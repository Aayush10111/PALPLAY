"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface DataPoint {
  date: string;
  income: number;
  cashout: number;
}

export function IncomeVsCashoutTrendChart({ data }: { data: DataPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart data={data}>
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
          <Area dataKey="income" fill="#facc15" fillOpacity={0.2} stroke="#facc15" type="monotone" />
          <Area dataKey="cashout" fill="#9ca3af" fillOpacity={0.16} stroke="#9ca3af" type="monotone" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}


