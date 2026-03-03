import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export function getEnv() {
  const rawEnv = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  const parsed = envSchema.safeParse(rawEnv);
  if (parsed.success) return parsed.data;

  // Keep local UI development usable even before Supabase is configured.
  if (process.env.NODE_ENV !== "production") {
    return {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "dev-placeholder-key",
    };
  }

  throw new Error(
    "Invalid Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
}

export function isSupabaseConfigured() {
  return envSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }).success;
}

export function isMockMode() {
  const flag = process.env.NEXT_PUBLIC_USE_MOCK_DATA;

  // In local development, default to mock mode unless explicitly disabled.
  if (process.env.NODE_ENV !== "production") {
    return flag !== "false";
  }

  return flag === "true";
}
