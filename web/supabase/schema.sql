-- Helatte POS Supabase core schema
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.brand_users (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner','admin','staff')),
  created_at timestamptz not null default now(),
  unique (brand_id, user_id)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null check (price >= 0),
  stock integer not null default 0 check (stock >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  phone text,
  address text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  client_name text,
  channel text not null check (channel in ('pos','wholesale')),
  folio text,
  notes text,
  total_amount numeric(10,2) not null check (total_amount >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null check (unit_price >= 0),
  line_total numeric(10,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.raw_materials (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  stock integer not null default 0 check (stock >= 0),
  min_stock integer not null default 0 check (min_stock >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  material_id uuid references public.raw_materials(id) on delete set null,
  movement_type text not null check (movement_type in ('entrada','salida','sale','adjustment')),
  quantity integer not null check (quantity > 0),
  note text,
  created_at timestamptz not null default now(),
  check (product_id is not null or material_id is not null)
);

alter table public.profiles enable row level security;
alter table public.brands enable row level security;
alter table public.brand_users enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.raw_materials enable row level security;
alter table public.inventory_movements enable row level security;

create or replace function public.is_member_of_brand(target_brand uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.brand_users bu
    where bu.brand_id = target_brand and bu.user_id = auth.uid()
  );
$$;

create policy "brand_users_select_self" on public.brand_users
for select using (user_id = auth.uid());

create policy "brands_select_by_membership" on public.brands
for select using (public.is_member_of_brand(id));

create policy "products_brand_access" on public.products
for all using (public.is_member_of_brand(brand_id))
with check (public.is_member_of_brand(brand_id));

create policy "customers_brand_access" on public.customers
for all using (public.is_member_of_brand(brand_id))
with check (public.is_member_of_brand(brand_id));

create policy "sales_brand_access" on public.sales
for all using (public.is_member_of_brand(brand_id))
with check (public.is_member_of_brand(brand_id));

create policy "sale_items_brand_access" on public.sale_items
for all using (public.is_member_of_brand(brand_id))
with check (public.is_member_of_brand(brand_id));

create policy "raw_materials_brand_access" on public.raw_materials
for all using (public.is_member_of_brand(brand_id))
with check (public.is_member_of_brand(brand_id));

create policy "inventory_brand_access" on public.inventory_movements
for all using (public.is_member_of_brand(brand_id))
with check (public.is_member_of_brand(brand_id));

create policy "profiles_select_own" on public.profiles
for select using (id = auth.uid());

create policy "profiles_update_own" on public.profiles
for update using (id = auth.uid());

-- base brands
insert into public.brands(name, slug)
values ('Helatte', 'helatte'), ('Las Purepechas', 'las-purepechas')
on conflict (slug) do nothing;
