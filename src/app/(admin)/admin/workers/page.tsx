"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isMockMode } from "@/lib/env";
import { getMockProfiles, MOCK_SHIFTS, MOCK_TRANSACTIONS } from "@/lib/mock-data";
import { fetchAdminDataset, type AdminDataset } from "@/lib/queries/admin-analytics";
import { createClient } from "@/lib/supabase/client";

type WorkerRow = {
  workerId: string;
  workerName: string;
  txCount: number;
  income: number;
  cashout: number;
  net: number;
  hours: number;
  incomePerHour: number;
  topCustomer: string;
};

function computeWorkerRows(dataset: AdminDataset): WorkerRow[] {
  const workerProfiles = dataset.profiles.filter((profile) => profile.role === "worker");
  const workerMap = new Map(workerProfiles.map((worker) => [worker.id, worker.full_name]));

  const shiftHours = new Map<string, number>();
  for (const shift of dataset.shifts) {
    if (!shift.clock_out_at) continue;
    const hours = (new Date(shift.clock_out_at).getTime() - new Date(shift.clock_in_at).getTime()) / 3600000;
    shiftHours.set(shift.user_id, (shiftHours.get(shift.user_id) ?? 0) + Math.max(0, hours));
  }

  const txByWorker = new Map<string, AdminDataset["transactions"]>();
  for (const tx of dataset.transactions) {
    if (!workerMap.has(tx.user_id)) continue;
    txByWorker.set(tx.user_id, [...(txByWorker.get(tx.user_id) ?? []), tx]);
  }

  return [...workerMap.entries()]
    .map(([workerId, workerName]) => {
      const rows = txByWorker.get(workerId) ?? [];
      const income = rows.reduce((sum, row) => sum + Number(row.amount_received ?? 0), 0);
      const cashout = rows.reduce((sum, row) => sum + Number(row.amount_cashed_out ?? 0), 0);
      const net = income - cashout;
      const hours = shiftHours.get(workerId) ?? 0;
      const incomePerHour = hours > 0 ? income / hours : 0;

      const byCustomer = new Map<string, number>();
      for (const row of rows) {
        byCustomer.set(row.customer_name, (byCustomer.get(row.customer_name) ?? 0) + Number(row.amount_received ?? 0));
      }
      const topCustomer =
        [...byCustomer.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "None";

      return {
        workerId,
        workerName,
        txCount: rows.length,
        income,
        cashout,
        net,
        hours,
        incomePerHour,
        topCustomer,
      };
    })
    .sort((a, b) => b.net - a.net);
}

export default function AdminWorkersReportPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [dataset, setDataset] = useState<AdminDataset | null>(null);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      if (isMockMode()) {
        setDataset({
          transactions: MOCK_TRANSACTIONS as AdminDataset["transactions"],
          shifts: MOCK_SHIFTS as AdminDataset["shifts"],
          profiles: getMockProfiles() as AdminDataset["profiles"],
        });
        return;
      }

      const supabase = createClient();
      const from = new Date();
      from.setDate(from.getDate() - 30);
      const data = await fetchAdminDataset(supabase, {
        from: from.toISOString(),
        to: new Date().toISOString(),
      });
      setDataset(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load worker report.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const workerRows = useMemo(() => (dataset ? computeWorkerRows(dataset) : []), [dataset]);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Workers Report</h1>
        <p className="text-sm text-muted-foreground">Performance summary of all workers for the last 30 days.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Workers</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{workerRows.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Income</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {workerRows.reduce((sum, row) => sum + row.income, 0).toFixed(2)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Net</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {workerRows.reduce((sum, row) => sum + row.net, 0).toFixed(2)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Hours</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {workerRows.reduce((sum, row) => sum + row.hours, 0).toFixed(2)}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Worker Stats Table</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading worker report...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Worker</TableHead>
                  <TableHead>Transactions</TableHead>
                  <TableHead>Income</TableHead>
                  <TableHead>Cashout</TableHead>
                  <TableHead>Net</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Income/Hour</TableHead>
                  <TableHead>Top Customer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workerRows.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={9}>
                      No worker report data available.
                    </TableCell>
                  </TableRow>
                ) : (
                  workerRows.map((row, index) => (
                    <TableRow key={row.workerId}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{row.workerName}</TableCell>
                      <TableCell>{row.txCount}</TableCell>
                      <TableCell>{row.income.toFixed(2)}</TableCell>
                      <TableCell>{row.cashout.toFixed(2)}</TableCell>
                      <TableCell>{row.net.toFixed(2)}</TableCell>
                      <TableCell>{row.hours.toFixed(2)}</TableCell>
                      <TableCell>{row.incomePerHour.toFixed(2)}</TableCell>
                      <TableCell>{row.topCustomer}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
