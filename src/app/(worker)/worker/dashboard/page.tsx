"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { isMockMode } from "@/lib/env";
import { getMockUserSession } from "@/lib/mock-auth";
import { MOCK_SHIFTS, MOCK_TRANSACTIONS, MOCK_USERS } from "@/lib/mock-data";
import { getStoredMockTasks, setStoredMockTasks } from "@/lib/mock-task-store";
import { computeTopCustomers, getWorkerTransactionsForReports } from "@/lib/queries/worker-reports";
import { createClient } from "@/lib/supabase/client";
import {
  cashoutTransactionSchema,
  incomeTransactionSchema,
  type CashoutTransactionInput,
  type IncomeTransactionInput,
} from "@/lib/validation/transaction";

type ShiftRow = {
  id: string;
  user_id?: string | null;
  clock_in_at: string;
  clock_out_at: string | null;
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  assigned_to?: string | null;
  status: "todo" | "in_progress" | "done";
  due_at: string | null;
  completed_at: string | null;
};

type TransactionRow = {
  id: string;
  user_id?: string | null;
  occurred_at: string;
  type: "income" | "cashout";
  customer_name: string;
  amount_received: number;
  amount_cashed_out: number;
  credit_loaded?: number | null;
  game_played: string | null;
  payment_tag_used: string | null;
  redeemed?: boolean | null;
  amount_redeemed?: number | null;
  notes?: string | null;
};

type MonthView = "this" | "last";

const statusCycle: Record<TaskRow["status"], TaskRow["status"]> = {
  todo: "in_progress",
  in_progress: "done",
  done: "done",
};

function getMonthRange(view: MonthView) {
  const now = new Date();
  const start = view === "this" ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = view === "this" ? now : new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}

function computeHours(rows: ShiftRow[], days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return rows.reduce((sum, row) => {
    if (!row.clock_out_at) return sum;
    if (new Date(row.clock_in_at).getTime() < since.getTime()) return sum;
    return sum + (new Date(row.clock_out_at).getTime() - new Date(row.clock_in_at).getTime()) / 3600000;
  }, 0);
}

export default function WorkerDashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isShiftSaving, setIsShiftSaving] = useState(false);
  const [monthView, setMonthView] = useState<MonthView>("this");
  const [activeShift, setActiveShift] = useState<ShiftRow | null>(null);
  const [todayHours, setTodayHours] = useState(0);
  const [weekHours, setWeekHours] = useState(0);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<TransactionRow[]>([]);
  const [reportRows, setReportRows] = useState<TransactionRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [mockWorkerId, setMockWorkerId] = useState(MOCK_USERS.workers[0].id);
  const [txTab, setTxTab] = useState<"income" | "cashout">("income");
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [pendingDeleteTransaction, setPendingDeleteTransaction] = useState<TransactionRow | null>(null);
  const txSectionRef = useRef<HTMLDivElement | null>(null);

  const [mockTransactions, setMockTransactions] = useState<TransactionRow[]>(MOCK_TRANSACTIONS as TransactionRow[]);
  const [mockShifts, setMockShifts] = useState<ShiftRow[]>(MOCK_SHIFTS as ShiftRow[]);

  useEffect(() => {
    if (!isMockMode()) return;
    const session = getMockUserSession();
    if (session?.role === "worker") setMockWorkerId(session.id);
  }, []);

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

  const reportTotals = useMemo(() => {
    const income = reportRows.reduce((sum, row) => sum + Number(row.amount_received ?? 0), 0);
    const cashout = reportRows.reduce((sum, row) => sum + Number(row.amount_cashed_out ?? 0), 0);
    return { income, cashout, net: income - cashout };
  }, [reportRows]);

  const topCustomers = useMemo(() => computeTopCustomers(reportRows as never).slice(0, 5), [reportRows]);

  const loadDashboard = useCallback(async () => {
    try {
      setIsLoading(true);
      const { from, to } = getMonthRange(monthView);

      if (isMockMode()) {
        const workerShifts = mockShifts.filter((row) => row.user_id === mockWorkerId);
        const workerTasks = getStoredMockTasks().filter((row) => row.assigned_to === mockWorkerId);
        const workerTransactions = mockTransactions
          .filter((row) => row.user_id === mockWorkerId)
          .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

        setActiveShift(workerShifts.find((row) => !row.clock_out_at) ?? null);
        setTodayHours(computeHours(workerShifts, 1));
        setWeekHours(computeHours(workerShifts, 7));
        setTasks(workerTasks as TaskRow[]);
        setRecentTransactions(workerTransactions.slice(0, 8));
        setReportRows(
          workerTransactions.filter((row) => {
            const ts = new Date(row.occurred_at).getTime();
            return ts >= new Date(from).getTime() && ts <= new Date(to).getTime();
          }),
        );
        return;
      }

      const supabase = createClient();
      let currentUserId = userId;
      if (!currentUserId) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated.");
        currentUserId = user.id;
        setUserId(user.id);
      }

      const [activeRes, shiftsRes, tasksRes, recentTxRes, monthlyRows] = await Promise.all([
        supabase.from("shifts").select("*").eq("user_id", currentUserId).is("clock_out_at", null).maybeSingle(),
        supabase.from("shifts").select("id,clock_in_at,clock_out_at,user_id").eq("user_id", currentUserId),
        supabase.from("tasks").select("*").eq("assigned_to", currentUserId).order("created_at", { ascending: false }),
        supabase
          .from("transactions")
          .select("id,user_id,occurred_at,type,customer_name,amount_received,amount_cashed_out,credit_loaded,game_played,payment_tag_used,redeemed,amount_redeemed,notes")
          .eq("user_id", currentUserId)
          .order("occurred_at", { ascending: false })
          .limit(8),
        getWorkerTransactionsForReports(supabase, currentUserId, { from, to }),
      ]);

      if (activeRes.error && activeRes.error.code !== "PGRST116") throw activeRes.error;
      if (shiftsRes.error) throw shiftsRes.error;
      if (tasksRes.error) throw tasksRes.error;
      if (recentTxRes.error) throw recentTxRes.error;

      const shifts = (shiftsRes.data ?? []) as ShiftRow[];
      setActiveShift((activeRes.data as ShiftRow | null) ?? null);
      setTodayHours(computeHours(shifts, 1));
      setWeekHours(computeHours(shifts, 7));
      setTasks((tasksRes.data ?? []) as TaskRow[]);
      setRecentTransactions((recentTxRes.data ?? []) as TransactionRow[]);
      setReportRows(monthlyRows as unknown as TransactionRow[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load worker dashboard.");
    } finally {
      setIsLoading(false);
    }
  }, [monthView, mockShifts, mockTransactions, mockWorkerId, userId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleClockIn = async () => {
    try {
      if (activeShift) throw new Error("You already have an active shift.");
      setIsShiftSaving(true);

      if (isMockMode()) {
        setMockShifts((prev) => [
          { id: `sh-${Date.now()}`, user_id: mockWorkerId, clock_in_at: new Date().toISOString(), clock_out_at: null },
          ...prev,
        ]);
        toast.success("Clocked in.");
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated.");

      const { error } = await supabase.from("shifts").insert({ user_id: user.id, clock_in_at: new Date().toISOString() });
      if (error) throw error;
      toast.success("Clocked in.");
      await loadDashboard();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Clock in failed.");
    } finally {
      setIsShiftSaving(false);
    }
  };

  const handleClockOut = async () => {
    try {
      if (!activeShift) throw new Error("No active shift found.");
      setIsShiftSaving(true);

      if (isMockMode()) {
        setMockShifts((prev) =>
          prev.map((row) => (row.id === activeShift.id ? { ...row, clock_out_at: new Date().toISOString() } : row)),
        );
        toast.success("Clocked out.");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase
        .from("shifts")
        .update({ clock_out_at: new Date().toISOString() })
        .eq("id", activeShift.id);
      if (error) throw error;
      toast.success("Clocked out.");
      await loadDashboard();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Clock out failed.");
    } finally {
      setIsShiftSaving(false);
    }
  };

  const handleIncomeSubmit = async (values: IncomeTransactionInput) => {
    try {
      const occurredAt = editingTransactionId ? values.occurred_at : new Date().toISOString();
      if (isMockMode()) {
        if (editingTransactionId) {
          setMockTransactions((prev) =>
            prev.map((row) =>
              row.id === editingTransactionId
                ? {
                    ...row,
                    occurred_at: occurredAt,
                    customer_name: values.customer_name,
                    amount_received: values.amount_received,
                    amount_cashed_out: 0,
                    credit_loaded: values.credit_loaded,
                    payment_tag_used: values.payment_tag_used,
                    game_played: values.game_played,
                    notes: values.notes || null,
                  }
                : row,
            ),
          );
          toast.success("Income transaction updated.");
        } else {
          setMockTransactions((prev) => [
            {
              id: `tx-${Date.now()}`,
              user_id: mockWorkerId,
              occurred_at: occurredAt,
              type: "income",
              customer_name: values.customer_name,
              amount_received: values.amount_received,
              amount_cashed_out: 0,
              credit_loaded: values.credit_loaded,
              game_played: values.game_played,
              payment_tag_used: values.payment_tag_used,
              notes: values.notes || null,
            },
            ...prev,
          ]);
          toast.success("Income transaction saved.");
        }
      } else {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated.");

        const payload = {
          occurred_at: occurredAt,
          customer_name: values.customer_name,
          amount_received: values.amount_received,
          amount_cashed_out: 0,
          credit_loaded: values.credit_loaded,
          payment_tag_used: values.payment_tag_used,
          game_played: values.game_played,
          notes: values.notes || null,
          type: "income" as const,
        };

        const { error } = editingTransactionId
          ? await supabase.from("transactions").update(payload).eq("id", editingTransactionId).eq("user_id", user.id)
          : await supabase.from("transactions").insert({ ...payload, user_id: user.id });
        if (error) throw error;
        toast.success(editingTransactionId ? "Income transaction updated." : "Income transaction saved.");
        await loadDashboard();
      }

      setEditingTransactionId(null);
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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save income transaction.");
    }
  };

  const handleCashoutSubmit = async (values: CashoutTransactionInput) => {
    try {
      const occurredAt = editingTransactionId ? values.occurred_at : new Date().toISOString();
      if (isMockMode()) {
        if (editingTransactionId) {
          setMockTransactions((prev) =>
            prev.map((row) =>
              row.id === editingTransactionId
                ? {
                    ...row,
                    occurred_at: occurredAt,
                    customer_name: values.customer_name,
                    amount_received: 0,
                    amount_cashed_out: values.amount_cashed_out,
                    redeemed: values.redeemed,
                    amount_redeemed: values.amount_redeemed,
                    notes: values.notes || null,
                  }
                : row,
            ),
          );
          toast.success("Cashout transaction updated.");
        } else {
          setMockTransactions((prev) => [
            {
              id: `tx-${Date.now()}`,
              user_id: mockWorkerId,
              occurred_at: occurredAt,
              type: "cashout",
              customer_name: values.customer_name,
              amount_received: 0,
              amount_cashed_out: values.amount_cashed_out,
              game_played: null,
              payment_tag_used: null,
              redeemed: values.redeemed,
              amount_redeemed: values.amount_redeemed,
              notes: values.notes || null,
            },
            ...prev,
          ]);
          toast.success("Cashout transaction saved.");
        }
      } else {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated.");

        const payload = {
          occurred_at: occurredAt,
          customer_name: values.customer_name,
          amount_received: 0,
          amount_cashed_out: values.amount_cashed_out,
          redeemed: values.redeemed,
          amount_redeemed: values.amount_redeemed,
          notes: values.notes || null,
          type: "cashout" as const,
        };

        const { error } = editingTransactionId
          ? await supabase.from("transactions").update(payload).eq("id", editingTransactionId).eq("user_id", user.id)
          : await supabase.from("transactions").insert({ ...payload, user_id: user.id });
        if (error) throw error;
        toast.success(editingTransactionId ? "Cashout transaction updated." : "Cashout transaction saved.");
        await loadDashboard();
      }

      setEditingTransactionId(null);
      cashoutForm.reset({
        ...cashoutForm.getValues(),
        customer_name: "",
        amount_cashed_out: 0,
        amount_redeemed: 0,
        redeemed: false,
        notes: "",
        occurred_at: new Date().toISOString(),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save cashout transaction.");
    }
  };

  const handleEditTransaction = (row: TransactionRow) => {
    setEditingTransactionId(row.id);
    if (row.type === "income") {
      setTxTab("income");
      incomeForm.reset({
        type: "income",
        occurred_at: row.occurred_at,
        customer_name: row.customer_name,
        amount_received: Number(row.amount_received ?? 0),
        credit_loaded: Number(row.credit_loaded ?? 0),
        payment_tag_used: row.payment_tag_used ?? "",
        game_played: row.game_played ?? "",
        notes: row.notes ?? "",
      });
    } else {
      setTxTab("cashout");
      cashoutForm.reset({
        type: "cashout",
        occurred_at: row.occurred_at,
        customer_name: row.customer_name,
        amount_cashed_out: Number(row.amount_cashed_out ?? 0),
        redeemed: Boolean(row.redeemed),
        amount_redeemed: Number(row.amount_redeemed ?? 0),
        notes: row.notes ?? "",
      });
    }
  };

  const handleDeleteTransaction = async (row: TransactionRow) => {
    try {
      if (isMockMode()) {
        setMockTransactions((prev) => prev.filter((tx) => tx.id !== row.id));
        if (editingTransactionId === row.id) setEditingTransactionId(null);
        toast.success("Transaction deleted.");
        return;
      } else {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated.");
        const { error } = await supabase.from("transactions").delete().eq("id", row.id).eq("user_id", user.id);
        if (error) throw error;
      }

      if (editingTransactionId === row.id) {
        setEditingTransactionId(null);
      }
      toast.success("Transaction deleted.");
      if (!isMockMode()) await loadDashboard();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete transaction.");
    }
  };

  const moveTaskForward = async (task: TaskRow) => {
    try {
      const nextStatus = statusCycle[task.status];
      const completedAt = nextStatus === "done" ? new Date().toISOString() : null;

      if (isMockMode()) {
        const next = getStoredMockTasks().map((row) =>
          row.id === task.id ? { ...row, status: nextStatus, completed_at: completedAt } : row,
        );
        setStoredMockTasks(next);
        setTasks(next.filter((row) => row.assigned_to === mockWorkerId) as TaskRow[]);
        toast.success("Task updated.");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase
        .from("tasks")
        .update({ status: nextStatus, completed_at: completedAt })
        .eq("id", task.id);

      if (error) throw error;
      toast.success("Task updated.");
      await loadDashboard();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Task update failed.");
    }
  };

  const jumpToTransactionTab = (tab: "income" | "cashout") => {
    setTxTab(tab);
    txSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Worker Dashboard</h1>
        <p className="text-sm text-muted-foreground">Clock in, add transactions, review monthly report, and handle tasks in one page.</p>
      </div>

      <Card className="border-2 border-primary/40 bg-gradient-to-r from-orange-100/80 via-pink-100/70 to-cyan-100/80">
        <CardHeader>
          <CardTitle>Shift Control</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Badge variant={activeShift ? "default" : "secondary"}>{activeShift ? "Clocked In" : "Clocked Out"}</Badge>
            <span className="text-sm text-muted-foreground">Today Hours: {todayHours.toFixed(2)}</span>
            <span className="text-sm text-muted-foreground">Last 7 Days: {weekHours.toFixed(2)}</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <Button
              className="h-16 w-full text-lg font-semibold lg:max-w-md"
              disabled={isShiftSaving || isLoading}
              onClick={activeShift ? handleClockOut : handleClockIn}
            >
              {activeShift ? "CLOCK OUT" : "CLOCK IN"}
            </Button>
            <div className="flex gap-2">
              <Button
                className="flex-1 lg:flex-none"
                onClick={() => jumpToTransactionTab("income")}
                variant="secondary"
              >
                Add Income
              </Button>
              <Button
                className="flex-1 lg:flex-none"
                onClick={() => jumpToTransactionTab("cashout")}
                variant="secondary"
              >
                Add Cashout
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2" ref={txSectionRef}>
        <CardHeader>
          <CardTitle>Add Transaction</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Tabs onValueChange={(value) => setTxTab(value as "income" | "cashout")} value={txTab}>
            <TabsList>
              <TabsTrigger value="income">Income</TabsTrigger>
              <TabsTrigger value="cashout">Cashout</TabsTrigger>
            </TabsList>

            <TabsContent value="income">
              <Form {...incomeForm}>
                <form className="grid gap-4 md:grid-cols-2" onSubmit={incomeForm.handleSubmit(handleIncomeSubmit)}>
                  <FormField
                    control={incomeForm.control}
                    name="customer_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer</FormLabel>
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
                        <FormLabel>Payment Tag</FormLabel>
                        <FormControl>
                          <Input placeholder="CashApp / Zelle / etc." {...field} />
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
                  <div className="flex gap-2 md:col-span-2">
                    <Button className="flex-1" disabled={incomeForm.formState.isSubmitting} type="submit">
                      {incomeForm.formState.isSubmitting
                        ? "Saving..."
                        : editingTransactionId
                          ? "Update Income"
                          : "Save Income"}
                    </Button>
                    {editingTransactionId ? (
                      <Button
                        onClick={() => setEditingTransactionId(null)}
                        type="button"
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="cashout">
              <Form {...cashoutForm}>
                <form className="grid gap-4 md:grid-cols-2" onSubmit={cashoutForm.handleSubmit(handleCashoutSubmit)}>
                  <FormField
                    control={cashoutForm.control}
                    name="customer_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer</FormLabel>
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
                  <div className="flex gap-2 md:col-span-2">
                    <Button className="flex-1" disabled={cashoutForm.formState.isSubmitting} type="submit">
                      {cashoutForm.formState.isSubmitting
                        ? "Saving..."
                        : editingTransactionId
                          ? "Update Cashout"
                          : "Save Cashout"}
                    </Button>
                    {editingTransactionId ? (
                      <Button
                        onClick={() => setEditingTransactionId(null)}
                        type="button"
                        variant="outline"
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>Monthly Report</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="w-full sm:w-auto" onClick={() => setMonthView("this")} variant={monthView === "this" ? "default" : "outline"}>
              This Month
            </Button>
            <Button className="w-full sm:w-auto" onClick={() => setMonthView("last")} variant={monthView === "last" ? "default" : "outline"}>
              Last Month
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Income</CardTitle>
              </CardHeader>
              <CardContent>{reportTotals.income.toFixed(2)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Cashout</CardTitle>
              </CardHeader>
              <CardContent>{reportTotals.cashout.toFixed(2)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Net</CardTitle>
              </CardHeader>
              <CardContent>{reportTotals.net.toFixed(2)}</CardContent>
            </Card>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Top Customers</TableHead>
                  <TableHead>Income</TableHead>
                  <TableHead>Cashout</TableHead>
                  <TableHead>Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={4}>
                      No data for this period.
                    </TableCell>
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

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Occurred</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={5}>
                      No transactions yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentTransactions.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{format(new Date(row.occurred_at), "PPpp")}</TableCell>
                      <TableCell>
                        <Badge variant={row.type === "income" ? "default" : "secondary"}>{row.type}</Badge>
                      </TableCell>
                      <TableCell>{row.customer_name}</TableCell>
                      <TableCell>
                        {row.type === "income" ? Number(row.amount_received).toFixed(2) : Number(row.amount_cashed_out).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button onClick={() => handleEditTransaction(row)} size="sm" variant="outline">
                            Edit
                          </Button>
                          <Button onClick={() => setPendingDeleteTransaction(row)} size="sm" variant="outline">
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader>
          <CardTitle>My Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading tasks...</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No assigned tasks.</p>
          ) : (
            tasks.map((task) => (
              <div className="space-y-2 rounded-md border bg-card p-3" key={task.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="font-medium">{task.title}</h3>
                  <Badge className="w-fit">{task.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{task.description ?? "No description."}</p>
                <div className="text-xs text-muted-foreground">
                  <p>Due: {task.due_at ? format(new Date(task.due_at), "PPpp") : "Not set"}</p>
                  <p>Completed: {task.completed_at ? format(new Date(task.completed_at), "PPpp") : "Not completed"}</p>
                </div>
                <Button
                  disabled={task.status === "done"}
                  onClick={() => moveTaskForward(task)}
                  size="sm"
                  variant="outline"
                >
                  {task.status === "todo" ? "Start Task" : task.status === "in_progress" ? "Mark Done" : "Completed"}
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog
        onOpenChange={(open) => {
          if (!open) setPendingDeleteTransaction(null);
        }}
        open={Boolean(pendingDeleteTransaction)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Transaction?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently remove the selected transaction.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPendingDeleteTransaction(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!pendingDeleteTransaction) return;
                await handleDeleteTransaction(pendingDeleteTransaction);
                setPendingDeleteTransaction(null);
              }}
              type="button"
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
