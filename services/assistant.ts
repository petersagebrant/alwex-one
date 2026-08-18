import OpenAI from "openai";
import { getCurrentUser } from "@/lib/auth/require-user";
import { formatDateTimeSv } from "@/lib/format/date";
import {
  countTargetKpiStatuses,
  isStatusTone,
  isTargetKpi,
  type KpiStoredStatus,
} from "@/lib/kpi/kind";
import { isExcludedFromVdAttention } from "@/lib/kpi/vdAttentionFilter";
import { fetchBusinessAreas } from "@/lib/supabase/business-areas";
import type { BusinessAreaRow } from "@/lib/supabase/business-areas";
import { getActivities, type ActivityListItem } from "@/services/activities";
import { getAuditLogSince, type AuditLogListItem } from "@/services/auditLog";
import { getDashboardData } from "@/services/dashboard";
import { getDecisions, type DecisionListItem } from "@/services/decisions";
import { getGoals, type GoalListItem } from "@/services/goals";
import { getKPIs, type KPIListItem } from "@/services/kpis";
import {
  getRecentKpiHistoryForKpis,
} from "@/services/kpiHistory";
import type { AuditFieldChange, KPIHistory, StatusTone } from "@/types";

const INSUFFICIENT_HISTORY =
  "Det finns inte tillräckligt historiskt underlag för att bedöma trenden.";

const ASSISTANT_SYSTEM_PROMPT_BROAD = `Du är VD-assistent för LEIR.

Svara kort, skarpt och beslutsinriktat. Max 120–160 ord.
Svara direkt på frågan först. Inga upprepningar. Samma KPI får nämnas högst en gång.
Använd endast context. Hitta inte på orsaker eller siffror.
Om samband syns men orsaken inte är säker, skriv t.ex.:
"Tillgänglig data visar ett samband mellan X och Y, men fastställer inte den bakomliggande orsaken."
Om orsaken saknas helt: "Orsaken framgår inte av tillgänglig data."
Namnge ansvarig när namn finns i context.

Struktur (markdown):

## Övergripande läge
2–3 korta meningar.

## Viktigaste risker
Max 3 punkter.

## Positivt
Max 2 punkter.

## Mitt förslag idag
Max 3 konkreta rekommendationer.

Avsluta med: Vill du att jag utvecklar någon punkt?`;

const ASSISTANT_SYSTEM_PROMPT_AREA = `Du är VD-assistent för LEIR.

Svara kort, skarpt och beslutsinriktat. Max 120–160 ord.
Svara direkt på frågan först. Inga upprepningar. Samma KPI får nämnas högst en gång.
Använd endast context för det aktuella affärsområdet. Hitta inte på orsaker eller siffror.
Om samband syns men orsaken inte är säker, skriv t.ex.:
"Tillgänglig data visar ett samband mellan låg beläggning och svagt resultat, men fastställer inte den bakomliggande orsaken."
Om orsaken saknas helt: "Orsaken framgår inte av tillgänglig data."
Namnge ansvarig när namn finns i context.
Använd analysisInsights om de finns — lägg inte till nya orsaker.

Struktur (markdown) — använd exakt dessa rubriker:

## Kort svar
1–2 meningar som direkt förklarar läget.

## Det som driver avvikelsen
Max 3 punkter.

## Min rekommendation
Max 2 konkreta åtgärder.`;

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

/** Datastödd kedja: vad → varför → konsekvens → åtgärd → ansvarig. */
export type AssistantAnalysisInsight = {
  areaName: string;
  owner: string;
  whatHappened: string;
  whyImportant: string;
  consequence: string;
  action: string;
  linkedSignals: string[];
  /** True när data inte räcker för att förklara orsaken. */
  causeUnknown: boolean;
};

export type AssistantTrendDirection =
  | "bättre"
  | "sämre"
  | "oförändrad"
  | "okänd";

export type AssistantKpiTrend = {
  kpiId: string;
  name: string;
  areaId: string;
  areaName: string;
  previousValue: string | null;
  currentValue: string | null;
  previousStatus: KpiStoredStatus | null;
  currentStatus: KpiStoredStatus;
  unit: string | null;
  direction: AssistantTrendDirection;
  previousRecordedAt: string | null;
  currentRecordedAt: string | null;
};

export type AssistantEntityChange = {
  entityType: "area" | "kpi" | "goal" | "activity" | "decision" | "other";
  entityId: string | null;
  title: string;
  areaId: string | null;
  areaName: string | null;
  description: string;
  action: string;
  at: string;
  /** Structured from/to field diffs when available. */
  fields: AuditFieldChange[];
};

/** Latest known change per KPI for LOCAL "när ändrades … senast"-frågor. */
export type AssistantKpiLastChange = {
  kpiId: string;
  name: string;
  areaId: string;
  areaName: string;
  lastChangedAt: string | null;
  previousValue: string | null;
  currentValue: string | null;
  previousStatus: KpiStoredStatus | null;
  currentStatus: KpiStoredStatus;
  unit: string | null;
  source: "kpi_history" | "audit_log" | "updated_at" | "none";
};

export type AssistantAreaTrendSummary = {
  areaId: string;
  areaName: string;
  direction: AssistantTrendDirection;
  worsenedCount: number;
  improvedCount: number;
  highlights: string[];
};

export type AssistantTrendWindow = {
  key: "yesterday" | "week" | "monday";
  label: string;
  sinceIso: string;
  kpiTrends: AssistantKpiTrend[];
  worsenedKpis: AssistantKpiTrend[];
  improvedKpis: AssistantKpiTrend[];
  entityChanges: AssistantEntityChange[];
  areaSummaries: AssistantAreaTrendSummary[];
  hasEnoughHistory: boolean;
};

export type AssistantTrends = {
  sinceYesterday: AssistantTrendWindow;
  lastWeek: AssistantTrendWindow;
  sinceMonday: AssistantTrendWindow;
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
  /** Förberäknade samband mellan KPI/mål/aktivitet/beslut per område. */
  analysisInsights: AssistantAnalysisInsight[];
  /** Historik/trend från kpi_history + audit_log. */
  trends: AssistantTrends;
  /** Senaste kända ändring per KPI (för LOCAL tidpunktsfrågor). */
  kpiLastChanges: AssistantKpiLastChange[];
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

  const weekCutoff = daysAgoCutoff(7);
  const [auditSinceWeek, kpiHistoryRows] = await Promise.all([
    getAuditLogSince(weekCutoff, 150).catch(() => [] as AuditLogListItem[]),
    getRecentKpiHistoryForKpis(
      allKpis.map((kpi) => kpi.id),
      3,
    ).catch(() => [] as KPIHistory[]),
  ]);

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

  const analysisInsights = buildAnalysisInsights({
    areas: businessAreas,
    kpis: allKpis,
    goals: allGoals,
    delayedActivities,
    openDecisions,
    areaManagers,
  });

  const trends = buildAssistantTrends({
    areas: businessAreas,
    kpis: allKpis,
    goals: allGoals,
    activities: allActivities,
    decisions: allDecisions,
    auditEntries: auditSinceWeek ?? [],
    kpiHistory: kpiHistoryRows ?? [],
  });

  const kpiLastChanges = buildKpiLastChanges({
    kpis: allKpis,
    kpiHistory: kpiHistoryRows ?? [],
    auditEntries: auditSinceWeek ?? [],
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

  const kpiCounts = countTargetKpiStatuses(allKpis);
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
    analysisInsights,
    trends,
    kpiLastChanges,
    yesterdayChanges: dashboard?.yesterdayChanges ?? [],
    openDeviations,
  };
}

/**
 * Rule-based answers from the complete context object.
 */
export async function generateAssistantAnswer(
  question: string,
  context: AssistantContext,
): Promise<string> {
  return buildLocalAnswer(question, context);
}

/**
 * Routes the question to local, hybrid or AI answering.
 * OpenAI is only used when classification requires it.
 */
export async function askAssistant(question: string): Promise<string> {
  const totalStarted = Date.now();
  const trimmed = question.trim();
  if (!trimmed) {
    return "Skriv en fråga om verksamheten för att få svar.";
  }

  const questionType = classifyQuestion(trimmed);
  console.log(`Question type: ${questionType.toUpperCase()}`);

  const contextStarted = Date.now();
  const fullContext = await buildAssistantContext();
  console.log(
    `[askAssistant] buildAssistantContext: ${Date.now() - contextStarted}ms`,
  );

  try {
    let answer: string;
    if (questionType === "local") {
      answer = await answerLocal(trimmed, fullContext);
    } else if (questionType === "hybrid") {
      answer = await answerHybrid(trimmed, fullContext);
    } else {
      answer = await answerAI(trimmed, fullContext);
    }

    console.log(`[askAssistant] total askAssistant: ${Date.now() - totalStarted}ms`);
    return answer;
  } catch (error) {
    console.error(error);
    console.log(
      `[askAssistant] total askAssistant (error): ${Date.now() - totalStarted}ms`,
    );
    // LOCAL must still work if OpenAI path fails unexpectedly.
    try {
      return await answerLocal(trimmed, fullContext);
    } catch {
      return "AI-assistenten är tillfälligt upptagen och kunde inte generera analysen just nu. Försök igen om någon minut.";
    }
  }
}

export type AssistantQuestionType = "local" | "hybrid" | "ai";

/**
 * Classifies whether a question can be answered locally, needs a hybrid
 * local+OpenAI pass, or requires a full AI analysis.
 */
export function classifyQuestion(question: string): AssistantQuestionType {
  const q = normalizeText(question);
  if (!q) {
    return "local";
  }

  if (isAiQuestion(q)) {
    return "ai";
  }

  if (isHybridQuestion(q)) {
    return "hybrid";
  }

  if (isLocalQuestion(q)) {
    return "local";
  }

  // Unknown open-ended questions → AI.
  return "ai";
}

function isAiQuestion(q: string): boolean {
  return (
    q.includes("hur skulle du") ||
    q.includes("vilken strategi") ||
    q.includes("strategi") ||
    q.includes("vad missar jag") ||
    q.includes("ge en analys") ||
    q.includes("analysera") ||
    q.includes("sammanfatta") ||
    q.includes("framtid") ||
    q.includes("prognos") ||
    q.includes("ledningsmotet") ||
    q.includes("ledningsmote") ||
    q.includes("scenario") ||
    q.includes("rekommendera en plan")
  );
}

function isHybridQuestion(q: string): boolean {
  return (
    q.startsWith("varfor") ||
    q.includes(" varfor ") ||
    q.startsWith("hur paverkar") ||
    q.includes("hur paverkar") ||
    q.startsWith("vilka risker") ||
    q.includes("vilka risker") ||
    q.startsWith("vad betyder") ||
    q.includes("vad betyder")
  );
}

function isLocalTrendQuestion(q: string): boolean {
  if (isKpiLastChangedQuestion(q)) {
    return true;
  }

  if (
    q.includes("vilka kpi har forsamrats") ||
    q.includes("vilka kpi har forbattrats") ||
    q.includes("vilka nyckeltal har forsamrats") ||
    q.includes("vilka nyckeltal har forbattrats") ||
    q.includes("kpi har forsamrats") ||
    q.includes("kpi har forbattrats")
  ) {
    return true;
  }

  if (
    q.includes("vad har forandrats") ||
    q.includes("vad har andrats") ||
    q.includes("sedan igar") ||
    q.includes("sedan mandag") ||
    q.includes("senaste veckan") ||
    q.includes("senaste 7 dagarna")
  ) {
    return true;
  }

  if (
    q.includes("utvecklats") ||
    (q.includes("battre") && q.includes("samre")) ||
    q.includes("battre eller samre") ||
    q.includes("forsamrats") ||
    q.includes("forbattrats")
  ) {
    // "Varför har X försämrats" is hybrid (checked earlier).
    return !isHybridQuestion(q);
  }

  return false;
}

function isKpiLastChangedQuestion(q: string): boolean {
  const mentionsKpi = q.includes("kpi") || q.includes("nyckeltal");
  if (!mentionsKpi) {
    return false;
  }

  return (
    (q.includes("nar") && (q.includes("andrades") || q.includes("uppdaterades"))) ||
    q.includes("senast andrad") ||
    q.includes("senast andrades") ||
    q.includes("senast uppdaterad") ||
    q.includes("senast uppdaterades") ||
    (q.includes("senast") && (q.includes("andrad") || q.includes("andrats")))
  );
}

function isLocalQuestion(q: string): boolean {
  if (isLocalTrendQuestion(q)) {
    return true;
  }

  if (
    q.includes("hur gar") ||
    q.includes("hur gar det") ||
    q.includes("visa status") ||
    q.includes("status for") ||
    q.includes("status pa")
  ) {
    return true;
  }

  if (q.includes("hur manga") || q.includes("hur många")) {
    return true;
  }

  if (
    q.includes("vem ansvarar") ||
    q.includes("vem ar ansvarig") ||
    q.includes("ansvarig for") ||
    q.includes("vem ager")
  ) {
    return true;
  }

  if (
    (q.includes("kpi") || q.includes("nyckeltal")) &&
    (q.includes("roda") ||
      q.includes("rod") ||
      q.includes("gula") ||
      q.includes("gul") ||
      q.includes("uppfoljning") ||
      q.includes("foljas upp") ||
      q.includes("kraver"))
  ) {
    return true;
  }

  if (
    (q.includes("mal") || q.includes("malen")) &&
    (q.includes("sena") ||
      q.includes("sen") ||
      q.includes("forsenade") ||
      q.includes("gula") ||
      q.includes("roda"))
  ) {
    return true;
  }

  if (
    (q.includes("aktivitet") || q.includes("aktiviteter")) &&
    (q.includes("sena") ||
      q.includes("sen") ||
      q.includes("forsenade") ||
      q.includes("forsenad"))
  ) {
    return true;
  }

  if (
    (q.includes("beslut") || q.includes("besluten")) &&
    (q.includes("oppna") || q.includes("oppet") || q.includes("vilka"))
  ) {
    return true;
  }

  if (
    q.includes("belaggning") ||
    q.includes("belaggningen") ||
    q.includes("resultat mot budget") ||
    (q.includes("resultat") && q.includes("budget"))
  ) {
    return true;
  }

  if (isPriorityQuestion(q) && !isAiQuestion(q)) {
    return true;
  }

  return false;
}

/**
 * Answers factual questions directly from context — no OpenAI.
 */
export async function answerLocal(
  question: string,
  context: AssistantContext,
): Promise<string> {
  const started = Date.now();
  const answer = buildLocalAnswer(question, context);
  console.log(`[answerLocal] ${Date.now() - started}ms`);
  return answer;
}

/**
 * Builds a tight local fact summary, then asks OpenAI only to explain it.
 * Falls back to the local summary if OpenAI is unavailable.
 */
export async function answerHybrid(
  question: string,
  context: AssistantContext,
): Promise<string> {
  const localSummary = buildHybridLocalSummary(question, context);
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.log("[answerHybrid] OpenAI saknas — returnerar lokal sammanfattning");
    return localSummary;
  }

  try {
    const openaiStarted = Date.now();
    const client = new OpenAI({
      apiKey,
      timeout: 20_000,
      maxRetries: 0,
    });
    const completion = await client.chat.completions.create({
      model: "gpt-5",
      max_completion_tokens: 350,
      messages: [
        {
          role: "system",
          content: ASSISTANT_SYSTEM_PROMPT_AREA,
        },
        {
          role: "user",
          content: `Lokal analys (enda faktaunderlaget):\n${localSummary}\n\nFråga:\n${question}\n\nFörklara utifrån den lokala analysen. Hitta inte på orsaker. Max 120–160 ord.`,
        },
      ],
    });
    console.log(`[answerHybrid] OpenAI request: ${Date.now() - openaiStarted}ms`);

    const answer = completion.choices[0]?.message?.content?.trim();
    if (!answer) {
      return localSummary;
    }
    return answer;
  } catch (error) {
    console.error(error);
    console.log("[answerHybrid] OpenAI fel — returnerar lokal sammanfattning");
    return localSummary;
  }
}

/**
 * Full AI path with filtered context. Falls back to local answer if OpenAI fails.
 */
export async function answerAI(
  question: string,
  context: AssistantContext,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.log("[answerAI] OpenAI saknas — faller tillbaka till LOCAL");
    return answerLocal(question, context);
  }

  const filterStarted = Date.now();
  const { context: relevant, scope, areaName } = selectRelevantAssistantContext(
    question,
    context,
  );
  const openAiPayload = toCompactOpenAiContext(relevant, scope);
  console.log(
    `[answerAI] context filtering: ${Date.now() - filterStarted}ms (scope=${scope}${areaName ? ` area="${areaName}"` : ""}; payload=${JSON.stringify(openAiPayload).length} chars)`,
  );

  try {
    const openaiStarted = Date.now();
    const client = new OpenAI({
      apiKey,
      timeout: 25_000,
      maxRetries: 0,
    });
    const systemPrompt =
      scope === "area"
        ? ASSISTANT_SYSTEM_PROMPT_AREA
        : ASSISTANT_SYSTEM_PROMPT_BROAD;

    const completion = await client.chat.completions.create({
      model: "gpt-5",
      max_completion_tokens: 450,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `Context:\n${JSON.stringify(openAiPayload)}\n\nFråga:\n${question}\n\nSvara direkt på frågan. Max 120–160 ord. Hitta inte på orsaker.`,
        },
      ],
    });
    console.log(`[answerAI] OpenAI request: ${Date.now() - openaiStarted}ms`);

    const answer = completion.choices[0]?.message?.content?.trim();
    if (!answer) {
      return answerLocal(question, context);
    }
    return answer;
  } catch (error) {
    console.error(error);
    console.log("[answerAI] OpenAI fel — faller tillbaka till LOCAL");
    return answerLocal(question, context);
  }
}

function buildLocalAnswer(
  question: string,
  context: AssistantContext,
): string {
  const q = normalizeText(question);
  if (!q) {
    return "Ställ en fråga om affärsområden, KPI:er, mål, aktiviteter eller beslut.";
  }

  if (isLocalTrendQuestion(q) || isTrendIntentQuestion(q)) {
    return answerTrendQuestion(q, context);
  }

  if (isYellowKpiQuestion(q)) {
    return answerYellowKpis(context);
  }

  if (isRedKpiQuestion(q)) {
    return answerRedKpis(context);
  }

  if (isFollowUpKpiQuestion(q)) {
    return answerFollowUpKpis(context);
  }

  if (isLateGoalQuestion(q)) {
    return answerLateGoals(context);
  }

  if (isDelayedActivityQuestion(q)) {
    return answerDelayedActivities(context);
  }

  if (isOpenDecisionQuestion(q)) {
    return answerOpenDecisions(context);
  }

  if (isOwnerQuestion(q)) {
    return answerOwnerQuestion(q, context);
  }

  if (isCountQuestion(q)) {
    return answerCountQuestion(q, context);
  }

  if (isOccupancyQuestion(q) || isResultBudgetQuestion(q)) {
    return answerNamedKpiQuestion(q, context);
  }

  if (isPriorityQuestion(q)) {
    return answerPriority(context);
  }

  const area = findAreaInQuestion(q, context.businessAreas);
  if (area) {
    return answerAreaStatus(area, context);
  }

  if (q.includes("hur gar") || q.includes("visa status")) {
    return "Affärsområdet hittades inte i tillgänglig data.";
  }

  return answerFallback(context);
}

/** Compact factual briefing used as the only OpenAI input for hybrid questions. */
function buildHybridLocalSummary(
  question: string,
  context: AssistantContext,
): string {
  const q = normalizeText(question);
  const area = findAreaInQuestion(q, context.businessAreas);

  if (area) {
    const areaContext = filterContextToArea(context, area);
    const insight = (areaContext.analysisInsights ?? [])[0];
    const kpis = (areaContext.kpis ?? []).slice(0, 6);
    const lines: string[] = [
      `Område: ${area.name}`,
      `Status: ${area.status}`,
      `Ansvarig: ${area.manager?.trim() || "Ej angiven"}`,
      "",
      "KPI:",
      ...kpis.map((kpi) => `- ${formatKpiFact(kpi)}`),
    ];

    const goals = (areaContext.goals ?? [])
      .filter((goal) => goal.status === "Gul" || goal.status === "Röd")
      .slice(0, 4);
    if (goals.length > 0) {
      lines.push("", "Mål som kräver uppföljning:");
      for (const goal of goals) {
        lines.push(`- ${goal.title} (${goal.status})`);
      }
    }

    const delayed = (areaContext.activities ?? [])
      .filter(isDelayedActivity)
      .slice(0, 3);
    if (delayed.length > 0) {
      lines.push("", "Försenade aktiviteter:");
      for (const activity of delayed) {
        lines.push(
          `- ${activity.title} (${activity.owner?.trim() || "Ej angiven"})`,
        );
      }
    }

    const decisions = (areaContext.decisions ?? []).slice(0, 3);
    if (decisions.length > 0) {
      lines.push("", "Öppna beslut:");
      for (const decision of decisions) {
        lines.push(
          `- ${decision.title} (${decision.owner?.trim() || "Ej angiven"})`,
        );
      }
    }

    if (insight) {
      lines.push(
        "",
        "Lokal tolkning:",
        `- ${insight.whatHappened}`,
        `- ${insight.whyImportant}`,
        `- ${insight.consequence}`,
        `- Åtgärd: ${insight.action}`,
        insight.causeUnknown
          ? "- Orsaken framgår inte av tillgänglig data."
          : "- Samband syns i data; bakomliggande orsak är inte bevisad.",
      );
    }

    const trendWindow = pickTrendWindow(
      areaContext.trends,
      normalizeText(question),
    );
    const areaTrend = trendWindow.areaSummaries.find(
      (item) => item.areaId === area.id,
    );
    if (areaTrend && trendWindow.hasEnoughHistory) {
      lines.push(
        "",
        `Trend ${trendWindow.label}:`,
        `- Riktning: ${areaTrend.direction}`,
        ...areaTrend.highlights.slice(0, 3).map((line) => `- ${line}`),
      );
    } else if (isTrendIntentQuestion(normalizeText(question))) {
      lines.push(
        "",
        "Trend:",
        "- Det finns inte tillräckligt historiskt underlag för att bedöma trenden.",
      );
    }

    return lines.join("\n");
  }

  return buildLocalAnswer(question, context);
}

function isYellowKpiQuestion(q: string): boolean {
  const mentionsKpi = q.includes("kpi") || q.includes("nyckeltal");
  const mentionsYellow = q.includes("gula") || q.includes("gul");
  return mentionsKpi && mentionsYellow;
}

function isFollowUpKpiQuestion(q: string): boolean {
  const mentionsKpi = q.includes("kpi") || q.includes("nyckeltal");
  return (
    mentionsKpi &&
    (q.includes("uppfoljning") ||
      q.includes("foljas upp") ||
      q.includes("kraver") ||
      q.includes("folja upp"))
  );
}

function isLateGoalQuestion(q: string): boolean {
  const mentionsGoal = q.includes("mal") || q.includes("malen");
  return (
    mentionsGoal &&
    (q.includes("sena") ||
      q.includes("sen ") ||
      q.endsWith(" sen") ||
      q.includes("forsenade") ||
      q.includes("forsenad") ||
      q.includes("passerad deadline"))
  );
}

function isOwnerQuestion(q: string): boolean {
  return (
    q.includes("vem ansvarar") ||
    q.includes("vem ar ansvarig") ||
    q.includes("ansvarig for") ||
    q.includes("vem ager")
  );
}

function isCountQuestion(q: string): boolean {
  return q.includes("hur manga") || q.includes("hur många");
}

function isOccupancyQuestion(q: string): boolean {
  return q.includes("belaggning") || q.includes("belaggningen");
}

function isResultBudgetQuestion(q: string): boolean {
  return (
    (q.includes("resultat") && q.includes("budget")) ||
    q.includes("resultat mot budget")
  );
}

function answerYellowKpis(context: AssistantContext): string {
  const yellow = (context.kpis ?? []).filter(
    (kpi) =>
      isTargetKpi(kpi) &&
      !isExcludedFromVdAttention(kpi) &&
      kpi.status === "Gul",
  );
  if (yellow.length === 0) {
    return "Inga KPI:er är gula just nu.";
  }

  const lines = yellow.map((kpi) => {
    const area = kpi.businessAreaName || "Okänt område";
    return `• ${kpi.name} (${area}): ${[kpi.currentValue, kpi.unit].filter(Boolean).join(" ") || "—"}`;
  });

  return `Gula KPI:er (${yellow.length}):\n${lines.join("\n")}`;
}

function answerFollowUpKpis(context: AssistantContext): string {
  const follow = (context.kpis ?? []).filter(
    (kpi) =>
      isTargetKpi(kpi) &&
      !isExcludedFromVdAttention(kpi) &&
      (kpi.status === "Gul" || kpi.status === "Röd"),
  );
  if (follow.length === 0) {
    return "Inga KPI kräver uppföljning just nu.";
  }

  const lines = follow.map((kpi) => {
    const area = kpi.businessAreaName || "Okänt område";
    return `• ${kpi.name} (${area}): ${kpi.status} — ${[kpi.currentValue, kpi.unit].filter(Boolean).join(" ") || "—"}`;
  });

  return `KPI som kräver uppföljning (${follow.length}):\n${lines.join("\n")}`;
}

function answerLateGoals(context: AssistantContext): string {
  const today = todayDateKey();
  const late = (context.goals ?? []).filter((goal) => {
    if (!goal.deadline) {
      return false;
    }
    return goal.deadline.slice(0, 10) < today && goal.status !== "Grön";
  });

  if (late.length === 0) {
    return "Inga mål är sena utifrån deadline just nu.";
  }

  const lines = late.map((goal) => {
    const deadline = goal.deadline?.slice(0, 10) ?? "—";
    return `• ${goal.title} (${goal.businessAreaName}) — deadline ${deadline}, ${goal.status}, ägare ${goal.owner ?? "Ej angiven"}`;
  });

  return `Sena mål (${late.length}):\n${lines.join("\n")}`;
}

function answerOwnerQuestion(
  q: string,
  context: AssistantContext,
): string {
  const area = findAreaInQuestion(q, context.businessAreas);
  if (area) {
    return `${area.name}: ansvarig är ${area.manager?.trim() || "Ej angiven"}.`;
  }

  const kpi = (context.kpis ?? []).find((item) =>
    q.includes(normalizeText(item.name)),
  );
  if (kpi) {
    const manager =
      context.businessAreas.find((areaRow) => areaRow.id === kpi.businessAreaId)
        ?.manager ?? "Ej angiven";
    return `KPI:n ${kpi.name} (${kpi.businessAreaName}): ansvarig är ${manager?.trim() || "Ej angiven"}.`;
  }

  const persons = context.summary.responsiblePersons ?? [];
  if (persons.length === 0) {
    return "Ingen ansvarig person hittades i tillgänglig data.";
  }

  return `Registrerade ansvariga: ${persons.slice(0, 12).join(", ")}.`;
}

function answerCountQuestion(
  q: string,
  context: AssistantContext,
): string {
  if (q.includes("affarsomrad") || q.includes("omraden")) {
    return `Det finns ${context.summary.areaCount} affärsområden.`;
  }
  if (q.includes("kpi") || q.includes("nyckeltal")) {
    const total = (context.kpis ?? []).length;
    const counts = context.summary.kpiCounts;
    return `Det finns ${total} KPI:er (${counts.Grön} gröna, ${counts.Gul} gula, ${counts.Röd} röda).`;
  }
  if (q.includes("mal")) {
    const total = (context.goals ?? []).length;
    const counts = context.summary.goalCounts;
    return `Det finns ${total} mål (${counts.Grön} gröna, ${counts.Gul} gula, ${counts.Röd} röda).`;
  }
  if (q.includes("aktivitet")) {
    const total = (context.activities ?? []).length;
    const delayed = context.summary.delayedActivityCount;
    return `Det finns ${total} aktiviteter, varav ${delayed} försenade.`;
  }
  if (q.includes("beslut")) {
    return `Det finns ${context.summary.openDecisionCount} öppna beslut.`;
  }

  return [
    `${context.summary.areaCount} affärsområden.`,
    `${(context.kpis ?? []).length} KPI:er.`,
    `${(context.goals ?? []).length} mål.`,
    `${context.summary.delayedActivityCount} försenade aktiviteter.`,
    `${context.summary.openDecisionCount} öppna beslut.`,
  ].join(" ");
}

function answerNamedKpiQuestion(
  q: string,
  context: AssistantContext,
): string {
  const area = findAreaInQuestion(q, context.businessAreas);
  const pool = area
    ? (context.kpis ?? []).filter((kpi) => kpi.businessAreaId === area.id)
    : (context.kpis ?? []);

  const keywords = isOccupancyQuestion(q)
    ? ["belagg", "belägg", "kapacitet", "utnyttjande"]
    : ["resultat", "budget", "ebit", "marginal"];

  const match = findKpiByKeywords(pool, keywords);
  if (!match) {
    return area
      ? `Ingen matchande KPI hittades för ${area.name}.`
      : "Ingen matchande KPI hittades i tillgänglig data.";
  }

  return `${match.businessAreaName}: ${formatKpiFact(match)}.`;
}

function isTrendIntentQuestion(q: string): boolean {
  return (
    isLocalTrendQuestion(q) ||
    q.includes("forandrats") ||
    q.includes("andrats") ||
    q.includes("utvecklats") ||
    q.includes("forsamrats") ||
    q.includes("forbattrats") ||
    q.includes("sedan igar") ||
    q.includes("sedan mandag") ||
    q.includes("senaste veckan")
  );
}

function answerTrendQuestion(
  q: string,
  context: AssistantContext,
): string {
  if (isKpiLastChangedQuestion(q)) {
    return answerKpiLastChangedQuestion(q, context);
  }

  const window = pickTrendWindow(context.trends, q);
  const area = findAreaInQuestion(q, context.businessAreas);

  if (q.includes("forsamrats") && (q.includes("kpi") || q.includes("nyckeltal"))) {
    return formatKpiTrendList(window.worsenedKpis, "försämrats", window);
  }

  if (q.includes("forbattrats") && (q.includes("kpi") || q.includes("nyckeltal"))) {
    return formatKpiTrendList(window.improvedKpis, "förbättrats", window);
  }

  if (area) {
    return formatAreaTrendAnswer(area, window);
  }

  if (
    q.includes("vad har forandrats") ||
    q.includes("vad har andrats") ||
    q.includes("sedan igar") ||
    q.includes("sedan mandag") ||
    q.includes("senaste veckan")
  ) {
    return formatCompanyTrendAnswer(window);
  }

  if (!window.hasEnoughHistory) {
    return INSUFFICIENT_HISTORY;
  }

  return formatCompanyTrendAnswer(window);
}

function answerKpiLastChangedQuestion(
  q: string,
  context: AssistantContext,
): string {
  const area = findAreaInQuestion(q, context.businessAreas);
  const pool = area
    ? (context.kpis ?? []).filter((kpi) => kpi.businessAreaId === area.id)
    : (context.kpis ?? []);

  const kpi = findKpiInQuestion(q, pool) ?? findKpiInQuestion(q, context.kpis ?? []);
  if (!kpi) {
    return "Ange vilken KPI du menar, till exempel namnet på nyckeltalet.";
  }

  const meta =
    (context.kpiLastChanges ?? []).find((item) => item.kpiId === kpi.id) ??
    null;

  if (!meta || !meta.lastChangedAt || meta.source === "none") {
    return INSUFFICIENT_HISTORY;
  }

  const when = formatDateTimeSv(meta.lastChangedAt);
  const lines = [`${kpi.name} (${kpi.businessAreaName}) ändrades senast ${when}.`];

  if (meta.previousValue !== null || meta.previousStatus !== null) {
    const valuePart =
      meta.previousValue !== null && meta.currentValue !== null
        ? `${meta.previousValue} → ${meta.currentValue}${meta.unit ? ` ${meta.unit}` : ""}`
        : null;
    const statusPart =
      meta.previousStatus && meta.previousStatus !== meta.currentStatus
        ? `${meta.previousStatus} → ${meta.currentStatus}`
        : null;
    if (valuePart || statusPart) {
      lines.push(
        [valuePart, statusPart].filter(Boolean).join(" · "),
      );
    }
  } else if (meta.source === "updated_at") {
    lines.push(
      "Tidpunkten kommer från senaste sparningen; tidigare värde saknas i historiken.",
    );
  }

  return lines.join("\n");
}

function formatKpiTrendList(
  items: AssistantKpiTrend[],
  verb: string,
  window: AssistantTrendWindow,
): string {
  if (!window.hasEnoughHistory || items.length === 0) {
    return `Inga KPI har ${verb} ${window.label} utifrån tillgänglig historik.`;
  }

  const lines = items.slice(0, 8).map((item) => {
    if (item.previousValue && item.currentValue) {
      return `• ${item.name} (${item.areaName}): ${item.previousValue} → ${item.currentValue}${item.unit ? ` ${item.unit}` : ""}`;
    }
    if (item.previousStatus && item.currentStatus !== item.previousStatus) {
      return `• ${item.name} (${item.areaName}): ${item.previousStatus} → ${item.currentStatus}`;
    }
    return `• ${item.name} (${item.areaName}): ${item.direction}`;
  });

  return `KPI som ${verb} ${window.label} (${items.length})\n${lines.join("\n")}`;
}

function formatAreaTrendAnswer(
  area: BusinessAreaRow,
  window: AssistantTrendWindow,
): string {
  const summary = window.areaSummaries.find((item) => item.areaId === area.id);

  if (!window.hasEnoughHistory || !summary || summary.direction === "okänd") {
    return `Det finns inte tillräckligt historiskt underlag för att bedöma trenden för ${area.name}.`;
  }

  const directionLabel =
    summary.direction === "sämre"
      ? "försämrats"
      : summary.direction === "bättre"
        ? "förbättrats"
        : "är i stort sett oförändrat";

  const lines: string[] = [
    summary.direction === "oförändrad"
      ? `${area.name} ${directionLabel} ${window.label}.`
      : `${area.name} har ${directionLabel} ${window.label}.`,
  ];

  for (const highlight of summary.highlights.slice(0, 3)) {
    lines.push(highlight);
  }

  if (summary.worsenedCount > 0 || summary.improvedCount > 0) {
    lines.push(
      `${summary.worsenedCount} KPI försämrade, ${summary.improvedCount} förbättrade.`,
    );
  }

  return lines.join("\n");
}

function formatCompanyTrendAnswer(window: AssistantTrendWindow): string {
  if (!window.hasEnoughHistory) {
    return INSUFFICIENT_HISTORY;
  }

  const lines: string[] = [`Förändringar ${window.label}:`];

  if (window.worsenedKpis.length > 0) {
    lines.push("", "KPI som försämrats:");
    for (const item of window.worsenedKpis.slice(0, 5)) {
      if (item.previousValue && item.currentValue) {
        lines.push(
          `• ${item.name} (${item.areaName}): ${item.previousValue} → ${item.currentValue}${item.unit ? ` ${item.unit}` : ""}`,
        );
      } else {
        lines.push(
          `• ${item.name} (${item.areaName}): ${item.previousStatus ?? "—"} → ${item.currentStatus}`,
        );
      }
    }
  }

  if (window.improvedKpis.length > 0) {
    lines.push("", "KPI som förbättrats:");
    for (const item of window.improvedKpis.slice(0, 5)) {
      if (item.previousValue && item.currentValue) {
        lines.push(
          `• ${item.name} (${item.areaName}): ${item.previousValue} → ${item.currentValue}${item.unit ? ` ${item.unit}` : ""}`,
        );
      } else {
        lines.push(
          `• ${item.name} (${item.areaName}): ${item.previousStatus ?? "—"} → ${item.currentStatus}`,
        );
      }
    }
  }

  const notableChanges = window.entityChanges
    .filter((change) => change.entityType !== "kpi")
    .slice(0, 4);
  if (notableChanges.length > 0) {
    lines.push("", "Övriga förändringar:");
    for (const change of notableChanges) {
      lines.push(`• ${change.description}`);
    }
  }

  if (lines.length === 1) {
    return `Inga tydliga förändringar registrerade ${window.label}.`;
  }

  return lines.join("\n");
}

function pickTrendWindow(
  trends: AssistantTrends | null | undefined,
  q: string,
): AssistantTrendWindow {
  const safe = trends ?? emptyTrends();
  if (q.includes("sedan mandag") || q.includes("mandag")) {
    return safe.sinceMonday;
  }
  if (
    q.includes("senaste veckan") ||
    q.includes("senaste 7") ||
    q.includes("utvecklats")
  ) {
    return safe.lastWeek;
  }
  return safe.sinceYesterday;
}

function daysAgoCutoff(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function mondayCutoffStockholm(): Date {
  const now = new Date();
  const key = todayDateKey();
  const [year, month, day] = key.split("-").map(Number);
  const todayNoon = new Date(Date.UTC(year!, month! - 1, day!, 12));
  // getUTCDay: 0=Sun ... 1=Mon
  const weekday = todayNoon.getUTCDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  return new Date(todayNoon.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
}

function statusRank(
  status: StatusTone | "Statistik" | null | undefined,
): number {
  if (status === "Grön") return 2;
  if (status === "Gul") return 1;
  if (status === "Röd") return 0;
  return 1;
}

function directionFromStatuses(
  previous: KpiStoredStatus | null,
  current: KpiStoredStatus,
): AssistantTrendDirection {
  if (!previous) {
    return "okänd";
  }
  const delta = statusRank(current) - statusRank(previous);
  if (delta > 0) return "bättre";
  if (delta < 0) return "sämre";
  return "oförändrad";
}

function emptyTrendWindow(
  key: AssistantTrendWindow["key"],
  label: string,
  sinceIso: string,
): AssistantTrendWindow {
  return {
    key,
    label,
    sinceIso,
    kpiTrends: [],
    worsenedKpis: [],
    improvedKpis: [],
    entityChanges: [],
    areaSummaries: [],
    hasEnoughHistory: false,
  };
}

function emptyTrends(): AssistantTrends {
  const now = new Date().toISOString();
  return {
    sinceYesterday: emptyTrendWindow("yesterday", "sedan igår", now),
    lastWeek: emptyTrendWindow("week", "senaste veckan", now),
    sinceMonday: emptyTrendWindow("monday", "sedan måndag", now),
  };
}

function filterTrendsToArea(
  trends: AssistantTrends | null | undefined,
  areaId: string,
  areaName: string,
): AssistantTrends {
  const source = trends ?? emptyTrends();
  const filterWindow = (window: AssistantTrendWindow): AssistantTrendWindow => {
    const kpiTrends = window.kpiTrends.filter((item) => item.areaId === areaId);
    const entityChanges = window.entityChanges.filter(
      (item) =>
        item.areaId === areaId ||
        item.areaName === areaName ||
        normalizeText(item.description).includes(normalizeText(areaName)),
    );
    const areaSummaries = window.areaSummaries.filter(
      (item) => item.areaId === areaId,
    );
    return {
      ...window,
      kpiTrends,
      worsenedKpis: kpiTrends.filter((item) => item.direction === "sämre"),
      improvedKpis: kpiTrends.filter((item) => item.direction === "bättre"),
      entityChanges,
      areaSummaries,
      hasEnoughHistory:
        kpiTrends.length > 0 ||
        entityChanges.length > 0 ||
        areaSummaries.some((item) => item.direction !== "okänd"),
    };
  };

  return {
    sinceYesterday: filterWindow(source.sinceYesterday),
    lastWeek: filterWindow(source.lastWeek),
    sinceMonday: filterWindow(source.sinceMonday),
  };
}

function slimTrends(trends: AssistantTrends | null | undefined): AssistantTrends {
  const source = trends ?? emptyTrends();
  const slim = (window: AssistantTrendWindow): AssistantTrendWindow => ({
    ...window,
    kpiTrends: window.kpiTrends.slice(0, 20),
    worsenedKpis: window.worsenedKpis.slice(0, 10),
    improvedKpis: window.improvedKpis.slice(0, 10),
    entityChanges: window.entityChanges.slice(0, 20),
    areaSummaries: window.areaSummaries.slice(0, 10),
  });
  return {
    sinceYesterday: slim(source.sinceYesterday),
    lastWeek: slim(source.lastWeek),
    sinceMonday: slim(source.sinceMonday),
  };
}

function buildAssistantTrends(input: {
  areas: BusinessAreaRow[];
  kpis: KPIListItem[];
  goals: GoalListItem[];
  activities: ActivityListItem[];
  decisions: DecisionListItem[];
  auditEntries: AuditLogListItem[];
  kpiHistory: KPIHistory[];
}): AssistantTrends {
  const yesterday = daysAgoCutoff(1);
  const week = daysAgoCutoff(7);
  const monday = mondayCutoffStockholm();

  const historyByKpi = new Map<string, KPIHistory[]>();
  for (const entry of input.kpiHistory ?? []) {
    const list = historyByKpi.get(entry.kpiId) ?? [];
    list.push(entry);
    historyByKpi.set(entry.kpiId, list);
  }
  for (const [, list] of historyByKpi) {
    list.sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    );
  }

  const areaNameById = new Map(
    (input.areas ?? []).map((area) => [area.id, area.name]),
  );
  const goalTitleById = new Map(
    (input.goals ?? []).map((goal) => [goal.id, goal.title]),
  );
  const activityTitleById = new Map(
    (input.activities ?? []).map((activity) => [activity.id, activity.title]),
  );
  const decisionTitleById = new Map(
    (input.decisions ?? []).map((decision) => [decision.id, decision.title]),
  );
  const kpiById = new Map((input.kpis ?? []).map((kpi) => [kpi.id, kpi]));

  const buildWindow = (
    key: AssistantTrendWindow["key"],
    label: string,
    cutoff: Date,
  ): AssistantTrendWindow => {
    const cutoffMs = cutoff.getTime();
    const kpiTrends: AssistantKpiTrend[] = [];

    for (const kpi of input.kpis ?? []) {
      const history = historyByKpi.get(kpi.id) ?? [];
      if (history.length === 0) {
        continue;
      }

      const latest = history[0]!;
      const previous =
        history.find(
          (entry) =>
            entry.id !== latest.id &&
            new Date(entry.recordedAt).getTime() <
              new Date(latest.recordedAt).getTime(),
        ) ?? null;

      const latestInWindow =
        new Date(latest.recordedAt).getTime() >= cutoffMs ||
        (previous && new Date(previous.recordedAt).getTime() >= cutoffMs);

      if (!previous) {
        if (new Date(latest.recordedAt).getTime() >= cutoffMs) {
          kpiTrends.push({
            kpiId: kpi.id,
            name: kpi.name,
            areaId: kpi.businessAreaId,
            areaName: kpi.businessAreaName,
            previousValue: null,
            currentValue: latest.value,
            previousStatus: null,
            currentStatus: latest.status,
            unit: kpi.unit,
            direction: "okänd",
            previousRecordedAt: null,
            currentRecordedAt: latest.recordedAt,
          });
        }
        continue;
      }

      if (!latestInWindow && new Date(latest.recordedAt).getTime() < cutoffMs) {
        continue;
      }

      // Only include if something changed after cutoff (latest after cutoff),
      // or previous is before cutoff and latest after (crossing the window).
      const crossedWindow =
        new Date(latest.recordedAt).getTime() >= cutoffMs &&
        new Date(previous.recordedAt).getTime() < cutoffMs;
      const bothInWindow =
        new Date(latest.recordedAt).getTime() >= cutoffMs &&
        new Date(previous.recordedAt).getTime() >= cutoffMs;

      if (!crossedWindow && !bothInWindow) {
        continue;
      }

      const direction = directionFromStatuses(previous.status, latest.status);
      kpiTrends.push({
        kpiId: kpi.id,
        name: kpi.name,
        areaId: kpi.businessAreaId,
        areaName: kpi.businessAreaName,
        previousValue: previous.value,
        currentValue: latest.value,
        previousStatus: previous.status,
        currentStatus: latest.status,
        unit: kpi.unit,
        direction,
        previousRecordedAt: previous.recordedAt,
        currentRecordedAt: latest.recordedAt,
      });
    }

    const entityChanges: AssistantEntityChange[] = [];
    for (const entry of input.auditEntries ?? []) {
      if (new Date(entry.createdAt).getTime() < cutoffMs) {
        continue;
      }

      const entityType = mapAuditEntityType(entry.entityType);
      let title = entry.description;
      let areaId = entry.businessAreaId;
      let areaName = areaId ? areaNameById.get(areaId) ?? null : null;

      if (entityType === "kpi" && entry.entityId) {
        const kpi = kpiById.get(entry.entityId);
        if (kpi) {
          title = kpi.name;
          areaId = kpi.businessAreaId;
          areaName = kpi.businessAreaName;
        }
      } else if (entityType === "goal" && entry.entityId) {
        title = goalTitleById.get(entry.entityId) ?? entry.description;
      } else if (entityType === "activity" && entry.entityId) {
        title = activityTitleById.get(entry.entityId) ?? entry.description;
      } else if (entityType === "decision" && entry.entityId) {
        title = decisionTitleById.get(entry.entityId) ?? entry.description;
      } else if (entityType === "area" && entry.entityId) {
        title = areaNameById.get(entry.entityId) ?? entry.description;
        areaId = entry.entityId;
        areaName = areaNameById.get(entry.entityId) ?? null;
      }

      entityChanges.push({
        entityType,
        entityId: entry.entityId,
        title,
        areaId,
        areaName,
        description: formatAuditChangeDescription(entry),
        action: entry.action,
        at: entry.createdAt,
        fields: entry.changes?.fields ?? [],
      });
    }

    // Supplement KPI trends from structured audit diffs when kpi_history is thin.
    const coveredKpiIds = new Set(kpiTrends.map((item) => item.kpiId));
    for (const change of entityChanges) {
      if (change.entityType !== "kpi" || !change.entityId) {
        continue;
      }
      if (coveredKpiIds.has(change.entityId)) {
        continue;
      }

      const kpi = kpiById.get(change.entityId);
      if (!kpi) {
        continue;
      }

      const valueChange = change.fields.find(
        (field) => field.field === "current_value",
      );
      const statusChange = change.fields.find(
        (field) => field.field === "status",
      );
      if (!valueChange && !statusChange) {
        continue;
      }

      const previousStatus = toStatusToneOrNull(statusChange?.from ?? null);
      const currentStatus =
        toStatusToneOrNull(statusChange?.to ?? null) ?? kpi.status;
      const direction = directionFromStatuses(previousStatus, currentStatus);

      kpiTrends.push({
        kpiId: kpi.id,
        name: kpi.name,
        areaId: kpi.businessAreaId,
        areaName: kpi.businessAreaName,
        previousValue: valueChange?.from ?? null,
        currentValue: valueChange?.to ?? kpi.currentValue,
        previousStatus,
        currentStatus,
        unit: kpi.unit,
        direction,
        previousRecordedAt: null,
        currentRecordedAt: change.at,
      });
      coveredKpiIds.add(kpi.id);
    }

    const worsenedKpis = kpiTrends.filter((item) => item.direction === "sämre");
    const improvedKpis = kpiTrends.filter((item) => item.direction === "bättre");

    const areaSummaries: AssistantAreaTrendSummary[] = (input.areas ?? []).map(
      (area) => {
        const areaKpis = kpiTrends.filter((item) => item.areaId === area.id);
        const worsened = areaKpis.filter((item) => item.direction === "sämre");
        const improved = areaKpis.filter((item) => item.direction === "bättre");
        const highlights: string[] = [];

        for (const item of [...worsened, ...improved].slice(0, 3)) {
          if (item.previousValue && item.currentValue) {
            const since = item.currentRecordedAt
              ? ` sedan ${formatShortHistoryDate(item.currentRecordedAt)}`
              : "";
            highlights.push(
              `${item.name} gick från ${item.previousValue} till ${item.currentValue}${item.unit ? ` ${item.unit}` : ""}${since}.`,
            );
          } else if (item.previousStatus) {
            highlights.push(
              `${item.name}: ${item.previousStatus} → ${item.currentStatus}.`,
            );
          }
        }

        const areaAudit = entityChanges
          .filter((change) => change.areaId === area.id)
          .slice(0, 2);
        for (const change of areaAudit) {
          if (highlights.length >= 3) break;
          highlights.push(change.description);
        }

        let direction: AssistantTrendDirection = "okänd";
        if (worsened.length > improved.length) direction = "sämre";
        else if (improved.length > worsened.length) direction = "bättre";
        else if (worsened.length > 0 && improved.length > 0)
          direction = "oförändrad";
        else if (areaKpis.some((item) => item.direction === "oförändrad"))
          direction = "oförändrad";
        else if (highlights.length > 0) direction = "okänd";

        return {
          areaId: area.id,
          areaName: area.name,
          direction,
          worsenedCount: worsened.length,
          improvedCount: improved.length,
          highlights,
        };
      },
    );

    const hasEnoughHistory =
      worsenedKpis.length > 0 ||
      improvedKpis.length > 0 ||
      entityChanges.length > 0 ||
      kpiTrends.some(
        (item) => item.previousValue !== null || item.previousStatus !== null,
      );

    return {
      key,
      label,
      sinceIso: cutoff.toISOString(),
      kpiTrends,
      worsenedKpis,
      improvedKpis,
      entityChanges,
      areaSummaries,
      hasEnoughHistory,
    };
  };

  return {
    sinceYesterday: buildWindow("yesterday", "sedan igår", yesterday),
    lastWeek: buildWindow("week", "senaste veckan", week),
    sinceMonday: buildWindow("monday", "sedan måndag", monday),
  };
}

function mapAuditEntityType(
  value: string,
): AssistantEntityChange["entityType"] {
  switch (value) {
    case "business_area":
      return "area";
    case "kpi":
      return "kpi";
    case "goal":
      return "goal";
    case "activity":
    case "activity_comment":
      return "activity";
    case "decision":
      return "decision";
    default:
      return "other";
  }
}

function formatAuditChangeDescription(entry: AuditLogListItem): string {
  const fields = entry.changes?.fields ?? [];
  if (fields.length === 0) {
    return entry.description;
  }

  const parts = fields
    .filter((field) =>
      ["status", "current_value", "progress", "owner", "priority", "deadline", "due_date", "meeting_date", "manager", "target_value"].includes(
        field.field,
      ),
    )
    .slice(0, 4)
    .map((field) => `${field.field}: ${field.from ?? "—"} → ${field.to ?? "—"}`);

  if (parts.length === 0) {
    return entry.description;
  }

  return `${entry.description} [${parts.join("; ")}]`;
}

function toStatusToneOrNull(value: string | null | undefined): StatusTone | null {
  if (value === "Grön" || value === "Gul" || value === "Röd") {
    return value;
  }
  return null;
}

function buildKpiLastChanges(input: {
  kpis: KPIListItem[];
  kpiHistory: KPIHistory[];
  auditEntries: AuditLogListItem[];
}): AssistantKpiLastChange[] {
  const historyByKpi = new Map<string, KPIHistory[]>();
  for (const entry of input.kpiHistory ?? []) {
    const list = historyByKpi.get(entry.kpiId) ?? [];
    list.push(entry);
    historyByKpi.set(entry.kpiId, list);
  }
  for (const [, list] of historyByKpi) {
    list.sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
    );
  }

  const latestAuditByKpi = new Map<string, AuditLogListItem>();
  for (const entry of input.auditEntries ?? []) {
    if (entry.entityType !== "kpi" || !entry.entityId) {
      continue;
    }
    const existing = latestAuditByKpi.get(entry.entityId);
    if (
      !existing ||
      new Date(entry.createdAt).getTime() > new Date(existing.createdAt).getTime()
    ) {
      latestAuditByKpi.set(entry.entityId, entry);
    }
  }

  return (input.kpis ?? []).map((kpi) => {
    const history = historyByKpi.get(kpi.id) ?? [];
    const latest = history[0] ?? null;
    const previous = history[1] ?? null;
    const audit = latestAuditByKpi.get(kpi.id) ?? null;

    if (latest) {
      return {
        kpiId: kpi.id,
        name: kpi.name,
        areaId: kpi.businessAreaId,
        areaName: kpi.businessAreaName,
        lastChangedAt: latest.recordedAt,
        previousValue: previous?.value ?? null,
        currentValue: latest.value,
        previousStatus: previous?.status ?? null,
        currentStatus: latest.status,
        unit: kpi.unit,
        source: "kpi_history" as const,
      };
    }

    if (audit) {
      const valueChange = audit.changes?.fields?.find(
        (field) => field.field === "current_value",
      );
      const statusChange = audit.changes?.fields?.find(
        (field) => field.field === "status",
      );
      return {
        kpiId: kpi.id,
        name: kpi.name,
        areaId: kpi.businessAreaId,
        areaName: kpi.businessAreaName,
        lastChangedAt: audit.createdAt,
        previousValue: valueChange?.from ?? null,
        currentValue: valueChange?.to ?? kpi.currentValue,
        previousStatus: toStatusToneOrNull(statusChange?.from ?? null),
        currentStatus:
          toStatusToneOrNull(statusChange?.to ?? null) ?? kpi.status,
        unit: kpi.unit,
        source: "audit_log" as const,
      };
    }

    if (kpi.updatedAt) {
      return {
        kpiId: kpi.id,
        name: kpi.name,
        areaId: kpi.businessAreaId,
        areaName: kpi.businessAreaName,
        lastChangedAt: kpi.updatedAt,
        previousValue: null,
        currentValue: kpi.currentValue,
        previousStatus: null,
        currentStatus: kpi.status,
        unit: kpi.unit,
        source: "updated_at" as const,
      };
    }

    return {
      kpiId: kpi.id,
      name: kpi.name,
      areaId: kpi.businessAreaId,
      areaName: kpi.businessAreaName,
      lastChangedAt: null,
      previousValue: null,
      currentValue: kpi.currentValue,
      previousStatus: null,
      currentStatus: kpi.status,
      unit: kpi.unit,
      source: "none" as const,
    };
  });
}

function findKpiInQuestion(
  q: string,
  kpis: KPIListItem[],
): KPIListItem | null {
  let best: KPIListItem | null = null;
  let bestScore = 0;

  for (const kpi of kpis ?? []) {
    const name = normalizeText(kpi.name);
    if (!name) {
      continue;
    }
    if (q.includes(name) && name.length > bestScore) {
      best = kpi;
      bestScore = name.length;
      continue;
    }

    const tokens = name.split(/\s+/).filter((token) => token.length >= 4);
    for (const token of tokens) {
      if (q.includes(token) && token.length > bestScore) {
        best = kpi;
        bestScore = token.length;
      }
    }
  }

  return best;
}

function formatShortHistoryDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso.slice(0, 10);
  }
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

type AssistantContextScope = "area" | "broad";

type RelevantAssistantContextResult = {
  context: AssistantContext;
  scope: AssistantContextScope;
  areaName: string | null;
};

/**
 * Selects a question-relevant slice of the full assistant context.
 * Area questions get only that area's signals; broad questions keep company-wide context.
 */
export function selectRelevantAssistantContext(
  question: string,
  fullContext: AssistantContext,
): RelevantAssistantContextResult {
  const q = normalizeText(question);
  const areas = fullContext.businessAreas ?? [];

  if (isBroadAssistantQuestion(q) || !q) {
    return {
      context: slimBroadContext(fullContext),
      scope: "broad",
      areaName: null,
    };
  }

  const area = findAreaInQuestion(q, areas);
  if (area) {
    return {
      context: filterContextToArea(fullContext, area),
      scope: "area",
      areaName: area.name,
    };
  }

  return {
    context: slimBroadContext(fullContext),
    scope: "broad",
    areaName: null,
  };
}

function isBroadAssistantQuestion(q: string): boolean {
  return (
    q.includes("hur mar foretaget") ||
    q.includes("hur gar det for bolaget") ||
    q.includes("hur gar det for foretaget") ||
    q.includes("hur ser laget ut") ||
    q.includes("overgripande") ||
    q.includes("hela bolaget") ||
    q.includes("hela koncernen") ||
    q.includes("ledningsmotet") ||
    q.includes("ledningsmote") ||
    q.includes("prioritera") ||
    q.includes("prioritet") ||
    q.includes("viktigast idag") ||
    q.includes("vad ska jag fokusera") ||
    q.includes("vad ska tas upp")
  );
}

function filterContextToArea(
  full: AssistantContext,
  area: BusinessAreaRow,
): AssistantContext {
  const areaId = area.id;
  const areaName = area.name;
  const areaNameNorm = normalizeText(areaName);

  const kpis = sortFollowUpFirst(
    (full.kpis ?? []).filter((kpi) => kpi.businessAreaId === areaId),
  ).slice(0, 10);

  const goals = sortFollowUpFirst(
    (full.goals ?? []).filter((goal) => goal.businessAreaId === areaId),
  ).slice(0, 8);

  const delayedFirst = [
    ...(full.activities ?? []).filter(
      (activity) =>
        activity.businessAreaId === areaId && isDelayedActivity(activity),
    ),
    ...(full.activities ?? []).filter(
      (activity) =>
        activity.businessAreaId === areaId && !isDelayedActivity(activity),
    ),
  ].slice(0, 6);

  const decisions = (full.decisions ?? [])
    .filter(
      (decision) =>
        decision.businessAreaId === areaId && decision.status !== "Klart",
    )
    .slice(0, 5);

  const observations = (full.observations ?? [])
    .filter((line) => normalizeText(line).includes(areaNameNorm))
    .slice(0, 5);

  const priorities = (full.priorities ?? [])
    .filter((item) => item.areaName === areaName)
    .slice(0, 3);

  const analysisInsights = (full.analysisInsights ?? [])
    .filter((item) => item.areaName === areaName)
    .slice(0, 3);

  const openDeviations = (full.openDeviations ?? [])
    .filter((item) => item.areaName === areaName)
    .slice(0, 6);

  const yesterdayChanges = (full.yesterdayChanges ?? [])
    .filter((change) => normalizeText(change.text).includes(areaNameNorm))
    .slice(0, 4);

  const manager = area.manager?.trim() || "Ej angiven";

  return {
    summary: {
      ...full.summary,
      areaCount: 1,
      kpiCounts: countTargetKpiStatuses(kpis),
      goalCounts: countStatuses(goals.map((goal) => goal.status)),
      delayedActivityCount: delayedFirst.filter(isDelayedActivity).length,
      openDecisionCount: decisions.length,
      responsiblePersons: manager !== "Ej angiven" ? [manager] : [],
      vdSituation: "",
      vdPriority: "",
      vdPositiveSummary: "",
      dashboardSituation: `${areaName} · ${kpis.length} KPI · ${goals.length} mål`,
    },
    businessAreas: [area],
    kpis,
    goals,
    activities: delayedFirst,
    decisions,
    observations,
    priorities,
    analysisInsights,
    trends: filterTrendsToArea(full.trends, areaId, areaName),
    kpiLastChanges: (full.kpiLastChanges ?? []).filter(
      (item) => item.areaId === areaId,
    ),
    yesterdayChanges,
    openDeviations,
  };
}

function slimBroadContext(full: AssistantContext): AssistantContext {
  const followKpis = sortFollowUpFirst(
    (full.kpis ?? []).filter(
      (kpi) =>
        isTargetKpi(kpi) &&
        !isExcludedFromVdAttention(kpi) &&
        (kpi.status === "Röd" || kpi.status === "Gul"),
    ),
  ).slice(0, 12);

  const followGoals = sortFollowUpFirst(
    (full.goals ?? []).filter(
      (goal) => goal.status === "Röd" || goal.status === "Gul",
    ),
  ).slice(0, 8);

  const delayedActivities = (full.activities ?? [])
    .filter(isDelayedActivity)
    .slice(0, 6);

  const openDecisions = (full.decisions ?? [])
    .filter((decision) => decision.status !== "Klart")
    .slice(0, 6);

  return {
    ...full,
    kpis: followKpis,
    goals: followGoals,
    activities: delayedActivities,
    decisions: openDecisions,
    observations: (full.observations ?? []).slice(0, 6),
    priorities: (full.priorities ?? []).slice(0, 4),
    analysisInsights: (full.analysisInsights ?? []).slice(0, 6),
    openDeviations: (full.openDeviations ?? []).slice(0, 8),
    yesterdayChanges: (full.yesterdayChanges ?? []).slice(0, 5),
    trends: slimTrends(full.trends),
    kpiLastChanges: (full.kpiLastChanges ?? []).slice(0, 40),
    summary: {
      ...full.summary,
      responsiblePersons: (full.summary.responsiblePersons ?? []).slice(0, 12),
    },
  };
}

function sortFollowUpFirst<
  T extends { status: StatusTone | "Statistik" },
>(items: T[]): T[] {
  const rank = (status: StatusTone | "Statistik") => {
    if (status === "Röd") return 0;
    if (status === "Gul") return 1;
    return 2;
  };
  return [...items].sort((a, b) => rank(a.status) - rank(b.status));
}

/** Compact JSON payload for OpenAI — drops ids/timestamps and unused fields. */
function toCompactOpenAiContext(
  context: AssistantContext,
  scope: AssistantContextScope,
) {
  return {
    scope,
    summary: {
      dateLabel: context.summary.dateLabel,
      areaCount: context.summary.areaCount,
      kpiCounts: context.summary.kpiCounts,
      goalCounts: context.summary.goalCounts,
      delayedActivityCount: context.summary.delayedActivityCount,
      openDecisionCount: context.summary.openDecisionCount,
      dashboardSituation: context.summary.dashboardSituation,
      vdSituation: context.summary.vdSituation || undefined,
      vdPriority: context.summary.vdPriority || undefined,
      vdPositiveSummary: context.summary.vdPositiveSummary || undefined,
      responsiblePersons: context.summary.responsiblePersons,
      firstName: context.summary.firstName,
    },
    businessAreas: (context.businessAreas ?? []).map((area) => ({
      name: area.name,
      status: area.status,
      manager: area.manager,
    })),
    kpis: (context.kpis ?? []).map((kpi) => ({
      name: kpi.name,
      area: kpi.businessAreaName,
      kind: kpi.kind,
      status: kpi.status,
      currentValue: kpi.currentValue,
      targetValue: kpi.kind === "TARGET" ? kpi.targetValue : null,
      unit: kpi.unit,
      trend: kpi.trend,
    })),
    goals: (context.goals ?? []).map((goal) => ({
      title: goal.title,
      area: goal.businessAreaName,
      status: goal.status,
      owner: goal.owner,
      deadline: goal.deadline,
    })),
    activities: (context.activities ?? []).map((activity) => ({
      title: activity.title,
      area: activity.businessAreaName,
      status: activity.status,
      owner: activity.owner,
      deadline: activity.deadline,
      delayed: isDelayedActivity(activity),
    })),
    decisions: (context.decisions ?? []).map((decision) => ({
      title: decision.title,
      area: decision.businessAreaName,
      status: decision.status,
      owner: decision.owner,
      dueDate: decision.dueDate,
    })),
    observations: context.observations ?? [],
    priorities: (context.priorities ?? []).map((item) => ({
      label: item.label,
      reason: item.reason,
      owner: item.owner,
      areaName: item.areaName,
    })),
    analysisInsights: context.analysisInsights ?? [],
    trends: context.trends ?? emptyTrends(),
    kpiLastChanges: (context.kpiLastChanges ?? []).slice(0, 20),
    yesterdayChanges: context.yesterdayChanges ?? [],
    openDeviations: context.openDeviations ?? [],
  };
}

/**
 * Briefing-specific OpenAI payload: reuse compact context, prioritize
 * deviations / red-yellow signals / risks / changes, drop duplicate noise.
 */
function buildVdBriefingOpenAiPayload(full: AssistantContext) {
  const slimmed = slimBroadContext(full);
  const compact = toCompactOpenAiContext(slimmed, "broad");

  const greenAreas = (full.businessAreas ?? [])
    .filter((area) => area.status === "Grön")
    .map((area) => area.name)
    .slice(0, 6);

  const attentionAreas = (full.businessAreas ?? [])
    .filter((area) => area.status === "Röd" || area.status === "Gul")
    .map((area) => ({
      name: area.name,
      status: area.status,
      manager: area.manager,
    }));

  const week = compact.trends?.lastWeek;
  const yesterday = compact.trends?.sinceYesterday;

  const trendFocus = {
    sinceYesterday: {
      label: yesterday?.label,
      hasEnoughHistory: yesterday?.hasEnoughHistory ?? false,
      worsenedKpis: (yesterday?.worsenedKpis ?? []).slice(0, 6),
      improvedKpis: (yesterday?.improvedKpis ?? []).slice(0, 4),
      entityChanges: (yesterday?.entityChanges ?? [])
        .filter((change) => change.entityType !== "kpi")
        .slice(0, 4),
    },
    lastWeek: {
      label: week?.label,
      hasEnoughHistory: week?.hasEnoughHistory ?? false,
      worsenedKpis: (week?.worsenedKpis ?? []).slice(0, 6),
      improvedKpis: (week?.improvedKpis ?? []).slice(0, 4),
      areaSummaries: (week?.areaSummaries ?? [])
        .filter(
          (item) =>
            item.direction === "sämre" ||
            item.direction === "bättre" ||
            item.worsenedCount > 0 ||
            item.improvedCount > 0,
        )
        .slice(0, 6),
    },
  };

  const kpiChanges = (compact.kpiLastChanges ?? [])
    .filter(
      (item) =>
        item.previousValue !== null ||
        item.previousStatus !== null ||
        item.source === "kpi_history" ||
        item.source === "audit_log",
    )
    .slice(0, 10)
    .map((item) => ({
      name: item.name,
      area: item.areaName,
      previousValue: item.previousValue,
      currentValue: item.currentValue,
      previousStatus: item.previousStatus,
      currentStatus: item.currentStatus,
      unit: item.unit,
      lastChangedAt: item.lastChangedAt,
    }));

  return {
    scope: "vd-briefing" as const,
    summary: {
      dateLabel: compact.summary.dateLabel,
      areaCount: compact.summary.areaCount,
      kpiCounts: compact.summary.kpiCounts,
      goalCounts: compact.summary.goalCounts,
      delayedActivityCount: compact.summary.delayedActivityCount,
      openDecisionCount: compact.summary.openDecisionCount,
      dashboardSituation: compact.summary.dashboardSituation,
      vdSituation: compact.summary.vdSituation,
      vdPriority: compact.summary.vdPriority,
      vdPositiveSummary: compact.summary.vdPositiveSummary,
      firstName: compact.summary.firstName,
    },
    focus: {
      attentionAreas,
      greenAreaNames: greenAreas,
      followUpKpis: compact.kpis,
      atRiskGoals: compact.goals,
      delayedActivities: compact.activities,
      openDecisions: compact.decisions,
      openDeviations: compact.openDeviations,
      priorities: compact.priorities,
      observations: compact.observations,
      analysisInsights: (compact.analysisInsights ?? []).slice(0, 5),
      yesterdayChanges: compact.yesterdayChanges,
      kpiChanges,
      trends: trendFocus,
    },
    counts: {
      areas: full.businessAreas?.length ?? compact.summary.areaCount,
      kpis: full.kpis?.length ??
        (compact.summary.kpiCounts?.Grön ?? 0) +
          (compact.summary.kpiCounts?.Gul ?? 0) +
          (compact.summary.kpiCounts?.Röd ?? 0),
      goals: full.goals?.length ??
        (compact.summary.goalCounts?.Grön ?? 0) +
          (compact.summary.goalCounts?.Gul ?? 0) +
          (compact.summary.goalCounts?.Röd ?? 0),
      activities: full.activities?.length ?? 0,
      decisions: full.decisions?.length ?? 0,
      delayedActivities: compact.summary.delayedActivityCount,
      openDecisions: compact.summary.openDecisionCount,
    },
  };
}

const BRIEFING_SYSTEM_PROMPT = `Du är COO-rådgivare för LEIR och förbereder VD inför dagen.

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
/** Background AI upgrade budget; local briefing stays on screen if this fails. */
const VD_BRIEFING_OPENAI_TIMEOUT_MS = 15_000;
const VD_BRIEFING_OPENAI_MODEL = "gpt-5";
/** gpt-5: completion budget covers reasoning + visible text; keep effort minimal for latency. */
const VD_BRIEFING_MAX_COMPLETION_TOKENS = 1200;
const VD_BRIEFING_REASONING_EFFORT = "minimal" as const;
/** Bump when briefing format/payload changes so stale AI cache is not shown. */
const VD_BRIEFING_CACHE_VERSION = 5;

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
 * Returns cached AI briefing when valid; otherwise generates via OpenAI.
 * Uses singleflight so concurrent callers share one OpenAI request.
 */
export async function generateVdBriefing(): Promise<string> {
  const totalStarted = Date.now();
  const cached = getCachedVdBriefing();
  if (cached) {
    console.log(
      `[vd-briefing] cache hit (${Date.now() - totalStarted}ms, ${cached.length} chars)`,
    );
    return cached;
  }

  if (vdBriefingInFlight) {
    console.log("[vd-briefing] joining in-flight OpenAI request");
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
      console.log(
        `[vd-briefing] total success: ${Date.now() - totalStarted}ms (${content.length} chars)`,
      );
      return content;
    } catch (error) {
      console.warn(
        `[vd-briefing] total failed: ${Date.now() - totalStarted}ms` +
          (error instanceof Error ? ` — ${error.message}` : ""),
      );
      throw error;
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

  const contextStarted = Date.now();
  const context = await buildAssistantContext();
  const contextMs = Date.now() - contextStarted;

  const payloadStarted = Date.now();
  const payload = buildVdBriefingOpenAiPayload(context);
  const payloadJson = JSON.stringify(payload);
  const payloadMs = Date.now() - payloadStarted;
  const payloadChars = payloadJson.length;

  const firstName = context.summary.firstName ?? "Peter";
  const createdAtLabel = formatDateTimeSv(new Date().toISOString());

  console.log(
    `[vd-briefing] context build: ${contextMs}ms · payload shape: ${payloadMs}ms · payload: ${payloadChars} chars · ` +
      `model=${VD_BRIEFING_OPENAI_MODEL} · reasoning_effort=${VD_BRIEFING_REASONING_EFFORT}`,
  );

  const client = new OpenAI({
    apiKey,
    timeout: VD_BRIEFING_OPENAI_TIMEOUT_MS,
    maxRetries: 0,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, VD_BRIEFING_OPENAI_TIMEOUT_MS);

  const openaiStarted = Date.now();
  try {
    const completion = await client.chat.completions.create(
      {
        model: VD_BRIEFING_OPENAI_MODEL,
        max_completion_tokens: VD_BRIEFING_MAX_COMPLETION_TOKENS,
        reasoning_effort: VD_BRIEFING_REASONING_EFFORT,
        messages: [
          {
            role: "system",
            content: BRIEFING_SYSTEM_PROMPT.replace("{förnamn}", firstName),
          },
          {
            role: "user",
            content: `Context (prioriterat beslutsunderlag — avvikelser och förändringar först):\n${payloadJson}\n\nUppgift:\nSkriv morgonbriefingen för dashboarden.\nPrioritera röda/gula KPI, risker, försenade aktiviteter, öppna beslut och tydliga förändringar.\nAnvänd positiva gröna signaler kortfattat under Positiv utveckling.\nAnvänd exakt denna tidstämpel i foten: Skapad: ${createdAtLabel}\nRäkna antal från context.counts: affärsområden, KPI, mål, aktiviteter, beslut.`,
          },
        ],
      },
      { signal: controller.signal },
    );

    const openaiMs = Date.now() - openaiStarted;
    const choice = completion.choices[0];
    const message = choice?.message;
    const contentRaw = message?.content;
    const briefing =
      typeof contentRaw === "string" ? contentRaw.trim() : "";
    const usage = completion.usage;
    const reasoningTokens =
      usage?.completion_tokens_details?.reasoning_tokens ?? null;

    // Timing/token metrics only — never log prompts, payloads, or API keys.
    console.log(
      `[vd-briefing] OpenAI request: ${openaiMs}ms · model=${completion.model ?? VD_BRIEFING_OPENAI_MODEL} · ` +
        `finish_reason=${choice?.finish_reason ?? "n/a"} · content_len=${briefing.length} · ` +
        `prompt_tokens=${usage?.prompt_tokens ?? "n/a"} · ` +
        `completion_tokens=${usage?.completion_tokens ?? "n/a"} · ` +
        `reasoning_tokens=${reasoningTokens ?? "n/a"} · ` +
        `total_tokens=${usage?.total_tokens ?? "n/a"}`,
    );

    if (!briefing) {
      throw new Error(
        `OpenAI returnerade ingen briefing (finish_reason=${choice?.finish_reason ?? "n/a"}, ` +
          `reasoning_tokens=${reasoningTokens ?? "n/a"}, ` +
          `completion_tokens=${usage?.completion_tokens ?? "n/a"}).`,
      );
    }

    return briefing;
  } catch (error) {
    const openaiMs = Date.now() - openaiStarted;
    if (
      controller.signal.aborted ||
      (error instanceof Error &&
        (error.name === "AbortError" ||
          error.message.toLowerCase().includes("timeout") ||
          error.message.toLowerCase().includes("aborted")))
    ) {
      console.warn(
        `[vd-briefing] OpenAI timeout after ${openaiMs}ms ` +
          `(limit ${VD_BRIEFING_OPENAI_TIMEOUT_MS}ms, model=${VD_BRIEFING_OPENAI_MODEL}, ` +
          `payload ${payloadChars} chars)`,
      );
      throw new Error("VD Briefing OpenAI timeout");
    }
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      `[vd-briefing] OpenAI error after ${openaiMs}ms (model=${VD_BRIEFING_OPENAI_MODEL}): ${message}`,
    );
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

function normalizeSignalName(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function formatKpiFact(kpi: KPIListItem): string {
  const current = [kpi.currentValue, kpi.unit].filter(Boolean).join(" ");
  const target = kpi.targetValue
    ? ` mot mål ${kpi.targetValue}${kpi.unit ? ` ${kpi.unit}` : ""}`
    : "";
  return `${kpi.name} ${current || "—"}${target} (${kpi.status})`;
}

function findKpiByKeywords(
  kpis: KPIListItem[],
  keywords: string[],
): KPIListItem | null {
  const normalizedKeywords = keywords.map((keyword) =>
    normalizeSignalName(keyword),
  );
  return (
    kpis.find((kpi) => {
      const name = normalizeSignalName(kpi.name);
      return normalizedKeywords.some((keyword) =>
        keyword ? name.includes(keyword) : false,
      );
    }) ?? null
  );
}

function isFollowUpStatus(
  status: StatusTone | "Statistik" | null | undefined,
): boolean {
  return status === "Gul" || status === "Röd";
}

/**
 * Builds data-backed causal insights by linking related signals in the same area.
 * Never invents causes — marks causeUnknown when linkage is weak.
 */
function buildAnalysisInsights(input: {
  areas: BusinessAreaRow[];
  kpis: KPIListItem[];
  goals: GoalListItem[];
  delayedActivities: ActivityListItem[];
  openDecisions: DecisionListItem[];
  areaManagers: Map<string, string>;
}): AssistantAnalysisInsight[] {
  const insights: AssistantAnalysisInsight[] = [];

  for (const area of input.areas ?? []) {
    const areaId = area.id;
    const areaName = area.name;
    const owner =
      input.areaManagers.get(areaId) ||
      area.manager?.trim() ||
      "Ej angiven";

    const areaKpis = (input.kpis ?? []).filter(
      (kpi) => kpi.businessAreaId === areaId,
    );
    const followKpis = areaKpis.filter((kpi) => isFollowUpStatus(kpi.status));
    if (followKpis.length === 0 && area.status !== "Gul" && area.status !== "Röd") {
      continue;
    }

    const areaGoals = (input.goals ?? []).filter(
      (goal) =>
        goal.businessAreaId === areaId && isFollowUpStatus(goal.status),
    );
    const delayed = (input.delayedActivities ?? []).filter(
      (activity) => activity.businessAreaId === areaId,
    );
    const decisions = (input.openDecisions ?? []).filter(
      (decision) => decision.businessAreaId === areaId,
    );

    const occupancy = findKpiByKeywords(areaKpis, [
      "belagg",
      "belägg",
      "kapacitet",
      "utnyttjande",
    ]);
    const resultKpi = findKpiByKeywords(areaKpis, [
      "resultat",
      "budget",
      "ebit",
      "marginal",
    ]);
    const volume = findKpiByKeywords(areaKpis, [
      "volym",
      "ton",
      "antal",
      "order",
      "orderingang",
    ]);
    const revenue = findKpiByKeywords(areaKpis, [
      "intakt",
      "intäkt",
      "omsatt",
      "omsattning",
      "omsättning",
      "foraljning",
      "försäljning",
    ]);

    const linkedSignals: string[] = [];
    let whatHappened = "";
    let whyImportant = "";
    let consequence = "";
    let action = "";
    let causeUnknown = true;

    const occupancyOff =
      occupancy && isFollowUpStatus(occupancy.status) ? occupancy : null;
    const resultOff =
      resultKpi && isFollowUpStatus(resultKpi.status) ? resultKpi : null;
    const volumeOff =
      volume && isFollowUpStatus(volume.status) ? volume : null;
    const revenueOff =
      revenue && isFollowUpStatus(revenue.status) ? revenue : null;

    if (occupancyOff && resultOff) {
      linkedSignals.push(formatKpiFact(occupancyOff), formatKpiFact(resultOff));
      whatHappened = `${areaName}: ${formatKpiFact(occupancyOff)}.`;
      whyImportant = `Samma område visar samtidigt avvikelse i ${resultOff.name} (${formatKpiFact(resultOff)}).`;
      consequence =
        "Om beläggningen inte förbättras finns risk att resultatmålet fortsatt missas.";
      action = `${owner} bör presentera en kapacitets- och försäljningsplan.`;
      causeUnknown = false;
    } else if (volumeOff && revenueOff) {
      linkedSignals.push(formatKpiFact(volumeOff), formatKpiFact(revenueOff));
      whatHappened = `${areaName}: ${formatKpiFact(volumeOff)}.`;
      whyImportant = `Volymsignalen sammanfaller med avvikelse i ${revenueOff.name} (${formatKpiFact(revenueOff)}).`;
      consequence =
        "Om volymen inte vänder finns risk att intäkten fortsatt ligger under plan.";
      action = `${owner} bör redovisa volym- och intäktsåtgärder för nästa period.`;
      causeUnknown = false;
    } else if (followKpis[0] && areaGoals[0]) {
      const kpi = followKpis[0];
      const goal = areaGoals[0];
      linkedSignals.push(formatKpiFact(kpi), `Mål: ${goal.title} (${goal.status})`);
      whatHappened = `${areaName}: ${formatKpiFact(kpi)}.`;
      whyImportant = `KPI-avvikelsen ligger i samma område som målet "${goal.title}" (${goal.status}).`;
      consequence =
        "Om KPI och mål fortsätter i samma riktning ökar risken att områdets målbild missas.";
      action = `${owner} bör stämma av KPI mot målet och låsa nästa åtgärd.`;
      causeUnknown = false;
    } else if (followKpis[0] && delayed[0]) {
      const kpi = followKpis[0];
      const activity = delayed[0];
      linkedSignals.push(
        formatKpiFact(kpi),
        `Försenad aktivitet: ${activity.title}`,
      );
      whatHappened = `${areaName}: ${formatKpiFact(kpi)}.`;
      whyImportant = `Försenad aktivitet "${activity.title}" ökar risken kring KPI-avvikelsen.`;
      consequence =
        "Om aktiviteten inte låses kan KPI-avvikelsen bestå eller förvärras.";
      action = `${activity.owner?.trim() || owner} bör säkra nästa steg för "${activity.title}".`;
      causeUnknown = false;
    } else if (followKpis[0] && decisions[0]) {
      const kpi = followKpis[0];
      const decision = decisions[0];
      linkedSignals.push(
        formatKpiFact(kpi),
        `Öppet beslut: ${decision.title}`,
      );
      whatHappened = `${areaName}: ${formatKpiFact(kpi)}.`;
      whyImportant = `Öppet beslut "${decision.title}" kan förklara utebliven effekt på KPI.`;
      consequence =
        "Så länge beslutet är öppet riskerar KPI-åtgärder att sakna effekt.";
      action = `${decision.owner?.trim() || owner} bör driva beslutet "${decision.title}" till avslut.`;
      causeUnknown = false;
    } else if (followKpis[0]) {
      const kpi = followKpis[0];
      linkedSignals.push(formatKpiFact(kpi));
      whatHappened = `${areaName}: ${formatKpiFact(kpi)}.`;
      whyImportant =
        "Orsaken framgår inte av tillgänglig data.";
      consequence =
        "Utan tydlig orsak finns risk att avvikelsen kvarstår utan rätt åtgärd.";
      action = `${owner} bör komplettera underlaget och föreslå nästa steg.`;
      causeUnknown = true;
    } else if (area.status === "Gul" || area.status === "Röd") {
      whatHappened = `${areaName} har status ${area.status}.`;
      whyImportant =
        "Orsaken framgår inte av tillgänglig data.";
      consequence =
        "Områdesstatusen kräver uppföljning tills underlag finns.";
      action = `${owner} bör förklara status och föreslå åtgärd.`;
      linkedSignals.push(`Områdesstatus: ${area.status}`);
      causeUnknown = true;
    } else {
      continue;
    }

    if (delayed[0] && !linkedSignals.some((s) => s.includes(delayed[0]!.title))) {
      linkedSignals.push(`Försenad aktivitet: ${delayed[0]!.title}`);
    }
    if (
      decisions[0] &&
      !linkedSignals.some((s) => s.includes(decisions[0]!.title))
    ) {
      linkedSignals.push(`Öppet beslut: ${decisions[0]!.title}`);
    }

    insights.push({
      areaName,
      owner,
      whatHappened,
      whyImportant,
      consequence,
      action,
      linkedSignals: linkedSignals.slice(0, 5),
      causeUnknown,
    });
  }

  return insights
    .sort((a, b) => Number(a.causeUnknown) - Number(b.causeUnknown))
    .slice(0, 8);
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
  const red = (context.kpis ?? []).filter(
    (kpi) =>
      isTargetKpi(kpi) &&
      !isExcludedFromVdAttention(kpi) &&
      kpi.status === "Röd",
  );
  if (red.length === 0) {
    return "Inga KPI är röda just nu.";
  }

  const lines = red.slice(0, 8).map((kpi) => {
    const area = kpi.businessAreaName || "Okänt område";
    const value = formatKpiValueAgainstTarget(kpi);
    return `• ${kpi.name} (${area}): ${value}`;
  });

  return `Röda KPI (${red.length})\n${lines.join("\n")}`;
}

function answerDelayedActivities(context: AssistantContext): string {
  const delayed = (context.activities ?? []).filter(isDelayedActivity);
  if (delayed.length === 0) {
    return "Inga aktiviteter är försenade just nu.";
  }

  const lines = delayed.slice(0, 8).map((activity) => {
    const deadline = activity.deadline
      ? activity.deadline.slice(0, 10)
      : "saknar deadline";
    return `• ${activity.title} (${activity.businessAreaName}) — deadline ${deadline}, ${activity.owner?.trim() || "Ej angiven"}`;
  });

  return `Försenade aktiviteter (${delayed.length})\n${lines.join("\n")}`;
}

function answerOpenDecisions(context: AssistantContext): string {
  const open = (context.decisions ?? []).filter(
    (decision) => decision.status !== "Klart",
  );
  if (open.length === 0) {
    return "Inga öppna beslut just nu.";
  }

  const lines = open.slice(0, 8).map((decision) => {
    const when =
      decision.dueDate?.slice(0, 10) ??
      decision.meetingDate?.slice(0, 10) ??
      null;
    const owner = decision.owner?.trim() || "Ej angiven";
    const due = when ? ` — förfaller ${when}` : "";
    return `• ${decision.title} (${decision.businessAreaName})${due}, ${owner}`;
  });

  return `Öppna beslut (${open.length})\n${lines.join("\n")}`;
}

function formatKpiValueAgainstTarget(kpi: KPIListItem): string {
  const current = [kpi.currentValue, kpi.unit].filter(Boolean).join(" ");
  if (kpi.targetValue) {
    const targetUnit = kpi.unit ? ` ${kpi.unit}` : "";
    return `${current || "—"} mot mål ${kpi.targetValue}${targetUnit}`;
  }
  return current || "värde saknas";
}

/**
 * VD-formatted local status for one business area — no OpenAI.
 */
function answerAreaStatus(
  area: BusinessAreaRow,
  context: AssistantContext,
): string {
  const areaKpis = (context.kpis ?? []).filter(
    (kpi) => kpi.businessAreaId === area.id,
  );
  const followKpis = areaKpis
    .filter(
      (kpi) =>
        isTargetKpi(kpi) &&
        (kpi.status === "Röd" || kpi.status === "Gul"),
    )
    .sort((a, b) => {
      if (a.status === b.status) return 0;
      return a.status === "Röd" ? -1 : 1;
    });
  const topKpi = followKpis[0] ?? null;

  const delayed = (context.activities ?? []).filter(
    (activity) =>
      activity.businessAreaId === area.id && isDelayedActivity(activity),
  );
  const followGoals = (context.goals ?? []).filter(
    (goal) =>
      goal.businessAreaId === area.id &&
      (goal.status === "Gul" || goal.status === "Röd"),
  );

  const status =
    area.status === "Grön" || area.status === "Gul" || area.status === "Röd"
      ? area.status
      : "Gul";

  let lage: string;
  if (topKpi) {
    lage = `${topKpi.name} ligger på ${formatKpiValueAgainstTarget(topKpi)}.`;
  } else if (areaKpis.length === 0) {
    lage = "Relevant KPI-data saknas för området i underlaget.";
  } else if (status === "Grön") {
    lage = "Området ligger enligt plan utifrån tillgängliga KPI.";
  } else {
    lage = `Området har status ${status}, men ingen tydlig KPI-avvikelse finns i underlaget.`;
  }

  const deviationBullets: string[] = [];
  for (const kpi of followKpis.slice(0, 2)) {
    deviationBullets.push(
      `• ${kpi.name}: ${formatKpiValueAgainstTarget(kpi)}`,
    );
  }
  if (deviationBullets.length < 2 && followGoals[0]) {
    deviationBullets.push(
      `• Mål: ${followGoals[0].title} (${followGoals[0].status})`,
    );
  }
  if (deviationBullets.length < 2 && delayed[0]) {
    deviationBullets.push(`• Försenad aktivitet: ${delayed[0].title}`);
  }
  if (deviationBullets.length === 0 && topKpi) {
    deviationBullets.push(`• ${topKpi.name}: målet nås inte.`);
  }

  const hasClearRisk =
    Boolean(topKpi) || delayed.length > 0 || followGoals.length > 0;
  let risk: string | null = null;
  if (topKpi) {
    risk = `Fortsatt avvikelse i ${topKpi.name} behöver följas upp.`;
  } else if (delayed[0]) {
    risk = `Försenad aktivitet (${delayed[0].title}) ökar uppföljningsbehovet.`;
  } else if (followGoals[0]) {
    risk = `Målet "${followGoals[0].title}" ligger utanför plan.`;
  }

  const manager = area.manager?.trim();
  const ansvarig = manager || "Ej angiven i data.";

  let recommendation: string;
  if (topKpi) {
    recommendation = manager
      ? `Följ upp ${topKpi.name} med ${manager} och säkra en åtgärdsplan.`
      : `Följ upp ${topKpi.name} och säkra en åtgärdsplan.`;
  } else if (delayed[0]) {
    const owner = delayed[0].owner?.trim() || manager;
    recommendation = owner
      ? `Säkra nästa steg för "${delayed[0].title}" med ${owner}.`
      : `Säkra nästa steg för "${delayed[0].title}".`;
  } else if (followGoals[0]) {
    recommendation = `Följ upp målet "${followGoals[0].title}".`;
  } else if (status === "Grön") {
    recommendation = "Behåll den löpande uppföljningen.";
  } else {
    recommendation =
      "Komplettera underlaget och återkom med tydlig avvikelse och åtgärd.";
  }

  const sections: string[] = [
    area.name,
    `Status: ${status}`,
    "",
    "Läge:",
    lage,
  ];

  if (deviationBullets.length > 0) {
    sections.push("", "Viktigaste avvikelse:", ...deviationBullets.slice(0, 2));
  } else {
    sections.push(
      "",
      "Viktigaste avvikelse:",
      "• Inga tydliga avvikelser i tillgänglig data.",
    );
  }

  if (hasClearRisk && risk) {
    sections.push("", "Risk:", risk);
  }

  sections.push("", "Ansvarig:", ansvarig, "", "Rekommendation:", recommendation);

  return sections.join("\n");
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
