-- Extensions
create extension if not exists "pgcrypto";

-- Role enum
do $$ begin
  create type public.app_role as enum ('admin', 'worker');
exception
  when duplicate_object then null;
end $$;

-- Transaction type enum
do $$ begin
  create type public.transaction_type as enum ('income', 'cashout');
exception
  when duplicate_object then null;
end $$;

-- Task status enum
do $$ begin
  create type public.task_status as enum ('todo', 'in_progress', 'done');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.app_role not null default 'worker',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shifts_time_valid check (clock_out_at is null or clock_out_at >= clock_in_at)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  type public.transaction_type not null,
  customer_name text not null,
  amount_received numeric(12, 2) not null default 0,
  credit_loaded numeric(12, 2) not null default 0,
  payment_tag_used text,
  game_played text,
  amount_cashed_out numeric(12, 2) not null default 0,
  amount_redeemed numeric(12, 2) not null default 0,
  redeemed boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_positive_amounts check (
    amount_received >= 0 and credit_loaded >= 0 and amount_cashed_out >= 0 and amount_redeemed >= 0
  ),
  constraint transactions_income_rule check (
    type <> 'income' or (amount_received > 0 and amount_cashed_out = 0)
  ),
  constraint transactions_cashout_rule check (
    type <> 'cashout' or (amount_cashed_out > 0 and amount_received = 0)
  ),
  constraint transactions_redeemed_rule check (
    (redeemed = false and amount_redeemed = 0)
    or
    (redeemed = true and amount_redeemed >= 0 and amount_redeemed <= amount_cashed_out)
  )
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_to uuid references public.profiles(id) on delete set null,
  status public.task_status not null default 'todo',
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_done_timestamp check (
    (status <> 'done' and completed_at is null) or (status = 'done' and completed_at is not null)
  )
);

-- Helpful indexes
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_shifts_user_clockin on public.shifts(user_id, clock_in_at desc);
create index if not exists idx_transactions_user_time on public.transactions(user_id, occurred_at desc);
create index if not exists idx_transactions_customer_time on public.transactions(customer_name, occurred_at desc);
create index if not exists idx_transactions_type_time on public.transactions(type, occurred_at desc);
create index if not exists idx_tasks_assigned_status on public.tasks(assigned_to, status, due_at);

-- Update timestamp trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_shifts_updated on public.shifts;
create trigger trg_shifts_updated before update on public.shifts
for each row execute function public.set_updated_at();

drop trigger if exists trg_transactions_updated on public.transactions;
create trigger trg_transactions_updated before update on public.transactions
for each row execute function public.set_updated_at();

drop trigger if exists trg_tasks_updated on public.tasks;
create trigger trg_tasks_updated before update on public.tasks
for each row execute function public.set_updated_at();

-- Role helper functions
create or replace function public.my_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.shifts enable row level security;
alter table public.transactions enable row level security;
alter table public.tasks enable row level security;

-- Profiles policies
drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin on public.profiles
for select using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles
for update using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- Shifts policies
drop policy if exists shifts_select_own_or_admin on public.shifts;
create policy shifts_select_own_or_admin on public.shifts
for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists shifts_insert_worker_only_self on public.shifts;
create policy shifts_insert_worker_only_self on public.shifts
for insert with check (user_id = auth.uid() and public.my_role() = 'worker');

drop policy if exists shifts_update_worker_self_or_admin on public.shifts;
create policy shifts_update_worker_self_or_admin on public.shifts
for update using ((user_id = auth.uid() and public.my_role() = 'worker') or public.is_admin())
with check ((user_id = auth.uid() and public.my_role() = 'worker') or public.is_admin());

-- Transactions policies
drop policy if exists transactions_select_own_or_admin on public.transactions;
create policy transactions_select_own_or_admin on public.transactions
for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists transactions_insert_worker_only_self on public.transactions;
create policy transactions_insert_worker_only_self on public.transactions
for insert with check (user_id = auth.uid() and public.my_role() = 'worker');

drop policy if exists transactions_update_worker_self_or_admin on public.transactions;
create policy transactions_update_worker_self_or_admin on public.transactions
for update using ((user_id = auth.uid() and public.my_role() = 'worker') or public.is_admin())
with check ((user_id = auth.uid() and public.my_role() = 'worker') or public.is_admin());

-- Tasks policies
drop policy if exists tasks_select_assigned_or_admin on public.tasks;
create policy tasks_select_assigned_or_admin on public.tasks
for select using (assigned_to = auth.uid() or public.is_admin());

drop policy if exists tasks_insert_admin_only on public.tasks;
create policy tasks_insert_admin_only on public.tasks
for insert with check (public.is_admin());

drop policy if exists tasks_update_assigned_or_admin on public.tasks;
create policy tasks_update_assigned_or_admin on public.tasks
for update using (assigned_to = auth.uid() or public.is_admin())
with check (assigned_to = auth.uid() or public.is_admin());

-- STRICT OPTION: block admin updates on shifts and transactions.
-- Keep this enabled if admins should be read-only for these business events.
drop policy if exists shifts_update_worker_self_or_admin on public.shifts;
create policy shifts_update_worker_self_only_strict on public.shifts
for update using (user_id = auth.uid() and public.my_role() = 'worker')
with check (user_id = auth.uid() and public.my_role() = 'worker');

drop policy if exists transactions_update_worker_self_or_admin on public.transactions;
create policy transactions_update_worker_self_only_strict on public.transactions
for update using (user_id = auth.uid() and public.my_role() = 'worker')
with check (user_id = auth.uid() and public.my_role() = 'worker');

