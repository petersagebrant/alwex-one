import OpenAI from "openai";
import { getCurrentUser } from "@/lib/auth/require-user";
import { formatDateTimeSv } from "@/lib/format/date";
import { fetchBusinessAreas } from "@/lib/supabase/business-areas";
import type { BusinessAreaRow } from "@/lib/supabase/business-areas";
import { getActivities, type ActivityListItem } from "@/services/activities";
import { getDashboardData } from "@/services/dashboard";
import { getDecisions, type DecisionListItem } from "@/services/decisions";
import { getGoals, type GoalListItem } from "@/services/goals";
import { getKPIs, type KPIListItem } from "@/services/kpis";
import type { StatusTone } from "@/types";

const ASSISTANT_SYSTEM_PROMPT = `Du är VD-assistent för ALWEX ONE.

Du svarar som en erfaren VD-rådgivare: kort, skarp och beslutsinriktad.
Prioritera beslutsstöd framför sammanfattning.
Analysera och rekommendera — dumpa inte data.

Använd endast informationen i context.
Hitta inte på information. Om underlag saknas, säg det tydligt.
Namnge ansvarig person när det finns i datan.
Koppla ihop samband när flera datapunkter hör ihop.

Prioritera alltid:
1. Röda avvikelser och kritiska risker
2. Ekonomi och resultat mot budget
3. Gula KPI:er som behöver följas upp
4. Försenade aktiviteter och öppna beslut
5. Positiva utvecklingar och möjligheter

Längd och stil:
- Max 180–220 ord.
- Korta meningar. Undvik långa stycken och långa listor.
- Inga upprepningar. Samma KPI får inte nämnas flera gånger.
- Skriv på svenska.

Använd alltid exakt denna markdown-struktur:

## Övergripande läge
2–3 meningar.

## Viktigaste risker
Max 3 punkter.

## Positivt
Max 2 punkter.

## Mitt förslag idag
Tre konkreta rekommendationer.

Avsluta alltid med:
Vill du att jag utvecklar någon punkt?`;

export type AssistantDeviation = {
  type: "kpi" | "goal" | "activity" | "area" | "decision";
  status: StatusTone | "Försenad" | "Öppen";
  title: string;
  areaName: string;
  owner: string;
};

export type AssistantPriority = {
  label: string;
  reason: string;
  owner: string;
  areaName: string | null;
};

export type AssistantContext = {
  summary: {
    date: string;
    dateLabel: string;
    areaCount: number;
    kpiCounts: Record<StatusTone, number>;
    goalCounts: Record<StatusTone, number>;
    delayedActivityCount: number;
    openDecisionCount: number;
    dashboardSituation: string;
    vdSituation: string;
    vdPriority: string;
    vdPositiveSummary: string;
    responsiblePersons: string[];
    firstName: string | null;
  };
  businessAreas: BusinessAreaRow[];
  kpis: KPIListItem[];
  goals: GoalListItem[];
  activities: ActivityListItem[];
  decisions: DecisionListItem[];
  observations: string[];
  priorities: AssistantPriority[];
  yesterdayChanges: { id: string; text: string }[];
  /** Derived helpers used by rule-based answers. */
  openDeviations: AssistantDeviation[];
};

/**
 * Builds a complete operational briefing for every assistant question.
 */
export async function buildAssistantContext(): Promise<AssistantContext> {
  const [areas, kpis, goals, activities, decisions, dashboard, currentUser] =
    await Promise.all([
      fetchBusinessAreas().catch(() => [] as BusinessAreaRow[]),
      getKPIs().catch(() => [] as KPIListItem[]),
      getGoals().catch(() => [] as GoalListItem[]),
      getActivities().catch(() => [] as ActivityListItem[]),
      getDecisions().catch(() => [] as DecisionListItem[]),
      getDashboardData().catch(() => null),
      getCurrentUser().catch(() => null),
    ]);

  const businessAreas = areas ?? [];
  const allKpis = kpis ?? [];
  const allGoals = goals ?? [];
  const allActivities = activities ?? [];
  const allDecisions = decisions ?? [];

  const delayedActivities = allActivities.filter(isDelayedActivity);
  const openDecisions = allDecisions.filter(
    (decision) => decision.status !== "Klart",
  );
  const areaManagers = new Map(
    businessAreas.map((area) => [area.id, area.manager?.trim() || "Ej angiven"]),
  );

  const openDeviations = buildOpenDeviations({
    areas: businessAreas,
    kpis: allKpis,
    goals: allGoals,
    delayedActivities,
    openDecisions,
    areaManagers,
  });

  const vd = dashboard?.vdAssistant;
  const observations = [
    ...(vd?.observations ?? []),
    ...openDeviations.slice(0, 5).map(formatDeviationObservation),
  ].filter(Boolean);

  const uniqueObservations = [...new Set(observations)].slice(0, 8);

  const priorities = buildPriorities({
    kpis: allKpis,
    delayedActivities,
    openDecisions,
    areaManagers,
    vdPriority: vd?.priority ?? vd?.recommendation ?? "",
  });

  const responsiblePersons = [
    ...new Set(
      [
        ...businessAreas.map((area) => area.manager?.trim() || ""),
        ...allGoals.map((goal) => goal.owner?.trim() || ""),
        ...allActivities.map((activity) => activity.owner?.trim() || ""),
        ...allDecisions.map((decision) => decision.owner?.trim() || ""),
      ].filter((name) => name.length > 0),
    ),
  ].sort((a, b) => a.localeCompare(b, "sv"));

  const date = todayDateKey();
  const dateLabel = formatDateLabel(date);

  const kpiCounts = countStatuses(allKpis.map((kpi) => kpi.status));
  const goalCounts = countStatuses(allGoals.map((goal) => goal.status));

  const dashboardSituation =
    vd?.situation ||
    `${businessAreas.length} affärsområden · ${allKpis.length} KPI:er · ${allGoals.length} mål`;

  return {
    summary: {
      date,
      dateLabel,
      areaCount: businessAreas.length,
      kpiCounts,
      goalCounts,
      delayedActivityCount: delayedActivities.length,
      openDecisionCount: openDecisions.length,
      dashboardSituation,
      vdSituation: vd?.situation ?? vd?.intro ?? "",
      vdPriority: vd?.priority ?? vd?.recommendation ?? "",
      vdPositiveSummary: vd?.positiveSummary ?? "",
      responsiblePersons,
      firstName: firstNameFromEmail(currentUser?.email ?? null),
    },
    businessAreas,
    kpis: allKpis,
    goals: allGoals,
    activities: allActivities,
    decisions: allDecisions,
    observations: uniqueObservations,
    priorities,
    yesterdayChanges: dashboard?.yesterdayChanges ?? [],
    openDeviations,
  };
}

/**
 * Rule-based answers from the complete context object.
 * Later: replace this with OpenAI using the same AssistantContext.
 */
export async function generateAssistantAnswer(
  question: string,
  context: AssistantContext,
): Promise<string> {
  const q = normalizeText(question);
  if (!q) {
    return "Ställ en fråga om affärsområden, KPI:er, mål, aktiviteter eller beslut.";
  }

  if (isPriorityQuestion(q)) {
    return answerPriority(context);
  }

  if (isRedKpiQuestion(q)) {
    return answerRedKpis(context);
  }

  if (isDelayedActivityQuestion(q)) {
    return answerDelayedActivities(context);
  }

  if (isOpenDecisionQuestion(q)) {
    return answerOpenDecisions(context);
  }

  const area = findAreaInQuestion(q, context.businessAreas);
  if (area) {
    return answerAreaStatus(area, context);
  }

  return answerFallback(context);
}

/**
 * Builds full operational context, then asks GPT-5 for the answer.
 * UI depends only on: question in → answer string out.
 */
export async function askAssistant(question: string): Promise<string> {
  const trimmed = question.trim();
  if (!trimmed) {
    return "Skriv en fråga om verksamheten för att få svar.";
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY saknas. Lägg till nyckeln i .env.local.",
    );
  }

  const context = await buildAssistantContext();

  try {
    const client = new OpenAI({ apiKey });
    const completion = await client.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: ASSISTANT_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Context:\n${JSON.stringify(context)}\n\nFråga:\n${trimmed}`,
        },
      ],
    });

    const answer = completion.choices[0]?.message?.content?.trim();
    if (!answer) {
      throw new Error("OpenAI returnerade inget svar.");
    }

    return answer;
  } catch (error) {
    console.error(error);
    return "AI-assistenten är tillfälligt upptagen och kunde inte generera analysen just nu. Försök igen om någon minut.";
  }
}

const BRIEFING_SYSTEM_PROMPT = `Du är COO-rådgivare för ALWEX ONE och förbereder VD inför dagen.

Skriv som en erfaren COO: kort, skarp, affärsmässig. Beslutsstöd framför datadump.
Använd endast informationen i context. Hitta inte på något.
Skriv på svenska. Max 200 ord.

Regler:
1. Börja med hälsning och därefter 2–3 korta meningar. Inga långa stycken.
2. Varje punkt = en kort mening (max ca 12 ord).
3. Om ansvarig finns: skriv på egen rad under punkten, exakt "Ansvarig: Namn".
4. Prioritera affärsrisk. Gruppera när flera KPI hör ihop.
5. Inga upprepningar.
6. Använd exakt rubrikerna nedan (inklusive emoji).
7. Håll maxgränserna strikt.

Använd exakt denna struktur (markdown):

God morgon {förnamn}.

[2–3 korta meningar — ingen egen rubrik]

## 🔴 Viktigaste idag
Max 3 punkter.

## 🟢 Positiv utveckling
Max 3 punkter.

## ⚠ Risk kommande två veckor
Max 2 punkter.

## ✅ Mina tre rekommendationer idag
Exakt 3 korta åtgärder. Ansvarig på egen rad när namn finns.

## Analysen bygger på
- X affärsområden
- Y KPI
- Z mål
- A aktiviteter
- B beslut

Skapad: [tidstämpel]`;

const VD_BRIEFING_CACHE_TTL_MS = 15 * 60 * 1000;
/** Background AI upgrade must finish within 8 seconds or local briefing is kept. */
const VD_BRIEFING_OPENAI_TIMEOUT_MS = 8_000;
/** Bump when briefing format changes so stale AI cache is not shown. */
const VD_BRIEFING_CACHE_VERSION = 2;

type VdBriefingCacheEntry = {
  content: string;
  expiresAt: number;
  version: number;
};

let vdBriefingCache: VdBriefingCacheEntry | null = null;
let vdBriefingInFlight: Promise<string> | null = null;

/** Sync read of a still-valid AI briefing cache entry. */
export function getCachedVdBriefing(): string | null {
  if (
    vdBriefingCache &&
    vdBriefingCache.version === VD_BRIEFING_CACHE_VERSION &&
    vdBriefingCache.expiresAt > Date.now() &&
    vdBriefingCache.content
  ) {
    return vdBriefingCache.content;
  }
  return null;
}

export type LocalVdBriefingInput = {
  firstName?: string | null;
  /** Kort sammanfattning (2–3 meningar), redan byggd från dashboarddata. */
  summaryText?: string | null;
  followUpKpis?: Array<{
    name?: string | null;
    area?: string | null;
    status?: StatusTone | null;
    owner?: string | null;
  }> | null;
  greenAreaNames?: Array<string | null> | null;
  delayedActivities?: Array<{
    title?: string | null;
    area?: string | null;
    owner?: string | null;
    deadline?: string | null;
  }> | null;
  openDecisions?: Array<{
    title?: string | null;
    area?: string | null;
    owner?: string | null;
    dueDate?: string | null;
  }> | null;
  actionGoals?: Array<{
    goal?: string | null;
    area?: string | null;
    owner?: string | null;
    status?: StatusTone | null;
  }> | null;
  delayedActivityCount?: number | null;
  openDecisionCount?: number | null;
  priorityText?: string | null;
  positiveSummary?: string | null;
  counts?: {
    areas?: number | null;
    kpis?: number | null;
    goals?: number | null;
    activities?: number | null;
    decisions?: number | null;
  } | null;
  analyzedAtLabel?: string | null;
};

function cleanOwner(owner: string | null | undefined): string | null {
  const name = owner?.trim();
  if (!name || name === "Ej angiven") {
    return null;
  }
  return name;
}

/** Formats a bullet; optional owner becomes its own markdown line. */
function formatBriefingBullet(
  text: string,
  owner?: string | null,
): string {
  const line = text?.trim() || "Punkt saknas.";
  const name = cleanOwner(owner);
  if (name) {
    return `- ${line}\n  Ansvarig: ${name}`;
  }
  return `- ${line}`;
}

function toShortSummary(raw: string | null | undefined): string {
  const text = raw?.trim() ?? "";
  if (!text) {
    return "Läget följs upp via KPI, mål och aktiviteter. Fokusera på avvikelser först.";
  }
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3)
    .map((sentence) => {
      if (sentence.length <= 110) {
        return sentence;
      }
      return `${sentence.slice(0, 107).trim()}…`;
    });
  return sentences.join(" ");
}

/**
 * Instant, rule-based briefing from data already on the dashboard.
 * No OpenAI. Safe to render in the initial HTML response.
 */
export function buildLocalVdBriefing(
  input?: LocalVdBriefingInput | null,
): string {
  const data = input ?? {};
  const firstName = data.firstName?.trim() || "Peter";
  const followUp = (data.followUpKpis ?? []).filter(Boolean);
  const redKpis = followUp.filter((kpi) => kpi?.status === "Röd");
  const yellowKpis = followUp.filter((kpi) => kpi?.status === "Gul");
  const delayed = (data.delayedActivities ?? []).filter(Boolean);
  const decisions = (data.openDecisions ?? []).filter(Boolean);
  const goals = (data.actionGoals ?? []).filter(Boolean);
  const delayedCount = data.delayedActivityCount ?? 0;
  const openDecisionCount = data.openDecisionCount ?? 0;

  const summary = toShortSummary(data.summaryText);

  type Bullet = { text: string; owner?: string | null };
  const important: Bullet[] = [];

  if (redKpis[0]) {
    important.push({
      text: `${redKpis[0].area ?? "Område"}: negativ avvikelse i ${redKpis[0].name ?? "KPI"}.`,
      owner: redKpis[0].owner,
    });
  }

  const yellowByArea = new Map<string, typeof yellowKpis>();
  for (const kpi of yellowKpis) {
    const area = kpi?.area?.trim() || "Okänt område";
    const list = yellowByArea.get(area) ?? [];
    list.push(kpi);
    yellowByArea.set(area, list);
  }

  for (const [area, areaKpis] of yellowByArea) {
    if (important.length >= 3) {
      break;
    }
    if (redKpis.some((kpi) => (kpi?.area?.trim() || "") === area)) {
      continue;
    }
    const names = areaKpis.map((kpi) => (kpi?.name ?? "").toLowerCase());
    const hasResultat = names.some((name) => name.includes("resultat"));
    const owner = areaKpis[0]?.owner;
    if (areaKpis.length >= 2) {
      important.push({
        text: `${area}: flera gula KPI kräver uppföljning.`,
        owner,
      });
    } else if (hasResultat) {
      important.push({ text: `${area} ligger under budget.`, owner });
    } else {
      important.push({
        text: `${area}: ${areaKpis[0]?.name ?? "KPI"} behöver följas upp.`,
        owner,
      });
    }
  }

  if (important.length < 3 && delayed[0]) {
    important.push({
      text: `Försenad aktivitet: ${delayed[0].title ?? "utan titel"}.`,
      owner: delayed[0].owner,
    });
  } else if (important.length < 3 && delayedCount > 0) {
    important.push({
      text:
        delayedCount === 1
          ? "1 aktivitet är försenad."
          : `${delayedCount} aktiviteter är försenade.`,
    });
  }

  if (important.length < 3 && decisions[0]) {
    important.push({
      text: `Öppet beslut: ${decisions[0].title ?? "utan titel"}.`,
      owner: decisions[0].owner,
    });
  } else if (important.length < 3 && openDecisionCount > 0) {
    important.push({
      text:
        openDecisionCount === 1
          ? "1 öppet beslut kräver uppföljning."
          : `${openDecisionCount} öppna beslut kräver uppföljning.`,
    });
  }

  if (important.length === 0) {
    important.push({ text: "Inga kritiska avvikelser i dagens underlag." });
  }

  const positives: Bullet[] = [];
  for (const name of (data.greenAreaNames ?? []).filter(Boolean).slice(0, 3)) {
    positives.push({ text: `${name} utvecklas enligt plan.` });
  }
  if (positives.length === 0) {
    const fallback = data.positiveSummary?.trim();
    positives.push({
      text: fallback
        ? toShortSummary(fallback).split(/(?<=[.!?])\s+/)[0] ?? fallback
        : "Stabil utveckling i gröna områden.",
    });
  }

  const risks: Bullet[] = [];
  if (delayed[0]) {
    risks.push({
      text:
        delayed.length === 1
          ? `Försenad aktivitet kan eskalera: ${delayed[0].title ?? "aktivitet"}.`
          : `${delayed.length} försenade aktiviteter kan eskalera.`,
      owner: delayed[0].owner,
    });
  }
  if (risks.length < 2 && decisions[0]) {
    const due =
      decisions[0].dueDate && decisions[0].dueDate !== "—"
        ? ` Förfaller ${decisions[0].dueDate}.`
        : "";
    risks.push({
      text: `Öppet beslut kan bromsa: ${decisions[0].title ?? "beslut"}.${due}`,
      owner: decisions[0].owner,
    });
  }
  if (risks.length < 2) {
    const redOrYellowGoal = goals.find(
      (goal) => goal?.status === "Röd" || goal?.status === "Gul",
    );
    if (redOrYellowGoal) {
      risks.push({
        text: `Målrisk i ${redOrYellowGoal.area ?? "område"}: ${redOrYellowGoal.goal ?? "mål"}.`,
        owner: redOrYellowGoal.owner,
      });
    }
  }
  if (risks.length === 0) {
    risks.push({ text: "Inga tydliga tvåveckorsrisker just nu." });
  }

  const recommendations: Bullet[] = [];
  const topKpi = redKpis[0] ?? yellowKpis[0];
  if (topKpi) {
    recommendations.push({
      text: `Följ upp ${topKpi.name ?? "KPI"} i ${topKpi.area ?? "området"}.`,
      owner: topKpi.owner,
    });
  }
  if (recommendations.length < 3 && delayed[0]) {
    recommendations.push({
      text: `Lås nästa steg för ${delayed[0].title ?? "försenad aktivitet"}.`,
      owner: delayed[0].owner,
    });
  }
  if (recommendations.length < 3 && decisions[0]) {
    recommendations.push({
      text: `Stäng beslutet ${decisions[0].title ?? "öppet beslut"}.`,
      owner: decisions[0].owner,
    });
  }
  if (recommendations.length < 3 && goals[0]) {
    recommendations.push({
      text: `Följ upp målet ${goals[0].goal ?? "prioriterat mål"}.`,
      owner: goals[0].owner,
    });
  }
  if (recommendations.length === 0) {
    const fromPriority = data.priorityText
      ?.replace(/^Prioritet idag:\s*/i, "")
      ?.trim();
    if (fromPriority) {
      recommendations.push({
        text:
          toShortSummary(fromPriority).split(/(?<=[.!?])\s+/)[0] ??
          fromPriority,
      });
    }
  }
  const fallbackRecs = [
    "Behåll översikten på gula och röda signaler.",
    "Bekräfta ansvar och deadline för öppna beslut.",
    "Stäm av gröna områden kort.",
  ];
  while (recommendations.length < 3) {
    recommendations.push({ text: fallbackRecs[recommendations.length]! });
  }

  const counts = data.counts ?? {};
  const areas = counts.areas ?? 0;
  const kpis = counts.kpis ?? 0;
  const goalCount = counts.goals ?? 0;
  const activities = counts.activities ?? 0;
  const decisionCount = counts.decisions ?? 0;

  return [
    `God morgon ${firstName}.`,
    "",
    summary,
    "",
    "## 🔴 Viktigaste idag",
    ...important
      .slice(0, 3)
      .map((item) => formatBriefingBullet(item.text, item.owner)),
    "",
    "## 🟢 Positiv utveckling",
    ...positives
      .slice(0, 3)
      .map((item) => formatBriefingBullet(item.text, item.owner)),
    "",
    "## ⚠ Risk kommande två veckor",
    ...risks
      .slice(0, 2)
      .map((item) => formatBriefingBullet(item.text, item.owner)),
    "",
    "## ✅ Mina tre rekommendationer idag",
    ...recommendations
      .slice(0, 3)
      .map((item) => formatBriefingBullet(item.text, item.owner)),
    "",
    "## Analysen bygger på",
    `- ${areas} affärsområden`,
    `- ${kpis} KPI`,
    `- ${goalCount} mål`,
    `- ${activities} aktiviteter`,
    `- ${decisionCount} beslut`,
    "",
    `Skapad: ${data.analyzedAtLabel?.trim() || "nyss"}`,
  ].join("\n");
}

/**
 * Returns cached AI briefing when valid; otherwise generates via OpenAI (8s timeout).
 * Uses singleflight so concurrent callers share one OpenAI request.
 */
export async function generateVdBriefing(): Promise<string> {
  const cached = getCachedVdBriefing();
  if (cached) {
    return cached;
  }

  if (vdBriefingInFlight) {
    return vdBriefingInFlight;
  }

  vdBriefingInFlight = (async () => {
    try {
      const content = await generateVdBriefingFromOpenAI();
      vdBriefingCache = {
        content,
        expiresAt: Date.now() + VD_BRIEFING_CACHE_TTL_MS,
        version: VD_BRIEFING_CACHE_VERSION,
      };
      return content;
    } finally {
      vdBriefingInFlight = null;
    }
  })();

  return vdBriefingInFlight;
}

async function generateVdBriefingFromOpenAI(): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY saknas. Lägg till nyckeln i .env.local.",
    );
  }

  const context = await buildAssistantContext();
  const firstName = context.summary.firstName ?? "Peter";
  const createdAtLabel = formatDateTimeSv(new Date().toISOString());

  const client = new OpenAI({
    apiKey,
    timeout: VD_BRIEFING_OPENAI_TIMEOUT_MS,
    maxRetries: 0,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, VD_BRIEFING_OPENAI_TIMEOUT_MS);

  try {
    const completion = await client.chat.completions.create(
      {
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: BRIEFING_SYSTEM_PROMPT.replace("{förnamn}", firstName),
          },
          {
            role: "user",
            content: `Context:\n${JSON.stringify(context)}\n\nUppgift:\nSkriv morgonbriefingen för dashboarden.\nAnvänd exakt denna tidstämpel i foten: Skapad: ${createdAtLabel}\nRäkna antal från context: affärsområden, KPI, mål, aktiviteter, beslut.`,
          },
        ],
      },
      { signal: controller.signal },
    );

    const briefing = completion.choices[0]?.message?.content?.trim();
    if (!briefing) {
      throw new Error("OpenAI returnerade ingen briefing.");
    }

    return briefing;
  } catch (error) {
    if (
      controller.signal.aborted ||
      (error instanceof Error &&
        (error.name === "AbortError" ||
          error.message.toLowerCase().includes("timeout") ||
          error.message.toLowerCase().includes("aborted")))
    ) {
      throw new Error("VD Briefing OpenAI timeout");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function firstNameFromEmail(email: string | null): string | null {
  if (!email) {
    return null;
  }
  const local = email.split("@")[0]?.trim();
  if (!local) {
    return null;
  }
  const token = local.split(/[._-]/)[0] ?? local;
  if (!token) {
    return null;
  }
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
}

function todayDateKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) {
    return dateKey;
  }
  return new Intl.DateTimeFormat("sv-SE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function isDelayedActivity(activity: ActivityListItem): boolean {
  if (activity.status === "Försenad") {
    return true;
  }
  if (activity.status === "Klar" || !activity.deadline) {
    return false;
  }
  return activity.deadline.slice(0, 10) < todayDateKey();
}

function buildOpenDeviations(input: {
  areas: BusinessAreaRow[];
  kpis: KPIListItem[];
  goals: GoalListItem[];
  delayedActivities: ActivityListItem[];
  openDecisions: DecisionListItem[];
  areaManagers: Map<string, string>;
}): AssistantDeviation[] {
  const deviations: AssistantDeviation[] = [];

  for (const kpi of input.kpis) {
    if (kpi.status !== "Gul" && kpi.status !== "Röd") {
      continue;
    }
    deviations.push({
      type: "kpi",
      status: kpi.status,
      title: kpi.name,
      areaName: kpi.businessAreaName,
      owner: input.areaManagers.get(kpi.businessAreaId) ?? "Ej angiven",
    });
  }

  for (const goal of input.goals) {
    if (goal.status !== "Gul" && goal.status !== "Röd") {
      continue;
    }
    deviations.push({
      type: "goal",
      status: goal.status,
      title: goal.title,
      areaName: goal.businessAreaName,
      owner: goal.owner?.trim() || "Ej angiven",
    });
  }

  for (const activity of input.delayedActivities) {
    deviations.push({
      type: "activity",
      status: "Försenad",
      title: activity.title,
      areaName: activity.businessAreaName,
      owner: activity.owner?.trim() || "Ej angiven",
    });
  }

  for (const area of input.areas) {
    if (area.status !== "Gul" && area.status !== "Röd") {
      continue;
    }
    deviations.push({
      type: "area",
      status: area.status as StatusTone,
      title: area.name,
      areaName: area.name,
      owner: area.manager?.trim() || "Ej angiven",
    });
  }

  for (const decision of input.openDecisions) {
    deviations.push({
      type: "decision",
      status: "Öppen",
      title: decision.title,
      areaName: decision.businessAreaName,
      owner: decision.owner?.trim() || "Ej angiven",
    });
  }

  return deviations.sort((a, b) => {
    const rank = (status: AssistantDeviation["status"]) => {
      if (status === "Röd" || status === "Försenad") return 0;
      if (status === "Gul") return 1;
      return 2;
    };
    return rank(a.status) - rank(b.status);
  });
}

function formatDeviationObservation(deviation: AssistantDeviation): string {
  if (deviation.type === "kpi") {
    return `${deviation.areaName}: KPI:n ${deviation.title} är ${deviation.status.toLowerCase()}.`;
  }
  if (deviation.type === "goal") {
    return `Målet "${deviation.title}" i ${deviation.areaName} är ${deviation.status.toLowerCase()}.`;
  }
  if (deviation.type === "activity") {
    return `Aktiviteten "${deviation.title}" i ${deviation.areaName} är försenad.`;
  }
  if (deviation.type === "area") {
    return `${deviation.areaName} har ${deviation.status.toLowerCase()} status.`;
  }
  return `Öppet beslut: "${deviation.title}" (${deviation.areaName}).`;
}

function buildPriorities(input: {
  kpis: KPIListItem[];
  delayedActivities: ActivityListItem[];
  openDecisions: DecisionListItem[];
  areaManagers: Map<string, string>;
  vdPriority: string;
}): AssistantPriority[] {
  const priorities: AssistantPriority[] = [];

  const topKpi =
    input.kpis.find((kpi) => kpi.status === "Röd") ??
    input.kpis.find((kpi) => kpi.status === "Gul") ??
    null;

  if (topKpi) {
    priorities.push({
      label: `Följ upp KPI:n ${topKpi.name}`,
      reason: `KPI-status ${topKpi.status}`,
      owner: input.areaManagers.get(topKpi.businessAreaId) ?? "Ej angiven",
      areaName: topKpi.businessAreaName,
    });
  }

  const delayed = input.delayedActivities[0];
  if (delayed) {
    priorities.push({
      label: `Säkra nästa steg för "${delayed.title}"`,
      reason: "Försenad aktivitet",
      owner: delayed.owner?.trim() || "Ej angiven",
      areaName: delayed.businessAreaName,
    });
  }

  if (input.openDecisions.length > 0) {
    const decision = input.openDecisions[0]!;
    priorities.push({
      label: `Driv beslutet "${decision.title}" framåt`,
      reason: "Öppet beslut",
      owner: decision.owner?.trim() || "Ej angiven",
      areaName: decision.businessAreaName,
    });
  }

  if (priorities.length === 0 && input.vdPriority.trim()) {
    priorities.push({
      label: input.vdPriority.replace(/^Prioritet idag:\s*/i, "").trim(),
      reason: "VD-analys",
      owner: "Ej angiven",
      areaName: null,
    });
  }

  return priorities;
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/&/g, " och ");
}

function isPriorityQuestion(q: string): boolean {
  return (
    q.includes("prioritera") ||
    q.includes("prioritet") ||
    q.includes("viktigast idag") ||
    q.includes("fokusera pa")
  );
}

function isRedKpiQuestion(q: string): boolean {
  const mentionsKpi = q.includes("kpi") || q.includes("nyckeltal");
  const mentionsRed = q.includes("roda") || q.includes("rod");
  return mentionsKpi && mentionsRed;
}

function isDelayedActivityQuestion(q: string): boolean {
  return q.includes("forsenade") || q.includes("forsenad");
}

function isOpenDecisionQuestion(q: string): boolean {
  return (
    (q.includes("beslut") || q.includes("besluten")) &&
    (q.includes("oppna") ||
      q.includes("oppet") ||
      q.includes("finns") ||
      q.includes("vilka"))
  );
}

function findAreaInQuestion(
  q: string,
  areas: BusinessAreaRow[],
): BusinessAreaRow | null {
  let best: BusinessAreaRow | null = null;
  let bestScore = 0;

  for (const area of areas ?? []) {
    const name = normalizeText(area.name);
    const slug = normalizeText(area.slug.replace(/-/g, " "));
    if (name && q.includes(name) && name.length > bestScore) {
      best = area;
      bestScore = name.length;
      continue;
    }
    if (slug && q.includes(slug) && slug.length > bestScore) {
      best = area;
      bestScore = slug.length;
    }
    const tokens = name.split(/\s+/).filter((t) => t.length >= 4);
    for (const token of tokens) {
      if (q.includes(token) && token.length > bestScore) {
        best = area;
        bestScore = token.length;
      }
    }
  }

  return best;
}

function formatKpiLine(kpi: KPIListItem): string {
  const value = [kpi.currentValue, kpi.unit].filter(Boolean).join(" ");
  const target = kpi.targetValue
    ? ` (mål ${kpi.targetValue}${kpi.unit ? ` ${kpi.unit}` : ""})`
    : "";
  return `• ${kpi.name}: ${value || "—"}${target} — ${kpi.status}`;
}

function answerPriority(context: AssistantContext): string {
  if (context.summary.vdPriority.trim()) {
    return context.summary.vdPriority;
  }

  const top = context.priorities[0];
  if (!top) {
    return "Inga kritiska avvikelser finns just nu.";
  }

  return `Prioritet idag:\n${top.label} tillsammans med ${top.owner}.`;
}

function answerRedKpis(context: AssistantContext): string {
  const red = (context.kpis ?? []).filter((kpi) => kpi.status === "Röd");
  if (red.length === 0) {
    return "Inga KPI:er är röda just nu.";
  }

  const lines = red.map((kpi) => {
    const area = kpi.businessAreaName || "Okänt område";
    return `• ${kpi.name} (${area}): ${[kpi.currentValue, kpi.unit].filter(Boolean).join(" ") || "—"}`;
  });

  return `Röda KPI:er (${red.length}):\n${lines.join("\n")}`;
}

function answerDelayedActivities(context: AssistantContext): string {
  const delayed = (context.activities ?? []).filter(isDelayedActivity);
  if (delayed.length === 0) {
    return "Inga aktiviteter är försenade just nu.";
  }

  const lines = delayed.map((activity) => {
    const deadline = activity.deadline
      ? activity.deadline.slice(0, 10)
      : "saknar deadline";
    return `• ${activity.title} (${activity.businessAreaName}) — deadline ${deadline}, ägare ${activity.owner ?? "Ej angiven"}`;
  });

  return `Försenade aktiviteter (${delayed.length}):\n${lines.join("\n")}`;
}

function answerOpenDecisions(context: AssistantContext): string {
  const open = (context.decisions ?? []).filter(
    (decision) => decision.status !== "Klart",
  );
  if (open.length === 0) {
    return "Inga öppna beslut just nu.";
  }

  const lines = open.map((decision) => {
    const when =
      decision.dueDate?.slice(0, 10) ??
      decision.meetingDate?.slice(0, 10) ??
      "utan datum";
    return `• ${decision.title} (${decision.businessAreaName}) — ${decision.status}, ${when}`;
  });

  return `Öppna beslut (${open.length}):\n${lines.join("\n")}`;
}

function answerAreaStatus(
  area: BusinessAreaRow,
  context: AssistantContext,
): string {
  const areaKpis = (context.kpis ?? []).filter(
    (kpi) => kpi.businessAreaId === area.id,
  );
  const areaGoals = (context.goals ?? []).filter(
    (goal) => goal.businessAreaId === area.id,
  );
  const areaActivities = (context.activities ?? []).filter(
    (activity) => activity.businessAreaId === area.id,
  );
  const delayed = areaActivities.filter(isDelayedActivity);
  const openDecisions = (context.decisions ?? []).filter(
    (decision) =>
      decision.businessAreaId === area.id && decision.status !== "Klart",
  );

  const statusCounts = countStatuses(areaKpis.map((kpi) => kpi.status));
  const lines: string[] = [
    `${area.name} har status ${area.status}.`,
    `Ansvarig: ${area.manager?.trim() || "Ej angiven"}.`,
    `KPI: ${statusCounts.Grön} gröna, ${statusCounts.Gul} gula, ${statusCounts.Röd} röda.`,
  ];

  if (areaKpis.length > 0) {
    lines.push("", "Nyckeltal:");
    for (const kpi of areaKpis) {
      lines.push(formatKpiLine(kpi));
    }
  }

  const followGoals = areaGoals.filter(
    (goal) => goal.status === "Gul" || goal.status === "Röd",
  );
  if (followGoals.length > 0) {
    lines.push("", "Mål som kräver uppföljning:");
    for (const goal of followGoals) {
      lines.push(`• ${goal.title} — ${goal.status}`);
    }
  } else if (areaGoals.length > 0) {
    lines.push("", `Alla ${areaGoals.length} mål ligger utan röd/gul markering.`);
  }

  if (delayed.length > 0) {
    lines.push("", `Försenade aktiviteter: ${delayed.length}.`);
  } else {
    lines.push("", "Inga försenade aktiviteter i området.");
  }

  if (openDecisions.length > 0) {
    lines.push(`Öppna beslut: ${openDecisions.length}.`);
  }

  const areaDeviations = (context.openDeviations ?? []).filter(
    (deviation) => deviation.areaName === area.name,
  );
  if (areaDeviations.length > 0) {
    lines.push("", "Öppna avvikelser:");
    for (const deviation of areaDeviations.slice(0, 4)) {
      lines.push(`• ${deviation.title} (${deviation.status})`);
    }
  }

  return lines.join("\n");
}

function answerFallback(context: AssistantContext): string {
  const parts: string[] = [
    `Datum: ${context.summary.dateLabel}.`,
    context.summary.vdSituation || context.summary.dashboardSituation,
  ];

  if (context.summary.vdPriority) {
    parts.push("", context.summary.vdPriority);
  } else if (context.priorities[0]) {
    parts.push(
      "",
      `Prioritet idag: ${context.priorities[0].label} (${context.priorities[0].owner}).`,
    );
  }

  if ((context.observations ?? []).length > 0) {
    parts.push("", "Observationer:");
    for (const observation of context.observations.slice(0, 3)) {
      parts.push(`• ${observation}`);
    }
  }

  if (context.summary.vdPositiveSummary) {
    parts.push("", context.summary.vdPositiveSummary);
  }

  if (context.openDeviations.length > 0) {
    parts.push(
      "",
      `Öppna avvikelser just nu: ${context.openDeviations.length}.`,
    );
  }

  parts.push(
    "",
    "Du kan fråga till exempel: \"Hur går Recycling?\", \"Vilka KPI är röda?\" eller \"Vad ska jag prioritera idag?\".",
  );

  return parts.join("\n");
}

function countStatuses(statuses: StatusTone[]): Record<StatusTone, number> {
  return {
    Grön: statuses.filter((status) => status === "Grön").length,
    Gul: statuses.filter((status) => status === "Gul").length,
    Röd: statuses.filter((status) => status === "Röd").length,
  };
}
