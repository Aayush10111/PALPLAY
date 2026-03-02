import { NextResponse, type NextRequest } from "next/server";
import { isMockMode, isSupabaseConfigured } from "@/lib/env";
import { updateSession } from "@/lib/supabase/middleware";

const workerPrefix = "/worker";
const adminPrefix = "/admin";
const loginPath = "/login";

export async function proxy(request: NextRequest) {
  if ((isMockMode() || !isSupabaseConfigured()) && process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  const { supabase, user, response } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isWorkerRoute = pathname.startsWith(workerPrefix);
  const isAdminRoute = pathname.startsWith(adminPrefix);
  const isLoginRoute = pathname.startsWith(loginPath);

  if (!user && (isWorkerRoute || isAdminRoute)) {
    return NextResponse.redirect(new URL(loginPath, request.url));
  }

  if (!user) return response;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role;

  if (isLoginRoute) {
    const destination = role === "admin" ? "/admin/dashboard" : "/worker/dashboard";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (isAdminRoute && role !== "admin") {
    return NextResponse.redirect(new URL("/worker/dashboard", request.url));
  }

  if (isWorkerRoute && role !== "worker") {
    return NextResponse.redirect(new URL("/admin/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/login", "/worker/:path*", "/admin/:path*"],
};

