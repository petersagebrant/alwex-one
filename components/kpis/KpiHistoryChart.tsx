import { InfoPanel } from "@/components/ui";
import type { KpiStoredStatus } from "@/lib/kpi/kind";
import { formatKpiDisplayValue } from "@/lib/format/kpi";

export type KpiHistoryChartPoint = {
  value: string;
  status: KpiStoredStatus;
  recordedAt: string;
  label: string;
};

type KpiHistoryChartProps = {
  points: KpiHistoryChartPoint[];
  targetValue?: string | null;
  unit?: string | null;
  /** Statistik KPIs: no target legend / GYR; "Rapporterat värde" wording. */
  isStatistic?: boolean;
  className?: string;
};

const statusPointFill: Record<KpiStoredStatus, string> = {
  Grön: "#10b981",
  Gul: "#f59e0b",
  Röd: "#f43f5e",
  Statistik: "#64748b",
};

function parseNumericValue(value: string): number | null {
  const normalized = value.replace(",", ".").replace(/[^\d.-]/g, "");
  if (!normalized) {
    return null;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPercentChange(changePercent: number): string {
  const absolute = Math.abs(changePercent).toLocaleString("sv-SE", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const sign = changePercent > 0 ? "+" : changePercent < 0 ? "−" : "";
  return `${sign}${absolute} %`;
}

function changePeriodLabel(previousIso: string, latestIso: string): string {
  const previous = new Date(previousIso);
  const latest = new Date(latestIso);
  if (Number.isNaN(previous.getTime()) || Number.isNaN(latest.getTime())) {
    return "Sedan föregående mätning";
  }

  const days = Math.round(
    (latest.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (days >= 25 && days <= 40) {
    return "Sedan föregående månad";
  }
  if (days >= 6 && days <= 10) {
    return "Sedan föregående vecka";
  }
  if (days === 1) {
    return "Sedan föregående dag";
  }
  return "Sedan föregående mätning";
}

function computeChange(points: { numeric: number; recordedAt: string }[]) {
  if (points.length < 2) {
    return null;
  }

  const previous = points[points.length - 2];
  const latest = points[points.length - 1];
  if (previous.numeric === 0) {
    return null;
  }

  const changePercent =
    ((latest.numeric - previous.numeric) / Math.abs(previous.numeric)) * 100;

  return {
    changePercent,
    arrow: changePercent > 0 ? "↑" : changePercent < 0 ? "↓" : "→",
    label: formatPercentChange(changePercent),
    periodLabel: changePeriodLabel(previous.recordedAt, latest.recordedAt),
    toneClass:
      changePercent > 0
        ? "text-emerald-700"
        : changePercent < 0
          ? "text-rose-700"
          : "text-slate-700",
  };
}

export function KpiHistoryChart({
  points,
  targetValue,
  unit,
  isStatistic = false,
  className = "",
}: KpiHistoryChartProps) {
  if (points.length === 0) {
    return (
      <InfoPanel
        title="Historik"
        variant="info"
        showLabel={false}
        className={className}
      >
        Inga historiska värden registrerade ännu.
      </InfoPanel>
    );
  }

  const numericPoints = points
    .map((point) => {
      const numeric = parseNumericValue(point.value);
      if (numeric === null) {
        return null;
      }
      return { ...point, numeric };
    })
    .filter(
      (
        point,
      ): point is KpiHistoryChartPoint & { numeric: number } => point !== null,
    );

  if (numericPoints.length === 0) {
    return (
      <InfoPanel
        title="Historik"
        variant="info"
        showLabel={false}
        className={className}
      >
        Inga historiska värden registrerade ännu.
      </InfoPanel>
    );
  }

  const targetNumeric = targetValue
    ? parseNumericValue(targetValue)
    : null;

  const width = 720;
  const height = 280;
  const padding = { top: 24, right: 24, bottom: 52, left: 64 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const values = numericPoints.map((point) => point.numeric);
  if (targetNumeric !== null) {
    values.push(targetNumeric);
  }

  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const pad = (rawMax - rawMin || Math.abs(rawMax) || 1) * 0.12;
  const minValue = rawMin - pad;
  const maxValue = rawMax + pad;
  const range = maxValue - minValue || 1;

  const coords = numericPoints.map((point, index) => {
    const x =
      numericPoints.length === 1
        ? padding.left + innerWidth / 2
        : padding.left + (index / (numericPoints.length - 1)) * innerWidth;
    const y =
      padding.top +
      innerHeight -
      ((point.numeric - minValue) / range) * innerHeight;
    return { x, y, ...point };
  });

  const linePath = coords
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const yTicks = [minValue, minValue + range / 2, maxValue];
  const targetY =
    targetNumeric === null
      ? null
      : padding.top +
        innerHeight -
        ((targetNumeric - minValue) / range) * innerHeight;

  const change = computeChange(numericPoints);
  const latestPoint = numericPoints[numericPoints.length - 1];
  const previousPoint =
    numericPoints.length >= 2 ? numericPoints[numericPoints.length - 2] : null;
  const reportedValueSummary = isStatistic
    ? previousPoint
      ? `Rapporterat värde: ${previousPoint.value} → ${latestPoint.value}${unit?.trim() ? ` ${unit.trim()}` : ""}`
      : `Rapporterat värde: ${formatKpiDisplayValue(latestPoint.value, unit)}`
    : null;

  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="KPI-värden över tid"
          className="h-auto min-w-[320px] w-full"
        >
          {/* Y-axis label */}
          <text
            x={16}
            y={padding.top + innerHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90 16 ${padding.top + innerHeight / 2})`}
            className="fill-slate-500"
            fontSize="12"
            fontWeight="600"
          >
            KPI-värde
          </text>

          {/* X-axis label */}
          <text
            x={padding.left + innerWidth / 2}
            y={height - 8}
            textAnchor="middle"
            className="fill-slate-500"
            fontSize="12"
            fontWeight="600"
          >
            Datum
          </text>

          {yTicks.map((tick, index) => {
            const y =
              padding.top +
              innerHeight -
              ((tick - minValue) / range) * innerHeight;
            return (
              <g key={`tick-${index}`}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-400"
                  fontSize="11"
                >
                  {tick.toLocaleString("sv-SE", { maximumFractionDigits: 1 })}
                  {unit ? ` ${unit}` : ""}
                </text>
              </g>
            );
          })}

          {/* Axes */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + innerHeight}
            stroke="#cbd5e1"
            strokeWidth="1.5"
          />
          <line
            x1={padding.left}
            y1={padding.top + innerHeight}
            x2={width - padding.right}
            y2={padding.top + innerHeight}
            stroke="#cbd5e1"
            strokeWidth="1.5"
          />

          {targetY !== null ? (
            <line
              x1={padding.left}
              y1={targetY}
              x2={width - padding.right}
              y2={targetY}
              stroke="#94a3b8"
              strokeWidth="1.75"
              strokeDasharray="6 4"
            >
              <title>
                Målvärde: {targetValue}
                {unit ? ` ${unit}` : ""}
              </title>
            </line>
          ) : null}

          <path
            d={linePath}
            fill="none"
            stroke="#2563eb"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {coords.map((point) => (
            <g key={`${point.recordedAt}-${point.value}-${point.status}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r="5.5"
                fill={statusPointFill[point.status]}
                stroke="#ffffff"
                strokeWidth="2"
              />
              <title>
                {point.label}: {point.value}
                {unit ? ` ${unit}` : ""} · {point.status}
              </title>
            </g>
          ))}

          {coords.map((point, index) => {
            const showLabel =
              coords.length <= 6 ||
              index === 0 ||
              index === coords.length - 1 ||
              index % Math.ceil(coords.length / 4) === 0;
            if (!showLabel) {
              return null;
            }
            return (
              <text
                key={`label-${point.recordedAt}-${index}`}
                x={point.x}
                y={padding.top + innerHeight + 18}
                textAnchor="middle"
                className="fill-slate-500"
                fontSize="11"
              >
                {point.label}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-2">
          <span className="h-0.5 w-4 rounded bg-blue-600" aria-hidden />
          {isStatistic ? "Rapporterat värde" : "Utfall"}
        </span>
        {!isStatistic && targetNumeric !== null ? (
          <span className="inline-flex items-center gap-2">
            <span
              className="inline-block w-4 border-t-2 border-dashed border-slate-400"
              aria-hidden
            />
            Målvärde
          </span>
        ) : null}
        {!isStatistic ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full bg-emerald-500"
                aria-hidden
              />
              Grön
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full bg-amber-500"
                aria-hidden
              />
              Gul
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full bg-rose-500"
                aria-hidden
              />
              Röd
            </span>
          </>
        ) : null}
      </div>

      {reportedValueSummary ? (
        <p className="mt-3 text-sm font-medium text-slate-800">
          {reportedValueSummary}
        </p>
      ) : null}

      {change ? (
        <div className="mt-5 rounded-xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
          <p className={`text-xl font-semibold tracking-tight ${change.toneClass}`}>
            {change.arrow} {change.label}
          </p>
          <p className="mt-1 text-sm text-slate-500">{change.periodLabel}</p>
        </div>
      ) : null}
    </div>
  );
}
