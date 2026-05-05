create table customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  contact text,
  email text,
  notes text,
  created_at timestamptz not null default now()
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  customer_id uuid references customers(id) on delete set null,
  customer_name text not null,
  invoice_number text not null,
  amount numeric(10, 2) not null,
  status text not null check (status in ('draft', 'sent', 'overdue', 'paid')),
  due_date date not null,
  notes text,
  created_at timestamptz not null default now()
);

create table business_settings (
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

alter table customers enable row level security;
alter table invoices enable row level security;
alter table business_settings enable row level security;

create policy "Users can read their customers"
  on customers for select
  using (auth.uid() = user_id);

create policy "Users can create their customers"
  on customers for insert
  with check (auth.uid() = user_id);

create policy "Users can update their customers"
  on customers for update
  using (auth.uid() = user_id);

create policy "Users can delete their customers"
  on customers for delete
  using (auth.uid() = user_id);

create policy "Users can read their invoices"
  on invoices for select
  using (auth.uid() = user_id);

create policy "Users can create their invoices"
  on invoices for insert
  with check (auth.uid() = user_id);

create policy "Users can update their invoices"
  on invoices for update
  using (auth.uid() = user_id);

create policy "Users can delete their invoices"
  on invoices for delete
  using (auth.uid() = user_id);

create policy "Users can read their business settings"
  on business_settings for select
  using (auth.uid() = user_id);

create policy "Users can create their business settings"
  on business_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their business settings"
  on business_settings for update
  using (auth.uid() = user_id);
