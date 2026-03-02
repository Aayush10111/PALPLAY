import { redirect } from "next/navigation";
import type { AppRole } from "@/types/database";
import { isMockMode, isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { getUserRole } from "@/lib/auth/get-user-role";

export async function requireRole(requiredRole: AppRole) {
  if ((isMockMode() || !isSupabaseConfigured()) && process.env.NODE_ENV !== "production") {
    return { user: null, role: requiredRole };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const role = await getUserRole(user.id);
  if (!role) {
    redirect("/unauthorized");
  }

  if (requiredRole === "admin" && role !== "admin") {
    redirect("/worker/dashboard");
  }

  if (requiredRole === "worker" && role !== "worker") {
    redirect("/admin/dashboard");
  }

  return { user, role };
}

