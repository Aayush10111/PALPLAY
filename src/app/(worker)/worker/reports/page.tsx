"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isMockMode } from "@/lib/env";
import { MOCK_TRANSACTIONS, MOCK_USERS } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";
import {
  computeTopCustomers,
  computeTopGames,
  computeTopPaymentTags,
  computeVipCustomers,
  getWorkerTransactionsForReports,
} from "@/lib/queries/worker-reports";

function defaultFrom() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 16);
}

function defaultTo() {
  return new Date().toISOString().slice(0, 16);
}

export default function WorkerReportsPage() {
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(defaultTo());
  const [isLoading, setIsLoading] = useState(false);
  const [topCustomers, setTopCustomers] = useState<Array<{ customer_name: string; income: number; cashout: number; net: number }>>([]);
  const [vipCustomers, setVipCustomers] = useState<Array<{ customer_name: string; total_income_30d: number }>>([]);
  const [topGames, setTopGames] = useState<Array<{ game_played: string; income: number }>>([]);
  const [topTags, setTopTags] = useState<Array<{ payment_tag_used: string; income: number }>>([]);

  const loadReport = async () => {
    try {
      setIsLoading(true);
      if (isMockMode()) {
        const rows = MOCK_TRANSACTIONS.filter((tx) => tx.user_id === MOCK_USERS.workers[0].id);
        setTopCustomers(computeTopCustomers(rows as never));
        setVipCustomers(computeVipCustomers(rows as never));
        setTopGames(computeTopGames(rows as never));
        setTopTags(computeTopPaymentTags(rows as never));
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated.");

      const rows = await getWorkerTransactionsForReports(supabase, user.id, {
        from: new Date(from).toISOString(),
        to: new Date(to).toISOString(),
      });

      setTopCustomers(computeTopCustomers(rows));
      setVipCustomers(computeVipCustomers(rows));
      setTopGames(computeTopGames(rows));
      setTopTags(computeTopPaymentTags(rows));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load reports.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Customer Reports</h1>
        <p className="text-sm text-muted-foreground">
          Analyze your own customers by net value, VIP status, games, and payment tags.
        </p>
      </div>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button disabled={isLoading} onClick={loadReport}>
            {isLoading ? "Loading..." : "Run Report"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Customers (Net)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Income</TableHead>
                  <TableHead>Cashout</TableHead>
                  <TableHead>Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>No data.</TableCell>
                  </TableRow>
                ) : (
                  topCustomers.map((row) => (
                    <TableRow key={row.customer_name}>
                      <TableCell>{row.customer_name}</TableCell>
                      <TableCell>{row.income.toFixed(2)}</TableCell>
                      <TableCell>{row.cashout.toFixed(2)}</TableCell>
                      <TableCell>{row.net.toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>VIP Customers (30d income &gt;= 500)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {vipCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No VIP customers.</p>
            ) : (
              vipCustomers.map((row) => (
                <div className="flex justify-between rounded border bg-card px-3 py-2 text-sm" key={row.customer_name}>
                  <span>{row.customer_name}</span>
                  <span>{row.total_income_30d.toFixed(2)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Games by Income</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topGames.length === 0 ? (
              <p className="text-sm text-muted-foreground">No game data.</p>
            ) : (
              topGames.map((row) => (
                <div className="flex justify-between rounded border bg-card px-3 py-2 text-sm" key={row.game_played}>
                  <span>{row.game_played}</span>
                  <span>{row.income.toFixed(2)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Payment Tags by Income</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {topTags.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment tag data.</p>
          ) : (
            topTags.map((row) => (
              <div className="flex justify-between rounded border bg-card px-3 py-2 text-sm" key={row.payment_tag_used}>
                <span>{row.payment_tag_used}</span>
                <span>{row.income.toFixed(2)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

