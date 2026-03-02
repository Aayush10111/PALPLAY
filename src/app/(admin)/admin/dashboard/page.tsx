"use client";

import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { GameDistributionChart } from "@/components/admin/charts/game-distribution";
import { IncomeVsCashoutTrendChart } from "@/components/admin/charts/income-vs-cashout-trend";
import { NetTrendChart } from "@/components/admin/charts/net-trend";
import { PaymentTagDistributionChart } from "@/components/admin/charts/payment-tag-distribution";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isMockMode } from "@/lib/env";
import { getMockProfiles, MOCK_SHIFTS, MOCK_TRANSACTIONS } from "@/lib/mock-data";
import {
  computeKpis,
  customerLeaderboard,
  fetchAdminDataset,
  gameDistribution,
  incomeCashoutTrend,
  netTrend,
  paymentTagDistribution,
  type AdminDataset,
} from "@/lib/queries/admin-analytics";
import { createClient } from "@/lib/supabase/client";

type TxRow = AdminDataset["transactions"][number];

type PlayerBoard = {
  title: string;
  customer: string;
  net: number;
  income: number;
  cashout: number;
  rangeLabel: string;
};

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function rangeStart(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (days - 1));
  return date;
}

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

function playerForRange(rows: TxRow[], from: Date, to: Date, title: string): PlayerBoard {
  const filtered = rows.filter((row) => {
    const ts = new Date(row.occurred_at).getTime();
    return ts >= from.getTime() && ts <= to.getTime();
  });

  const ranked = customerLeaderboard({
    transactions: filtered,
    shifts: [],
    profiles: [],
  } as AdminDataset);

  const top = ranked[0];
  return {
    title,
    customer: top?.customer_name ?? "No Player",
    net: top?.net ?? 0,
    income: top?.income ?? 0,
    cashout: top?.cashout ?? 0,
    rangeLabel: `${format(from, "MMM d")} - ${format(to, "MMM d")}`,
  };
}

export default function AdminDashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [from, setFrom] = useState(toDateInput(rangeStart(30)));
  const [to, setTo] = useState(toDateInput(new Date()));
  const [dataset, setDataset] = useState<AdminDataset | null>(null);
  const [allTransactions, setAllTransactions] = useState<TxRow[]>([]);

  const loadDashboard = useCallback(async () => {
    try {
      setIsLoading(true);

      if (isMockMode()) {
        const data = {
          transactions: MOCK_TRANSACTIONS as AdminDataset["transactions"],
          shifts: MOCK_SHIFTS as AdminDataset["shifts"],
          profiles: getMockProfiles() as AdminDataset["profiles"],
        };
        setDataset(data);
        setAllTransactions(data.transactions);
        return;
      }

      const supabase = createClient();
      const [selected, allTxRes] = await Promise.all([
        fetchAdminDataset(supabase, {
          from: new Date(`${from}T00:00:00.000Z`).toISOString(),
          to: new Date(`${to}T23:59:59.999Z`).toISOString(),
        }),
        supabase.from("transactions").select("*").order("occurred_at", { ascending: false }),
      ]);

      if (allTxRes.error) throw allTxRes.error;
      setDataset(selected);
      setAllTransactions((allTxRes.data ?? []) as TxRow[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load admin dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const kpis = useMemo(() => (dataset ? computeKpis(dataset) : null), [dataset]);
  const trend = useMemo(() => (dataset ? incomeCashoutTrend(dataset) : []), [dataset]);
  const net = useMemo(() => (dataset ? netTrend(dataset) : []), [dataset]);
  const games = useMemo(() => (dataset ? gameDistribution(dataset) : []), [dataset]);
  const tags = useMemo(() => (dataset ? paymentTagDistribution(dataset) : []), [dataset]);
  const customerRows = useMemo(() => (dataset ? customerLeaderboard(dataset).slice(0, 15) : []), [dataset]);

  const playerBoards = useMemo(() => {
    const todayStart = rangeStart(1);
    const weekStart = rangeStart(7);
    const monthStart = rangeStart(30);
    const todayEnd = endOfToday();

    return [
      playerForRange(allTransactions, todayStart, todayEnd, "Player of the Day"),
      playerForRange(allTransactions, weekStart, todayEnd, "Player of the Week"),
      playerForRange(allTransactions, monthStart, todayEnd, "Player of the Month"),
    ];
  }, [allTransactions]);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">Advanced data visuals, top players, and customer analytics.</p>
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Calendar Range</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <Button disabled={isLoading} onClick={loadDashboard}>
            {isLoading ? "Refreshing..." : "Update Dashboard"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        {playerBoards.map((board) => (
          <Card className="border-2 border-primary/40 bg-gradient-to-br from-orange-100/80 via-pink-100/70 to-cyan-100/80" key={board.title}>
            <CardHeader>
              <CardTitle className="text-base">{board.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xl font-semibold">{board.customer}</p>
              <p className="text-sm text-muted-foreground">{board.rangeLabel}</p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge>Net: {board.net.toFixed(2)}</Badge>
                <span>In: {board.income.toFixed(2)}</span>
                <span>Out: {board.cashout.toFixed(2)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {kpis ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Income</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold">{kpis.totalIncome.toFixed(2)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Total Cashout</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold">{kpis.totalCashout.toFixed(2)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Net</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold">{kpis.net.toFixed(2)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Active Workers</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold">{kpis.activeWorkers}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Income / Hour</CardTitle>
            </CardHeader>
            <CardContent className="text-xl font-semibold">{kpis.avgIncomePerHour.toFixed(2)}</CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Income vs Cashout Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {trend.length ? <IncomeVsCashoutTrendChart data={trend} /> : <p className="text-sm text-muted-foreground">No trend data.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Net Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {net.length ? <NetTrendChart data={net} /> : <p className="text-sm text-muted-foreground">No net data.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Game Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {games.length ? <GameDistributionChart data={games} /> : <p className="text-sm text-muted-foreground">No game data.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Tag Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {tags.length ? <PaymentTagDistributionChart data={tags} /> : <p className="text-sm text-muted-foreground">No payment tag data.</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Customer Data ({from} to {to})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Income</TableHead>
                <TableHead>Cashout</TableHead>
                <TableHead>Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customerRows.length === 0 ? (
                <TableRow>
                  <TableCell className="text-muted-foreground" colSpan={5}>
                    No customer data in this range.
                  </TableCell>
                </TableRow>
              ) : (
                customerRows.map((row, index) => (
                  <TableRow key={row.customer_name}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{row.customer_name}</TableCell>
                    <TableCell>{row.income.toFixed(2)}</TableCell>
                    <TableCell>{row.cashout.toFixed(2)}</TableCell>
                    <TableCell>{row.net.toFixed(2)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
