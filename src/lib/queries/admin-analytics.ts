import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type TxRow = Database["public"]["Tables"]["transactions"]["Row"];
type ShiftRow = Database["public"]["Tables"]["shifts"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export interface AdminFilters {
  from: string;
  to: string;
  workerId?: string;
  paymentTag?: string;
  game?: string;
}

export interface AdminDataset {
  transactions: TxRow[];
  shifts: ShiftRow[];
  profiles: ProfileRow[];
}

export async function fetchAdminDataset(
  supabase: SupabaseClient<Database>,
  filters: AdminFilters,
): Promise<AdminDataset> {
  let txQuery = supabase
    .from("transactions")
    .select("*")
    .gte("occurred_at", filters.from)
    .lte("occurred_at", filters.to);

  let shiftsQuery = supabase
    .from("shifts")
    .select("*")
    .gte("clock_in_at", filters.from)
    .lte("clock_in_at", filters.to);

  if (filters.workerId) {
    txQuery = txQuery.eq("user_id", filters.workerId);
    shiftsQuery = shiftsQuery.eq("user_id", filters.workerId);
  }
  if (filters.paymentTag) txQuery = txQuery.ilike("payment_tag_used", `%${filters.paymentTag}%`);
  if (filters.game) txQuery = txQuery.ilike("game_played", `%${filters.game}%`);

  const [txRes, shiftsRes, profilesRes] = await Promise.all([
    txQuery,
    shiftsQuery,
    supabase.from("profiles").select("*").order("full_name"),
  ]);

  if (txRes.error) throw txRes.error;
  if (shiftsRes.error) throw shiftsRes.error;
  if (profilesRes.error) throw profilesRes.error;

  return {
    transactions: txRes.data ?? [],
    shifts: shiftsRes.data ?? [],
    profiles: profilesRes.data ?? [],
  };
}

function dateBucket(iso: string) {
  return iso.slice(0, 10);
}

export function computeKpis(dataset: AdminDataset) {
  const totalIncome = dataset.transactions.reduce((sum, tx) => sum + Number(tx.amount_received ?? 0), 0);
  const totalCashout = dataset.transactions.reduce((sum, tx) => sum + Number(tx.amount_cashed_out ?? 0), 0);
  const net = totalIncome - totalCashout;
  const activeWorkers = new Set(dataset.shifts.map((s) => s.user_id)).size;
  const transactionsCount = dataset.transactions.length;
  const avgTicket = transactionsCount > 0 ? totalIncome / transactionsCount : 0;
  const cashoutCount = dataset.transactions.filter((tx) => tx.type === "cashout").length;
  const redeemedCount = dataset.transactions.filter((tx) => tx.redeemed).length;
  const redemptionRate = cashoutCount > 0 ? (redeemedCount / cashoutCount) * 100 : 0;

  const hours = dataset.shifts.reduce((sum, shift) => {
    if (!shift.clock_out_at) return sum;
    return sum + (new Date(shift.clock_out_at).getTime() - new Date(shift.clock_in_at).getTime()) / (1000 * 60 * 60);
  }, 0);

  const avgIncomePerHour = hours > 0 ? totalIncome / hours : 0;

  return {
    totalIncome,
    totalCashout,
    net,
    activeWorkers,
    avgIncomePerHour,
    avgTicket,
    transactionsCount,
    redemptionRate,
    hours,
  };
}

export function incomeCashoutTrend(dataset: AdminDataset) {
  const map = new Map<string, { date: string; income: number; cashout: number }>();
  for (const tx of dataset.transactions) {
    const date = dateBucket(tx.occurred_at);
    const entry = map.get(date) ?? { date, income: 0, cashout: 0 };
    entry.income += Number(tx.amount_received ?? 0);
    entry.cashout += Number(tx.amount_cashed_out ?? 0);
    map.set(date, entry);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function netTrend(dataset: AdminDataset) {
  return incomeCashoutTrend(dataset).map((item) => ({
    date: item.date,
    net: item.income - item.cashout,
  }));
}

export function gameDistribution(dataset: AdminDataset) {
  const map = new Map<string, number>();
  for (const tx of dataset.transactions) {
    if (tx.type !== "income" || !tx.game_played) continue;
    map.set(tx.game_played, (map.get(tx.game_played) ?? 0) + Number(tx.amount_received ?? 0));
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

export function paymentTagDistribution(dataset: AdminDataset) {
  const map = new Map<string, number>();
  for (const tx of dataset.transactions) {
    if (tx.type !== "income" || !tx.payment_tag_used) continue;
    map.set(tx.payment_tag_used, (map.get(tx.payment_tag_used) ?? 0) + Number(tx.amount_received ?? 0));
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

export function customerLeaderboard(dataset: AdminDataset) {
  const map = new Map<string, { income: number; cashout: number; net: number }>();
  for (const tx of dataset.transactions) {
    const current = map.get(tx.customer_name) ?? { income: 0, cashout: 0, net: 0 };
    current.income += Number(tx.amount_received ?? 0);
    current.cashout += Number(tx.amount_cashed_out ?? 0);
    current.net = current.income - current.cashout;
    map.set(tx.customer_name, current);
  }
  return [...map.entries()]
    .map(([customer_name, stats]) => ({ customer_name, ...stats }))
    .sort((a, b) => b.net - a.net);
}

function vipTier(totalIncome: number) {
  if (totalIncome >= 3000) return "Gold";
  if (totalIncome >= 1500) return "Silver";
  if (totalIncome >= 500) return "Bronze";
  return "None";
}

export function customerVipTiers(dataset: AdminDataset) {
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const map = new Map<string, number>();
  for (const tx of dataset.transactions) {
    if (tx.type !== "income") continue;
    if (new Date(tx.occurred_at).getTime() < since.getTime()) continue;
    map.set(tx.customer_name, (map.get(tx.customer_name) ?? 0) + Number(tx.amount_received ?? 0));
  }

  return [...map.entries()]
    .filter(([, income]) => income >= 500)
    .map(([customer_name, income]) => ({ customer_name, income, tier: vipTier(income) }))
    .sort((a, b) => b.income - a.income);
}

export function workerLeaderboard(dataset: AdminDataset) {
  const profileMap = new Map(dataset.profiles.map((p) => [p.id, p]));
  const shiftsByUser = new Map<string, number>();

  for (const shift of dataset.shifts) {
    if (!shift.clock_out_at) continue;
    const hours = (new Date(shift.clock_out_at).getTime() - new Date(shift.clock_in_at).getTime()) / (1000 * 60 * 60);
    shiftsByUser.set(shift.user_id, (shiftsByUser.get(shift.user_id) ?? 0) + Math.max(0, hours));
  }

  const map = new Map<string, { income: number; cashout: number; net: number }>();
  for (const tx of dataset.transactions) {
    const profile = profileMap.get(tx.user_id);
    if (!profile || profile.role !== "worker") continue;
    const current = map.get(tx.user_id) ?? { income: 0, cashout: 0, net: 0 };
    current.income += Number(tx.amount_received ?? 0);
    current.cashout += Number(tx.amount_cashed_out ?? 0);
    current.net = current.income - current.cashout;
    map.set(tx.user_id, current);
  }

  return [...map.entries()]
    .map(([user_id, stats]) => {
      const workerName = profileMap.get(user_id)?.full_name ?? "Unknown";
      const hours = shiftsByUser.get(user_id) ?? 0;
      const incomePerHour = hours > 0 ? stats.income / hours : 0;
      return { user_id, workerName, hours, incomePerHour, ...stats };
    })
    .sort((a, b) => (b.net - a.net) || (b.income - a.income));
}

export function getDashboardFilterOptions(dataset: AdminDataset) {
  const workerIds = new Set<string>();
  const games = new Set<string>();
  const tags = new Set<string>();

  for (const tx of dataset.transactions) {
    workerIds.add(tx.user_id);
    if (tx.game_played) games.add(tx.game_played);
    if (tx.payment_tag_used) tags.add(tx.payment_tag_used);
  }

  const workers = dataset.profiles
    .filter((profile) => workerIds.has(profile.id) && profile.role === "worker")
    .map((profile) => ({ id: profile.id, label: profile.full_name }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    workers,
    games: [...games].sort((a, b) => a.localeCompare(b)),
    paymentTags: [...tags].sort((a, b) => a.localeCompare(b)),
  };
}

export function getDashboardInsights(dataset: AdminDataset) {
  const kpis = computeKpis(dataset);
  const insights: string[] = [];
  const totalVolume = kpis.totalIncome + kpis.totalCashout;
  const cashoutRatio = totalVolume > 0 ? (kpis.totalCashout / totalVolume) * 100 : 0;

  if (cashoutRatio > 60) {
    insights.push("Cashout ratio is unusually high for this period.");
  }

  const tags = paymentTagDistribution(dataset);
  if (tags.length > 1) {
    const first = tags[0]?.value ?? 0;
    const second = tags[1]?.value ?? 0;
    if (first > second * 2) {
      insights.push(`Payment account concentration is high: ${tags[0].name} dominates current inflows.`);
    }
  }

  const workers = workerLeaderboard(dataset);
  if (workers.length > 0 && workers[0].hours > 0 && workers[0].incomePerHour > 0) {
    insights.push(
      `Top worker by net is ${workers[0].workerName} with ${workers[0].incomePerHour.toFixed(2)} income/hour.`,
    );
  }

  if (insights.length === 0) {
    insights.push("No unusual risk signals detected for the selected range.");
  }

  return insights;
}


