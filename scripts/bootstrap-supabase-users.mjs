#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const defaultPassword = process.env.SUPABASE_BOOTSTRAP_PASSWORD ?? "123456";

const users = [
  { email: "amy@palplay.com", full_name: "AMY", role: "worker" },
  { email: "dino@palplay.com", full_name: "DINO", role: "worker" },
  { email: "ellen@palplay.com", full_name: "ELLEN", role: "worker" },
  { email: "hustel@palplay.com", full_name: "PAL PAY HUSTEL", role: "worker" },
  { email: "admin@palplay.com", full_name: "ADMIN", role: "admin" },
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!supabaseUrl) {
  fail("Missing NEXT_PUBLIC_SUPABASE_URL.");
}

if (!serviceRoleKey) {
  fail("Missing SUPABASE_SERVICE_ROLE_KEY.");
}

if (defaultPassword.length < 6) {
  fail("SUPABASE_BOOTSTRAP_PASSWORD must be at least 6 characters.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function ensureUser(input) {
  const listRes = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listRes.error) throw listRes.error;
  const existing = (listRes.data?.users ?? []).find((user) => user.email?.toLowerCase() === input.email);

  if (existing) {
    const updateRes = await admin.auth.admin.updateUserById(existing.id, {
      email_confirm: true,
      user_metadata: { full_name: input.full_name, role: input.role },
      password: defaultPassword,
    });
    if (updateRes.error) throw updateRes.error;
    return { id: existing.id, email: input.email, status: "updated" };
  }

  const createRes = await admin.auth.admin.createUser({
    email: input.email,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: { full_name: input.full_name, role: input.role },
  });
  if (createRes.error || !createRes.data.user) {
    throw createRes.error ?? new Error(`Unable to create user ${input.email}`);
  }
  return { id: createRes.data.user.id, email: input.email, status: "created" };
}

async function upsertProfile(row) {
  const res = await admin.from("profiles").upsert(
    {
      id: row.id,
      full_name: users.find((u) => u.email === row.email)?.full_name ?? row.email.split("@")[0],
      role: users.find((u) => u.email === row.email)?.role ?? "worker",
      is_active: true,
    },
    { onConflict: "id" },
  );
  if (res.error) throw res.error;
}

async function main() {
  console.log("Bootstrapping Supabase users...");
  const results = [];
  for (const user of users) {
    const ensured = await ensureUser(user);
    await upsertProfile(ensured);
    results.push(ensured);
  }

  for (const item of results) {
    console.log(`${item.status.toUpperCase()} ${item.email}`);
  }

  console.log(`Done. Login password for all bootstrap users: ${defaultPassword}`);
}

main().catch((error) => {
  console.error("Bootstrap failed:", error.message ?? error);
  process.exit(1);
});
