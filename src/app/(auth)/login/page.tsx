"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { isMockMode, isSupabaseConfigured } from "@/lib/env";
import { resolveMockUserFromEmail, setMockUserSession } from "@/lib/mock-auth";
import { createClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z.email("Enter a valid email."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [authError, setAuthError] = useState<string | null>(null);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginValues) => {
    setAuthError(null);

    if (isMockMode()) {
      const email = values.email.trim().toLowerCase();
      const mockUser = resolveMockUserFromEmail(email);
      setMockUserSession(mockUser);
      router.replace(mockUser.role === "admin" ? "/admin/dashboard" : "/worker/dashboard");
      router.refresh();
      return;
    }

    if (!isSupabaseConfigured()) {
      setAuthError("Supabase env vars are not set yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.");
      return;
    }

    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error || !data.user) {
      setAuthError(error?.message ?? "Unable to sign in.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();

    const role = (profile as { role?: "admin" | "worker" } | null)?.role;

    if (profileError || !role) {
      setAuthError("Profile not found. Contact admin.");
      return;
    }

    router.replace(role === "admin" ? "/admin/dashboard" : "/worker/dashboard");
    router.refresh();
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center p-4 sm:p-6 md:p-10">
      <div className="grid w-full max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-2 bg-gradient-to-br from-emerald-100/70 to-cyan-100/60 shadow-sm">
          <CardHeader className="space-y-4">
            <p className="w-fit rounded-full border border-orange-700/30 bg-orange-100/70 px-3 py-1 text-xs font-medium text-orange-700">
              PAL PAY HUSTEL
            </p>
            <CardTitle className="text-3xl leading-tight md:text-4xl">
              Log in to manage daily transactions, shifts, and analytics.
            </CardTitle>
            <CardDescription className="max-w-xl text-base text-slate-700">
              Use your assigned account. Workers access personal workflow pages. Admins access system-wide analytics
              and management tools.
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="border-2 shadow-sm">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>Enter credentials provided by admin.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input autoComplete="email" placeholder="worker1@palplay.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input autoComplete="current-password" placeholder="********" type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {authError ? (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {authError}
                  </p>
                ) : null}

                <Button className="w-full" disabled={form.formState.isSubmitting} size="lg" type="submit">
                  {form.formState.isSubmitting ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

