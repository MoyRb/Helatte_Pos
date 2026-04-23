# Helatte POS Web (Supabase + PWA)

Migración de Helatte POS a aplicación **web-first** con **Supabase** y soporte **PWA instalable**.

## Stack final
- React + Vite + Tailwind (en `web/`)
- Supabase (Auth + Postgres + RLS)
- PWA (manifest + service worker)

## Variables de entorno
Crear `web/.env` con:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Referencia: `web/.env.example`.

## SQL inicial (Supabase)
Ejecutar el script:

- `web/supabase/schema.sql`

Incluye:
- `profiles`
- `brands`
- `brand_users`
- `products`
- `customers`
- `sales`
- `sale_items`
- `raw_materials`
- `inventory_movements`
- políticas RLS base por marca

## Scripts npm (raíz)
```bash
npm run install:web
npm run dev
npm run build
npm run preview
npm run lint
```

> `npm run dev` y `npm run build` delegan a `web/`.

## Flujo de desarrollo
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```
