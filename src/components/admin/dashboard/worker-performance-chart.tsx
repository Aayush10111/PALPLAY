"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface WorkerPoint {
  workerName: string;
  income: number;
  net: number;
  incomePerHour: number;
}

interface WorkerPerformanceChartProps {
  data: WorkerPoint[];
  mode: "income" | "net";
}

export function WorkerPerformanceChart({ data, mode }: Readonly<WorkerPerformanceChartProps>) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 16, right: 12 }}>
          <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
          <XAxis stroke="#9ca3af" type="number" />
          <YAxis dataKey="workerName" stroke="#9ca3af" type="category" width={110} />
          <Tooltip
            contentStyle={{
              background: "#111827",
              border: "1px solid #1f2937",
              borderRadius: "8px",
              color: "#f9fafb",
            }}
            formatter={(value, name) => {
              const metric = name ?? "";
              const label =
                metric === "incomePerHour" ? "Income/Hour" : metric === "income" ? "Income" : "Net";
              return [Number(value ?? 0).toFixed(2), label];
            }}
          />
          <Bar dataKey={mode} fill="#facc15" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
