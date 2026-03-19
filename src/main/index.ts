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
  const rows = await prismaClient.$queryRawUnsafe<SqliteColumnInfo[]>(
    `PRAGMA table_info('${table}')`
  )
  return rows.some((row) => row.name === column)
}

const tableExists = async (prismaClient: PrismaClient, table: string): Promise<boolean> => {
  const rows = await prismaClient.$queryRawUnsafe<SqliteTableInfo[]>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`
  )
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
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2021' || error.code === 'P2022') {
      const reason = `Base de datos desactualizada (Prisma ${error.code}).`
      markDatabaseIncompatible(reason)

      try {
        const issues = await checkDatabaseCompatibility(getPrisma())
        await promptDatabaseReset(issues, reason)
      } catch (err) {
        console.error('[db] Error verificando compatibilidad tras excepción', err)
      }

      return reason
    }
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
    const folio = `VENTA-${Date.now()}`

    return prisma.$transaction(async (tx) => {
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
    const folio = `POS-${Date.now()}`
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

      const sale = await tx.sale.create({
        data: {
          folio,
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
        items: itemsVenta
      }
    })
  }
)

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
