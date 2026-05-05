create table if not exists business_settings (
  user_id uuid primary key,
  business_name text,
  sender_name text,
  email text,
  phone text,
  payment_terms text,
  payment_note text,
  sign_off text,
  updated_at timestamptz not null default now()
);

alter table business_settings enable row level security;

drop policy if exists "Users can read their business settings" on business_settings;
drop policy if exists "Users can create their business settings" on business_settings;
drop policy if exists "Users can update their business settings" on business_settings;

create policy "Users can read their business settings"
  on business_settings for select
  using (auth.uid() = user_id);

create policy "Users can create their business settings"
  on business_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their business settings"
  on business_settings for update
  using (auth.uid() = user_id);
