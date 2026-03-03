"use client";

import { format, subDays } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { GameDistributionChart } from "@/components/admin/charts/game-distribution";
import { PaymentTagDistributionChart } from "@/components/admin/charts/payment-tag-distribution";
import { FiltersBar } from "@/components/admin/dashboard/filters-bar";
import { InsightsPanel } from "@/components/admin/dashboard/insights-panel";
import { KpiRow } from "@/components/admin/dashboard/kpi-row";
import { LeaderboardTable } from "@/components/admin/dashboard/leaderboard-table";
import { TrendTimeseriesChart } from "@/components/admin/dashboard/trend-timeseries-chart";
import { WorkerPerformanceChart } from "@/components/admin/dashboard/worker-performance-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isMockMode } from "@/lib/env";
import { getMockProfiles, MOCK_SHIFTS, MOCK_TRANSACTIONS } from "@/lib/mock-data";
import {
  computeKpis,
  customerLeaderboard,
  fetchAdminDataset,
  gameDistribution,
  getDashboardFilterOptions,
  getDashboardInsights,
  incomeCashoutTrend,
  paymentTagDistribution,
  type AdminDataset,
  workerLeaderboard,
} from "@/lib/queries/admin-analytics";
import { createClient } from "@/lib/supabase/client";

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseDateParam(value: string | null, fallback: Date) {
  if (!value) return formatDateInput(fallback);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return formatDateInput(fallback);
  return formatDateInput(parsed);
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [dataset, setDataset] = useState<AdminDataset | null>(null);
  const [filterSource, setFilterSource] = useState<AdminDataset | null>(null);
  const [workerMetric, setWorkerMetric] = useState<"income" | "net">("net");
  const [customerSort, setCustomerSort] = useState<"net" | "income" | "cashout">("net");
  const [workerSort, setWorkerSort] = useState<"net" | "income" | "incomePerHour">("net");
  const [customerSearch, setCustomerSearch] = useState("");
  const [workerSearch, setWorkerSearch] = useState("");

  const from = parseDateParam(searchParams.get("from"), subDays(new Date(), 6));
  const to = parseDateParam(searchParams.get("to"), new Date());
  const workerId = searchParams.get("workerId") ?? "all";
  const game = searchParams.get("game") ?? "all";
  const paymentTag = searchParams.get("paymentTag") ?? "all";

  const updateQuery = useCallback(
    (next: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (!value || value === "all") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      router.replace(`/admin/dashboard?${params.toString()}`);
    },
    [router, searchParams],
  );

  const applyPreset = (preset: "today" | "7d" | "30d") => {
    const now = new Date();
    const start = preset === "today" ? now : preset === "7d" ? subDays(now, 6) : subDays(now, 29);
    updateQuery({ from: formatDateInput(start), to: formatDateInput(now) });
  };

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
        setFilterSource(data);
        return;
      }

      const supabase = createClient();
      const fromIso = new Date(`${from}T00:00:00.000Z`).toISOString();
      const toIso = new Date(`${to}T23:59:59.999Z`).toISOString();
      const workerFilter = workerId !== "all" ? workerId : undefined;
      const gameFilter = game !== "all" ? game : undefined;
      const paymentFilter = paymentTag !== "all" ? paymentTag : undefined;

      const [selectedDataset, dateScopeDataset] = await Promise.all([
        fetchAdminDataset(supabase, {
          from: fromIso,
          to: toIso,
          workerId: workerFilter,
          game: gameFilter,
          paymentTag: paymentFilter,
        }),
        fetchAdminDataset(supabase, {
          from: fromIso,
          to: toIso,
        }),
      ]);

      setDataset(selectedDataset);
      setFilterSource(dateScopeDataset);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load admin dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [from, to, workerId, game, paymentTag]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const options = useMemo(
    () => (filterSource ? getDashboardFilterOptions(filterSource) : { workers: [], games: [], paymentTags: [] }),
    [filterSource],
  );

  const kpis = useMemo(() => (dataset ? computeKpis(dataset) : null), [dataset]);
  const trendSeries = useMemo(
    () =>
      dataset
        ? incomeCashoutTrend(dataset).map((item) => ({ ...item, net: item.income - item.cashout }))
        : [],
    [dataset],
  );
  const gameSeries = useMemo(() => (dataset ? gameDistribution(dataset) : []), [dataset]);
  const tagSeries = useMemo(() => (dataset ? paymentTagDistribution(dataset) : []), [dataset]);
  const insights = useMemo(() => (dataset ? getDashboardInsights(dataset) : []), [dataset]);

  const customerRows = useMemo(() => {
    if (!dataset) return [];
    const base = customerLeaderboard(dataset).filter((item) =>
      item.customer_name.toLowerCase().includes(customerSearch.toLowerCase()),
    );
    return [...base].sort((a, b) => Number(b[customerSort]) - Number(a[customerSort]));
  }, [dataset, customerSearch, customerSort]);

  const workerRows = useMemo(() => {
    if (!dataset) return [];
    const base = workerLeaderboard(dataset).filter((item) =>
      item.workerName.toLowerCase().includes(workerSearch.toLowerCase()),
    );
    return [...base].sort((a, b) => Number(b[workerSort]) - Number(a[workerSort]));
  }, [dataset, workerSearch, workerSort]);

  const customerTableRows = useMemo(
    () =>
      customerRows.slice(0, 25).map((row) => [
        row.customer_name,
        row.income.toFixed(2),
        row.cashout.toFixed(2),
        row.net.toFixed(2),
      ]),
    [customerRows],
  );

  const workerTableRows = useMemo(
    () =>
      workerRows.slice(0, 25).map((row) => [
        row.workerName,
        row.income.toFixed(2),
        row.cashout.toFixed(2),
        row.net.toFixed(2),
        row.incomePerHour.toFixed(2),
      ]),
    [workerRows],
  );

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-start">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Analytics Cockpit</h2>
          <p className="text-sm text-muted-foreground">
            Date range: {format(new Date(from), "MMM d, yyyy")} to {format(new Date(to), "MMM d, yyyy")}
          </p>
        </div>
        <Button disabled={isLoading} onClick={loadDashboard} variant="secondary">
          {isLoading ? "Refreshing..." : "Refresh"}
        </Button>
      </section>

      <FiltersBar
        from={from}
        game={game}
        isLoading={isLoading}
        onChange={(next) => updateQuery(next as Record<string, string>)}
        onPreset={applyPreset}
        paymentTag={paymentTag}
        paymentTags={options.paymentTags}
        to={to}
        workerId={workerId}
        workers={options.workers}
        games={options.games}
      />

      {kpis ? (
        <KpiRow
          avgTicket={kpis.avgTicket}
          net={kpis.net}
          redemptionRate={kpis.redemptionRate}
          totalCashout={kpis.totalCashout}
          totalIncome={kpis.totalIncome}
          transactionsCount={kpis.transactionsCount}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Income vs Cashout Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {trendSeries.length ? (
            <TrendTimeseriesChart data={trendSeries} />
          ) : (
            <p className="text-sm text-muted-foreground">No trend data.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Payment Account Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {tagSeries.length ? (
              <PaymentTagDistributionChart data={tagSeries} />
            ) : (
              <p className="text-sm text-muted-foreground">No payment account data.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Game Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {gameSeries.length ? (
              <GameDistributionChart data={gameSeries} />
            ) : (
              <p className="text-sm text-muted-foreground">No game revenue data.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Worker Performance</CardTitle>
          <Select onValueChange={(value) => setWorkerMetric(value as "income" | "net")} value={workerMetric}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="net">Show Net</SelectItem>
              <SelectItem value="income">Show Income</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {workerRows.length ? (
            <WorkerPerformanceChart
              data={workerRows.slice(0, 12).map((item) => ({
                workerName: item.workerName,
                income: item.income,
                incomePerHour: item.incomePerHour,
                net: item.net,
              }))}
              mode={workerMetric}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No worker performance data.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="max-w-xs"
              onChange={(event) => setCustomerSearch(event.target.value)}
              placeholder="Filter customer name..."
              value={customerSearch}
            />
            <Select onValueChange={(value) => setCustomerSort(value as "net" | "income" | "cashout")} value={customerSort}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="net">Sort by Net</SelectItem>
                <SelectItem value="income">Sort by Income</SelectItem>
                <SelectItem value="cashout">Sort by Cashout</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <LeaderboardTable
            columns={["Customer", "Income", "Cashout", "Net"]}
            emptyText="No customer leaderboard data."
            rows={customerTableRows}
            title="Best Payers"
          />
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="max-w-xs"
              onChange={(event) => setWorkerSearch(event.target.value)}
              placeholder="Filter worker name..."
              value={workerSearch}
            />
            <Select onValueChange={(value) => setWorkerSort(value as "net" | "income" | "incomePerHour")} value={workerSort}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="net">Sort by Net</SelectItem>
                <SelectItem value="income">Sort by Income</SelectItem>
                <SelectItem value="incomePerHour">Sort by Income/Hour</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <LeaderboardTable
            columns={["Worker", "Income", "Cashout", "Net", "Income/Hour"]}
            emptyText="No worker leaderboard data."
            rows={workerTableRows}
            title="Best Employees"
          />
        </div>
      </div>

      <InsightsPanel insights={insights} />
    </div>
  );
}
