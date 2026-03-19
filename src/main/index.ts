import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import path from 'path'
import fs from 'fs'
import { createRequire } from 'module'
import { fileURLToPath } from 'url'

console.log('[main] Helatte POS main process starting')

/* =========================================================
   ESM PATHS + CommonJS bridge (NECESARIO)
========================================================= */
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const cjsRequire = createRequire(import.meta.url)

/* =========================================================
   PRISMA – Electron-safe lazy loader
========================================================= */
import type { PrismaClient } from '@prisma/client'
import { Prisma } from '@prisma/client'

let prisma: PrismaClient | undefined
let databaseHealthy = true
let lastDatabaseError: string | null = null
let databaseDialogOpen = false

const resolvePrismaClientEntry = () => {
  const appPath = app.getAppPath()
  const candidates = [
    path.join(appPath, 'node_modules', '.prisma', 'client', 'default.js'),
    path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      '.prisma',
      'client',
      'default.js'
    ),
    path.join(appPath, 'node_modules', '@prisma', 'client', 'default.js'),
    path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'node_modules',
      '@prisma',
      'client',
      'default.js'
    )
  ]
  const found = candidates.find((candidate) => fs.existsSync(candidate))
  if (!found) {
    console.error('[prisma] No se encontró el cliente generado.', { candidates })
    return candidates[0]
  }
  return found
}

function getPrisma(): PrismaClient {
  if (!prisma) {
    const prismaClientEntry = resolvePrismaClientEntry()
    const { PrismaClient } = cjsRequire(prismaClientEntry)
    prisma = new PrismaClient()
  }
  return prisma!
}

async function getDefaultUserId(prismaClient: PrismaClient): Promise<number> {
  const existing = await prismaClient.user.findFirst({ orderBy: { id: 'asc' } })
  if (existing) return existing.id

  const created = await prismaClient.user.create({
    data: {
      email: 'cajero@helatte.local',
      nombre: 'Cajero',
      password: 'changeme',
      role: 'CAJERO'
    }
  })

  return created.id
}

async function ensureDefaultCashBoxes(prismaClient: PrismaClient) {
  const existentes = await prismaClient.cashBox.findMany()
  if (existentes.length > 0) return

  await prismaClient.cashBox.createMany({
    data: [
      { nombre: 'Caja chica', tipo: 'chica' },
      { nombre: 'Caja grande', tipo: 'grande' }
    ]
  })
}

/* =========================================================
   APP CONFIG
========================================================= */
const isDev = !app.isPackaged

const DEFAULT_DEV_SERVER_URL = 'http://localhost:5173'

const resolveDevServerUrl = () => {
  const fromEnv = process.env.VITE_DEV_SERVER_URL?.trim()
  if (!fromEnv) return DEFAULT_DEV_SERVER_URL

  if (/^https?:\/\//i.test(fromEnv)) {
    return fromEnv
  }

  return DEFAULT_DEV_SERVER_URL
}

const devServerUrl = resolveDevServerUrl()

process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandledRejection', reason)
})

process.on('uncaughtException', (error) => {
  console.error('[main] uncaughtException', error)
})

const resolvePreloadPath = () => {
  const candidates = [
    path.resolve(__dirname, '../preload/index.js'),
    path.resolve(app.getAppPath(), 'dist', 'preload', 'index.js'),
    path.resolve(process.resourcesPath, 'app.asar.unpacked', 'dist', 'preload', 'index.js')
  ]
  const found = candidates.find((candidate) => fs.existsSync(candidate))

  const preloadPath = found ?? candidates[0]

  console.info('[preload] resolved preload path', {
    isPackaged: app.isPackaged,
    preloadPath,
    exists: !!found,
    candidates
  })

  return preloadPath
}

const resolveRendererPath = () => {
  const candidate = path.join(__dirname, '../renderer/index.html')
  if (!fs.existsSync(candidate)) {
    const error = new Error('Renderer index.html missing')
    console.error('[renderer] No se encontró index.html.', { candidate, error })
  }
  return candidate
}

/* =========================================================
   PRISMA ENGINE PATH (asar-safe)
========================================================= */
if (!isDev) {
  const prismaEngineDir = path.join(
    process.resourcesPath,
    'app.asar.unpacked',
    'node_modules',
    '.prisma',
    'client'
  )
  if (fs.existsSync(prismaEngineDir)) {
    const engineFile = fs
      .readdirSync(prismaEngineDir)
      .find((file) => file.startsWith('libquery_engine') || file.startsWith('query_engine'))
    if (engineFile) {
      process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(prismaEngineDir, engineFile)
    }
  }
}

/* =========================================================
   DATABASE SETUP (SQLite portable)
========================================================= */
const dbPath = path.join(app.getPath('userData'), 'helatte.db')

const templateDbPath = isDev
  ? path.join(__dirname, '../../prisma/helatte.db')
  : path.join(process.resourcesPath, 'prisma', 'helatte.db')

if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  if (fs.existsSync(templateDbPath)) {
    fs.copyFileSync(templateDbPath, dbPath)
  }
}

process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? `file:${dbPath}`

type SqliteColumnInfo = {
  name: string
}

type SqliteTableInfo = {
  name: string
}

const columnExists = async (
  prismaClient: PrismaClient,
  table: string,
  column: string
): Promise<boolean> => {
  const rows = (await prismaClient.$queryRawUnsafe(
    `PRAGMA table_info('${table}')`
  )) as SqliteColumnInfo[]
  return rows.some((row) => row.name === column)
}

const tableExists = async (prismaClient: PrismaClient, table: string): Promise<boolean> => {
  const rows = (await prismaClient.$queryRawUnsafe(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`
  )) as SqliteTableInfo[]
  return rows.length > 0
}

const addColumnIfMissing = async (
  prismaClient: PrismaClient,
  table: string,
  column: string,
  sql: string
) => {
  if (await columnExists(prismaClient, table, column)) return
  await prismaClient.$executeRawUnsafe(sql)
}

const ensurePosWholesaleColumns = async (prismaClient: PrismaClient) => {
  await addColumnIfMissing(
    prismaClient,
    'Product',
    'precioMayoreo',
    'ALTER TABLE "Product" ADD COLUMN "precioMayoreo" REAL'
  )

  await addColumnIfMissing(
    prismaClient,
    'Customer',
    'permiteMayoreo',
    'ALTER TABLE "Customer" ADD COLUMN "permiteMayoreo" BOOLEAN NOT NULL DEFAULT true'
  )

  await addColumnIfMissing(
    prismaClient,
    'Sale',
    'customerId',
    'ALTER TABLE "Sale" ADD COLUMN "customerId" INTEGER'
  )
  await addColumnIfMissing(
    prismaClient,
    'Sale',
    'tipoVenta',
    `ALTER TABLE "Sale" ADD COLUMN "tipoVenta" TEXT NOT NULL DEFAULT 'MOSTRADOR'`
  )
  await addColumnIfMissing(
    prismaClient,
    'Sale',
    'subtotal',
    'ALTER TABLE "Sale" ADD COLUMN "subtotal" REAL NOT NULL DEFAULT 0'
  )
  await addColumnIfMissing(
    prismaClient,
    'Sale',
    'descuentoTipo',
    `ALTER TABLE "Sale" ADD COLUMN "descuentoTipo" TEXT NOT NULL DEFAULT 'ninguno'`
  )
  await addColumnIfMissing(
    prismaClient,
    'Sale',
    'descuentoValor',
    'ALTER TABLE "Sale" ADD COLUMN "descuentoValor" REAL NOT NULL DEFAULT 0'
  )

  await addColumnIfMissing(
    prismaClient,
    'SaleItem',
    'subtotalLinea',
    'ALTER TABLE "SaleItem" ADD COLUMN "subtotalLinea" REAL NOT NULL DEFAULT 0'
  )

  await prismaClient.$executeRawUnsafe(
    `UPDATE "Sale"
     SET
       "subtotal" = CASE WHEN "subtotal" = 0 THEN "total" ELSE "subtotal" END,
       "descuentoTipo" = COALESCE("descuentoTipo", 'ninguno'),
       "descuentoValor" = COALESCE("descuentoValor", 0),
       "tipoVenta" = CASE
         WHEN COALESCE("tipoVenta", '') = '' THEN CASE WHEN "pagoMetodo" = 'crédito' THEN 'MAYOREO' ELSE 'MOSTRADOR' END
         ELSE "tipoVenta"
       END`
  )

  await prismaClient.$executeRawUnsafe(
    `UPDATE "SaleItem"
     SET "subtotalLinea" = CASE
       WHEN "subtotalLinea" = 0 THEN "precio" * "cantidad"
       ELSE "subtotalLinea"
     END`
  )
}

const ensureProductionTables = async (prismaClient: PrismaClient) => {
  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProductionPlan" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "fecha" DATETIME NOT NULL,
      "notas" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await prismaClient.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "ProductionPlan_fecha_key"
    ON "ProductionPlan"("fecha")
  `)

  await prismaClient.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProductionPlanItem" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "planId" INTEGER NOT NULL,
      "productId" INTEGER,
      "nombre" TEXT NOT NULL,
      "presentacion" TEXT NOT NULL,
      "cantidadBase" INTEGER NOT NULL DEFAULT 0,
      "cantidadAjuste" INTEGER NOT NULL DEFAULT 0,
      "orden" INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT "ProductionPlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ProductionPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "ProductionPlanItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    )
  `)

  await prismaClient.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "productionplanitem_plan_idx"
    ON "ProductionPlanItem"("planId")
  `)

  await prismaClient.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "productionplanitem_product_idx"
    ON "ProductionPlanItem"("productId")
  `)
}

const markDatabaseIncompatible = (reason: string) => {
  databaseHealthy = false
  lastDatabaseError = reason
}

const assertDatabaseHealthy = () => {
  if (!databaseHealthy) {
    throw new Error(lastDatabaseError ?? 'Base de datos desactualizada. Reinicia la aplicación')
  }
}

const checkDatabaseCompatibility = async (prismaClient: PrismaClient): Promise<string[]> => {
  const missing: string[] = []

  if (!(await tableExists(prismaClient, 'CustomerMovement'))) {
    missing.push('CustomerMovement')
  }

  if (!(await columnExists(prismaClient, 'FridgeAssignment', 'fechaFin'))) {
    missing.push('FridgeAssignment.fechaFin')
  }

  return missing
}

const resetDatabaseFromTemplate = async (): Promise<boolean> => {
  try {
    if (prisma) {
      await prisma.$disconnect()
      prisma = undefined
    }

    if (!fs.existsSync(templateDbPath)) {
      console.error('[db] No se encontró base de datos plantilla', { templateDbPath })
      return false
    }

    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    fs.copyFileSync(templateDbPath, dbPath)

    databaseHealthy = true
    lastDatabaseError = null

    return true
  } catch (error) {
    console.error('[db] Error reseteando base de datos', error)
    return false
  }
}

const promptDatabaseReset = async (missing: string[], reason: string): Promise<boolean> => {
  if (databaseDialogOpen) return false
  databaseDialogOpen = true

  try {
    const buttons = isDev ? ['Reset automático', 'Salir'] : ['Salir']

    const { response } = await dialog.showMessageBox({
      type: 'error',
      buttons,
      defaultId: 0,
      cancelId: buttons.length - 1,
      title: 'Base de datos desactualizada',
      message: 'La base de datos no coincide con el esquema actual.',
      detail: `${reason}\n\nElementos faltantes: ${missing.join(', ') || 'desconocidos.'}`,
      noLink: true
    })

    if (isDev && response === 0) {
      const resetOk = await resetDatabaseFromTemplate()
      if (resetOk) {
        const prismaClient = getPrisma()
        const remainingIssues = await checkDatabaseCompatibility(prismaClient)
        if (remainingIssues.length === 0) {
          return true
        }
        markDatabaseIncompatible(
          `La base se reseteó pero siguen faltando: ${remainingIssues.join(', ')}`
        )
      }
    }
  } finally {
    databaseDialogOpen = false
  }

  app.quit()
  return false
}

const handlePrismaError = async (error: unknown, channel?: string): Promise<string> => {
  const prismaErrorCode =
    error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code
      : null

  if (prismaErrorCode === 'P2021' || prismaErrorCode === 'P2022') {
      const reason = `Base de datos desactualizada (Prisma ${prismaErrorCode}).`
      markDatabaseIncompatible(reason)

      try {
        const issues = await checkDatabaseCompatibility(getPrisma())
        await promptDatabaseReset(issues, reason)
      } catch (err) {
        console.error('[db] Error verificando compatibilidad tras excepción', err)
      }

      return reason
  }

  if (error instanceof Error) {
    console.error(`[Prisma error${channel ? `:${channel}` : ''}]`, error)
    return error.message
  }

  console.error(`[Prisma error${channel ? `:${channel}` : ''}]`, error)
  return 'Error desconocido de base de datos'
}

const ensureDatabaseSchema = async (): Promise<boolean> => {
  try {
    const prismaClient = getPrisma()
    await ensurePosWholesaleColumns(prismaClient)
    await ensureProductionTables(prismaClient)
    const missing = await checkDatabaseCompatibility(prismaClient)

    if (missing.length === 0) {
      databaseHealthy = true
      lastDatabaseError = null
      return true
    }

    const reason = `Base de datos incompatible. Faltan: ${missing.join(', ')}`
    console.error('[db]', reason)
    markDatabaseIncompatible(reason)

    return await promptDatabaseReset(missing, reason)
  } catch (error) {
    const message = await handlePrismaError(error)
    console.error('[db] Error validando esquema', error)
    markDatabaseIncompatible(message)
    return false
  }
}

/* =========================================================
   IPC SAFE HANDLER
========================================================= */
const safeHandle = (
  channel: string,
  fn: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => Promise<any>
) => {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      assertDatabaseHealthy()
      return await fn(event, ...args)
    } catch (err: any) {
      const message = await handlePrismaError(err, channel)
      throw new Error(message)
    }
  })
}

/* =========================================================
   WINDOW
========================================================= */
let mainWindow: BrowserWindow | null = null
let creatingWindow: Promise<BrowserWindow> | null = null

const createWindow = async (): Promise<BrowserWindow> => {
  if (mainWindow) return mainWindow
  if (creatingWindow) return creatingWindow

  creatingWindow = (async () => {
    const preloadPath = resolvePreloadPath()
    if (!isDev) {
      console.info('[main] Production paths', {
        appPath: app.getAppPath(),
        resourcesPath: process.resourcesPath,
        preloadPath: preloadPath ?? null,
        rendererPath: resolveRendererPath(),
        userData: app.getPath('userData'),
        dbPath
      })
    }

    const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#FFF6FA',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[renderer] did-fail-load', { errorCode, errorDescription, validatedURL })
    if (!win.isVisible()) {
      win.show()
    }
  })

  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[renderer] render-process-gone', details)
  })

  win.once('ready-to-show', () => {
    win.show()
  })

  if (isDev) {
    try {
      console.info('[renderer] Loading dev server URL', { devServerUrl })
      await win.loadURL(devServerUrl)
    } catch (error) {
      console.error('[renderer] loadURL failed', error)
    }
    win.webContents.openDevTools()
  } else {
    try {
      await win.loadFile(resolveRendererPath())
    } catch (error) {
      console.error('[renderer] loadFile failed', error)
    }
  }

    win.on('closed', () => {
      mainWindow = null
    })

    mainWindow = win
    return win
  })()

  try {
    return await creatingWindow
  } finally {
    creatingWindow = null
  }
}

/* =========================================================
   APP LIFECYCLE
========================================================= */
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-gpu-compositing')
app.commandLine.appendSwitch('disable-software-rasterizer')
app.commandLine.appendSwitch('no-sandbox')

const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  console.error('[main] Another instance is running, quitting.')
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    } else {
      void createWindow()
    }
  })

  app.whenReady().then(async () => {
    const databaseReady = await ensureDatabaseSchema()
    if (!databaseReady) return
    await createWindow()
  })
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow()
})

app.on('window-all-closed', async () => {
  if (process.platform !== 'darwin') {
    try {
      if (prisma) await prisma.$disconnect()
    } finally {
      app.quit()
    }
  }
})

type PosSaleType = 'MOSTRADOR' | 'MAYOREO'
type DiscountType = 'ninguno' | 'porcentaje' | 'monto'

const normalizarTipoVenta = (tipoVenta?: string | null): PosSaleType =>
  tipoVenta === 'MAYOREO' ? 'MAYOREO' : 'MOSTRADOR'

const normalizarTipoDescuento = (tipo?: string | null): DiscountType => {
  if (tipo === 'porcentaje' || tipo === 'monto') return tipo
  return 'ninguno'
}

const calcularDescuento = (subtotal: number, tipo: DiscountType, valor: number) => {
  if (!Number.isFinite(valor) || valor < 0) {
    throw new Error('El descuento debe ser un número igual o mayor a cero.')
  }

  if (tipo === 'ninguno') return 0

  if (tipo === 'porcentaje') {
    if (valor > 100) {
      throw new Error('El descuento porcentual no puede ser mayor a 100%.')
    }
    return Number(((subtotal * valor) / 100).toFixed(2))
  }

  if (valor > subtotal) {
    throw new Error('El descuento fijo no puede ser mayor al subtotal.')
  }

  return Number(valor.toFixed(2))
}

const obtenerPrecioVenta = (
  producto: { precio: number; precioMayoreo?: number | null },
  tipoVenta: PosSaleType
) => {
  if (tipoVenta === 'MAYOREO') {
    return producto.precioMayoreo ?? producto.precio
  }
  return producto.precio
}

const HELATTE_BUSINESS = {
  nombre: 'Helatte',
  giro: 'Nevería & Paletería'
} as const

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2
  }).format(value)

const formatSaleDate = (value: Date) =>
  new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(value)

const getDayRange = (value: Date) => {
  const start = new Date(value)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}


type ProductionPlanItemPayload = {
  id?: number
  productId?: number | null
  nombre: string
  presentacion: string
  cantidadBase: number
  cantidadAjuste: number
  cantidadFinal: number
  orden: number
  esManual: boolean
}

type ProductionPlanPayload = {
  id?: number
  fecha: string
  notas: string
  createdAt?: string
  updatedAt?: string
  items: ProductionPlanItemPayload[]
}

type ProductionSourcePayload = {
  saleId: number
  folio: string
  customerName: string | null
  total: number
}

type ProductionPlanResponse = {
  plan: ProductionPlanPayload | null
  draft: ProductionPlanPayload
  basedOnWholesaleSales: boolean
  wholesaleSalesCount: number
  wholesaleSources: ProductionSourcePayload[]
}

const normalizePlanDate = (value?: string | Date | null) => {
  let date: Date

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    date = new Date(year, month - 1, day)
  } else {
    date = value ? new Date(value) : new Date()
  }

  if (Number.isNaN(date.getTime())) {
    throw new Error('Selecciona una fecha válida para producción.')
  }

  date.setHours(0, 0, 0, 0)
  return date
}

const formatPlanDateInput = (value: Date) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatProductionDate = (value: Date) =>
  new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'full'
  }).format(value)

const sanitizeProductionItems = (items: ProductionPlanItemPayload[]) =>
  items
    .map((item, index) => {
      const cantidadBase = Math.round(Number(item.cantidadBase ?? 0))
      const cantidadFinal = Math.max(0, Math.round(Number(item.cantidadFinal ?? 0)))
      const cantidadAjuste = cantidadFinal - cantidadBase
      return {
        productId: item.productId ?? null,
        nombre: String(item.nombre ?? '').trim(),
        presentacion: String(item.presentacion ?? '').trim(),
        cantidadBase: Number.isFinite(cantidadBase) ? cantidadBase : 0,
        cantidadAjuste: Number.isFinite(cantidadAjuste) ? cantidadAjuste : 0,
        cantidadFinal: Number.isFinite(cantidadFinal) ? cantidadFinal : 0,
        orden: Number.isFinite(Number(item.orden)) ? Number(item.orden) : index
      }
    })
    .filter((item) => item.cantidadFinal > 0 && item.nombre && item.presentacion)

const serializeProductionPlan = (plan: {
  id: number
  fecha: Date
  notas: string | null
  createdAt: Date
  updatedAt: Date
  items: {
    id: number
    productId: number | null
    nombre: string
    presentacion: string
    cantidadBase: number
    cantidadAjuste: number
    orden: number
  }[]
}): ProductionPlanPayload => ({
  id: plan.id,
  fecha: formatPlanDateInput(plan.fecha),
  notas: plan.notas ?? '',
  createdAt: plan.createdAt.toISOString(),
  updatedAt: plan.updatedAt.toISOString(),
  items: plan.items
    .slice()
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es-MX'))
    .map((item) => ({
      id: item.id,
      productId: item.productId,
      nombre: item.nombre,
      presentacion: item.presentacion,
      cantidadBase: item.cantidadBase,
      cantidadAjuste: item.cantidadAjuste,
      cantidadFinal: item.cantidadBase + item.cantidadAjuste,
      orden: item.orden,
      esManual: item.productId == null
    }))
})

const consolidateWholesaleProduction = async (
  prismaClient: PrismaClient,
  fecha: Date
): Promise<{ items: ProductionPlanItemPayload[]; sources: ProductionSourcePayload[] }> => {
  const { start, end } = getDayRange(fecha)
  const sales = await prismaClient.sale.findMany({
    where: {
      tipoVenta: 'MAYOREO',
      fecha: {
        gte: start,
        lt: end
      }
    },
    orderBy: [{ fecha: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      folio: true,
      total: true,
      customerId: true,
      items: {
        select: {
          productId: true,
          cantidad: true,
          product: {
            select: {
              tipo: { select: { nombre: true } },
              sabor: { select: { nombre: true } },
              presentacion: true
            }
          }
        }
      }
    }
  })

  const customerIds = sales
    .map((sale) => sale.customerId)
    .filter((value): value is number => value !== null)
  const customers = customerIds.length
    ? await prismaClient.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, nombre: true }
      })
    : []
  const customerMap = new Map(customers.map((customer) => [customer.id, customer.nombre]))

  const totals = new Map<string, ProductionPlanItemPayload>()

  for (const sale of sales) {
    for (const item of sale.items) {
      const key = `${item.productId}::${item.product.presentacion}`
      const current = totals.get(key)
      const nombre = `${item.product.tipo.nombre} ${item.product.sabor.nombre}`.trim()
      if (current) {
        current.cantidadBase += item.cantidad
        current.cantidadFinal += item.cantidad
      } else {
        totals.set(key, {
          productId: item.productId,
          nombre,
          presentacion: item.product.presentacion,
          cantidadBase: item.cantidad,
          cantidadAjuste: 0,
          cantidadFinal: item.cantidad,
          orden: totals.size,
          esManual: false
        })
      }
    }
  }

  return {
    items: Array.from(totals.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es-MX')),
    sources: sales.map((sale) => ({
      saleId: sale.id,
      folio: sale.folio,
      customerName: sale.customerId ? customerMap.get(sale.customerId) ?? null : null,
      total: sale.total
    }))
  }
}

const buildProductionDraft = async (
  prismaClient: PrismaClient,
  fecha: Date
): Promise<ProductionPlanResponse> => {
  const plan = await prismaClient.productionPlan.findUnique({
    where: { fecha },
    include: {
      items: {
        orderBy: [{ orden: 'asc' }, { id: 'asc' }]
      }
    }
  })

  const consolidated = await consolidateWholesaleProduction(prismaClient, fecha)

  if (plan) {
    return {
      plan: serializeProductionPlan(plan),
      draft: serializeProductionPlan(plan),
      basedOnWholesaleSales: consolidated.items.length > 0,
      wholesaleSalesCount: consolidated.sources.length,
      wholesaleSources: consolidated.sources
    }
  }

  return {
    plan: null,
    draft: {
      fecha: formatPlanDateInput(fecha),
      notas: '',
      items: consolidated.items
    },
    basedOnWholesaleSales: consolidated.items.length > 0,
    wholesaleSalesCount: consolidated.sources.length,
    wholesaleSources: consolidated.sources
  }
}

const formatFolioDate = (value: Date) => {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

const buildFriendlySaleFolio = async (
  tx: Prisma.TransactionClient,
  saleDate: Date
): Promise<string> => {
  const prefix = `HLT-${formatFolioDate(saleDate)}-`
  const { start, end } = getDayRange(saleDate)
  const lastSale = await tx.sale.findFirst({
    where: {
      fecha: {
        gte: start,
        lt: end
      },
      folio: {
        startsWith: prefix
      }
    },
    orderBy: { id: 'desc' },
    select: { folio: true }
  })

  const lastSequence = lastSale?.folio
    ? Number(lastSale.folio.slice(prefix.length))
    : 0
  const nextSequence = Number.isFinite(lastSequence) ? lastSequence + 1 : 1

  return `${prefix}${String(nextSequence).padStart(4, '0')}`
}

const resolveReceiptLogoPath = () => {
  const candidates = [
    path.join(app.getAppPath(), 'src', 'renderer', 'public', 'logo.png'),
    path.join(app.getAppPath(), 'dist', 'renderer', 'logo.png'),
    path.join(__dirname, '../renderer/logo.png'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'renderer', 'logo.png'),
    path.join(process.resourcesPath, 'dist', 'renderer', 'logo.png')
  ]

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null
}

const getReceiptLogoDataUrl = () => {
  const logoPath = resolveReceiptLogoPath()
  if (!logoPath) return null

  try {
    const encoded = fs.readFileSync(logoPath).toString('base64')
    return `data:image/png;base64,${encoded}`
  } catch (error) {
    console.error('[print] No se pudo leer el logo para la remisión', error)
    return null
  }
}

type PosReceiptData = {
  saleId: number
  folio: string
  fecha: string
  tipoVenta: PosSaleType
  customerId: number | null
  customerName: string | null
  subtotal: number
  descuentoTipo: DiscountType
  descuentoValor: number
  total: number
  pagoMetodo: string
  items: {
    productId: number
    nombre: string
    presentacion: string
    cantidad: number
    precioUnitario: number
    subtotalLinea: number
  }[]
}

const buildReceiptFromSaleRecord = (sale: {
  id: number
  folio: string
  fecha: Date
  tipoVenta: string
  customerId: number | null
  subtotal: number
  descuentoTipo: string
  descuentoValor: number
  total: number
  pagoMetodo: string
  customer: { nombre: string } | null
  items: {
    productId: number
    cantidad: number
    precio: number
    subtotalLinea: number
    product: {
      presentacion: string
      tipo: { nombre: string }
      sabor: { nombre: string }
    }
  }[]
}): PosReceiptData => ({
  saleId: sale.id,
  folio: sale.folio,
  fecha: sale.fecha.toISOString(),
  tipoVenta: normalizarTipoVenta(sale.tipoVenta),
  customerId: sale.customerId,
  customerName: sale.customer?.nombre ?? null,
  subtotal: sale.subtotal,
  descuentoTipo: normalizarTipoDescuento(sale.descuentoTipo),
  descuentoValor: sale.descuentoValor,
  total: sale.total,
  pagoMetodo: sale.pagoMetodo,
  items: sale.items.map((item) => ({
    productId: item.productId,
    nombre: `${item.product.tipo.nombre} ${item.product.sabor.nombre}`.trim(),
    presentacion: item.product.presentacion,
    cantidad: item.cantidad,
    precioUnitario: item.precio,
    subtotalLinea: item.subtotalLinea
  }))
})

const getPosReceiptBySaleId = async (
  prismaClient: PrismaClient,
  saleId: number
): Promise<PosReceiptData> => {
  const sale = await prismaClient.sale.findUnique({
    where: { id: saleId },
    include: {
      items: {
        include: {
          product: {
            include: {
              tipo: true,
              sabor: true
            }
          }
        }
      }
    }
  })

  if (!sale) {
    throw new Error('La venta seleccionada no existe.')
  }

  const customer = sale.customerId
    ? await prismaClient.customer.findUnique({
        where: { id: sale.customerId },
        select: { nombre: true }
      })
    : null

  return buildReceiptFromSaleRecord({
    ...sale,
    customer
  })
}

const buildReceiptHtml = (receipt: PosReceiptData) => {
  const logoDataUrl = getReceiptLogoDataUrl()
  const fecha = formatSaleDate(new Date(receipt.fecha))
  const discountLabel =
    receipt.descuentoTipo === 'porcentaje' && receipt.subtotal > 0
      ? `${((receipt.descuentoValor / receipt.subtotal) * 100).toFixed(2)}%`
      : receipt.descuentoTipo === 'monto'
        ? 'Monto fijo'
        : 'Sin descuento'

  const rows = receipt.items
    .map(
      (item) => `
        <tr>
          <td>
            <div class="product-name">${escapeHtml(item.nombre)}</div>
            <div class="product-meta">${escapeHtml(item.presentacion)}</div>
          </td>
          <td class="center">${item.cantidad}</td>
          <td class="right">${formatCurrency(item.precioUnitario)}</td>
          <td class="right">${formatCurrency(item.subtotalLinea)}</td>
        </tr>
      `
    )
    .join('')

  const signatureSection =
    receipt.tipoVenta === 'MAYOREO'
      ? `
        <div class="signature-grid">
          <div class="signature-box">Entregó</div>
          <div class="signature-box">Recibido / Firma</div>
        </div>
      `
      : ''

  return `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>Remisión ${escapeHtml(receipt.folio)}</title>
      <style>
        :root {
          color-scheme: light;
          --ink: #2f3133;
          --muted: #6b7280;
          --line: #d9ddd6;
          --accent: #df9fc3;
          --accent-soft: rgba(223, 159, 195, 0.12);
          --sky: #a7cce5;
          --paper: #fffdfc;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          background: #f4f1ef;
          color: var(--ink);
          font-family: Inter, Arial, sans-serif;
          padding: 24px;
        }
        .sheet {
          width: 100%;
          max-width: 860px;
          margin: 0 auto;
          background: var(--paper);
          border: 1px solid rgba(217, 221, 214, 0.9);
          border-radius: 24px;
          padding: 28px 32px 32px;
          box-shadow: 0 20px 60px rgba(47, 49, 51, 0.12);
        }
        .topbar {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          align-items: flex-start;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--line);
        }
        .brand {
          display: flex;
          gap: 16px;
          align-items: center;
        }
        .logo {
          width: 76px;
          height: 76px;
          border-radius: 20px;
          border: 1px solid rgba(217, 221, 214, 0.9);
          background: white;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 8px;
        }
        .logo img { width: 100%; height: 100%; object-fit: contain; }
        .eyebrow {
          display: inline-block;
          background: var(--accent-soft);
          color: #8f4471;
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        h1, h2, p { margin: 0; }
        h1 { font-size: 30px; line-height: 1.05; }
        .subtitle { color: var(--muted); margin-top: 6px; }
        .document-title {
          text-align: right;
        }
        .document-title h2 {
          font-size: 28px;
          margin-bottom: 8px;
        }
        .folio {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(167, 204, 229, 0.7);
          background: rgba(167, 204, 229, 0.16);
          border-radius: 999px;
          padding: 8px 14px;
          font-weight: 700;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-top: 22px;
        }
        .meta-card {
          border: 1px solid rgba(217, 221, 214, 0.9);
          border-radius: 18px;
          padding: 14px 16px;
          background: white;
        }
        .meta-label {
          font-size: 12px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 6px;
        }
        .meta-value {
          font-size: 15px;
          font-weight: 600;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 24px;
        }
        thead th {
          text-align: left;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--muted);
          padding: 12px 10px;
          background: rgba(167, 204, 229, 0.12);
          border-bottom: 1px solid var(--line);
        }
        tbody td {
          padding: 14px 10px;
          border-bottom: 1px solid rgba(217, 221, 214, 0.7);
          vertical-align: top;
          font-size: 14px;
        }
        .product-name { font-weight: 600; margin-bottom: 4px; }
        .product-meta { color: var(--muted); font-size: 12px; }
        .right { text-align: right; }
        .center { text-align: center; }
        .summary {
          margin-top: 22px;
          margin-left: auto;
          width: min(100%, 340px);
          border: 1px solid rgba(217, 221, 214, 0.9);
          border-radius: 20px;
          padding: 18px 18px 14px;
          background: white;
        }
        .summary-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 6px 0;
          font-size: 14px;
        }
        .summary-row strong { font-weight: 700; }
        .summary-row.total {
          margin-top: 8px;
          padding-top: 12px;
          border-top: 1px solid var(--line);
          font-size: 18px;
        }
        .notes {
          margin-top: 24px;
          padding: 16px 18px;
          border-radius: 18px;
          background: rgba(223, 159, 195, 0.08);
          border: 1px dashed rgba(223, 159, 195, 0.5);
          color: #5e5660;
          font-size: 13px;
        }
        .signature-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 36px;
          margin-top: 56px;
        }
        .signature-box {
          padding-top: 12px;
          border-top: 1px solid var(--ink);
          text-align: center;
          font-size: 13px;
          color: var(--muted);
        }
        @media print {
          body {
            background: white;
            padding: 0;
          }
          .sheet {
            border: none;
            border-radius: 0;
            box-shadow: none;
            max-width: none;
            padding: 0.4in;
          }
        }
      </style>
    </head>
    <body>
      <main class="sheet">
        <section class="topbar">
          <div class="brand">
            <div class="logo">
              ${
                logoDataUrl
                  ? `<img src="${logoDataUrl}" alt="Logo Helatte" />`
                  : `<div style="font-weight:700;color:#8f4471;">HLT</div>`
              }
            </div>
            <div>
              <span class="eyebrow">Orden / Remisión</span>
              <h1>${escapeHtml(HELATTE_BUSINESS.nombre)}</h1>
              <p class="subtitle">${escapeHtml(HELATTE_BUSINESS.giro)}</p>
            </div>
          </div>
          <div class="document-title">
            <h2>Venta guardada</h2>
            <div class="folio">${escapeHtml(receipt.folio)}</div>
          </div>
        </section>

        <section class="meta-grid">
          <article class="meta-card">
            <div class="meta-label">Fecha y hora</div>
            <div class="meta-value">${escapeHtml(fecha)}</div>
          </article>
          <article class="meta-card">
            <div class="meta-label">Tipo de venta</div>
            <div class="meta-value">${escapeHtml(receipt.tipoVenta === 'MAYOREO' ? 'Mayoreo' : 'Mostrador')}</div>
          </article>
          <article class="meta-card">
            <div class="meta-label">Cliente</div>
            <div class="meta-value">${escapeHtml(receipt.customerName ?? 'Público en general')}</div>
          </article>
          <article class="meta-card">
            <div class="meta-label">Método de pago</div>
            <div class="meta-value">${escapeHtml(receipt.pagoMetodo)}</div>
          </article>
        </section>

        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th class="center">Cantidad</th>
              <th class="right">P. unitario</th>
              <th class="right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>

        <section class="summary">
          <div class="summary-row"><span>Subtotal general</span><strong>${formatCurrency(receipt.subtotal)}</strong></div>
          <div class="summary-row"><span>Descuento</span><strong>${escapeHtml(discountLabel)} · ${formatCurrency(receipt.descuentoValor)}</strong></div>
          <div class="summary-row total"><span>Total final</span><strong>${formatCurrency(receipt.total)}</strong></div>
        </section>

        <section class="notes">
          Documento generado automáticamente por Helatte POS para control interno y entrega de producto.
        </section>

        ${signatureSection}
      </main>
    </body>
  </html>`
}

const openPrintPreviewWindow = async (receipt: PosReceiptData) => {
  const parentWindow = mainWindow ?? (await createWindow())
  const html = buildReceiptHtml(receipt)
  const printWindow = new BrowserWindow({
    width: 920,
    height: 760,
    title: `Remisión ${receipt.folio}`,
    backgroundColor: '#FFF6FA',
    autoHideMenuBar: true,
    parent: parentWindow,
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: false
    }
  })

  printWindow.once('ready-to-show', () => {
    printWindow.show()
    printWindow.focus()
  })

  await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

  setTimeout(() => {
    if (printWindow.isDestroyed()) return
    printWindow.webContents.print({
      silent: false,
      printBackground: true
    })
  }, 250)
}

type ProductionPrintData = ProductionPlanPayload & {
  titulo: string
}

const openHtmlPrintWindow = async (title: string, html: string) => {
  const parentWindow = mainWindow ?? (await createWindow())
  const printWindow = new BrowserWindow({
    width: 960,
    height: 780,
    title,
    backgroundColor: '#FFF6FA',
    autoHideMenuBar: true,
    parent: parentWindow,
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: false
    }
  })

  printWindow.once('ready-to-show', () => {
    printWindow.show()
    printWindow.focus()
  })

  await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)

  setTimeout(() => {
    if (printWindow.isDestroyed()) return
    printWindow.webContents.print({
      silent: false,
      printBackground: true
    })
  }, 250)
}

const buildProductionPrintHtml = (plan: ProductionPrintData) => {
  const logoDataUrl = getReceiptLogoDataUrl()
  const fecha = formatProductionDate(normalizePlanDate(plan.fecha))
  const rows = plan.items
    .map((item) => {
      const ajuste = item.cantidadAjuste === 0 ? '—' : item.cantidadAjuste > 0 ? `+${item.cantidadAjuste}` : `${item.cantidadAjuste}`
      return `
        <tr>
          <td>
            <div class="product-name">${escapeHtml(item.nombre)}</div>
            <div class="product-meta">${escapeHtml(item.presentacion)}</div>
          </td>
          <td class="center">${item.cantidadBase}</td>
          <td class="center">${escapeHtml(ajuste)}</td>
          <td class="center strong">${item.cantidadFinal}</td>
        </tr>
      `
    })
    .join('')

  return `<!doctype html>
  <html lang="es">
    <head>
      <meta charset="UTF-8" />
      <title>${escapeHtml(plan.titulo)}</title>
      <style>
        :root {
          color-scheme: light;
          --ink: #2f3133;
          --muted: #6b7280;
          --line: #d9ddd6;
          --accent: #df9fc3;
          --accent-soft: rgba(223, 159, 195, 0.12);
          --sky: #a7cce5;
          --paper: #fffdfc;
        }
        * { box-sizing: border-box; }
        body { margin: 0; background: #f4f1ef; color: var(--ink); font-family: Inter, Arial, sans-serif; padding: 24px; }
        .sheet { width: 100%; max-width: 860px; margin: 0 auto; background: var(--paper); border: 1px solid rgba(217, 221, 214, 0.9); border-radius: 24px; padding: 28px 32px 32px; box-shadow: 0 20px 60px rgba(47, 49, 51, 0.12); }
        .topbar { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; padding-bottom: 20px; border-bottom: 1px solid var(--line); }
        .brand { display: flex; gap: 16px; align-items: center; }
        .logo { width: 76px; height: 76px; border-radius: 20px; border: 1px solid rgba(217, 221, 214, 0.9); background: white; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 8px; }
        .logo img { width: 100%; height: 100%; object-fit: contain; }
        .eyebrow { display: inline-block; background: var(--accent-soft); color: #8f4471; border-radius: 999px; padding: 6px 12px; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; margin-bottom: 10px; }
        h1, h2, p { margin: 0; }
        h1 { font-size: 30px; line-height: 1.05; }
        .subtitle { color: var(--muted); margin-top: 6px; }
        .document-title { text-align: right; }
        .document-title h2 { font-size: 28px; margin-bottom: 8px; }
        .date-pill { display: inline-flex; align-items: center; justify-content: center; border: 1px solid rgba(167, 204, 229, 0.7); background: rgba(167, 204, 229, 0.16); border-radius: 999px; padding: 8px 14px; font-weight: 700; }
        .meta-card { border: 1px solid rgba(217, 221, 214, 0.9); border-radius: 18px; padding: 14px 16px; background: white; margin-top: 22px; }
        .meta-label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
        .meta-value { font-size: 15px; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-top: 24px; }
        thead th { text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); padding: 12px 10px; background: rgba(167, 204, 229, 0.12); border-bottom: 1px solid var(--line); }
        tbody td { padding: 14px 10px; border-bottom: 1px solid rgba(217, 221, 214, 0.7); vertical-align: top; font-size: 14px; }
        .product-name { font-weight: 600; margin-bottom: 4px; }
        .product-meta { color: var(--muted); font-size: 12px; }
        .center { text-align: center; }
        .strong { font-weight: 700; }
        .notes { margin-top: 24px; padding: 16px 18px; border-radius: 18px; background: rgba(223, 159, 195, 0.08); border: 1px dashed rgba(223, 159, 195, 0.5); color: #5e5660; font-size: 13px; min-height: 82px; white-space: pre-wrap; }
        .review-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; margin-top: 56px; }
        .review-box { padding-top: 12px; border-top: 1px solid var(--ink); text-align: center; font-size: 13px; color: var(--muted); min-height: 36px; }
        @media print { body { background: white; padding: 0; } .sheet { border: none; border-radius: 0; box-shadow: none; max-width: none; padding: 0.4in; } }
      </style>
    </head>
    <body>
      <main class="sheet">
        <section class="topbar">
          <div class="brand">
            <div class="logo">
              ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Logo Helatte" />` : `<div style="font-weight:700;color:#8f4471;">HLT</div>`}
            </div>
            <div>
              <span class="eyebrow">Producción diaria</span>
              <h1>${escapeHtml(HELATTE_BUSINESS.nombre)}</h1>
              <p class="subtitle">${escapeHtml(HELATTE_BUSINESS.giro)}</p>
            </div>
          </div>
          <div class="document-title">
            <h2>Plan de producción</h2>
            <div class="date-pill">${escapeHtml(fecha)}</div>
          </div>
        </section>

        <section class="meta-card">
          <div class="meta-label">Resumen</div>
          <div class="meta-value">${plan.items.length} renglones · ${plan.items.reduce((sum, item) => sum + item.cantidadFinal, 0)} piezas / unidades planeadas</div>
        </section>

        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th class="center">Base</th>
              <th class="center">Ajuste</th>
              <th class="center">Total</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        <section class="notes">${escapeHtml(plan.notas || 'Sin notas operativas para este plan.')}</section>

        <section class="review-grid">
          <div class="review-box">Revisó</div>
          <div class="review-box">Checklist / OK</div>
          <div class="review-box">Firma</div>
        </section>
      </main>
    </body>
  </html>`
}

const openProductionPrintWindow = async (plan: ProductionPlanPayload) => {
  const html = buildProductionPrintHtml({
    ...plan,
    titulo: `Plan de producción ${plan.fecha}`
  })
  await openHtmlPrintWindow(`Plan de producción ${plan.fecha}`, html)
}

/* =========================================================
   IPC HANDLERS – DASHBOARD
========================================================= */
safeHandle('dashboard:resumen', async () => {
  const prisma = getPrisma()

  const inicioHoy = new Date()
  inicioHoy.setHours(0, 0, 0, 0)

  const finHoy = new Date(inicioHoy)
  finHoy.setDate(finHoy.getDate() + 1)

  const inicioSemana = new Date(inicioHoy)
  inicioSemana.setDate(inicioSemana.getDate() - 6)

  const [ventasHoy, movimientosSemana, ventasRecientes, clientesSaldo, inventarioBajo, refris] =
    await Promise.all([
      prisma.sale.findMany({
        where: {
          fecha: {
            gte: inicioHoy,
            lt: finHoy
          }
        }
      }),
      prisma.cashMovement.findMany({
        where: {
          fecha: {
            gte: inicioSemana,
            lt: finHoy
          }
        },
        orderBy: { fecha: 'asc' }
      }),
      prisma.sale.findMany({
        take: 5,
        orderBy: { fecha: 'desc' },
        select: {
          id: true,
          folio: true,
          total: true,
          pagoMetodo: true,
          fecha: true
        }
      }),
      prisma.customer.findMany({
        take: 5,
        orderBy: { saldo: 'desc' }
      }),
      prisma.product.findMany({
        take: 5,
        orderBy: { stock: 'asc' },
        include: { tipo: true, sabor: true }
      }),
      prisma.fridgeAsset.findMany({
        include: {
          asignaciones: true
        }
      })
    ])

  const ventasDia = ventasHoy.reduce((sum, v) => sum + v.total, 0)

  const cajaDia = movimientosSemana
    .filter((mov) => mov.fecha >= inicioHoy && mov.fecha < finHoy)
    .reduce((sum, mov) => sum + (mov.tipo === 'ingreso' ? mov.monto : -mov.monto), 0)

  const clientesConAdeudo = await prisma.customer.count({
    where: { saldo: { gt: 0 } }
  })

  const asignacionesActivas = refris.filter((refri) =>
    refri.asignaciones.some((asignacion) => asignacion.fechaFin === null)
  )
  const refrisAsignados = asignacionesActivas.length
  const refrisDisponibles = refris.length - refrisAsignados

  const flujoPorDia = new Map<string, { ingresos: number; egresos: number }>()
  for (let i = 0; i < 7; i += 1) {
    const fecha = new Date(inicioSemana)
    fecha.setDate(inicioSemana.getDate() + i)
    const clave = fecha.toISOString().slice(0, 10)
    flujoPorDia.set(clave, { ingresos: 0, egresos: 0 })
  }

  movimientosSemana.forEach((mov) => {
    const clave = mov.fecha.toISOString().slice(0, 10)
    const actual = flujoPorDia.get(clave) ?? { ingresos: 0, egresos: 0 }
    if (mov.tipo === 'ingreso') actual.ingresos += mov.monto
    if (mov.tipo === 'egreso') actual.egresos += mov.monto
    flujoPorDia.set(clave, actual)
  })

  const ingresosVsEgresos = Array.from(flujoPorDia.entries()).map(([fecha, valores]) => ({
    fecha,
    ingresos: valores.ingresos,
    egresos: valores.egresos
  }))

  return {
    kpis: {
      cajaDia,
      ventasDia,
      clientesConAdeudo,
      refrisAsignados,
      refrisDisponibles
    },
    tablas: {
      ultimasVentas: ventasRecientes,
      clientesSaldo,
      inventarioBajo
    },
    graficas: {
      ingresosVsEgresos,
      refrisAsignadosVsLibres: [
        { label: 'Asignados', valor: refrisAsignados },
        { label: 'Disponibles', valor: refrisDisponibles }
      ]
    }
  }
})

/* =========================================================
   IPC HANDLERS – CATÁLOGO
========================================================= */
safeHandle('catalogo:listar', async () => {
  const prisma = getPrisma()

  const tipos = await prisma.productType.findMany()
  const sabores = await prisma.flavor.findMany()
  const productos = await prisma.product.findMany({
    include: { tipo: true, sabor: true }
  })

  return { tipos, sabores, productos }
})

safeHandle('catalogo:crearTipo', async (_event, data: { nombre: string; activo?: boolean }) => {
  const prisma = getPrisma()
  return prisma.productType.create({
    data: { nombre: data.nombre, activo: data.activo ?? true }
  })
})

safeHandle('catalogo:actualizarTipo', async (_event, data: { id: number; nombre: string; activo?: boolean }) => {
  const prisma = getPrisma()
  return prisma.productType.update({
    where: { id: data.id },
    data: { nombre: data.nombre, activo: data.activo }
  })
})

safeHandle('catalogo:toggleTipo', async (_event, data: { id: number; activo: boolean }) => {
  const prisma = getPrisma()
  return prisma.productType.update({
    where: { id: data.id },
    data: { activo: data.activo }
  })
})

safeHandle('catalogo:crearSabor', async (_event, data: { nombre: string; color?: string; activo?: boolean }) => {
  const prisma = getPrisma()
  return prisma.flavor.create({
    data: { nombre: data.nombre, color: data.color ?? null, activo: data.activo ?? true }
  })
})

safeHandle(
  'catalogo:actualizarSabor',
  async (_event, data: { id: number; nombre: string; color?: string | null; activo?: boolean }) => {
    const prisma = getPrisma()
    return prisma.flavor.update({
      where: { id: data.id },
      data: { nombre: data.nombre, color: data.color ?? null, activo: data.activo }
    })
  }
)

safeHandle('catalogo:toggleSabor', async (_event, data: { id: number; activo: boolean }) => {
  const prisma = getPrisma()
  return prisma.flavor.update({
    where: { id: data.id },
    data: { activo: data.activo }
  })
})

safeHandle(
  'catalogo:crearProducto',
  async (
    _event,
    data: {
      tipoId: number
      saborId: number
      presentacion: string
      precio: number
      precioMayoreo?: number | null
      costo: number
      sku?: string
      stock?: number
      activo?: boolean
    }
  ) => {
    const prisma = getPrisma()
    return prisma.product.create({
      data: {
        tipoId: data.tipoId,
        saborId: data.saborId,
        presentacion: data.presentacion,
        precio: data.precio,
        precioMayoreo: data.precioMayoreo ?? null,
        costo: data.costo,
        sku: data.sku ?? null,
        stock: data.stock ?? 0,
        activo: data.activo ?? true
      },
      include: { tipo: true, sabor: true }
    })
  }
)

safeHandle(
  'catalogo:actualizarProducto',
  async (
    _event,
    data: {
      id: number
      tipoId: number
      saborId: number
      presentacion: string
      precio: number
      precioMayoreo?: number | null
      costo: number
      sku?: string | null
      stock?: number
      activo?: boolean
    }
  ) => {
    const prisma = getPrisma()
    return prisma.product.update({
      where: { id: data.id },
      data: {
        tipoId: data.tipoId,
        saborId: data.saborId,
        presentacion: data.presentacion,
        precio: data.precio,
        precioMayoreo: data.precioMayoreo ?? null,
        costo: data.costo,
        sku: data.sku ?? null,
        stock: data.stock,
        activo: data.activo
      },
      include: { tipo: true, sabor: true }
    })
  }
)

safeHandle('catalogo:toggleProducto', async (_event, data: { id: number; activo: boolean }) => {
  const prisma = getPrisma()
  return prisma.product.update({
    where: { id: data.id },
    data: { activo: data.activo },
    include: { tipo: true, sabor: true }
  })
})

/* =========================================================
   IPC HANDLERS – INVENTARIOS
========================================================= */
safeHandle('inventario:listarMaterias', async () => {
  const prisma = getPrisma()
  const [materias, unidades] = await Promise.all([
    prisma.rawMaterial.findMany({
      include: { unidad: true, movimientos: true }
    }),
    prisma.unit.findMany()
  ])
  return { materias, unidades }
})

safeHandle('inventario:listarProductos', async () => {
  const prisma = getPrisma()
  return prisma.product.findMany()
})

safeHandle('inventario:listarProductosStock', async () => {
  const prisma = getPrisma()
  return prisma.product.findMany({
    include: {
      tipo: true,
      sabor: true,
      stockMoves: { orderBy: { createdAt: 'desc' } }
    }
  })
})

safeHandle('inventario:crearUnidad', async (_event, data: { nombre: string }) => {
  const prisma = getPrisma()
  return prisma.unit.create({
    data: { nombre: data.nombre }
  })
})

safeHandle(
  'inventario:crearMateria',
  async (_event, data: { nombre: string; unidadId: number; stock?: number; costoProm?: number }) => {
    const prisma = getPrisma()
    return prisma.rawMaterial.create({
      data: {
        nombre: data.nombre,
        unidadId: data.unidadId,
        stock: data.stock ?? 0,
        costoProm: data.costoProm ?? 0
      },
      include: { unidad: true, movimientos: true }
    })
  }
)

safeHandle(
  'inventario:movimientoMateria',
  async (_event, data: { materialId: number; tipo: 'entrada' | 'salida'; cantidad: number; costoTotal?: number }) => {
    const prisma = getPrisma()
    return prisma.$transaction(async (tx) => {
      const material = await tx.rawMaterial.findUnique({ where: { id: data.materialId } })
      if (!material) throw new Error('Materia prima no encontrada')

      const ajuste = data.tipo === 'entrada' ? data.cantidad : -data.cantidad
      const stockActual = material.stock + ajuste
      const costoProm =
        data.tipo === 'entrada' && data.costoTotal
          ? (material.stock * material.costoProm + data.costoTotal) / Math.max(stockActual, 1)
          : material.costoProm

      await tx.rawMaterialMovement.create({
        data: {
          materialId: data.materialId,
          tipo: data.tipo,
          cantidad: data.cantidad,
          costoTotal: data.costoTotal ?? 0
        }
      })

      return tx.rawMaterial.update({
        where: { id: data.materialId },
        data: {
          stock: stockActual,
          costoProm
        },
        include: { unidad: true, movimientos: true }
      })
    })
  }
)

safeHandle(
  'inventario:movimientoProducto',
  async (_event, data: { productId: number; tipo: 'entrada' | 'salida'; cantidad: number; referencia?: string }) => {
    const prisma = getPrisma()
    return prisma.$transaction(async (tx) => {
      const producto = await tx.product.findUnique({ where: { id: data.productId } })
      if (!producto) throw new Error('Producto no encontrado')

      const ajuste = data.tipo === 'entrada' ? data.cantidad : -data.cantidad
      const stockActual = producto.stock + ajuste

      await tx.finishedStockMovement.create({
        data: {
          productId: data.productId,
          tipo: data.tipo,
          cantidad: data.cantidad,
          referencia: data.referencia ?? null
        }
      })

      return tx.product.update({
        where: { id: data.productId },
        data: {
          stock: stockActual
        },
        include: { tipo: true, sabor: true }
      })
    })
  }
)

/* =========================================================
   IPC HANDLERS – CLIENTES
========================================================= */
safeHandle('clientes:listar', async () => {
  const prisma = getPrisma()
  return prisma.customer.findMany({
    include: {
      creditos: true,
      movimientos: true
    }
  })
})

safeHandle(
  'clientes:crear',
  async (
    _event,
    data: {
      nombre: string
      telefono?: string
      limite?: number
      saldo?: number
      estado?: 'activo' | 'inactivo'
      permiteMayoreo?: boolean
    }
  ) => {
    const prisma = getPrisma()
    return prisma.customer.create({
      data: {
        nombre: data.nombre,
        telefono: data.telefono ?? null,
        limite: data.limite ?? 0,
        saldo: data.saldo ?? 0,
        estado: data.estado ?? 'activo',
        permiteMayoreo: data.permiteMayoreo ?? true
      }
    })
  }
)

safeHandle(
  'clientes:actualizar',
  async (
    _event,
    data: {
      id: number
      nombre: string
      telefono?: string
      limite?: number
      saldo?: number
      estado?: 'activo' | 'inactivo'
      permiteMayoreo?: boolean
    }
  ) => {
    const prisma = getPrisma()
    return prisma.customer.update({
      where: { id: data.id },
      data: {
        nombre: data.nombre,
        telefono: data.telefono ?? null,
        limite: data.limite,
        saldo: data.saldo,
        estado: data.estado,
        permiteMayoreo: data.permiteMayoreo
      }
    })
  }
)

safeHandle('clientes:toggleEstado', async (_event, data: { id: number; estado: 'activo' | 'inactivo' }) => {
  const prisma = getPrisma()
  return prisma.customer.update({
    where: { id: data.id },
    data: { estado: data.estado }
  })
})

safeHandle('creditos:listarConSaldo', async () => {
  const prisma = getPrisma()
  return prisma.customer.findMany({
    where: { saldo: { gt: 0 } },
    orderBy: { saldo: 'desc' }
  })
})

safeHandle('pagares:listarPorCliente', async (_event, customerId: number) => {
  const prisma = getPrisma()
  return prisma.promissoryNote.findMany({
    where: { customerId },
    include: { abonos: { orderBy: { fecha: 'desc' } } },
    orderBy: { fecha: 'desc' }
  })
})

safeHandle('pagares:crear', async (_event, data: { customerId: number; monto: number }) => {
  const prisma = getPrisma()
  return prisma.promissoryNote.create({
    data: {
      customerId: data.customerId,
      monto: data.monto,
      estado: 'vigente'
    }
  })
})

safeHandle(
  'pagares:registrarAbono',
  async (_event, data: { promissoryNoteId: number; monto: number; cashBoxId?: number }) => {
    const prisma = getPrisma()
    return prisma.$transaction(async (tx) => {
      const pagare = await tx.promissoryNote.findUnique({
        where: { id: data.promissoryNoteId },
        include: { customer: true }
      })
      if (!pagare) throw new Error('Pagaré no encontrado')

      await tx.promissoryPayment.create({
        data: {
          promissoryNoteId: data.promissoryNoteId,
          monto: data.monto
        }
      })

      const montoRestante = Math.max(pagare.monto - data.monto, 0)
      const estado = montoRestante === 0 ? 'pagado' : pagare.estado

      const pagareActualizado = await tx.promissoryNote.update({
        where: { id: data.promissoryNoteId },
        data: { monto: montoRestante, estado },
        include: { abonos: { orderBy: { fecha: 'desc' } } }
      })

      const saldoNuevo = Math.max(pagare.customer.saldo - data.monto, 0)
      await tx.customer.update({
        where: { id: pagare.customerId },
        data: { saldo: saldoNuevo }
      })

      if (data.cashBoxId) {
        await tx.cashMovement.create({
          data: {
            cashBoxId: data.cashBoxId,
            tipo: 'ingreso',
            concepto: `Abono pagaré #${pagare.id}`,
            monto: data.monto
          }
        })
      }

      return { pagare: pagareActualizado, saldoCliente: saldoNuevo }
    })
  }
)

/* =========================================================
   IPC HANDLERS – CAJAS
========================================================= */
safeHandle('cajas:listar', async () => {
  const prisma = getPrisma()
  return prisma.cashBox.findMany({
    include: {
      movimientos: { orderBy: { fecha: 'desc' } }
    }
  })
})

safeHandle('cajas:listarMovimientos', async (_event, cashBoxId: number) => {
  const prisma = getPrisma()
  return prisma.cashMovement.findMany({
    where: { cashBoxId },
    orderBy: { fecha: 'desc' }
  })
})

safeHandle(
  'cajas:crearMovimiento',
  async (_event, data: { cashBoxId: number; tipo: string; concepto: string; monto: number; fecha?: string }) => {
    const prisma = getPrisma()
    return prisma.cashMovement.create({
      data: {
        cashBoxId: data.cashBoxId,
        tipo: data.tipo,
        concepto: data.concepto,
        monto: data.monto,
        fecha: data.fecha ? new Date(data.fecha) : undefined
      }
    })
  }
)

safeHandle('backup:export', async (_event, destino: string) => {
  fs.mkdirSync(path.dirname(destino), { recursive: true })
  fs.copyFileSync(dbPath, destino)
  return { ok: true }
})

/* =========================================================
   IPC HANDLERS – REFRIS
========================================================= */
safeHandle('refris:listar', async () => {
  const prisma = getPrisma()
  return prisma.fridgeAsset.findMany({
    include: {
      asignaciones: {
        include: { customer: true },
        orderBy: { entregadoEn: 'desc' }
      },
      visitas: true
    }
  })
})

safeHandle('refris:listarDisponibles', async () => {
  const prisma = getPrisma()
  return prisma.fridgeAsset.findMany({
    where: {
      estado: 'activo',
      asignaciones: { none: { fechaFin: null } }
    }
  })
})

safeHandle('refris:crear', async (_event, data: { modelo: string; serie: string; estado?: string }) => {
  const prisma = getPrisma()
  return prisma.fridgeAsset.create({
    data: {
      modelo: data.modelo,
      serie: data.serie,
      estado: data.estado ?? 'activo'
    }
  })
})

safeHandle(
  'refris:actualizar',
  async (_event, data: { id: number; modelo?: string; serie?: string; estado?: string }) => {
    const prisma = getPrisma()
    return prisma.fridgeAsset.update({
      where: { id: data.id },
      data: {
        modelo: data.modelo,
        serie: data.serie,
        estado: data.estado
      },
      include: {
        asignaciones: {
          include: { customer: true },
          orderBy: { entregadoEn: 'desc' }
        }
      }
    })
  }
)

safeHandle('refris:toggleEstado', async (_event, data: { id: number }) => {
  const prisma = getPrisma()
  const refri = await prisma.fridgeAsset.findUniqueOrThrow({ where: { id: data.id } })
  const nuevoEstado = refri.estado === 'activo' ? 'inactivo' : 'activo'
  return prisma.fridgeAsset.update({
    where: { id: refri.id },
    data: { estado: nuevoEstado },
    include: {
      asignaciones: {
        include: { customer: true },
        orderBy: { entregadoEn: 'desc' }
      }
    }
  })
})

safeHandle('asignaciones:listarPorCliente', async (_event, customerId: number) => {
  const prisma = getPrisma()
  return prisma.fridgeAssignment.findMany({
    where: { customerId },
    include: { asset: true },
    orderBy: { entregadoEn: 'desc' }
  })
})

safeHandle(
  'asignaciones:crear',
  async (
    _event,
    data: { customerId: number; assetId: number; ubicacion: string; entregadoEn: string; deposito?: number; renta?: number }
  ) => {
    const prisma = getPrisma()
    return prisma.$transaction(async (tx) => {
      const active = await tx.fridgeAssignment.findFirst({
        where: { assetId: data.assetId, fechaFin: null }
      })
      if (active) {
        throw new Error('El refri ya está asignado.')
      }

      const asignacion = await tx.fridgeAssignment.create({
        data: {
          customerId: data.customerId,
          assetId: data.assetId,
          ubicacion: data.ubicacion,
          entregadoEn: new Date(data.entregadoEn),
          deposito: data.deposito ?? null,
          renta: data.renta ?? null
        },
        include: { asset: true, customer: true }
      })

      return asignacion
    })
  }
)

safeHandle('asignaciones:eliminar', async (_event, id: number) => {
  const prisma = getPrisma()
  await prisma.fridgeAssignment.update({
    where: { id },
    data: {
      fechaFin: new Date()
    }
  })
  return { ok: true }
})

safeHandle('ventas:list', async () => {
  const prisma = getPrisma()
  return prisma.sale.findMany({
    include: { items: true },
    orderBy: { fecha: 'desc' }
  })
})

safeHandle(
  'ventas:crear',
  async (_event, data: { items: { productId: number; cantidad: number }[]; metodo: string; cajeroId?: number }) => {
    const prisma = getPrisma()
    const cajeroId = data.cajeroId ?? (await getDefaultUserId(prisma))

    return prisma.$transaction(async (tx) => {
      const saleDate = new Date()
      const folio = await buildFriendlySaleFolio(tx, saleDate)
      const productos = await tx.product.findMany({
        where: { id: { in: data.items.map((i) => i.productId) } },
        include: { sabor: true, tipo: true }
      })
      const total = data.items.reduce((sum, item) => {
        const prod = productos.find((p) => p.id === item.productId)
        if (!prod) throw new Error('Producto no encontrado.')
        if (prod.stock < item.cantidad) throw new Error('Stock insuficiente.')
        return sum + prod.precio * item.cantidad
      }, 0)

      const sale = await tx.sale.create({
        data: {
          folio,
          fecha: saleDate,
          cajeroId,
          tipoVenta: 'MOSTRADOR',
          subtotal: total,
          descuentoTipo: 'ninguno',
          descuentoValor: 0,
          total,
          pagoMetodo: data.metodo
        }
      })

      await tx.saleItem.createMany({
        data: data.items.map((item) => {
          const prod = productos.find((p) => p.id === item.productId)!
          return {
            saleId: sale.id,
            productId: item.productId,
            cantidad: item.cantidad,
            precio: prod.precio,
            subtotalLinea: prod.precio * item.cantidad
          }
        })
      })

      for (const item of data.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.cantidad } }
        })
      }

      await tx.payment.create({
        data: { saleId: sale.id, monto: total, metodo: data.metodo }
      })

      return sale
    })
  }
)

safeHandle(
  'pos:venta',
  async (
    _event,
    data: {
      items: { productId: number; cantidad: number }[]
      tipoVenta?: PosSaleType
      customerId?: number | null
      cashBoxId?: number | null
      descuentoTipo?: DiscountType
      descuentoValor?: number
    }
  ) => {
    const prisma = getPrisma()
    const cajeroId = await getDefaultUserId(prisma)
    const tipoVenta = normalizarTipoVenta(data.tipoVenta)
    const descuentoTipo = normalizarTipoDescuento(data.descuentoTipo)
    const descuentoValor = Number(data.descuentoValor ?? 0)

    if (data.items.length === 0) {
      throw new Error('Agrega al menos un producto a la venta.')
    }

    return prisma.$transaction(async (tx) => {
      const customer = data.customerId
        ? await tx.customer.findUnique({ where: { id: data.customerId } })
        : null

      if (tipoVenta === 'MAYOREO') {
        if (!customer) {
          throw new Error('Selecciona un cliente válido para una venta de mayoreo.')
        }
        if (customer.estado !== 'activo') {
          throw new Error('El cliente seleccionado está inactivo.')
        }
        if (!customer.permiteMayoreo) {
          throw new Error('El cliente seleccionado no está habilitado para mayoreo.')
        }
      }

      const productos = await tx.product.findMany({
        where: { id: { in: data.items.map((i) => i.productId) } },
        include: { tipo: true, sabor: true }
      })

      const itemsVenta = data.items.map((item) => {
        const prod = productos.find((p) => p.id === item.productId)
        if (!prod) throw new Error('Producto no encontrado.')
        if (prod.stock < item.cantidad) throw new Error('Stock insuficiente.')
        const precioUnitario = obtenerPrecioVenta(prod, tipoVenta)
        return {
          productId: item.productId,
          cantidad: item.cantidad,
          precioUnitario,
          subtotalLinea: Number((precioUnitario * item.cantidad).toFixed(2)),
          nombre: `${prod.tipo.nombre} ${prod.sabor.nombre}`.trim(),
          presentacion: prod.presentacion
        }
      })

      const subtotal = Number(
        itemsVenta.reduce((sum, item) => sum + item.subtotalLinea, 0).toFixed(2)
      )
      const descuentoAplicado = calcularDescuento(subtotal, descuentoTipo, descuentoValor)
      const total = Number((subtotal - descuentoAplicado).toFixed(2))
      const pagoMetodo = data.customerId ? 'crédito' : 'efectivo'
      const saleDate = new Date()
      const folio = await buildFriendlySaleFolio(tx, saleDate)

      const sale = await tx.sale.create({
        data: {
          folio,
          fecha: saleDate,
          cajeroId,
          customerId: data.customerId ?? null,
          tipoVenta,
          subtotal,
          descuentoTipo,
          descuentoValor: descuentoAplicado,
          total,
          pagoMetodo
        }
      })

      await tx.saleItem.createMany({
        data: itemsVenta.map((item) => {
          return {
            saleId: sale.id,
            productId: item.productId,
            cantidad: item.cantidad,
            precio: item.precioUnitario,
            subtotalLinea: item.subtotalLinea
          }
        })
      })

      for (const item of itemsVenta) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.cantidad } }
        })

        await tx.finishedStockMovement.create({
          data: {
            productId: item.productId,
            tipo: 'salida',
            cantidad: item.cantidad,
            referencia: `Venta ${folio}`
          }
        })
      }

      await tx.payment.create({
        data: { saleId: sale.id, monto: total, metodo: pagoMetodo }
      })

      if (data.cashBoxId) {
        await tx.cashMovement.create({
          data: {
            cashBoxId: data.cashBoxId,
            tipo: 'ingreso',
            concepto: `Venta POS ${folio}`,
            monto: total
          }
        })
      }

      if (data.customerId) {
        await tx.customer.update({
          where: { id: data.customerId },
          data: { saldo: { increment: total } }
        })

        await tx.customerMovement.create({
          data: {
            customerId: data.customerId,
            tipo: 'cargo',
            concepto: `Venta POS ${folio}`,
            monto: total,
            referencia: `venta:${sale.id}`
          }
        })
      }

      return {
        saleId: sale.id,
        folio: sale.folio,
        total: sale.total,
        subtotal: sale.subtotal,
        descuentoTipo: sale.descuentoTipo,
        descuentoValor: sale.descuentoValor,
        customerId: data.customerId ?? null,
        tipoVenta,
        fecha: sale.fecha.toISOString(),
        customerName: customer?.nombre ?? null,
        pagoMetodo,
        items: itemsVenta
      }
    })
  }
)

safeHandle('pos:ventasRecientes', async (_event, limit = 10) => {
  const prisma = getPrisma()
  const sales = await prisma.sale.findMany({
    take: Math.min(Math.max(Number(limit) || 10, 1), 30),
    orderBy: { fecha: 'desc' },
    select: {
      id: true,
      folio: true,
      fecha: true,
      tipoVenta: true,
      customerId: true,
      total: true,
      pagoMetodo: true
    }
  })

  const customerIds = sales
    .map((sale) => sale.customerId)
    .filter((value): value is number => value !== null)
  const customers = customerIds.length
    ? await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, nombre: true }
      })
    : []
  const customersById = new Map(customers.map((customer) => [customer.id, customer.nombre]))

  return sales.map((sale) => ({
    saleId: sale.id,
    folio: sale.folio,
    fecha: sale.fecha.toISOString(),
    tipoVenta: normalizarTipoVenta(sale.tipoVenta),
    customerName: sale.customerId ? customersById.get(sale.customerId) ?? null : null,
    total: sale.total,
    pagoMetodo: sale.pagoMetodo
  }))
})

safeHandle('pos:imprimirRemision', async (_event, saleId: number) => {
  const prisma = getPrisma()
  const receipt = await getPosReceiptBySaleId(prisma, saleId)
  await openPrintPreviewWindow(receipt)
  return { ok: true }
})

safeHandle('produccion:obtenerPlan', async (_event, fecha: string) => {
  const prisma = getPrisma()
  return buildProductionDraft(prisma, normalizePlanDate(fecha))
})

safeHandle('produccion:reconsolidar', async (_event, fecha: string) => {
  const prisma = getPrisma()
  const targetDate = normalizePlanDate(fecha)
  const consolidated = await consolidateWholesaleProduction(prisma, targetDate)

  return {
    plan: null,
    draft: {
      fecha: formatPlanDateInput(targetDate),
      notas: '',
      items: consolidated.items
    },
    basedOnWholesaleSales: consolidated.items.length > 0,
    wholesaleSalesCount: consolidated.sources.length,
    wholesaleSources: consolidated.sources
  }
})

safeHandle(
  'produccion:guardarPlan',
  async (
    _event,
    data: { fecha: string; notas?: string; items: ProductionPlanItemPayload[] }
  ) => {
    const prisma = getPrisma()
    const fecha = normalizePlanDate(data.fecha)
    const items = sanitizeProductionItems(data.items ?? [])

    const saved = await prisma.$transaction(async (tx) => {
      const plan = await tx.productionPlan.upsert({
        where: { fecha },
        update: {
          notas: (data.notas ?? '').trim(),
          updatedAt: new Date()
        },
        create: {
          fecha,
          notas: (data.notas ?? '').trim()
        }
      })

      await tx.productionPlanItem.deleteMany({
        where: { planId: plan.id }
      })

      if (items.length > 0) {
        await tx.productionPlanItem.createMany({
          data: items.map((item, index) => ({
            planId: plan.id,
            productId: item.productId,
            nombre: item.nombre,
            presentacion: item.presentacion,
            cantidadBase: item.cantidadBase,
            cantidadAjuste: item.cantidadAjuste,
            orden: index
          }))
        })
      }

      return tx.productionPlan.findUniqueOrThrow({
        where: { id: plan.id },
        include: {
          items: {
            orderBy: [{ orden: 'asc' }, { id: 'asc' }]
          }
        }
      })
    })

    return serializeProductionPlan(saved)
  }
)

safeHandle('produccion:imprimir', async (_event, fecha: string) => {
  const prisma = getPrisma()
  const targetDate = normalizePlanDate(fecha)
  const plan = await prisma.productionPlan.findUnique({
    where: { fecha: targetDate },
    include: {
      items: {
        orderBy: [{ orden: 'asc' }, { id: 'asc' }]
      }
    }
  })

  if (!plan) {
    throw new Error('Guarda el plan de producción antes de imprimirlo.')
  }

  await openProductionPrintWindow(serializeProductionPlan(plan))
  return { ok: true }
})

safeHandle('refri:listar', async () => {
  const prisma = getPrisma()
  return prisma.fridgeAsset.findMany({
    include: {
      asignaciones: {
        include: { customer: true },
        orderBy: { entregadoEn: 'desc' }
      },
      visitas: true
    }
  })
})

/* =========================================================
   IPC HANDLERS – STOCK
========================================================= */
safeHandle('stock:movimientos', async (_event, productId: number) => {
  const prisma = getPrisma()
  return prisma.finishedStockMovement.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' }
  })
})

const crearVenta = async (
  prisma: PrismaClient,
  data: { items: { productId: number; cantidad: number }[]; pagoMetodo: string; cajeroId?: number }
) => {
  const cajeroId = data.cajeroId ?? (await obtenerCajero(prisma))
  return prisma.$transaction(async (tx) => {
    const productos = await tx.product.findMany({
      where: { id: { in: data.items.map((item) => item.productId) } }
    })

    const total = data.items.reduce((sum, item) => {
      const producto = productos.find((p) => p.id === item.productId)
      if (!producto) throw new Error('Producto no encontrado')
      return sum + producto.precio * item.cantidad
    }, 0)

    const venta = await tx.sale.create({
      data: {
        folio: `V-${Date.now()}`,
        cajeroId,
        total,
        pagoMetodo: data.pagoMetodo
      }
    })

    await Promise.all(
      data.items.map((item) =>
        tx.saleItem.create({
          data: {
            saleId: venta.id,
            productId: item.productId,
            cantidad: item.cantidad,
            precio: productos.find((p) => p.id === item.productId)?.precio ?? 0
          }
        })
      )
    )

    await Promise.all(
      data.items.map((item) =>
        tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.cantidad } }
        })
      )
    )

    return venta
  })
}

const obtenerCajero = async (prisma: PrismaClient) => {
  const cajero = await prisma.user.findFirst()
  if (cajero) return cajero.id

  const creado = await prisma.user.create({
    data: {
      email: 'cajero@local',
      nombre: 'Cajero',
      password: 'cajero'
    }
  })
  return creado.id
}
