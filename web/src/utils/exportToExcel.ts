import * as XLSX from 'xlsx';
import {
  Client,
  Credit,
  FinanceMovement,
  FridgeLoan,
  Product,
  RawMaterial,
  Sale,
} from '../context/PosContext';

export type ExportPayload = {
  products: Product[];
  sales: Sale[];
  financeMovements: FinanceMovement[];
  clients: Client[];
  credits: Credit[];
  fridgeLoans: FridgeLoan[];
  rawMaterials: RawMaterial[];
};

type SheetRow = Record<string, string | number | boolean>;

type HeaderKeys = string[];

function appendSheet(workbook: XLSX.WorkBook, rows: SheetRow[], sheetName: string, headers: HeaderKeys) {
  const template = headers.reduce<SheetRow>((acc, key) => ({ ...acc, [key]: '' }), {});
  const sheetRows = rows.length ? rows : [template];
  const worksheet = XLSX.utils.json_to_sheet(sheetRows, { header: headers });
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
}

function findClientName(clients: Client[], clientId: string) {
  return clients.find((client) => client.id === clientId)?.name ?? clientId;
}

export function exportPosDataToExcel(data: ExportPayload) {
  const workbook = XLSX.utils.book_new();

  const ventasRows: SheetRow[] = data.sales.map((sale) => ({
    id: sale.id,
    'fecha/hora': sale.date,
    total: sale.total,
    notas: (sale as Sale & { notes?: string }).notes ?? '',
    clientId: (sale as Sale & { clientId?: string }).clientId
      ? findClientName(data.clients, (sale as Sale & { clientId?: string }).clientId ?? '')
      : (sale as Sale & { clientName?: string }).clientName ?? '',
    channel: sale.channel ?? 'pos',
    folio: sale.folio ?? '',
  }));
  appendSheet(workbook, ventasRows, 'Ventas', ['id', 'fecha/hora', 'total', 'notas', 'clientId', 'channel', 'folio']);

  const itemsVentaRows: SheetRow[] = data.sales.flatMap((sale) =>
    sale.items.map((item) => ({
      ventaId: sale.id,
      producto: item.name,
      cantidad: item.quantity,
      precio: item.price,
    })),
  );
  appendSheet(workbook, itemsVentaRows, 'ItemsVenta', ['ventaId', 'producto', 'cantidad', 'precio']);

  const productsRows: SheetRow[] = data.products.map((product) => ({
    id: product.id,
    nombre: product.name,
    precio: product.price,
    stock: product.stock,
  }));
  appendSheet(workbook, productsRows, 'Productos', ['id', 'nombre', 'precio', 'stock']);

  const clientsRows: SheetRow[] = data.clients.map((client) => ({
    id: client.id,
    nombre: client.name,
    telefono: client.phone,
    direccion: client.address,
    activo: client.active,
  }));
  appendSheet(workbook, clientsRows, 'Clientes', ['id', 'nombre', 'telefono', 'direccion', 'activo']);

  const creditRows: SheetRow[] = data.credits.map((credit) => {
    const paid = credit.payments.reduce((acc, payment) => acc + payment.amount, 0);
    const saldo = credit.amount - paid;
    return {
      id: credit.id,
      cliente: findClientName(data.clients, credit.clientId),
      monto: credit.amount,
      saldo,
      estado: credit.status,
      fecha: credit.date,
    };
  });
  appendSheet(workbook, creditRows, 'Créditos', ['id', 'cliente', 'monto', 'saldo', 'estado', 'fecha']);

  const abonosRows: SheetRow[] = data.credits.flatMap((credit) =>
    credit.payments.map((payment) => ({
      creditoId: credit.id,
      monto: payment.amount,
      fecha: payment.date,
    })),
  );
  appendSheet(workbook, abonosRows, 'Abonos', ['creditoId', 'monto', 'fecha']);

  const fridgeRows: SheetRow[] = data.fridgeLoans.map((loan) => ({
    cliente: findClientName(data.clients, loan.clientId),
    'producto/descripcion': 'Refri',
    cantidad: loan.quantity,
    fechaEntrega: loan.deliveryDate,
    estado: loan.status,
    fechaDevolucion: loan.returnDate ?? '',
  }));
  appendSheet(
    workbook,
    fridgeRows,
    'Refris',
    ['cliente', 'producto/descripcion', 'cantidad', 'fechaEntrega', 'estado', 'fechaDevolucion'],
  );

  const materialsRows: SheetRow[] = data.rawMaterials.map((material) => ({
    nombre: material.name,
    unidad: 'N/A',
    stock: material.stock,
    minimo: material.minStock,
  }));
  appendSheet(workbook, materialsRows, 'MateriasPrimas', ['nombre', 'unidad', 'stock', 'minimo']);

  const cashSmallRows: SheetRow[] = data.financeMovements
    .filter((movement) => movement.box === 'chica')
    .map((movement) => ({
      tipo: movement.kind,
      monto: movement.amount,
      concepto: movement.concept,
      fecha: movement.date,
    }));
  appendSheet(workbook, cashSmallRows, 'MovimientosCajaChica', ['tipo', 'monto', 'concepto', 'fecha']);

  const cashBigRows: SheetRow[] = data.financeMovements
    .filter((movement) => movement.box === 'grande')
    .map((movement) => ({
      tipo: movement.kind,
      monto: movement.amount,
      concepto: movement.concept,
      fecha: movement.date,
    }));
  appendSheet(workbook, cashBigRows, 'MovimientosCajaGrande', ['tipo', 'monto', 'concepto', 'fecha']);

  const fileName = `helatte-pos-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, fileName);
}
