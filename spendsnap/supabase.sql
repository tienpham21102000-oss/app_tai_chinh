-- SpendSnap Supabase schema (run in Supabase SQL editor)
-- Requires: Auth enabled (anonymous sign-in supported)

create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null,
  category text,
  merchant text,
  date text,
  note text,
  created_at text,
  raw_text text,
  source text,
  updated_at timestamptz default now()
);

alter table public.transactions enable row level security;

drop policy if exists "tx_select_own" on public.transactions;
create policy "tx_select_own"
on public.transactions for select
using (auth.uid() = user_id);

drop policy if exists "tx_upsert_own" on public.transactions;
create policy "tx_upsert_own"
on public.transactions for insert
with check (auth.uid() = user_id);

drop policy if exists "tx_update_own" on public.transactions;
create policy "tx_update_own"
on public.transactions for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

