import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

interface WorkerReportFilters {
  from: string;
  to: string;
}

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

function filterRange(rows: TransactionRow[], filters: WorkerReportFilters) {
  const fromTs = new Date(filters.from).getTime();
  const toTs = new Date(filters.to).getTime();
  return rows.filter((row) => {
    const ts = new Date(row.occurred_at).getTime();
    return ts >= fromTs && ts <= toTs;
  });
}

export async function getWorkerTransactionsForReports(
  supabase: SupabaseClient<Database>,
  userId: string,
  filters: WorkerReportFilters,
) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .gte("occurred_at", filters.from)
    .lte("occurred_at", filters.to);

  if (error) throw error;
  return filterRange(data ?? [], filters);
}

export function computeTopCustomers(rows: TransactionRow[]) {
  const map = new Map<string, { income: number; cashout: number; net: number }>();

  for (const row of rows) {
    const key = row.customer_name.trim();
    const prev = map.get(key) ?? { income: 0, cashout: 0, net: 0 };
    prev.income += Number(row.amount_received ?? 0);
    prev.cashout += Number(row.amount_cashed_out ?? 0);
    prev.net = prev.income - prev.cashout;
    map.set(key, prev);
  }

  return [...map.entries()]
    .map(([customer_name, stats]) => ({ customer_name, ...stats }))
    .sort((a, b) => b.net - a.net)
    .slice(0, 10);
}

export function computeVipCustomers(rows: TransactionRow[]) {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.type !== "income") continue;
    if (new Date(row.occurred_at).getTime() < since.getTime()) continue;
    map.set(row.customer_name, (map.get(row.customer_name) ?? 0) + Number(row.amount_received ?? 0));
  }

  return [...map.entries()]
    .filter(([, totalIncome]) => totalIncome >= 500)
    .map(([customer_name, total_income_30d]) => ({ customer_name, total_income_30d }))
    .sort((a, b) => b.total_income_30d - a.total_income_30d);
}

export function computeTopGames(rows: TransactionRow[]) {
  const map = new Map<string, number>();

  for (const row of rows) {
    if (row.type !== "income" || !row.game_played) continue;
    map.set(row.game_played, (map.get(row.game_played) ?? 0) + Number(row.amount_received ?? 0));
  }

  return [...map.entries()]
    .map(([game_played, income]) => ({ game_played, income }))
    .sort((a, b) => b.income - a.income)
    .slice(0, 10);
}

export function computeTopPaymentTags(rows: TransactionRow[]) {
  const map = new Map<string, number>();

  for (const row of rows) {
    if (row.type !== "income" || !row.payment_tag_used) continue;
    map.set(row.payment_tag_used, (map.get(row.payment_tag_used) ?? 0) + Number(row.amount_received ?? 0));
  }

  return [...map.entries()]
    .map(([payment_tag_used, income]) => ({ payment_tag_used, income }))
    .sort((a, b) => b.income - a.income)
    .slice(0, 10);
}


