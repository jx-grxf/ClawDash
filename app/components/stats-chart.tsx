import type { DayStat } from "@/lib/openclaw-types";

interface StatsChartProps {
  data: DayStat[];
  metric: "totalTokens" | "avgResponseMs";
  color: string;
  height?: number;
}

function formatValue(metric: StatsChartProps["metric"], value: number): string {
  return metric === "avgResponseMs" ? `${value} ms` : `${value}`;
}

export function StatsChart({ data, metric, color, height = 220 }: StatsChartProps) {
  if (data.length === 0) {
    return <div className="flex h-[220px] items-center justify-center text-sm text-[var(--text-muted)]">no data</div>;
  }

  const pad = { top: 16, right: 20, bottom: 48, left: 56 };
  const width = Math.max(720, data.length * 46);
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;
  const values = data.map((item) => item[metric]);
  const max = Math.max(...values, 1);

  const toX = (index: number) => pad.left + (index / Math.max(data.length - 1, 1)) * chartWidth;
  const toY = (value: number) => pad.top + chartHeight - (value / max) * chartHeight;
  const points = data.map((item, index) => `${toX(index)},${toY(item[metric])}`).join(" ");
  const ticks = Array.from({ length: 5 }, (_, index) => Math.round((max / 4) * index));

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="min-w-full">
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} y1={toY(tick)} x2={width - pad.right} y2={toY(tick)} stroke="rgba(147,164,189,0.14)" />
            <text x={pad.left - 8} y={toY(tick) + 4} textAnchor="end" fontSize="10" fill="rgba(147,164,189,0.8)">
              {formatValue(metric, tick)}
            </text>
          </g>
        ))}
        <polyline points={points} fill="none" stroke={color} strokeWidth="3" />
        {data.map((item, index) => (
          <g key={`${item.date}-${index}`}>
            <circle cx={toX(index)} cy={toY(item[metric])} r="4" fill={color} />
            <text x={toX(index)} y={height - 18} textAnchor="middle" fontSize="10" fill="rgba(147,164,189,0.8)">
              {item.date.slice(5)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
