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
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Area dataKey="income" fill="#10b981" fillOpacity={0.2} stroke="#10b981" type="monotone" />
          <Area dataKey="cashout" fill="#ef4444" fillOpacity={0.2} stroke="#ef4444" type="monotone" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}


