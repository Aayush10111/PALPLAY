"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { isMockMode } from "@/lib/env";
import { MOCK_TRANSACTIONS, MOCK_USERS } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";
import {
  cashoutTransactionSchema,
  incomeTransactionSchema,
  type CashoutTransactionInput,
  type IncomeTransactionInput,
} from "@/lib/validation/transaction";

type FilterType = "all" | "income" | "cashout";

type TransactionRow = {
  id: string;
  occurred_at: string;
  type: "income" | "cashout";
  customer_name: string;
  amount_received: number;
  amount_cashed_out: number;
  game_played: string | null;
  payment_tag_used: string | null;
};

const PAGE_SIZE = 10;

function toIsoLocalDefault() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function WorkerTransactionsPage() {
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [mockRows, setMockRows] = useState(
    MOCK_TRANSACTIONS.filter((tx) => tx.user_id === MOCK_USERS.workers[0].id) as unknown as TransactionRow[],
  );
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    type: "all" as FilterType,
    customer: "",
    game: "",
    paymentTag: "",
  });
  const [sortBy, setSortBy] = useState<"occurred_at" | "amount_received" | "amount_cashed_out">("occurred_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const incomeForm = useForm<IncomeTransactionInput>({
    resolver: zodResolver(incomeTransactionSchema) as never,
    defaultValues: {
      type: "income",
      occurred_at: new Date().toISOString(),
      customer_name: "",
      amount_received: 0,
      credit_loaded: 0,
      payment_tag_used: "",
      game_played: "",
      notes: "",
    },
  });

  const cashoutForm = useForm<CashoutTransactionInput>({
    resolver: zodResolver(cashoutTransactionSchema) as never,
    defaultValues: {
      type: "cashout",
      occurred_at: new Date().toISOString(),
      customer_name: "",
      amount_cashed_out: 0,
      redeemed: false,
      amount_redeemed: 0,
      notes: "",
    },
  });

  const maxPage = useMemo(() => Math.max(1, Math.ceil(totalCount / PAGE_SIZE)), [totalCount]);

  const loadTransactions = useCallback(async () => {
    try {
      setIsLoadingList(true);
      if (isMockMode()) {
        let rows = [...mockRows];
        if (filters.from) rows = rows.filter((r) => new Date(r.occurred_at) >= new Date(filters.from));
        if (filters.to) rows = rows.filter((r) => new Date(r.occurred_at) <= new Date(filters.to));
        if (filters.type !== "all") rows = rows.filter((r) => r.type === filters.type);
        if (filters.customer) rows = rows.filter((r) => r.customer_name.toLowerCase().includes(filters.customer.toLowerCase()));
        if (filters.game) rows = rows.filter((r) => (r.game_played ?? "").toLowerCase().includes(filters.game.toLowerCase()));
        if (filters.paymentTag) rows = rows.filter((r) => (r.payment_tag_used ?? "").toLowerCase().includes(filters.paymentTag.toLowerCase()));
        rows.sort((a, b) => {
          const av = Number(a[sortBy] ?? 0);
          const bv = Number(b[sortBy] ?? 0);
          if (sortBy === "occurred_at") {
            return sortOrder === "asc"
              ? new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
              : new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime();
          }
          return sortOrder === "asc" ? av - bv : bv - av;
        });
        setTotalCount(rows.length);
        setTransactions(rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated.");

      let query = supabase
        .from("transactions")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order(sortBy, { ascending: sortOrder === "asc" })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      if (filters.from) query = query.gte("occurred_at", new Date(filters.from).toISOString());
      if (filters.to) query = query.lte("occurred_at", new Date(filters.to).toISOString());
      if (filters.type !== "all") query = query.eq("type", filters.type);
      if (filters.customer) query = query.ilike("customer_name", `%${filters.customer}%`);
      if (filters.game) query = query.ilike("game_played", `%${filters.game}%`);
      if (filters.paymentTag) query = query.ilike("payment_tag_used", `%${filters.paymentTag}%`);

      const { data, error, count } = await query;
      if (error) throw error;

      setTransactions((data ?? []) as TransactionRow[]);
      setTotalCount(count ?? 0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load transactions.");
    } finally {
      setIsLoadingList(false);
    }
  }, [
    filters.customer,
    filters.from,
    filters.game,
    filters.paymentTag,
    filters.to,
    filters.type,
    page,
    mockRows,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  const handleIncomeSubmit = async (values: IncomeTransactionInput) => {
    try {
      const supabase = createClient();
      if (isMockMode()) {
        const newRow = {
          id: `tx-${Date.now()}`,
          occurred_at: values.occurred_at,
          type: "income" as const,
          customer_name: values.customer_name,
          amount_received: values.amount_received,
          amount_cashed_out: 0,
          game_played: values.game_played,
          payment_tag_used: values.payment_tag_used,
        };
        setMockRows((prev) => [newRow, ...prev]);
        toast.success("Income transaction saved (mock).");
        incomeForm.reset({
          ...incomeForm.getValues(),
          customer_name: "",
          amount_received: 0,
          credit_loaded: 0,
          payment_tag_used: "",
          game_played: "",
          notes: "",
          occurred_at: new Date().toISOString(),
        });
        await loadTransactions();
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated.");

      const { error } = await supabase.from("transactions").insert({
        user_id: user.id,
        occurred_at: values.occurred_at,
        type: "income",
        customer_name: values.customer_name,
        amount_received: values.amount_received,
        credit_loaded: values.credit_loaded,
        payment_tag_used: values.payment_tag_used,
        game_played: values.game_played,
        notes: values.notes || null,
      });

      if (error) throw error;
      toast.success("Income transaction saved.");
      incomeForm.reset({
        ...incomeForm.getValues(),
        customer_name: "",
        amount_received: 0,
        credit_loaded: 0,
        payment_tag_used: "",
        game_played: "",
        notes: "",
        occurred_at: new Date().toISOString(),
      });
      await loadTransactions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save income transaction.");
    }
  };

  const handleCashoutSubmit = async (values: CashoutTransactionInput) => {
    try {
      const supabase = createClient();
      if (isMockMode()) {
        const newRow = {
          id: `tx-${Date.now()}`,
          occurred_at: values.occurred_at,
          type: "cashout" as const,
          customer_name: values.customer_name,
          amount_received: 0,
          amount_cashed_out: values.amount_cashed_out,
          game_played: null,
          payment_tag_used: null,
        };
        setMockRows((prev) => [newRow, ...prev]);
        toast.success("Cashout transaction saved (mock).");
        cashoutForm.reset({
          ...cashoutForm.getValues(),
          customer_name: "",
          amount_cashed_out: 0,
          amount_redeemed: 0,
          redeemed: false,
          notes: "",
          occurred_at: new Date().toISOString(),
        });
        await loadTransactions();
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated.");

      const { error } = await supabase.from("transactions").insert({
        user_id: user.id,
        occurred_at: values.occurred_at,
        type: "cashout",
        customer_name: values.customer_name,
        amount_cashed_out: values.amount_cashed_out,
        redeemed: values.redeemed,
        amount_redeemed: values.amount_redeemed,
        notes: values.notes || null,
      });

      if (error) throw error;
      toast.success("Cashout transaction saved.");
      cashoutForm.reset({
        ...cashoutForm.getValues(),
        customer_name: "",
        amount_cashed_out: 0,
        amount_redeemed: 0,
        redeemed: false,
        notes: "",
        occurred_at: new Date().toISOString(),
      });
      await loadTransactions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save cashout transaction.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Submit income/cashout records and review your history with filters.
        </p>
      </div>

      <Tabs defaultValue="income">
        <TabsList>
          <TabsTrigger value="income">Income</TabsTrigger>
          <TabsTrigger value="cashout">Cashout</TabsTrigger>
        </TabsList>

        <TabsContent value="income">
          <Card>
            <CardHeader>
              <CardTitle>Add Income</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...incomeForm}>
                <form className="grid gap-4 md:grid-cols-2" onSubmit={incomeForm.handleSubmit(handleIncomeSubmit)}>
                  <FormField
                    control={incomeForm.control}
                    name="occurred_at"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Occurred At</FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            value={field.value ? field.value.slice(0, 16) : toIsoLocalDefault()}
                            onChange={(event) => field.onChange(new Date(event.target.value).toISOString())}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={incomeForm.control}
                    name="customer_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={incomeForm.control}
                    name="amount_received"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount Received</FormLabel>
                        <FormControl>
                          <Input min="0" step="0.01" type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={incomeForm.control}
                    name="credit_loaded"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Credit Loaded</FormLabel>
                        <FormControl>
                          <Input min="0" step="0.01" type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={incomeForm.control}
                    name="payment_tag_used"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Tag Used</FormLabel>
                        <FormControl>
                          <Input placeholder="Chime, CashApp, Zelle..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={incomeForm.control}
                    name="game_played"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Game Played</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={incomeForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button className="md:col-span-2" disabled={incomeForm.formState.isSubmitting} type="submit">
                    {incomeForm.formState.isSubmitting ? "Saving..." : "Save Income Transaction"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cashout">
          <Card>
            <CardHeader>
              <CardTitle>Add Cashout</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...cashoutForm}>
                <form className="grid gap-4 md:grid-cols-2" onSubmit={cashoutForm.handleSubmit(handleCashoutSubmit)}>
                  <FormField
                    control={cashoutForm.control}
                    name="occurred_at"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Occurred At</FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            value={field.value ? field.value.slice(0, 16) : toIsoLocalDefault()}
                            onChange={(event) => field.onChange(new Date(event.target.value).toISOString())}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={cashoutForm.control}
                    name="customer_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={cashoutForm.control}
                    name="amount_cashed_out"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount Cashed Out</FormLabel>
                        <FormControl>
                          <Input min="0" step="0.01" type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={cashoutForm.control}
                    name="amount_redeemed"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount Redeemed</FormLabel>
                        <FormControl>
                          <Input min="0" step="0.01" type="number" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={cashoutForm.control}
                    name="redeemed"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Redeemed</FormLabel>
                        <Select onValueChange={(value) => field.onChange(value === "true")} value={String(field.value)}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="false">No</SelectItem>
                            <SelectItem value="true">Yes</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={cashoutForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button className="md:col-span-2" disabled={cashoutForm.formState.isSubmitting} type="submit">
                    {cashoutForm.formState.isSubmitting ? "Saving..." : "Save Cashout Transaction"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Your Transactions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-3">
            <Input
              placeholder="From date-time"
              type="datetime-local"
              value={filters.from}
              onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
            />
            <Input
              placeholder="To date-time"
              type="datetime-local"
              value={filters.to}
              onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
            />
            <Select
              onValueChange={(value) => setFilters((prev) => ({ ...prev, type: value as FilterType }))}
              value={filters.type}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="cashout">Cashout</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Customer search"
              value={filters.customer}
              onChange={(e) => setFilters((prev) => ({ ...prev, customer: e.target.value }))}
            />
            <Input
              placeholder="Game filter"
              value={filters.game}
              onChange={(e) => setFilters((prev) => ({ ...prev, game: e.target.value }))}
            />
            <Input
              placeholder="Payment tag filter"
              value={filters.paymentTag}
              onChange={(e) => setFilters((prev) => ({ ...prev, paymentTag: e.target.value }))}
            />
            <Select onValueChange={(value) => setSortBy(value as typeof sortBy)} value={sortBy}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="occurred_at">Sort: Occurred At</SelectItem>
                <SelectItem value="amount_received">Sort: Amount Received</SelectItem>
                <SelectItem value="amount_cashed_out">Sort: Amount Cashed Out</SelectItem>
              </SelectContent>
            </Select>
            <Select onValueChange={(value) => setSortOrder(value as typeof sortOrder)} value={sortOrder}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Order: Desc</SelectItem>
                <SelectItem value="asc">Order: Asc</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                setPage(1);
                await loadTransactions();
              }}
              variant="secondary"
            >
              Apply Filters
            </Button>
            <Button
              onClick={async () => {
                setFilters({ from: "", to: "", type: "all", customer: "", game: "", paymentTag: "" });
                setPage(1);
                await loadTransactions();
              }}
              variant="outline"
            >
              Reset
            </Button>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Occurred At</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Game</TableHead>
                <TableHead>Payment Tag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingList ? (
                <TableRow>
                  <TableCell colSpan={6}>Loading...</TableCell>
                </TableRow>
              ) : transactions.length === 0 ? (
                <TableRow>
                  <TableCell className="text-muted-foreground" colSpan={6}>
                    No transactions found.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{format(new Date(transaction.occurred_at), "PPpp")}</TableCell>
                    <TableCell>
                      <Badge variant={transaction.type === "income" ? "default" : "secondary"}>
                        {transaction.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{transaction.customer_name}</TableCell>
                    <TableCell>
                      {transaction.type === "income"
                        ? Number(transaction.amount_received).toFixed(2)
                        : Number(transaction.amount_cashed_out).toFixed(2)}
                    </TableCell>
                    <TableCell>{transaction.game_played ?? "-"}</TableCell>
                    <TableCell>{transaction.payment_tag_used ?? "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {maxPage} ({totalCount} total)
            </p>
            <div className="flex gap-2">
              <Button disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)} size="sm" variant="outline">
                Prev
              </Button>
              <Button
                disabled={page >= maxPage}
                onClick={() => setPage((prev) => prev + 1)}
                size="sm"
                variant="outline"
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

