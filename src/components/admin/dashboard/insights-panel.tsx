import { AlertTriangle } from "lucide-react";

export function InsightsPanel({ insights }: Readonly<{ insights: string[] }>) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-base font-medium">Alerts & Insights</h3>
      <div className="space-y-2">
        {insights.map((item) => (
          <div
            className="flex items-start gap-2 rounded-md border border-border bg-secondary/60 px-3 py-2 text-sm text-muted-foreground"
            key={item}
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
