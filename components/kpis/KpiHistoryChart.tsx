type KpiHistoryChartPoint = {
  value: string;
  recordedAt: string;
  label: string;
};

type KpiHistoryChartProps = {
  points: KpiHistoryChartPoint[];
  unit?: string | null;
  className?: string;
};

function parseNumericValue(value: string): number | null {
  const normalized = value.replace(",", ".").replace(/[^\d.-]/g, "");
  if (!normalized) {
    return null;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function KpiHistoryChart({
  points,
  unit,
  className = "",
}: KpiHistoryChartProps) {
  const numericPoints = points
    .map((point) => {
      const numeric = parseNumericValue(point.value);
      if (numeric === null) {
        return null;
      }
      return { ...point, numeric };
    })
    .filter(
      (point): point is KpiHistoryChartPoint & { numeric: number } =>
        point !== null,
    );

  if (numericPoints.length === 0) {
    return (
      <p className={`text-sm text-slate-500 ${className}`}>
        Diagram kräver minst ett numeriskt värde i historiken.
      </p>
    );
  }

  const width = 640;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 36, left: 44 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const values = numericPoints.map((point) => point.numeric);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
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

  const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${padding.top + innerHeight} L ${coords[0].x} ${padding.top + innerHeight} Z`;

  const yTicks = [minValue, minValue + range / 2, maxValue];

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="KPI-värden över tid"
        className="h-auto w-full"
      >
        <defs>
          <linearGradient id="kpiHistoryFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5b5bd6" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#5b5bd6" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => {
          const y =
            padding.top +
            innerHeight -
            ((tick - minValue) / range) * innerHeight;
          return (
            <g key={`tick-${tick}`}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x={padding.left - 8}
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

        <path d={areaPath} fill="url(#kpiHistoryFill)" />
        <path
          d={linePath}
          fill="none"
          stroke="#5b5bd6"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {coords.map((point) => (
          <g key={`${point.recordedAt}-${point.value}`}>
            <circle cx={point.x} cy={point.y} r="4" fill="#5b5bd6" />
            <title>
              {point.label}: {point.value}
              {unit ? ` ${unit}` : ""}
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
              key={`label-${point.recordedAt}`}
              x={point.x}
              y={height - 12}
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
  );
}
