import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function getActiveShift(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("user_id", userId)
    .is("clock_out_at", null)
    .order("clock_in_at", { ascending: false })
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getRecentShifts(supabase: SupabaseClient<Database>, userId: string, limit = 20) {
  const { data, error } = await supabase
    .from("shifts")
    .select("*")
    .eq("user_id", userId)
    .order("clock_in_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function getHoursForLastDays(
  supabase: SupabaseClient<Database>,
  userId: string,
  days: number,
) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabase
    .from("shifts")
    .select("clock_in_at, clock_out_at")
    .eq("user_id", userId)
    .gte("clock_in_at", since.toISOString());

  if (error) throw error;

  let totalMs = 0;
  for (const shift of data) {
    if (!shift.clock_out_at) continue;
    totalMs += new Date(shift.clock_out_at).getTime() - new Date(shift.clock_in_at).getTime();
  }

  return Math.max(0, totalMs / (1000 * 60 * 60));
}


