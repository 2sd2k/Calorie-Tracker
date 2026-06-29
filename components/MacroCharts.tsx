"use client";

import { format, parseISO } from "date-fns";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyTotals } from "@/lib/notion";

function fmtDay(date: string) {
  try {
    return format(parseISO(date), "MMM d");
  } catch {
    return date;
  }
}

const macroColors = {
  protein: "#22c55e",
  carbs: "#3b82f6",
  fat: "#f59e0b",
};

export function CaloriesChart({ data }: { data: DailyTotals[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="cal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
        <XAxis dataKey="date" tickFormatter={fmtDay} stroke="var(--axis)" fontSize={12} />
        <YAxis stroke="var(--axis)" fontSize={12} width={44} />
        <Tooltip
          labelFormatter={(d) => fmtDay(String(d))}
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 13,
          }}
        />
        <Area
          type="monotone"
          dataKey="calories"
          name="Calories"
          stroke="#ef4444"
          strokeWidth={2}
          fill="url(#cal)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function MacrosChart({ data }: { data: DailyTotals[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
        <XAxis dataKey="date" tickFormatter={fmtDay} stroke="var(--axis)" fontSize={12} />
        <YAxis stroke="var(--axis)" fontSize={12} width={44} />
        <Tooltip
          labelFormatter={(d) => fmtDay(String(d))}
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 13,
          }}
        />
        <Line type="monotone" dataKey="protein" name="Protein (g)" stroke={macroColors.protein} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="carbs" name="Carbs (g)" stroke={macroColors.carbs} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="fat" name="Fat (g)" stroke={macroColors.fat} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
