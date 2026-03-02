import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KpiCardsProps {
  totalIncome: number;
  totalCashout: number;
  net: number;
  activeWorkers: number;
  avgIncomePerHour: number;
}

export function KpiCards(props: KpiCardsProps) {
  const items = [
    { label: "Total Income", value: props.totalIncome.toFixed(2), tone: "text-emerald-600" },
    { label: "Total Cashout", value: props.totalCashout.toFixed(2), tone: "text-rose-600" },
    { label: "Net", value: props.net.toFixed(2), tone: "text-sky-600" },
    { label: "Active Workers", value: String(props.activeWorkers), tone: "text-violet-600" },
    { label: "Avg Income / Hour", value: props.avgIncomePerHour.toFixed(2), tone: "text-amber-600" },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-semibold ${item.tone}`}>{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

