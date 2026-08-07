type VdBriefingProps = {
  content?: string | null;
};

/**
 * Renders the VD morning briefing (markdown subset) with clear section spacing.
 */
export function VdBriefing({ content }: VdBriefingProps) {
  const blocks = parseBriefingMarkdown(content ?? "");
  const sections = groupBriefingSections(blocks);

  return (
    <section className="rounded-2xl border border-indigo-200/70 bg-indigo-50/40 p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-6">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
        VD Briefing
      </p>
      <div className="mt-5 divide-y divide-indigo-200/70 text-sm text-slate-700">
        {sections.map((section, sectionIndex) => {
          const heading = section.heading ?? "";
          const isFooter = heading.toLowerCase().includes("analysen bygger");
          const isIntro = !section.heading;

          return (
            <div
              key={`section-${sectionIndex}`}
              className={
                sectionIndex === 0 ? "pb-5" : isFooter ? "pt-5" : "py-5"
              }
            >
              {section.heading ? (
                <h2
                  className={
                    isFooter
                      ? "text-xs font-semibold tracking-wide text-slate-500 uppercase"
                      : "text-base font-semibold tracking-tight text-slate-900"
                  }
                >
                  {section.heading}
                </h2>
              ) : null}

              <div
                className={
                  section.heading
                    ? isFooter
                      ? "mt-2.5 space-y-2"
                      : "mt-3 space-y-3"
                    : "space-y-2.5"
                }
              >
                {section.blocks.map((block, index) => {
                  if (block.type === "list") {
                    return (
                      <ul
                        key={`ul-${sectionIndex}-${index}`}
                        className={
                          isFooter
                            ? "list-none space-y-1.5 pl-0 text-xs text-slate-500"
                            : "list-none space-y-3 pl-0"
                        }
                      >
                        {(block.items ?? []).map((item, itemIndex) => {
                          const parsed = parseListItem(item);
                          return (
                            <li
                              key={`li-${sectionIndex}-${index}-${itemIndex}`}
                              className={isFooter ? "" : "pl-0"}
                            >
                              <div className="flex gap-2">
                                <span
                                  aria-hidden
                                  className={
                                    isFooter
                                      ? "text-slate-400"
                                      : "mt-0.5 text-slate-400"
                                  }
                                >
                                  •
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p
                                    className={
                                      isFooter
                                        ? "leading-relaxed"
                                        : "leading-snug text-slate-800"
                                    }
                                  >
                                    {parsed.text}
                                  </p>
                                  {parsed.owner ? (
                                    <p className="mt-1 text-xs font-medium tracking-wide text-slate-500">
                                      Ansvarig: {parsed.owner}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    );
                  }

                  const text = block.text ?? "";
                  const isGreeting =
                    isIntro && index === 0 && /^God morgon\b/i.test(text);

                  return (
                    <p
                      key={`p-${sectionIndex}-${index}`}
                      className={
                        isFooter
                          ? "text-xs text-slate-500"
                          : isGreeting
                            ? "text-base font-semibold tracking-tight text-slate-900"
                            : "leading-relaxed whitespace-pre-line text-slate-700"
                      }
                    >
                      {text}
                    </p>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
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
} {
  const raw = (item ?? "").trim();
  if (!raw) {
    return { text: "", owner: null };
  }

  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let text = lines[0] ?? "";
  let owner: string | null = null;

  for (const line of lines.slice(1)) {
    const match = line.match(/^Ansvarig:\s*(.+)$/i);
    if (match?.[1]) {
      owner = match[1].trim();
    }
  }

  const sameLine = text.match(/^(.*?)\s+Ansvarig:\s*(.+)$/i);
  if (sameLine?.[1] && sameLine[2]) {
    text = sameLine[1].trim();
    owner = sameLine[2].trim();
  }

  const paren = text.match(/^(.*?)\s*\(\s*ansvarig:\s*(.+?)\s*\)\s*$/i);
  if (paren?.[1] && paren[2]) {
    text = paren[1].trim();
    owner = paren[2].trim();
  }

  return { text, owner };
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

function parseBriefingMarkdown(markdown: string | null | undefined): BriefingBlock[] {
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
