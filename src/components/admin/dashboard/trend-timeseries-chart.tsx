"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface TrendPoint {
  date: string;
  income: number;
  cashout: number;
  net: number;
}

export function TrendTimeseriesChart({ data }: Readonly<{ data: TrendPoint[] }>) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
          <XAxis dataKey="date" stroke="#9ca3af" />
          <YAxis stroke="#9ca3af" />
          <Tooltip
            contentStyle={{
              background: "#111827",
              border: "1px solid #1f2937",
              borderRadius: "8px",
              color: "#f9fafb",
            }}
          />
          <Legend />
          <Line dataKey="income" dot={false} name="Income" stroke="#facc15" strokeWidth={2.4} type="monotone" />
          <Line dataKey="cashout" dot={false} name="Cashout" stroke="#9ca3af" strokeWidth={2.1} type="monotone" />
          <Line dataKey="net" dot={false} name="Net" stroke="#22c55e" strokeWidth={1.5} type="monotone" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
