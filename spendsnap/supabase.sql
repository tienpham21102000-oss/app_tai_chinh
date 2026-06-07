-- SpendSnap production Supabase schema
-- Run this in Supabase SQL Editor after creating the project.
-- Auth providers: enable Email and Google in Supabase Auth settings.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount integer not null check (amount >= 0),
  category text,
  merchant text,
  date text,
  note text,
  created_at text,
  raw_text text,
  source text,
  receipt_id text,
  deleted_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_transactions_user_date on public.transactions (user_id, date desc);
create index if not exists idx_transactions_user_updated on public.transactions (user_id, updated_at desc);

create table if not exists public.categories (
  id text not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  icon text,
  color text,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, id),
  unique (user_id, name)
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  month text not null,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

create table if not exists public.user_settings (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  value text,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

create table if not exists public.receipts (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  mime_type text,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null,
  input_units integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  platform text not null default 'google_play',
  product_id text,
  purchase_token text,
  status text not null default 'free',
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.categories enable row level security;
alter table public.budgets enable row level security;
alter table public.user_settings enable row level security;
alter table public.receipts enable row level security;
alter table public.ai_usage enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists tx_select_own on public.transactions;
create policy tx_select_own on public.transactions for select using (auth.uid() = user_id);
drop policy if exists tx_insert_own on public.transactions;
create policy tx_insert_own on public.transactions for insert with check (auth.uid() = user_id);
drop policy if exists tx_update_own on public.transactions;
create policy tx_update_own on public.transactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists tx_delete_own on public.transactions;
create policy tx_delete_own on public.transactions for delete using (auth.uid() = user_id);

drop policy if exists categories_all_own on public.categories;
create policy categories_all_own on public.categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists budgets_all_own on public.budgets;
create policy budgets_all_own on public.budgets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists settings_all_own on public.user_settings;
create policy settings_all_own on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists receipts_all_own on public.receipts;
create policy receipts_all_own on public.receipts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists ai_usage_select_own on public.ai_usage;
create policy ai_usage_select_own on public.ai_usage for select using (auth.uid() = user_id);
drop policy if exists ai_usage_insert_own on public.ai_usage;
create policy ai_usage_insert_own on public.ai_usage for insert with check (auth.uid() = user_id);

drop policy if exists subscriptions_select_own on public.subscriptions;
create policy subscriptions_select_own on public.subscriptions for select using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id, status)
  values (new.id, 'free')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Storage bucket for receipt images. Create from Dashboard if this statement is blocked by permissions.
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists receipt_images_select_own on storage.objects;
create policy receipt_images_select_own on storage.objects for select
using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists receipt_images_insert_own on storage.objects;
create policy receipt_images_insert_own on storage.objects for insert
with check (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists receipt_images_delete_own on storage.objects;
create policy receipt_images_delete_own on storage.objects for delete
using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);
