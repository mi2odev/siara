import React, { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function severityFromPercent(dangerPercent) {
  const safePercent = toFiniteNumber(dangerPercent);
  if (safePercent == null) return "low";
  if (safePercent < 25) return "low";
  if (safePercent < 50) return "moderate";
  if (safePercent < 75) return "high";
  return "extreme";
}

function normalizeSeverity(level, dangerPercent) {
  const text = String(level || "").trim().toLowerCase();
  if (text === "low" || text === "moderate" || text === "high" || text === "extreme") {
    return text;
  }
  return severityFromPercent(dangerPercent);
}

function severityRank(level) {
  if (level === "extreme") return 3;
  if (level === "high") return 2;
  if (level === "moderate") return 1;
  return 0;
}

function colorForSeverity(level) {
  if (level === "moderate") return "#f59e0b";
  if (level === "high" || level === "extreme") return "#391717";
  return "#22c55e";
}

function normalizePoint(item, index) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const dangerPercent = toFiniteNumber(item.danger_percent);
  if (dangerPercent == null) {
    return null;
  }

  const timeLabel = String(item.time_label || "").trim();
  const fallbackTime = String(item.time_iso || "").slice(11, 16);

  return {
    index,
    time_label: timeLabel || fallbackTime || `h${index}`,
    danger_percent: Math.max(0, Math.min(100, dangerPercent)),
    severity: normalizeSeverity(item.danger_level, dangerPercent),
  };
}

function DangerTooltip({ active, payload, label }) {
  if (!active || !Array.isArray(payload) || payload.length === 0) {
    return null;
  }

  const raw = payload[0]?.value;
  const dangerPercent = toFiniteNumber(raw);
  const rounded = dangerPercent == null ? "n/a" : `${Math.round(dangerPercent)}%`;

  return (
    <div className="danger-chart-tooltip">
      <div className="danger-chart-tooltip-time">{label}</div>
      <div className="danger-chart-tooltip-value">Danger: {rounded}</div>
    </div>
  );
}

export default function DangerForecastChart({ points, loading = false }) {
  const data = useMemo(() => {
    if (!Array.isArray(points)) {
      return [];
    }
    return points.map((item, index) => normalizePoint(item, index)).filter(Boolean);
  }, [points]);
  const chartSeverity = useMemo(() => {
    if (data.length === 0) {
      return "low";
    }
    let best = "low";
    let bestRank = -1;
    for (const point of data) {
      const rank = severityRank(point.severity);
      if (rank > bestRank) {
        best = point.severity;
        bestRank = rank;
      }
    }
    return best;
  }, [data]);
  const selectedColor = colorForSeverity(chartSeverity);

  if (loading && data.length === 0) {
    return <div className="danger-chart danger-chart-loading">Loading forecast...</div>;
  }

  if (data.length === 0) {
    return <div className="danger-chart danger-chart-empty">No forecast</div>;
  }

  return (
    <div className="danger-chart">
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart data={data} margin={{ top: 6, right: 8, left: -14, bottom: 0 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="time_label"
            minTickGap={18}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tickCount={6}
            tick={{ fontSize: 11, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<DangerTooltip />} />
          <Area
            type="monotone"
            dataKey="danger_percent"
            stroke="#7C3AED"
            strokeWidth={2}
            fill="#A78BFA"
            fillOpacity={0.4}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      {loading && <div className="danger-chart-updating">Updating...</div>}
    </div>
  );
}
