import Link from "next/link";

export type VdBriefingStats = {
  areas: number;
  greenKpis: number;
  yellowKpis: number;
  redKpis: number;
  delayedActivities: number;
};

export type VdBriefingLinkHint = {
  label: string;
  href: string;
  area?: string | null;
};

type VdBriefingProps = {
  content?: string | null;
  /** Compact KPI/area status strip under the greeting summary. */
  stats?: VdBriefingStats | null;
  /** Optional targets used to make attention/risk rows clickable. */
  linkHints?: VdBriefingLinkHint[] | null;
};

type SectionKind =
  | "attention"
  | "positive"
  | "risks"
  | "recommendations"
  | "analysis"
  | "other";

type ParsedItem = {
  text: string;
  owner: string | null;
  area: string | null;
  deadline: string | null;
  href: string | null;
};

/**
 * Renders the VD morning briefing as a compact executive overview.
 * Parses existing markdown content — does not change AI generation.
 */
export function VdBriefing({
  content,
  stats = null,
  linkHints = null,
}: VdBriefingProps) {
  const blocks = parseBriefingMarkdown(content ?? "");
  const sections = groupBriefingSections(blocks);
  const intro = sections.find((section) => !section.heading) ?? null;
  const { greeting, summary } = splitIntro(intro);
  const analysis = sections.find(
    (section) => classifyHeading(section.heading) === "analysis",
  );
  const footerMeta = buildFooterMeta(analysis, content ?? "");
  const displayStats = stats ?? footerMeta.stats;

  const cards: Array<{
    kind: Exclude<SectionKind, "analysis" | "other">;
    title: string;
    icon: string;
    titleClass: string;
    accentBar: string;
    items: ParsedItem[];
    empty: string;
  }> = [
    {
      kind: "attention",
      title: "Kräver uppmärksamhet",
      icon: "🔴",
      titleClass: "text-rose-700",
      accentBar: "bg-rose-500",
      items: itemsForKind(sections, "attention", linkHints).slice(0, 3),
      empty: "Inga kritiska avvikelser just nu.",
    },
    {
      kind: "positive",
      title: "Positiv utveckling",
      icon: "🟢",
      titleClass: "text-emerald-700",
      accentBar: "bg-emerald-500",
      items: itemsForKind(sections, "positive", linkHints).slice(0, 3),
      empty: "Inga positiva signaler i dagens underlag.",
    },
    {
      kind: "risks",
      title: "Kommande risker",
      icon: "⚠️",
      titleClass: "text-amber-700",
      accentBar: "bg-amber-400",
      items: itemsForKind(sections, "risks", linkHints).slice(0, 3),
      empty: "Inga tydliga risker de kommande 14 dagarna.",
    },
    {
      kind: "recommendations",
      title: "Mina rekommendationer idag",
      icon: "✅",
      titleClass: "text-sky-800",
      accentBar: "bg-sky-500",
      items: itemsForKind(sections, "recommendations", linkHints).slice(0, 3),
      empty: "Inga rekommendationer just nu.",
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-5">
      <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
        VD Briefing
      </p>

      <div className="mt-2.5 space-y-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          {greeting || "God morgon."}
        </h1>
        {summary ? (
          <p className="max-w-3xl text-sm leading-snug text-slate-600 sm:text-[15px]">
            {summary}
          </p>
        ) : null}
      </div>

      {displayStats ? (
        <ul className="mt-3.5 flex list-none flex-wrap gap-2 p-0">
          <li>
            <BriefingStatBadge label={`${displayStats.areas} affärsområden`} />
          </li>
          <li>
            <BriefingStatBadge
              label={`${displayStats.greenKpis} gröna KPI`}
              tone="green"
            />
          </li>
          <li>
            <BriefingStatBadge
              label={`${displayStats.yellowKpis} gula`}
              tone="yellow"
            />
          </li>
          <li>
            <BriefingStatBadge
              label={`${displayStats.redKpis} ${displayStats.redKpis === 1 ? "röd" : "röda"}`}
              tone="red"
            />
          </li>
          <li>
            <BriefingStatBadge
              label={`${displayStats.delayedActivities} försenade`}
            />
          </li>
        </ul>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {cards.map((card) => (
          <article
            key={card.kind}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-5"
          >
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className={`h-5 w-1 shrink-0 rounded-full ${card.accentBar}`}
              />
              <h2
                className={`flex min-w-0 items-center gap-1.5 text-sm font-semibold tracking-tight ${card.titleClass}`}
              >
                <span aria-hidden className="text-[13px] leading-none">
                  {card.icon}
                </span>
                <span>{card.title}</span>
              </h2>
            </div>

            {card.items.length === 0 ? (
              <p className="mt-3.5 text-sm text-slate-500">{card.empty}</p>
            ) : (
              <ul className="mt-3.5 space-y-3.5">
                {card.items.map((item, index) => (
                  <li key={`${card.kind}-${index}`}>
                    <BriefingItemRow item={item} />
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>

      <p className="mt-3.5 text-[11px] leading-relaxed text-slate-400">
        {footerMeta.basisLine}
        {footerMeta.updatedLabel
          ? ` · Uppdaterad ${footerMeta.updatedLabel}`
          : ""}
      </p>
    </section>
  );
}

function BriefingStatBadge({
  label,
  tone,
}: {
  label: string;
  tone?: "green" | "yellow" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "border-emerald-200/80 bg-emerald-50/70 text-emerald-800"
      : tone === "yellow"
        ? "border-amber-200/80 bg-amber-50/70 text-amber-800"
        : tone === "red"
          ? "border-rose-200/80 bg-rose-50/70 text-rose-800"
          : "border-slate-200/80 bg-slate-50 text-slate-600";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${toneClass}`}
    >
      {label}
    </span>
  );
}

function BriefingItemRow({ item }: { item: ParsedItem }) {
  const body = (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        {item.area ? (
          <p className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
            {item.area}
          </p>
        ) : null}
        <p className="text-sm leading-snug font-medium text-slate-900">
          {item.text}
        </p>
        {(item.owner || item.deadline) && (
          <p className="text-xs text-slate-500">
            {item.owner ? `Ansvarig: ${item.owner}` : null}
            {item.owner && item.deadline ? " · " : null}
            {item.deadline ? `Deadline: ${item.deadline}` : null}
          </p>
        )}
      </div>
      {item.href ? (
        <span
          aria-hidden
          className="mt-0.5 shrink-0 text-base leading-none text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500"
        >
          ›
        </span>
      ) : null}
    </div>
  );

  if (item.href) {
    return (
      <Link
        href={item.href}
        className="group -mx-2 block rounded-xl px-2 py-1.5 outline-none transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-300"
      >
        {body}
      </Link>
    );
  }

  return body;
}

function itemsForKind(
  sections: BriefingSection[],
  kind: SectionKind,
  linkHints: VdBriefingLinkHint[] | null,
): ParsedItem[] {
  const section = sections.find(
    (entry) => classifyHeading(entry.heading) === kind,
  );
  if (!section) {
    return [];
  }
  const items: ParsedItem[] = [];
  for (const block of section.blocks) {
    if (block.type === "list") {
      for (const raw of block.items ?? []) {
        items.push(enrichItem(parseListItem(raw), linkHints));
      }
    } else if (block.text?.trim()) {
      items.push(enrichItem(parseListItem(block.text), linkHints));
    }
  }
  return items;
}

function enrichItem(
  parsed: {
    text: string;
    owner: string | null;
    area: string | null;
    deadline: string | null;
  },
  linkHints: VdBriefingLinkHint[] | null,
): ParsedItem {
  return {
    ...parsed,
    href: resolveHref(parsed, linkHints),
  };
}

function resolveHref(
  item: {
    text: string;
    owner: string | null;
    area: string | null;
  },
  linkHints: VdBriefingLinkHint[] | null,
): string | null {
  if (!linkHints?.length) {
    return null;
  }
  const haystack = `${item.area ?? ""} ${item.text}`.toLowerCase();
  let best: { href: string; score: number } | null = null;

  for (const hint of linkHints) {
    const label = hint.label?.trim();
    if (!label || label.length < 3) {
      continue;
    }
    const needle = label.toLowerCase();
    if (!haystack.includes(needle)) {
      continue;
    }
    let score = needle.length;
    if (
      item.area &&
      hint.area &&
      item.area.toLowerCase() === hint.area.toLowerCase()
    ) {
      score += 50;
    }
    if (!best || score > best.score) {
      best = { href: hint.href, score };
    }
  }

  return best?.href ?? null;
}

function splitIntro(intro: BriefingSection | null): {
  greeting: string;
  summary: string;
} {
  const paragraphs = (intro?.blocks ?? [])
    .filter((block) => block.type === "paragraph")
    .map((block) => block.text?.trim() ?? "")
    .filter(Boolean);

  const greeting =
    paragraphs.find((text) => /^God morgon\b/i.test(text)) ??
    paragraphs[0] ??
    "";
  const summaryParts = paragraphs.filter((text) => text !== greeting);
  const summary = toShortSummary(summaryParts.join(" "));
  return { greeting, summary };
}

function toShortSummary(raw: string): string {
  const text = raw.trim();
  if (!text) {
    return "";
  }
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
}

function classifyHeading(heading: string | null): SectionKind {
  const value = (heading ?? "").toLowerCase();
  if (!value) {
    return "other";
  }
  if (value.includes("analysen bygger") || value.includes("ai-analys")) {
    return "analysis";
  }
  if (
    value.includes("viktigaste") ||
    value.includes("uppmärksamhet") ||
    value.includes("🔴")
  ) {
    return "attention";
  }
  if (
    value.includes("positiv") ||
    value.includes("🟢")
  ) {
    return "positive";
  }
  if (
    value.includes("risk") ||
    value.includes("⚠") ||
    value.includes("⚠️")
  ) {
    return "risks";
  }
  if (
    value.includes("rekommendation") ||
    value.includes("✅")
  ) {
    return "recommendations";
  }
  return "other";
}

function buildFooterMeta(
  analysis: BriefingSection | undefined,
  rawContent: string,
): {
  basisLine: string;
  updatedLabel: string | null;
  stats: VdBriefingStats | null;
} {
  const counts: Record<string, number> = {};
  const listItems =
    analysis?.blocks.find((block) => block.type === "list")?.items ?? [];

  for (const item of listItems) {
    const match = item.match(
      /(\d+)\s+(affärsområden|kpi|mål|aktiviteter|beslut)/i,
    );
    if (match?.[1] && match[2]) {
      counts[match[2].toLowerCase()] = Number(match[1]);
    }
  }

  let updatedLabel: string | null = null;
  const createdMatch = rawContent.match(/Skapad:\s*(.+)$/im);
  if (createdMatch?.[1]) {
    updatedLabel = shortenTimeLabel(createdMatch[1].trim());
  }
  for (const block of analysis?.blocks ?? []) {
    if (block.type === "paragraph" && /Skapad:/i.test(block.text ?? "")) {
      const m = block.text?.match(/Skapad:\s*(.+)$/i);
      if (m?.[1]) {
        updatedLabel = shortenTimeLabel(m[1].trim());
      }
    }
  }

  const areas = counts["affärsområden"] ?? 0;
  const kpis = counts.kpi ?? 0;
  const goals = counts["mål"] ?? 0;
  const activities = counts.aktiviteter ?? 0;
  const decisions = counts.beslut ?? 0;

  const parts = [
    areas ? `${areas} affärsområden` : null,
    kpis ? `${kpis} KPI` : null,
    goals ? `${goals} mål` : null,
    `${activities} aktiviteter`,
    decisions ? `${decisions} beslut` : null,
  ].filter(Boolean);

  const basisLine =
    parts.length > 0
      ? `AI-analys baserad på ${parts.join(", ")}`
      : "AI-analys baserad på aktuellt beslutsunderlag";

  return {
    basisLine,
    updatedLabel,
    stats: null,
  };
}

function shortenTimeLabel(label: string): string {
  // Prefer HH:MM when a Swedish datetime string is present.
  const time = label.match(/\b(\d{1,2}[:.]\d{2})\b/);
  if (time?.[1]) {
    return time[1].replace(".", ":");
  }
  return label;
}

type BriefingBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] };

type BriefingSection = {
  heading: string | null;
  blocks: Array<
    | { type: "paragraph"; text: string }
    | { type: "list"; items: string[] }
  >;
};

function parseListItem(item: string | null | undefined): {
  text: string;
  owner: string | null;
  area: string | null;
  deadline: string | null;
} {
  const raw = (item ?? "").trim();
  if (!raw) {
    return { text: "", owner: null, area: null, deadline: null };
  }

  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let text = lines[0] ?? "";
  let owner: string | null = null;
  let deadline: string | null = null;

  for (const line of lines.slice(1)) {
    const ownerMatch = line.match(/^Ansvarig:\s*(.+)$/i);
    if (ownerMatch?.[1]) {
      owner = ownerMatch[1].trim();
      continue;
    }
    const deadlineMatch = line.match(/^(?:Deadline|Förfaller):\s*(.+)$/i);
    if (deadlineMatch?.[1]) {
      deadline = deadlineMatch[1].trim();
    }
  }

  const sameLineOwner = text.match(/^(.*?)\s+Ansvarig:\s*(.+)$/i);
  if (sameLineOwner?.[1] && sameLineOwner[2]) {
    text = sameLineOwner[1].trim();
    owner = sameLineOwner[2].trim();
  }

  const parenOwner = text.match(/^(.*?)\s*\(\s*ansvarig:\s*(.+?)\s*\)\s*$/i);
  if (parenOwner?.[1] && parenOwner[2]) {
    text = parenOwner[1].trim();
    owner = parenOwner[2].trim();
  }

  const dueInline = text.match(
    /^(.*?)\s*(?:Förfaller|Deadline)\s+(.+?)\.?$/i,
  );
  if (dueInline?.[1] && dueInline[2] && !deadline) {
    text = dueInline[1].trim().replace(/[.:]$/, "");
    deadline = dueInline[2].trim().replace(/\.$/, "");
  }

  let area: string | null = null;
  const areaPrefix = text.match(
    /^([^:]{2,60}):\s+(.+)$/,
  );
  if (areaPrefix?.[1] && areaPrefix[2]) {
    const candidate = areaPrefix[1].trim();
    // Avoid treating action verbs / long sentences as area labels.
    if (
      candidate.length <= 40 &&
      !/^(följ|lås|stäng|bekräfta|behåll|stäm|försenad|öppet|ingen|inga)/i.test(
        candidate,
      )
    ) {
      area = candidate;
      text = areaPrefix[2].trim();
    }
  }

  return { text, owner, area, deadline };
}

function groupBriefingSections(blocks: BriefingBlock[]): BriefingSection[] {
  const sections: BriefingSection[] = [];
  let current: BriefingSection = { heading: null, blocks: [] };

  for (const block of blocks ?? []) {
    if (!block) {
      continue;
    }
    if (block.type === "heading") {
      if (current.heading !== null || current.blocks.length > 0) {
        sections.push(current);
      }
      current = { heading: block.text ?? "", blocks: [] };
      continue;
    }
    current.blocks.push(block);
  }

  if (current.heading !== null || current.blocks.length > 0) {
    sections.push(current);
  }

  return sections;
}

function parseBriefingMarkdown(
  markdown: string | null | undefined,
): BriefingBlock[] {
  const lines = String(markdown ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n");
  const blocks: BriefingBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  function flushParagraph() {
    const text = paragraphLines.join("\n").trim();
    if (text) {
      blocks.push({ type: "paragraph", text });
    }
    paragraphLines = [];
  }

  function flushList() {
    if (listItems.length > 0) {
      blocks.push({ type: "list", items: listItems });
    }
    listItems = [];
  }

  for (const rawLine of lines) {
    const line = (rawLine ?? "").trimEnd();
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    const bullet = line.match(/^[-*•]\s+(.+)$/);
    const ownerContinuation = line.match(/^\s{2,}Ansvarig:\s*(.+)$/i);

    if (heading?.[1]) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", text: heading[1].trim() });
      continue;
    }

    if (bullet?.[1]) {
      flushParagraph();
      listItems.push(bullet[1].trim());
      continue;
    }

    if (ownerContinuation?.[1] && listItems.length > 0) {
      const last = listItems[listItems.length - 1] ?? "";
      listItems[listItems.length - 1] =
        `${last}\nAnsvarig: ${ownerContinuation[1].trim()}`;
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }

    flushList();
    paragraphLines.push(line.trim());
  }

  flushParagraph();
  flushList();

  return blocks;
}
