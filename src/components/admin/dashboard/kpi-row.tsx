import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KpiRowProps {
  totalIncome: number;
  totalCashout: number;
  net: number;
  avgTicket: number;
  transactionsCount: number;
  redemptionRate: number;
}

export function KpiRow({
  totalIncome,
  totalCashout,
  net,
  avgTicket,
  transactionsCount,
  redemptionRate,
}: Readonly<KpiRowProps>) {
  const items = [
    { label: "Total Income", value: totalIncome.toFixed(2), tone: "text-primary" },
    { label: "Total Cashout", value: totalCashout.toFixed(2), tone: "text-rose-400" },
    { label: "Net", value: net.toFixed(2), tone: "text-emerald-400" },
    { label: "Avg Ticket", value: avgTicket.toFixed(2), tone: "text-foreground" },
    { label: "Transactions", value: String(transactionsCount), tone: "text-foreground" },
    { label: "Redemption Rate", value: `${redemptionRate.toFixed(1)}%`, tone: "text-amber-400" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-semibold tracking-tight ${item.tone}`}>{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
