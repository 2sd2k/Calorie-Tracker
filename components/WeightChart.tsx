"use client";

import { format, parseISO } from "date-fns";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyWeight } from "@/lib/notion";

function fmtDay(date: string) {
  try {
    return format(parseISO(date), "MMM d");
  } catch {
    return date;
  }
}

export function WeightChart({ data }: { data: DailyWeight[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
        <XAxis dataKey="date" tickFormatter={fmtDay} stroke="var(--axis)" fontSize={12} />
        <YAxis
          stroke="var(--axis)"
          fontSize={12}
          width={44}
          allowDecimals={false}
          // Zoom the axis to the data range so day-to-day changes are visible.
          domain={[(min: number) => Math.floor(min - 2), (max: number) => Math.ceil(max + 2)]}
        />
        <Tooltip
          labelFormatter={(d) => fmtDay(String(d))}
          formatter={(value) => [`${value} lbs`, "Weight"]}
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 13,
          }}
        />
        <Line
          type="monotone"
          dataKey="weight"
          name="Weight (lbs)"
          stroke="#8b5cf6"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
