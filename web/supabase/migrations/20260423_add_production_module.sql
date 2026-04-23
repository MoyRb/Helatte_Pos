-- Production module tables + inventory integration
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
