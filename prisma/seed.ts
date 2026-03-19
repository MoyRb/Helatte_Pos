import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'file:./prisma/helatte.db';
const prisma = new PrismaClient();

const daysAgo = (dias: number) => {
  const date = new Date();
  date.setDate(date.getDate() - dias);
  return date;
};

const registrarVenta = async (data: {
  items: { productId: number; cantidad: number }[];
  metodo: string;
  fecha: Date;
  cashBoxId?: number;
  customerId?: number;
  cajeroId: number;
  tipoVenta?: 'MOSTRADOR' | 'MAYOREO';
  descuentoTipo?: 'ninguno' | 'porcentaje' | 'monto';
  descuentoValor?: number;
}) => {
  const productos = await prisma.product.findMany({
    where: { id: { in: data.items.map((item) => item.productId) } }
  });

  const tipoVenta = data.tipoVenta ?? (data.customerId ? 'MAYOREO' : 'MOSTRADOR');
  const subtotal = data.items.reduce((sum, item) => {
    const producto = productos.find((prod) => prod.id === item.productId);
    if (!producto) throw new Error('Producto no encontrado en seed');
    const precioUnitario = tipoVenta === 'MAYOREO' ? producto.precioMayoreo ?? producto.precio : producto.precio;
    return sum + precioUnitario * item.cantidad;
  }, 0);
  const descuentoTipo = data.descuentoTipo ?? 'ninguno';
  const descuentoValor = data.descuentoValor ?? 0;
  const total = subtotal - descuentoValor;

  const sale = await prisma.sale.create({
    data: {
      folio: `SEED-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      fecha: data.fecha,
      cajeroId: data.cajeroId,
      customerId: data.customerId ?? null,
      tipoVenta,
      subtotal,
      descuentoTipo,
      descuentoValor,
      total,
      pagoMetodo: data.metodo,
      items: {
        create: data.items.map((item) => {
          const producto = productos.find((prod) => prod.id === item.productId);
          const precioUnitario = tipoVenta === 'MAYOREO' ? producto?.precioMayoreo ?? producto?.precio ?? 0 : producto?.precio ?? 0;
          return {
            productId: item.productId,
            cantidad: item.cantidad,
            precio: precioUnitario,
            subtotalLinea: precioUnitario * item.cantidad
          };
        })
      },
      pagos: {
        create: {
          monto: total,
          metodo: data.metodo,
          createdAt: data.fecha
        }
      }
    }
  });

  for (const item of data.items) {
    await prisma.product.update({
      where: { id: item.productId },
      data: { stock: { decrement: item.cantidad } }
    });

    await prisma.finishedStockMovement.create({
      data: {
        productId: item.productId,
        tipo: 'salida',
        cantidad: item.cantidad,
        referencia: `Venta seed ${sale.folio}`,
        createdAt: data.fecha
      }
    });
  }

  if (data.cashBoxId) {
    await prisma.cashMovement.create({
      data: {
        cashBoxId: data.cashBoxId,
        tipo: 'ingreso',
        concepto: `Venta ${sale.folio}`,
        monto: total,
        fecha: data.fecha
      }
    });
  }

  if (data.customerId) {
    await prisma.customer.update({
      where: { id: data.customerId },
      data: { saldo: { increment: total } }
    });

    await prisma.customerMovement.create({
      data: {
        customerId: data.customerId,
        tipo: 'cargo',
        concepto: `Venta ${sale.folio}`,
        monto: total,
        referencia: `venta:${sale.id}`,
        createdAt: data.fecha
      }
    });
  }

  return sale;
};

async function main() {
  await prisma.payment.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.cashMovement.deleteMany();
  await prisma.cashBox.deleteMany();
  await prisma.customerMovement.deleteMany();
  await prisma.creditPayment.deleteMany();
  await prisma.credit.deleteMany();
  await prisma.promissoryPayment.deleteMany();
  await prisma.promissoryNote.deleteMany();
  await prisma.fridgeVisitItem.deleteMany();
  await prisma.fridgeVisit.deleteMany();
  await prisma.fridgeAssignment.deleteMany();
  await prisma.fridgeAsset.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.finishedStockMovement.deleteMany();
  await prisma.recipeItem.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.rawMaterialMovement.deleteMany();
  await prisma.rawMaterial.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.product.deleteMany();
  await prisma.flavor.deleteMany();
  await prisma.productType.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      email: 'admin@helatte.local',
      nombre: 'Admin',
      password: 'admin123',
      role: 'ADMIN'
    }
  });

  const cajero = await prisma.user.create({
    data: {
      email: 'cajero@helatte.local',
      nombre: 'Cajero principal',
      password: 'cajero123',
      role: 'CAJERO'
    }
  });

  const tipoPaleta = await prisma.productType.create({ data: { nombre: 'Paleta', activo: true } });
  const tipoNieve = await prisma.productType.create({ data: { nombre: 'Nieve', activo: true } });
  const tipoYogurt = await prisma.productType.create({ data: { nombre: 'Yogurt', activo: true } });

  const fresa = await prisma.flavor.create({ data: { nombre: 'Fresa cremosa', color: '#ff8aa1' } });
  const mango = await prisma.flavor.create({ data: { nombre: 'Mango con chile', color: '#ffb347' } });
  const coco = await prisma.flavor.create({ data: { nombre: 'Coco', color: '#f5f5f0' } });
  const tamarindo = await prisma.flavor.create({ data: { nombre: 'Tamarindo', color: '#d4a373' } });

  const unidadKg = await prisma.unit.create({ data: { nombre: 'Kg' } });
  const unidadLitro = await prisma.unit.create({ data: { nombre: 'Litro' } });
  const unidadPieza = await prisma.unit.create({ data: { nombre: 'Pieza' } });

  const leche = await prisma.rawMaterial.create({
    data: { nombre: 'Leche entera', unidadId: unidadLitro.id, stock: 50, costoProm: 18.4 }
  });
  const azucar = await prisma.rawMaterial.create({
    data: { nombre: 'Azúcar refinada', unidadId: unidadKg.id, stock: 25, costoProm: 12 }
  });
  const palitos = await prisma.rawMaterial.create({
    data: { nombre: 'Palitos de madera', unidadId: unidadPieza.id, stock: 500, costoProm: 0.5 }
  });

  await prisma.rawMaterialMovement.createMany({
    data: [
      { materialId: leche.id, tipo: 'entrada', cantidad: 30, costoTotal: 540, createdAt: daysAgo(6) },
      { materialId: leche.id, tipo: 'entrada', cantidad: 20, costoTotal: 380, createdAt: daysAgo(2) },
      { materialId: azucar.id, tipo: 'entrada', cantidad: 15, costoTotal: 180, createdAt: daysAgo(5) },
      { materialId: azucar.id, tipo: 'entrada', cantidad: 10, costoTotal: 120, createdAt: daysAgo(1) },
      { materialId: palitos.id, tipo: 'entrada', cantidad: 500, costoTotal: 250, createdAt: daysAgo(4) }
    ]
  });

  const paletaFresa = await prisma.product.create({
    data: {
      tipoId: tipoPaleta.id,
      saborId: fresa.id,
      presentacion: 'pieza',
      precio: 25,
      precioMayoreo: 21,
      costo: 9,
      sku: 'PAL-FRE-01',
      stock: 120
    }
  });
  const paletaMango = await prisma.product.create({
    data: {
      tipoId: tipoPaleta.id,
      saborId: mango.id,
      presentacion: 'pieza',
      precio: 27,
      precioMayoreo: 23,
      costo: 10,
      sku: 'PAL-MAN-01',
      stock: 90
    }
  });
  const nieveCoco = await prisma.product.create({
    data: {
      tipoId: tipoNieve.id,
      saborId: coco.id,
      presentacion: 'litro',
      precio: 120,
      precioMayoreo: 105,
      costo: 55,
      sku: 'NIE-COC-L',
      stock: 40
    }
  });
  const yogurtTamarindo = await prisma.product.create({
    data: {
      tipoId: tipoYogurt.id,
      saborId: tamarindo.id,
      presentacion: 'vaso',
      precio: 45,
      precioMayoreo: 39,
      costo: 18,
      sku: 'YOG-TAM-01',
      stock: 60
    }
  });

  await prisma.recipe.create({
    data: {
      productId: paletaFresa.id,
      items: {
        create: [
          { materialId: leche.id, cantidad: 1 },
          { materialId: azucar.id, cantidad: 0.5 },
          { materialId: palitos.id, cantidad: 10 }
        ]
      }
    }
  });

  await prisma.finishedStockMovement.createMany({
    data: [
      { productId: paletaFresa.id, tipo: 'entrada', cantidad: 100, referencia: 'Producción matutina', createdAt: daysAgo(6) },
      { productId: paletaFresa.id, tipo: 'salida', cantidad: 30, referencia: 'Pedido mayorista', createdAt: daysAgo(5) },
      { productId: paletaMango.id, tipo: 'entrada', cantidad: 80, referencia: 'Lote con chile', createdAt: daysAgo(4) },
      { productId: paletaMango.id, tipo: 'salida', cantidad: 20, referencia: 'Merma', createdAt: daysAgo(3) },
      { productId: nieveCoco.id, tipo: 'entrada', cantidad: 40, referencia: 'Producción especial', createdAt: daysAgo(2) },
      { productId: yogurtTamarindo.id, tipo: 'entrada', cantidad: 50, referencia: 'Batch inicial', createdAt: daysAgo(1) }
    ]
  });

  const clienteMonarca = await prisma.customer.create({
    data: { nombre: 'Cafetería Monarca', telefono: '333-000-0001', limite: 5000, saldo: 1500, permiteMayoreo: true }
  });
  const clienteEscuela = await prisma.customer.create({
    data: { nombre: 'Escuela San Ángel', telefono: '333-000-0002', limite: 3000, saldo: 0, permiteMayoreo: true }
  });
  const clienteEventos = await prisma.customer.create({
    data: { nombre: 'Eventos Luna', telefono: '333-000-0003', limite: 2000, saldo: 800, permiteMayoreo: true }
  });
  const clienteDonaMary = await prisma.customer.create({
    data: { nombre: 'Cocina Doña Mary', telefono: '333-000-0004', limite: 3500, saldo: 0, estado: 'inactivo', permiteMayoreo: false }
  });

  const creditoMonarca = await prisma.credit.create({
    data: {
      customerId: clienteMonarca.id,
      saldo: 1500,
      createdAt: daysAgo(10)
    }
  });

  await prisma.creditPayment.create({
    data: {
      creditId: creditoMonarca.id,
      monto: 500,
      fecha: daysAgo(3)
    }
  });

  await prisma.customerMovement.createMany({
    data: [
      {
        customerId: clienteMonarca.id,
        tipo: 'cargo',
        concepto: 'Venta mayoreo',
        monto: 1500,
        referencia: 'venta:seed-1',
        createdAt: daysAgo(4)
      },
      {
        customerId: clienteMonarca.id,
        tipo: 'abono',
        concepto: 'Pago parcial',
        monto: 500,
        referencia: 'abono:seed-1',
        createdAt: daysAgo(3)
      },
      {
        customerId: clienteEventos.id,
        tipo: 'cargo',
        concepto: 'Servicio evento',
        monto: 800,
        referencia: 'venta:seed-2',
        createdAt: daysAgo(2)
      }
    ]
  });

  const pagare = await prisma.promissoryNote.create({
    data: {
      customerId: clienteEventos.id,
      monto: 800,
      fecha: daysAgo(2),
      estado: 'vigente'
    }
  });

  await prisma.promissoryPayment.create({
    data: {
      promissoryNoteId: pagare.id,
      monto: 200,
      fecha: daysAgo(1)
    }
  });

  const refriA = await prisma.fridgeAsset.create({
    data: { modelo: 'Imbera VR-16', serie: 'IMB-001', estado: 'activo' }
  });
  const refriB = await prisma.fridgeAsset.create({
    data: { modelo: 'Mabe RVZ', serie: 'MAB-502', estado: 'activo' }
  });
  const refriC = await prisma.fridgeAsset.create({
    data: { modelo: 'Torrey TC-12', serie: 'TOR-889', estado: 'inactivo' }
  });

  await prisma.fridgeAssignment.create({
    data: {
      assetId: refriA.id,
      customerId: clienteMonarca.id,
      ubicacion: 'Av. Central 123',
      entregadoEn: daysAgo(15),
      deposito: 1500,
      renta: 250
    }
  });

  await prisma.fridgeAssignment.create({
    data: {
      assetId: refriB.id,
      customerId: clienteEscuela.id,
      ubicacion: 'Colegio San Ángel',
      entregadoEn: daysAgo(30),
      fechaFin: daysAgo(5),
      deposito: 1000,
      renta: 200
    }
  });

  await prisma.fridgeVisit.create({
    data: {
      assetId: refriA.id,
      fecha: daysAgo(2),
      notas: 'Reposición semanal',
      items: {
        create: [
          { product: 'Paleta Fresa', cantidad: 40, devuelto: 0 },
          { product: 'Paleta Mango', cantidad: 30, devuelto: 5 }
        ]
      }
    }
  });

  const cajaGrande = await prisma.cashBox.create({
    data: { nombre: 'Caja grande', tipo: 'grande' }
  });
  const cajaChica = await prisma.cashBox.create({
    data: { nombre: 'Caja chica', tipo: 'chica' }
  });

  await prisma.cashMovement.createMany({
    data: [
      { cashBoxId: cajaGrande.id, tipo: 'ingreso', concepto: 'Apertura', monto: 1500, fecha: daysAgo(6) },
      { cashBoxId: cajaGrande.id, tipo: 'egreso', concepto: 'Compra insumos', monto: 300, fecha: daysAgo(5) },
      { cashBoxId: cajaGrande.id, tipo: 'ingreso', concepto: 'Venta mostrador', monto: 780, fecha: daysAgo(4) },
      { cashBoxId: cajaChica.id, tipo: 'ingreso', concepto: 'Recarga caja chica', monto: 400, fecha: daysAgo(3) },
      { cashBoxId: cajaChica.id, tipo: 'egreso', concepto: 'Transporte', monto: 120, fecha: daysAgo(2) },
      { cashBoxId: cajaGrande.id, tipo: 'ingreso', concepto: 'Venta mostrador', monto: 520, fecha: daysAgo(1) }
    ]
  });

  await registrarVenta({
    items: [
      { productId: paletaFresa.id, cantidad: 4 },
      { productId: paletaMango.id, cantidad: 3 }
    ],
    metodo: 'efectivo',
    fecha: daysAgo(0),
    cashBoxId: cajaGrande.id,
    cajeroId: cajero.id
  });

  await registrarVenta({
    items: [
      { productId: nieveCoco.id, cantidad: 1 },
      { productId: yogurtTamarindo.id, cantidad: 2 }
    ],
    metodo: 'crédito',
    fecha: daysAgo(1),
    cashBoxId: cajaGrande.id,
    customerId: clienteEventos.id,
    cajeroId: cajero.id,
    tipoVenta: 'MAYOREO',
    descuentoTipo: 'porcentaje',
    descuentoValor: 16.5
  });

  await registrarVenta({
    items: [{ productId: paletaFresa.id, cantidad: 6 }],
    metodo: 'efectivo',
    fecha: daysAgo(2),
    cashBoxId: cajaChica.id,
    cajeroId: cajero.id
  });

  console.log('Seed listo', { admin: admin.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
