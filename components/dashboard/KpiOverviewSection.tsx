import Link from "next/link";
import {
  InfoPanel,
  SectionHeader,
  StatusBadge,
} from "@/components/ui";
import { BeraknadTypeBadge } from "@/components/kpis/BeraknadTypeBadge";
import { ReportingStatusBadge } from "@/components/kpis/ReportingStatusBadge";
import { formatKpiDisplayValue } from "@/lib/format/kpi";
import { formatDateSv } from "@/lib/format/date";
import {
  formatExpectedFinalizationSv,
  formatPeriodMonthSv,
  isMonthlyEconomicResultKpi,
} from "@/lib/kpi/economics";
import { buildMonthlyResultPresentation } from "@/lib/kpi/monthlyResultPresentation";
import { resolveKpiStatusPresentation } from "@/lib/kpi/statusPresentation";
import type {
  KpiOverviewAreaSection,
  KpiOverviewData,
  KpiOverviewDisplayItem,
} from "@/services/kpiOverview";

type KpiOverviewSectionProps = {
  data: KpiOverviewData;
};

function StatusCountPills({
  counts,
}: {
  counts: KpiOverviewAreaSection["statusCounts"];
}) {
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200/80 bg-rose-50/80 px-2.5 py-1.5 font-semibold text-rose-800">
        Röd <span className="tabular-nums">{counts.Röd}</span>
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200/80 bg-amber-50/80 px-2.5 py-1.5 font-semibold text-amber-900">
        Gul <span className="tabular-nums">{counts.Gul}</span>
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50/80 px-2.5 py-1.5 font-semibold text-emerald-800">
        Grön <span className="tabular-nums">{counts.Grön}</span>
      </span>
    </div>
  );
}

function KpiStatusCell({ item }: { item: KpiOverviewDisplayItem }) {
  if (item.kpi.isPeriodPending) {
    return (
      <span className="rounded-md bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
        Inväntar bokslut
      </span>
    );
  }
  const presentation = resolveKpiStatusPresentation(item.kpi);
  switch (presentation.kind) {
    case "rapporterad":
      return <ReportingStatusBadge reported />;
    case "ej_rapporterad":
      return <ReportingStatusBadge reported={false} />;
    case "beraknad":
      return <BeraknadTypeBadge />;
    case "tone":
      return <StatusBadge status={presentation.status} />;
    default:
      return null;
  }
}

function monthlyResultPeriod(item: KpiOverviewDisplayItem): string | null {
  return (
    (item.kpi.isPeriodPending
      ? item.kpi.expectedPeriodMonth
      : item.kpi.latestPeriodMonth) ??
    item.kpi.latestPeriodMonth ??
    item.kpi.expectedPeriodMonth ??
    null
  );
}

function KeyKpiRows({ items }: { items: KpiOverviewDisplayItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500">Inga nyckel-KPI:er att visa.</p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item) => (
        <li key={item.kpi.id}>
          <Link
            href={item.href}
            className="group flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0 outline-none transition hover:bg-slate-50/80 focus-visible:ring-2 focus-visible:ring-slate-300 rounded-lg"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900 group-hover:underline">
                {isMonthlyEconomicResultKpi(item.kpi)
                  ? `${item.kpi.name}${
                      monthlyResultPeriod(item)
                        ? ` – ${formatPeriodMonthSv(monthlyResultPeriod(item)!)}`
                        : ""
                    }`
                  : item.kpi.name}
              </p>
              {isMonthlyEconomicResultKpi(item.kpi) ? (
                <MonthlyResultValues item={item} />
              ) : (
                <p className="mt-0.5 text-base font-semibold tabular-nums text-slate-900">
                  {formatKpiDisplayValue(item.kpi.currentValue, item.kpi.unit)}
                  {item.kpi.targetValue ? (
                    <span className="text-sm font-normal text-slate-400">
                      {" "}
                      / mål{" "}
                      {formatKpiDisplayValue(
                        item.kpi.targetValue,
                        item.kpi.unit,
                      )}
                    </span>
                  ) : null}
                </p>
              )}
              <p className="mt-0.5 text-xs text-slate-500">
                Trend: {item.displayTrend}
                {item.lastReportedAt
                  ? ` · Senast ${formatDateSv(item.lastReportedAt.slice(0, 10))}`
                  : null}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <KpiStatusCell item={item} />
              <span
                aria-hidden
                className="text-base leading-none text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500"
              >
                ›
              </span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MonthlyResultValues({ item }: { item: KpiOverviewDisplayItem }) {
  const { kpi } = item;
  const periodMonth = monthlyResultPeriod(item);
  if (!periodMonth) {
    return <p className="mt-1 text-sm text-slate-500">Inväntar bokslut</p>;
  }
  const presentation = buildMonthlyResultPresentation({
    kpiName: kpi.name,
    unit: kpi.unit,
    periodLabel: formatPeriodMonthSv(periodMonth),
    isReported: !kpi.isPeriodPending,
    expectedFinalizationLabel: kpi.isPeriodPending
      ? `Förväntas omkring ${formatExpectedFinalizationSv(periodMonth)}`
      : null,
    actualValue: kpi.latestActualValue,
    budgetValue: kpi.latestBudgetValue,
    status: kpi.status,
  });
  if (presentation.pendingLabel) {
    return (
      <dl className="mt-1 space-y-0.5 text-sm text-slate-600">
        <div><dt className="inline">Resultatmånad: </dt><dd className="inline font-medium">{presentation.resultMonth}</dd></div>
        <div><dt className="sr-only">Status</dt><dd>{presentation.pendingLabel}</dd></div>
        {presentation.expectedFinalizationLabel ? (
          <div><dt className="sr-only">Förväntat bokslut</dt><dd>{presentation.expectedFinalizationLabel}</dd></div>
        ) : null}
      </dl>
    );
  }
  return (
    <dl className="mt-1 space-y-0.5 text-sm tabular-nums text-slate-600">
      <div><dt className="inline">Resultatmånad: </dt><dd className="inline font-medium text-slate-800">{presentation.resultMonth}</dd></div>
      <div><dt className="inline">Faktiskt resultat: </dt><dd className="inline font-medium text-slate-800">{presentation.actualValue}</dd></div>
      <div><dt className="inline">Budgeterat resultat: </dt><dd className="inline font-medium text-slate-800">{presentation.budgetValue}</dd></div>
      <div><dt className="inline">Avvikelse: </dt><dd className="inline font-medium text-slate-800">{presentation.deviationValue}</dd></div>
      <div><dt className="inline">Status: </dt><dd className="inline font-medium text-slate-800">{presentation.statusValue}</dd></div>
    </dl>
  );
}

function AreaOverviewCard({
  section,
  emphasize,
}: {
  section: KpiOverviewAreaSection;
  emphasize?: boolean;
}) {
  const areaHref =
    !section.isAlwexTotalt && section.areaSlug
      ? `/areas/${section.areaSlug}`
      : null;

  return (
    <article
      className={`rounded-2xl border bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] sm:p-6 ${
        emphasize
          ? "border-slate-300/90 ring-1 ring-slate-200/80"
          : "border-slate-200/80"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-tight text-slate-900">
            {areaHref ? (
              <Link
                href={areaHref}
                className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 rounded-sm"
              >
                {section.areaName}
              </Link>
            ) : (
              section.areaName
            )}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            {section.reporting.totalCount > 0
              ? `${section.reporting.totalCount} KPI:er att rapportera idag – ${section.reporting.reportedCount} av ${section.reporting.totalCount} rapporterade`
              : "Inga manuella KPI:er att rapportera"}
          </p>
        </div>
        <StatusCountPills counts={section.statusCounts} />
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Nyckel-KPI:er
        </p>
        <KeyKpiRows items={section.keyKpis} />
      </div>

      {areaHref ? (
        <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
          <Link
            href={areaHref}
            className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
          >
            Visa alla KPI:er
          </Link>
        </div>
      ) : null}
    </article>
  );
}

/** VD KPI-översikt: Alwex totalt + AO sections with key KPIs. */
export function KpiOverviewSection({ data }: KpiOverviewSectionProps) {
  const hasContent = data.alwexTotalt != null || data.areas.length > 0;

  return (
    <section aria-labelledby="kpi-overview-heading" className="space-y-4">
      <SectionHeader
        title="KPI-översikt"
        description="Nyckel-KPI:er per affärsområde. Grön/Gul/Röd räknas endast för KPI:er med mål."
        className="scroll-mt-6"
        action={
          <Link
            href="/areas"
            className="text-sm font-medium text-slate-700 underline-offset-4 hover:underline"
          >
            Alla affärsområden
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
        <p className="text-sm font-medium text-slate-700">Totalt (mål-KPI)</p>
        <StatusCountPills counts={data.orgStatusCounts} />
      </div>

      {!hasContent ? (
        <InfoPanel title="KPI" variant="info" showLabel={false} compact>
          Inga aktiva KPI:er registrerade ännu.
        </InfoPanel>
      ) : (
        <div className="space-y-4">
          {data.alwexTotalt ? (
            <AreaOverviewCard section={data.alwexTotalt} emphasize />
          ) : null}

          {data.areas.length > 0 ? (
            <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {data.areas.map((section) => (
                <li key={section.areaId}>
                  <AreaOverviewCard section={section} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </section>
  );
}

/** Optional helper export for type-only consumers. */
export type { KpiOverviewDisplayItem };
