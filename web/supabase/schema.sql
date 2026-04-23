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

create table if not exists public.cash_boxes (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, name),
  unique (id, brand_id)
);

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  cash_box_id uuid not null,
  movement_type text not null check (movement_type in ('entrada', 'salida')),
  amount numeric(12,2) not null check (amount > 0),
  notes text,
  reference text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint cash_movements_cash_box_brand_fk
    foreign key (cash_box_id, brand_id)
    references public.cash_boxes(id, brand_id)
    on delete cascade
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
alter table public.cash_boxes enable row level security;
alter table public.cash_movements enable row level security;

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

create policy "cash_boxes_brand_access" on public.cash_boxes
for all using (public.is_member_of_brand(brand_id))
with check (public.is_member_of_brand(brand_id));

create policy "cash_movements_brand_access" on public.cash_movements
for all using (public.is_member_of_brand(brand_id))
with check (public.is_member_of_brand(brand_id));

create policy "profiles_select_own" on public.profiles
for select using (id = auth.uid());

create policy "profiles_update_own" on public.profiles
for update using (id = auth.uid());

create or replace function public.ensure_default_cash_boxes(target_brand uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.cash_boxes (brand_id, name, description)
  values
    (target_brand, 'Caja chica', 'Entradas y salidas manuales'),
    (target_brand, 'Caja grande', 'Ventas y movimientos operativos')
  on conflict (brand_id, name) do nothing;
end;
$$;

create or replace function public.sync_cash_boxes_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trigger_cash_boxes_set_updated_at on public.cash_boxes;
create trigger trigger_cash_boxes_set_updated_at
before update on public.cash_boxes
for each row
execute procedure public.sync_cash_boxes_updated_at();

-- base brands
insert into public.brands(name, slug)
values ('Helatte', 'helatte'), ('Las Purepechas', 'las-purepechas')
on conflict (slug) do nothing;

insert into public.cash_boxes (brand_id, name, description)
select b.id, defaults.name, defaults.description
from public.brands b
cross join (
  values
    ('Caja chica'::text, 'Entradas y salidas manuales'::text),
    ('Caja grande'::text, 'Ventas y movimientos operativos'::text)
) as defaults(name, description)
on conflict (brand_id, name) do nothing;

create table if not exists public.production_plans (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  plan_date date not null,
  status text not null default 'draft' check (status in ('draft','confirmed')),
  responsible text,
  notes text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.production_plans(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_name_snapshot text not null,
  variant text,
  presentation text,
  planned_quantity numeric(12,2) not null check (planned_quantity > 0),
  unit text not null default 'pza',
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (plan_id, sort_order)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trigger_set_updated_at_production_plans on public.production_plans;
create trigger trigger_set_updated_at_production_plans
before update on public.production_plans
for each row
execute procedure public.set_updated_at();

alter table public.production_plans enable row level security;
alter table public.production_plan_items enable row level security;

create policy "production_plans_brand_access" on public.production_plans
for all using (public.is_member_of_brand(brand_id))
with check (public.is_member_of_brand(brand_id));

create policy "production_plan_items_brand_access" on public.production_plan_items
for all using (
  exists (
    select 1 from public.production_plans pp
    where pp.id = production_plan_items.plan_id
      and public.is_member_of_brand(pp.brand_id)
  )
)
with check (
  exists (
    select 1 from public.production_plans pp
    where pp.id = production_plan_items.plan_id
      and public.is_member_of_brand(pp.brand_id)
  )
);

create or replace function public.apply_production_plan(target_plan uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_record public.production_plans%rowtype;
  item_record public.production_plan_items%rowtype;
begin
  select *
  into plan_record
  from public.production_plans
  where id = target_plan
  for update;

  if not found then
    raise exception 'Plan de producción no encontrado';
  end if;

  if not public.is_member_of_brand(plan_record.brand_id) then
    raise exception 'No tienes permisos para aplicar este plan';
  end if;

  if plan_record.status <> 'confirmed' then
    raise exception 'Solo se pueden aplicar planes confirmados';
  end if;

  if plan_record.applied_at is not null then
    raise exception 'Este plan ya fue aplicado';
  end if;

  for item_record in
    select *
    from public.production_plan_items
    where plan_id = target_plan
    order by sort_order
  loop
    update public.products
    set stock = stock + item_record.planned_quantity::integer
    where id = item_record.product_id
      and brand_id = plan_record.brand_id;

    insert into public.inventory_movements (
      brand_id,
      product_id,
      movement_type,
      quantity,
      note
    )
    values (
      plan_record.brand_id,
      item_record.product_id,
      'entrada',
      item_record.planned_quantity::integer,
      format('Entrada por producción (%s)', plan_record.plan_date::text)
    );
  end loop;

  update public.production_plans
  set applied_at = now(),
      confirmed_at = coalesce(confirmed_at, now())
  where id = target_plan;
end;
$$;
