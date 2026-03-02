import type { AppRole } from "@/types/database";
import { createClient } from "@/lib/supabase/server";

export async function getUserRole(userId: string): Promise<AppRole | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error) return null;
  return data?.role ?? null;
}

export async function getCurrentUserRole(): Promise<AppRole | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return getUserRole(user.id);
}


