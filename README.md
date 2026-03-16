# Helatte POS (Electron + React + Prisma)

Aplicación de escritorio estilo POS para la paletería/nevería **Helatte**. Incluye módulos de catálogo, inventarios, ventas, finanzas, créditos, refris y dashboard analítico.

## Supuestos base
- Sin IVA por defecto (configurable).
- Una sola sucursal.
- Impresión genérica de tickets (sin cajón dedicado).
- Nieve por litro/medio litro y paleta por pieza.
- Recetas opcionales; si no existen, se permiten ajustes manuales.
- Pagaré genérico.
- Stock negativo bloqueado salvo rol Admin.

## Requerimientos
- Node.js 18+
- SQLite (incluido) y Prisma CLI (`npx prisma`)

## Instalación
```bash
npm install
```

## Desarrollo
El flujo de desarrollo compila el proceso main/preload en modo watch, arranca Vite y abre Electron contra los artefactos de `dist`:
```bash
npm run dev
```
El servidor de Vite queda en `http://localhost:5173` y la ventana de Electron se abre automáticamente cuando los bundles están listos.

## Build instalador
```bash
npm run build
npm run dist
```
El instalador se genera con electron-builder.

## Base de datos y seed
La aplicación utiliza un único archivo SQLite almacenado en la ruta `app.getPath('userData')/helatte.db`. Al iniciar Electron, si no existe, se copiará automáticamente una base presembrada desde `prisma/helatte.db` (si está disponible en el paquete).

### Reset controlado (desarrollo)
Este flujo alinea el **schema.prisma** con una base SQLite nueva sin tocar la lógica de la app. Incluye las tablas/columnas nuevas como `CustomerMovement` y `FridgeAssignment.fechaFin`.

1. Elimina la base existente (si existe):
```bash
rm -f prisma/helatte.db
```
2. Reconstruye el esquema con migraciones:
```bash
DATABASE_URL="file:./prisma/helatte.db" npx prisma migrate reset
```
3. Si necesitas resembrar manualmente:
```bash
DATABASE_URL="file:./prisma/helatte.db" npx prisma db seed
```
4. (Opcional) Borra la copia local en `app.getPath('userData')/helatte.db` si ya estaba en uso.

El admin inicial es `admin@helatte.local` / `admin123`.

## Respaldo y export
- IPC `backup:export` copia el archivo `helatte.db` a la ruta indicada.
- Puede extenderse para CSV/Excel desde el proceso main.

## Datos demo
Vienen en el seed: sabores, productos, clientes, cajas y usuario Admin.

## Pruebas rápidas
1. Ejecuta `DATABASE_URL="file:./prisma/helatte.db" npx prisma migrate reset` para recrear la base SQLite con datos demo.
2. Arranca el entorno con `npm run dev` y abre la vista de Catálogo, Finanzas y Ventas.
3. Agrega un sabor y un producto desde Catálogo y verifica que persistan tras recargar.
4. Registra un ingreso o gasto en cada caja y revisa que los totales se actualicen.
5. Arma un carrito en Ventas, usa **Cobrar / Guardar venta** y confirma que se vacíe al guardar.

## Checklist de MVP
- [x] Tema pastel Helatte + layout POS.
- [x] Dashboard con gráficas de ventas y sabores.
- [x] POS rápido con carrito y totales.
- [x] Catálogo (sabores/productos) y clientes.
- [x] Inventario de producto terminado.
- [x] Finanzas (cajas) y movimientos demo.
- [x] Créditos y refris (listas básicas).
- [x] Prisma schema + seed + handlers IPC iniciales.
- [ ] Autenticación completa con roles y permisos UI.
- [ ] CRUD completos con formularios y validación Zod.
- [ ] Producción desde recetas con consumo automático.
- [ ] Import/export CSV y backups automatizados.
- [ ] Reportes PDF de pagarés y tickets.

## Fase 2 sugerida
- Integrar lector de código de barras y atajos de teclado globales.
- Añadir auditoría detallada por módulo.
- Optimizar POS para pantallas táctiles con modo kiosco.
- Sincronización opcional entre sucursales (si aplica futuro multi-sucursal).
