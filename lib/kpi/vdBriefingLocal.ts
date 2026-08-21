import type { StatusTone } from "@/types/status";

export type LocalVdBriefingInput = {
  firstName?: string | null;
  /** Kort sammanfattning (2–3 meningar), redan byggd från dashboarddata. */
  summaryText?: string | null;
  followUpKpis?: Array<{
    name?: string | null;
    area?: string | null;
    status?: StatusTone | null;
    owner?: string | null;
    monthlyEconomicSummary?: string | null;
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
  reportedTargetCount?: number | null;
  unreportedTargetCount?: number | null;
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
    return "Tillräckligt underlag saknas för en verksamhetsbedömning.";
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
  const reportedTargetCountInput = data.reportedTargetCount;
  const unreportedTargetCount = data.unreportedTargetCount ?? 0;
  const noReportedTargets = reportedTargetCountInput === 0;
  const followUp = noReportedTargets
    ? []
    : (data.followUpKpis ?? []).filter(Boolean);
  const redKpis = followUp.filter((kpi) => kpi?.status === "Röd");
  const yellowKpis = followUp.filter((kpi) => kpi?.status === "Gul");
  const delayed = (data.delayedActivities ?? []).filter(Boolean);
  const decisions = (data.openDecisions ?? []).filter(Boolean);
  const delayedCount = data.delayedActivityCount ?? 0;
  const openDecisionCount = data.openDecisionCount ?? 0;
  const hasReportingGap = unreportedTargetCount > 0 || noReportedTargets;

  const summary = toShortSummary(
    data.summaryText ||
      (noReportedTargets
        ? "Ingen TARGET-KPI är rapporterad. Saknad rapportering är en rapporteringsbrist, inte en verksamhetsavvikelse."
        : null),
  );

  type Bullet = { text: string; owner?: string | null };
  const important: Bullet[] = [];

  if (redKpis[0]) {
    important.push({
      text: redKpis[0].monthlyEconomicSummary
        ? `${redKpis[0].area ?? "Område"}: ${redKpis[0].monthlyEconomicSummary}.`
        : `${redKpis[0].area ?? "Område"}: negativ avvikelse i ${redKpis[0].name ?? "KPI"}.`,
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
      important.push({
        text: areaKpis[0]?.monthlyEconomicSummary
          ? `${area}: ${areaKpis[0].monthlyEconomicSummary}.`
          : `${area} ligger under budget.`,
        owner,
      });
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

  if (important.length < 3 && hasReportingGap) {
    important.push({
      text:
        unreportedTargetCount > 0
          ? `${unreportedTargetCount} TARGET-KPI:er är ej rapporterade (rapporteringsbrist).`
          : "Ingen TARGET-KPI är rapporterad (rapporteringsbrist).",
    });
  }

  if (important.length === 0) {
    important.push({
      text: noReportedTargets
        ? "Tillräckligt underlag saknas för verksamhetsavvikelser."
        : "Inga kritiska avvikelser i dagens underlag.",
    });
  }

  const positives: Bullet[] = [];
  if (!noReportedTargets) {
    for (const name of (data.greenAreaNames ?? []).filter(Boolean).slice(0, 3)) {
      positives.push({ text: `${name} utvecklas enligt plan.` });
    }
  }
  if (positives.length === 0) {
    positives.push({
      text: noReportedTargets
        ? "Tillräckligt underlag saknas för positiv utveckling."
        : data.positiveSummary?.trim()
          ? toShortSummary(data.positiveSummary).split(/(?<=[.!?])\s+/)[0] ??
            data.positiveSummary
          : "Tillräckligt underlag saknas för positiv utveckling.",
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
  if (risks.length === 0) {
    risks.push({
      text: noReportedTargets
        ? "Tillräckligt underlag saknas för att bedöma tvåveckorsrisk."
        : "Inga tydliga tvåveckorsrisker just nu.",
    });
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
  if (recommendations.length === 0 && !noReportedTargets) {
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
  const fallbackRecs = noReportedTargets
    ? [
        "Säkra att TARGET-KPI:er rapporteras innan läget bedöms.",
        "Behandla inte orapporterade KPI:er som avvikelser.",
        "Återkom när det finns rapporterade värden.",
      ]
    : [
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
