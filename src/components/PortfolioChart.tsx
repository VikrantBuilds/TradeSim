import { useMemo } from "react";
import type { PortfolioPoint } from "@/lib/supabase";

interface Props {
  points: PortfolioPoint[];
  startingCash: number;
}

export default function PortfolioChart({ points, startingCash }: Props) {
  const { path, area, minV, maxV, width, height, baselineY, spark } = useMemo(() => {
    const w = 600;
    const h = 200;
    const pad = 8;
    if (points.length < 2) {
      return { path: "", area: "", minV: 0, maxV: 0, width: w, height: h, baselineY: 0, spark: null };
    }
    const vals = points.map((p) => p.total);
    const minV = Math.min(...vals, startingCash);
    const maxV = Math.max(...vals, startingCash);
    const range = maxV - minV || 1;
    const stepX = (w - pad * 2) / (points.length - 1);
    const coords = points.map((p, i) => {
      const x = pad + i * stepX;
      const y = pad + (h - pad * 2) * (1 - (p.total - minV) / range);
      return { x, y };
    });
    const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(" ");
    const area = `${path} L${coords[coords.length - 1].x.toFixed(2)},${h - pad} L${coords[0].x.toFixed(2)},${h - pad} Z`;
    const baselineY = pad + (h - pad * 2) * (1 - (startingCash - minV) / range);
    const last = coords[coords.length - 1];
    const first = coords[0];
    const spark = { lastX: last.x, lastY: last.y, up: points[points.length - 1].total >= points[0].total, firstY: first.y };
    return { path, area, minV, maxV, width: w, height: h, baselineY, spark };
  }, [points, startingCash]);

  if (points.length < 2) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-slate-500">
        Chart will appear as the market ticks and your portfolio value is recorded.
      </div>
    );
  }

  const up = spark!.up;
  const stroke = up ? "#34d399" : "#fb7185";
  const fill = up ? "rgba(52,211,153,0.15)" : "rgba(251,113,133,0.12)";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[200px]" preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      {/* starting cash baseline */}
      <line
        x1="8" y1={baselineY} x2={width - 8} y2={baselineY}
        stroke="#475569" strokeWidth="1" strokeDasharray="4 4" opacity="0.5"
      />
      <path d={area} fill="url(#chartFill)" />
      <path d={path} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={spark!.lastX} cy={spark!.lastY} r="4" fill={stroke} />
      <circle cx={spark!.lastX} cy={spark!.lastY} r="7" fill={stroke} opacity="0.25" />
    </svg>
  );
}
