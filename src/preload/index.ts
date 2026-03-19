import { contextBridge, ipcRenderer } from 'electron';

/** ===== Tipos ===== */
export type Flavor = { id: number; nombre: string; color?: string | null; activo: boolean };

export type ProductType = { id: number; nombre: string; activo: boolean };

export type FinishedStockMovement = {
  id: number;
  productId: number;
  tipo: string;
  cantidad: number;
  referencia?: string | null;
  createdAt: string;
};

export type Product = {
  id: number;
  sku?: string | null;
  tipoId: number;
  saborId: number;
  presentacion: string;
  precio: number;
  precioMayoreo?: number | null;
  costo: number;
  foto?: string | null;
  stock: number;
  activo: boolean;
  tipo: ProductType;
  sabor: Flavor;
};

export type CashMovement = {
  id: number;
  cashBoxId: number;
  tipo: string;
  concepto: string;
  monto: number;
  fecha: string;
};

export type CashBox = {
  id: number;
  nombre: string;
  tipo: string;
  movimientos: CashMovement[];
};

export type Customer = {
  id: number;
  nombre: string;
  telefono?: string | null;
  limite: number;
  saldo: number;
  estado: 'activo' | 'inactivo' | string;
  permiteMayoreo: boolean;
};

export type PosDiscountType = 'ninguno' | 'porcentaje' | 'monto';
export type PosSaleType = 'MOSTRADOR' | 'MAYOREO';

export type PosSaleReceiptItem = {
  productId: number;
  nombre: string;
  presentacion: string;
  cantidad: number;
  precioUnitario: number;
  subtotalLinea: number;
};

export type PosSaleReceipt = {
  saleId: number;
  folio: string;
  fecha: string;
  tipoVenta: PosSaleType;
  customerId: number | null;
  customerName: string | null;
  subtotal: number;
  descuentoTipo: PosDiscountType;
  descuentoValor: number;
  total: number;
  pagoMetodo: string;
  items: PosSaleReceiptItem[];
};

export type PosSaleSummary = {
  saleId: number;
  folio: string;
  fecha: string;
  tipoVenta: PosSaleType;
  customerName: string | null;
  total: number;
  pagoMetodo: string;
};

export type PromissoryPayment = {
  id: number;
  promissoryNoteId: number;
  monto: number;
  fecha: string;
};

export type PromissoryNote = {
  id: number;
  customerId: number;
  monto: number;
  fecha: string;
  estado: string;
  abonos?: PromissoryPayment[];
};

/** ===== Refris / Asignaciones ===== */
export type FridgeAsset = {
  id: number;
  modelo: string;
  serie: string;
  estado: 'activo' | 'inactivo' | string;
  asignaciones?: FridgeAssignment[];
};

export type FridgeAssignment = {
  id: number;
  assetId: number;
  customerId: number;
  ubicacion: string;
  entregadoEn: string;
  fechaFin?: string | null;
  deposito?: number | null;
  renta?: number | null;

  // según el include del main
  asset?: FridgeAsset;
  customer?: Customer;
};

export type Unit = { id: number; nombre: string };

export type RawMaterialMovement = {
  id: number;
  materialId: number;
  tipo: string;
  cantidad: number;
  costoTotal: number;
  createdAt: string;
};

export type RawMaterial = {
  id: number;
  nombre: string;
  unidadId: number;
  stock: number;
  costoProm: number;
  unidad?: Unit;
  movimientos?: RawMaterialMovement[];
};


export type ProductionPlanItem = {
  id?: number;
  productId?: number | null;
  nombre: string;
  presentacion: string;
  cantidadBase: number;
  cantidadAjuste: number;
  cantidadFinal: number;
  orden: number;
  esManual: boolean;
};

export type ProductionPlan = {
  id?: number;
  fecha: string;
  notas: string;
  createdAt?: string;
  updatedAt?: string;
  items: ProductionPlanItem[];
};

export type ProductionSalesSource = {
  saleId: number;
  folio: string;
  customerName: string | null;
  total: number;
};

export type ProductionPlanDraft = {
  fecha: string;
  notas: string;
  items: ProductionPlanItem[];
};

export type ProductionPlanResponse = {
  plan: ProductionPlan | null;
  draft: ProductionPlanDraft;
  basedOnWholesaleSales: boolean;
  wholesaleSalesCount: number;
  wholesaleSources: ProductionSalesSource[];
};

export type DashboardSale = {
  id: number;
  folio: string;
  total: number;
  pagoMetodo: string;
  fecha: string;
};

export type DashboardSummary = {
  kpis: {
    cajaDia: number;
    ventasDia: number;
    clientesConAdeudo: number;
    refrisAsignados: number;
    refrisDisponibles: number;
  };
  tablas: {
    ultimasVentas: DashboardSale[];
    clientesSaldo: Customer[];
    inventarioBajo: Product[];
  };
  graficas: {
    ingresosVsEgresos: { fecha: string; ingresos: number; egresos: number }[];
    refrisAsignadosVsLibres: { label: string; valor: number }[];
  };
};

/** ===== API ===== */
const api = {
  // Backup
  exportarBackup: (destino: string) => ipcRenderer.invoke('backup:export', destino) as Promise<{ ok: boolean }>,

  // Dashboard
  obtenerDashboard: () => ipcRenderer.invoke('dashboard:resumen') as Promise<DashboardSummary>,

  // Catálogo
  listarCatalogo: () =>
    ipcRenderer.invoke('catalogo:listar') as Promise<{ sabores: Flavor[]; productos: Product[]; tipos: ProductType[] }>,

  crearTipo: (data: { nombre: string; activo?: boolean }) =>
    ipcRenderer.invoke('catalogo:crearTipo', data) as Promise<ProductType>,
  actualizarTipo: (data: { id: number; nombre: string; activo?: boolean }) =>
    ipcRenderer.invoke('catalogo:actualizarTipo', data) as Promise<ProductType>,
  toggleTipo: (data: { id: number; activo: boolean }) =>
    ipcRenderer.invoke('catalogo:toggleTipo', data) as Promise<ProductType>,

  crearSabor: (data: { nombre: string; color?: string; activo?: boolean }) =>
    ipcRenderer.invoke('catalogo:crearSabor', data) as Promise<Flavor>,
  actualizarSabor: (data: { id: number; nombre: string; color?: string | null; activo?: boolean }) =>
    ipcRenderer.invoke('catalogo:actualizarSabor', data) as Promise<Flavor>,
  toggleSabor: (data: { id: number; activo: boolean }) =>
    ipcRenderer.invoke('catalogo:toggleSabor', data) as Promise<Flavor>,

  crearProducto: (data: {
    tipoId: number;
    saborId: number;
    presentacion: string;
    precio: number;
    precioMayoreo?: number | null;
    costo: number;
    sku?: string;
    stock?: number;
    activo?: boolean;
  }) => ipcRenderer.invoke('catalogo:crearProducto', data) as Promise<Product>,

  actualizarProducto: (data: {
    id: number;
    tipoId: number;
    saborId: number;
    presentacion: string;
    precio: number;
    precioMayoreo?: number | null;
    costo: number;
    sku?: string | null;
    stock?: number;
    activo?: boolean;
  }) => ipcRenderer.invoke('catalogo:actualizarProducto', data) as Promise<Product>,

  toggleProducto: (data: { id: number; activo: boolean }) =>
    ipcRenderer.invoke('catalogo:toggleProducto', data) as Promise<Product>,

  // Cajas
  listarCajas: () => ipcRenderer.invoke('cajas:listar') as Promise<CashBox[]>,
  crearMovimiento: (data: { cashBoxId: number; tipo: string; concepto: string; monto: number; fecha?: string }) =>
    ipcRenderer.invoke('cajas:crearMovimiento', data) as Promise<CashMovement>,

  // Clientes
  listarClientes: () => ipcRenderer.invoke('clientes:listar') as Promise<Customer[]>,
  crearCliente: (data: {
    nombre: string;
    telefono?: string;
    limite?: number;
    saldo?: number;
    estado?: 'activo' | 'inactivo';
    permiteMayoreo?: boolean;
  }) =>
    ipcRenderer.invoke('clientes:crear', data) as Promise<Customer>,
  actualizarCliente: (data: {
    id: number;
    nombre: string;
    telefono?: string;
    limite?: number;
    saldo?: number;
    estado?: 'activo' | 'inactivo';
    permiteMayoreo?: boolean;
  }) =>
    ipcRenderer.invoke('clientes:actualizar', data) as Promise<Customer>,
  toggleClienteEstado: (data: { id: number; estado: 'activo' | 'inactivo' }) =>
    ipcRenderer.invoke('clientes:toggleEstado', data) as Promise<Customer>,
  listarClientesConSaldo: () => ipcRenderer.invoke('creditos:listarConSaldo') as Promise<Customer[]>,

  listarPagaresPorCliente: (customerId: number) =>
    ipcRenderer.invoke('pagares:listarPorCliente', customerId) as Promise<(PromissoryNote & { abonos?: PromissoryPayment[] })[]>,
  crearPagare: (data: { customerId: number; monto: number }) =>
    ipcRenderer.invoke('pagares:crear', data) as Promise<PromissoryNote>,
  registrarAbonoPagare: (data: { promissoryNoteId: number; monto: number; cashBoxId?: number }) =>
    ipcRenderer.invoke('pagares:registrarAbono', data) as Promise<{ pagare: PromissoryNote & { abonos?: PromissoryPayment[] }; saldoCliente: number }>,

  // Asignaciones (cliente <-> refri)
  listarAsignacionesCliente: (customerId: number) =>
    ipcRenderer.invoke('asignaciones:listarPorCliente', customerId) as Promise<(FridgeAssignment & { asset: FridgeAsset })[]>,
  crearAsignacionRefri: (data: {
    customerId: number;
    assetId: number;
    ubicacion: string;
    entregadoEn: string;
    deposito?: number;
    renta?: number;
  }) => ipcRenderer.invoke('asignaciones:crear', data) as Promise<FridgeAssignment>,
  eliminarAsignacionRefri: (id: number) => ipcRenderer.invoke('asignaciones:eliminar', id) as Promise<{ ok: boolean }>,
  listarRefrisDisponibles: () => ipcRenderer.invoke('refris:listarDisponibles') as Promise<FridgeAsset[]>,

  // Refris
  listarRefris: () => ipcRenderer.invoke('refris:listar') as Promise<FridgeAsset[]>,
  crearRefri: (data: { modelo: string; serie: string; estado?: string }) =>
    ipcRenderer.invoke('refris:crear', data) as Promise<FridgeAsset>,
  actualizarRefri: (data: { id: number; modelo?: string; serie?: string; estado?: string }) =>
    ipcRenderer.invoke('refris:actualizar', data) as Promise<FridgeAsset>,
  toggleRefriEstado: (data: { id: number }) => ipcRenderer.invoke('refris:toggleEstado', data) as Promise<FridgeAsset>,

  // Ventas
  listarVentas: () => ipcRenderer.invoke('ventas:list') as Promise<unknown>,
  crearVenta: (data: { items: { productId: number; cantidad: number }[]; metodo: string; cajeroId?: number }) =>
    ipcRenderer.invoke('ventas:crear', data) as Promise<unknown>,
  ventaPOS: (data: {
    items: { productId: number; cantidad: number }[];
    tipoVenta?: PosSaleType;
    customerId?: number | null;
    cashBoxId?: number | null;
    descuentoTipo?: PosDiscountType;
    descuentoValor?: number;
  }) => ipcRenderer.invoke('pos:venta', data) as Promise<PosSaleReceipt>,
  listarVentasPOS: (limit = 10) =>
    ipcRenderer.invoke('pos:ventasRecientes', limit) as Promise<PosSaleSummary[]>,
  imprimirRemisionVenta: (saleId: number) =>
    ipcRenderer.invoke('pos:imprimirRemision', saleId) as Promise<{ ok: boolean }>,

  // Producción
  obtenerPlanProduccion: (fecha: string) =>
    ipcRenderer.invoke('produccion:obtenerPlan', fecha) as Promise<ProductionPlanResponse>,
  reconsolidarPlanProduccion: (fecha: string) =>
    ipcRenderer.invoke('produccion:reconsolidar', fecha) as Promise<ProductionPlanResponse>,
  guardarPlanProduccion: (data: ProductionPlanDraft) =>
    ipcRenderer.invoke('produccion:guardarPlan', data) as Promise<ProductionPlan>,
  imprimirPlanProduccion: (fecha: string) =>
    ipcRenderer.invoke('produccion:imprimir', fecha) as Promise<{ ok: boolean }>,

  // Inventario (materia prima)
  listarMaterias: () =>
    ipcRenderer.invoke('inventario:listarMaterias') as Promise<{ materias: RawMaterial[]; unidades: Unit[] }>,
  crearUnidad: (data: { nombre: string }) => ipcRenderer.invoke('inventario:crearUnidad', data) as Promise<Unit>,
  crearMateria: (data: { nombre: string; unidadId: number; stock?: number; costoProm?: number }) =>
    ipcRenderer.invoke('inventario:crearMateria', data) as Promise<RawMaterial>,
  movimientoMateria: (data: { materialId: number; tipo: 'entrada' | 'salida'; cantidad: number; costoTotal?: number }) =>
    ipcRenderer.invoke('inventario:movimientoMateria', data) as Promise<RawMaterial>,

  // Inventario (productos terminados)
  listarProductosStock: () =>
    ipcRenderer.invoke('inventario:listarProductosStock') as Promise<(Product & { stockMoves?: FinishedStockMovement[] })[]>,
  movimientoProducto: (data: { productId: number; tipo: 'entrada' | 'salida'; cantidad: number; referencia?: string }) =>
    ipcRenderer.invoke('inventario:movimientoProducto', data) as Promise<Product>
} as const;

contextBridge.exposeInMainWorld('helatte', api);

declare global {
  interface Window {
    helatte: typeof api;
  }
}
