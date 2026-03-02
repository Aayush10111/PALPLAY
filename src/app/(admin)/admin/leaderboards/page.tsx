"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isMockMode } from "@/lib/env";
import { getMockProfiles, MOCK_SHIFTS, MOCK_TRANSACTIONS } from "@/lib/mock-data";
import {
  customerLeaderboard,
  customerVipTiers,
  fetchAdminDataset,
  workerLeaderboard,
  type AdminDataset,
} from "@/lib/queries/admin-analytics";
import { createClient } from "@/lib/supabase/client";

export default function AdminLeaderboardsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [dataset, setDataset] = useState<AdminDataset | null>(null);

  useEffect(() => {
    const load = async () => {
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
        const date = new Date();
        date.setDate(date.getDate() - 30);
        const data = await fetchAdminDataset(supabase, {
          from: date.toISOString(),
          to: new Date().toISOString(),
        });
        setDataset(data);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load leaderboards.");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
  }, []);

  const customers = useMemo(() => (dataset ? customerLeaderboard(dataset).slice(0, 25) : []), [dataset]);
  const vips = useMemo(() => (dataset ? customerVipTiers(dataset).slice(0, 25) : []), [dataset]);
  const workers = useMemo(() => (dataset ? workerLeaderboard(dataset) : []), [dataset]);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Leaderboards & Stats</h1>
        <p className="text-sm text-muted-foreground">Top customers, VIP tiers, and worker performance stats for the last 30 days.</p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">Loading leaderboards...</CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Players (Customers)</CardTitle>
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
                {customers.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={5}>
                      No customer leaderboard data.
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((row, index) => (
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

        <Card>
          <CardHeader>
            <CardTitle>VIP Tiers</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Income</TableHead>
                  <TableHead>Tier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vips.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={3}>
                      No VIP customers.
                    </TableCell>
                  </TableRow>
                ) : (
                  vips.map((row) => (
                    <TableRow key={row.customer_name}>
                      <TableCell>{row.customer_name}</TableCell>
                      <TableCell>{row.income.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{row.tier}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Worker Leaderboard</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Worker</TableHead>
                <TableHead>Income</TableHead>
                <TableHead>Cashout</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Income / Hour</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers.length === 0 ? (
                <TableRow>
                  <TableCell className="text-muted-foreground" colSpan={7}>
                    No worker stats available.
                  </TableCell>
                </TableRow>
              ) : (
                workers.map((row, index) => (
                  <TableRow key={row.user_id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{row.workerName}</TableCell>
                    <TableCell>{row.income.toFixed(2)}</TableCell>
                    <TableCell>{row.cashout.toFixed(2)}</TableCell>
                    <TableCell>{row.net.toFixed(2)}</TableCell>
                    <TableCell>{row.hours.toFixed(2)}</TableCell>
                    <TableCell>{row.incomePerHour.toFixed(2)}</TableCell>
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
