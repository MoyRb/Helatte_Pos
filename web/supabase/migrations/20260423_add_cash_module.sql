-- Cash module tables with brand-scoped RLS
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

create index if not exists idx_cash_boxes_brand_id on public.cash_boxes(brand_id);
create index if not exists idx_cash_movements_brand_id on public.cash_movements(brand_id);
create index if not exists idx_cash_movements_cash_box_id on public.cash_movements(cash_box_id);
create index if not exists idx_cash_movements_created_at on public.cash_movements(created_at desc);

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

alter table public.cash_boxes enable row level security;
alter table public.cash_movements enable row level security;

create policy "cash_boxes_brand_access" on public.cash_boxes
for all using (public.is_member_of_brand(brand_id))
with check (public.is_member_of_brand(brand_id));

create policy "cash_movements_brand_access" on public.cash_movements
for all using (public.is_member_of_brand(brand_id))
with check (public.is_member_of_brand(brand_id));

insert into public.cash_boxes (brand_id, name, description)
select b.id, defaults.name, defaults.description
from public.brands b
cross join (
  values
    ('Caja chica'::text, 'Entradas y salidas manuales'::text),
    ('Caja grande'::text, 'Ventas y movimientos operativos'::text)
) as defaults(name, description)
on conflict (brand_id, name) do nothing;
