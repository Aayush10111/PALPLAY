"use client";

import { addMonths, format, startOfMonth, endOfMonth } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isMockMode } from "@/lib/env";
import { getMockProfiles, MOCK_TRANSACTIONS } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";

type TxRow = {
  id: string;
  occurred_at: string;
  type: "income" | "cashout";
  customer_name: string;
  user_id: string;
  amount_received: number;
  amount_cashed_out: number;
  payment_tag_used: string | null;
  game_played: string | null;
};

type DayGroup = {
  day: string;
  rows: TxRow[];
};

export default function AdminTransactionsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [monthCursor, setMonthCursor] = useState(new Date());
  const [rows, setRows] = useState<TxRow[]>([]);
  const [workerMap, setWorkerMap] = useState<Record<string, string>>({});

  const loadRows = useCallback(async () => {
    try {
      setIsLoading(true);
      const from = startOfMonth(monthCursor).toISOString();
      const to = endOfMonth(monthCursor).toISOString();

      if (isMockMode()) {
        const profiles = getMockProfiles();
        const data = (MOCK_TRANSACTIONS as TxRow[])
          .filter((row) => {
            const ts = new Date(row.occurred_at).getTime();
            return ts >= new Date(from).getTime() && ts <= new Date(to).getTime();
          })
          .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());
        setRows(data);
        setWorkerMap(Object.fromEntries(profiles.map((profile) => [profile.id, profile.full_name])));
        return;
      }

      const supabase = createClient();
      const [txRes, profileRes] = await Promise.all([
        supabase
          .from("transactions")
          .select("*")
          .gte("occurred_at", from)
          .lte("occurred_at", to)
          .order("occurred_at", { ascending: false }),
        supabase.from("profiles").select("id,full_name"),
      ]);

      if (txRes.error) throw txRes.error;
      if (profileRes.error) throw profileRes.error;

      setRows((txRes.data ?? []) as TxRow[]);
      setWorkerMap(Object.fromEntries((profileRes.data ?? []).map((profile) => [profile.id, profile.full_name])));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load transactions.");
    } finally {
      setIsLoading(false);
    }
  }, [monthCursor]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  const monthLabel = format(monthCursor, "MMMM yyyy");
  const fromIso = startOfMonth(monthCursor).toISOString();
  const toIso = endOfMonth(monthCursor).toISOString();

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams({
        from: fromIso,
        to: toIso,
      });
      const res = await fetch(`/api/export/transactions?${params.toString()}`, {
        method: "GET",
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Export failed.");
      }
      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `transactions-${monthLabel.replace(/\s+/g, "-").toLowerCase()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(downloadUrl);
      toast.success("CSV export started.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to export CSV.");
    } finally {
      setIsExporting(false);
    }
  };

  const groupedByDay = useMemo(() => {
    const groups = new Map<string, TxRow[]>();
    for (const row of rows) {
      const day = row.occurred_at.slice(0, 10);
      groups.set(day, [...(groups.get(day) ?? []), row]);
    }

    return [...groups.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, groupedRows]) => ({ day, rows: groupedRows })) as DayGroup[];
  }, [rows]);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Monthly Transactions</h1>
        <p className="text-sm text-muted-foreground">Browse all transactions by month and move back or forward quickly.</p>
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>{monthLabel}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setMonthCursor((prev) => addMonths(prev, -1))}>
            Previous Month
          </Button>
          <Button variant="outline" onClick={() => setMonthCursor((prev) => addMonths(prev, 1))}>
            Next Month
          </Button>
          <Button onClick={loadRows}>Refresh</Button>
          <Button disabled={isExporting} onClick={handleExport} variant="secondary">
            {isExporting ? "Exporting..." : "Export CSV"}
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">Loading transactions...</CardContent>
        </Card>
      ) : groupedByDay.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">No transactions found for {monthLabel}.</CardContent>
        </Card>
      ) : (
        groupedByDay.map((group) => (
          <Card key={group.day}>
            <CardHeader>
              <CardTitle>{format(new Date(group.day), "EEEE, MMM d, yyyy")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Worker</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Game</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{format(new Date(row.occurred_at), "p")}</TableCell>
                      <TableCell>{workerMap[row.user_id] ?? row.user_id}</TableCell>
                      <TableCell>
                        <Badge variant={row.type === "income" ? "default" : "secondary"}>{row.type}</Badge>
                      </TableCell>
                      <TableCell>{row.customer_name}</TableCell>
                      <TableCell>
                        {row.type === "income"
                          ? Number(row.amount_received).toFixed(2)
                          : Number(row.amount_cashed_out).toFixed(2)}
                      </TableCell>
                      <TableCell>{row.payment_tag_used ?? "-"}</TableCell>
                      <TableCell>{row.game_played ?? "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
