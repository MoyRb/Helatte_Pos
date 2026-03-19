import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'file:./prisma/helatte.db';
const prisma = new PrismaClient();

const daysAgo = (dias: number) => {
  const date = new Date();
  date.setDate(date.getDate() - dias);
  return date;
};

type BrandSeedContext = {
  id: number;
  slug: string;
  nombre: string;
};

const upsertBrands = async (): Promise<Record<'helatte' | 'las-purepechas', BrandSeedContext>> => {
  const helatte = await prisma.brand.upsert({
    where: { slug: 'helatte' },
    update: {
      nombre: 'Helatte',
      subtitulo: 'Nevería & Paletería',
      logoPath: 'brands/helatte-logo.svg'
    },
    create: {
      slug: 'helatte',
      nombre: 'Helatte',
      subtitulo: 'Nevería & Paletería',
      logoPath: 'brands/helatte-logo.svg'
    }
  });

  const lasPurepechas = await prisma.brand.upsert({
    where: { slug: 'las-purepechas' },
    update: {
      nombre: 'Las Purepechas',
      subtitulo: 'Base para helado y aguas frescas',
      logoPath: 'brands/las-purepechas-logo.svg'
    },
    create: {
      slug: 'las-purepechas',
      nombre: 'Las Purepechas',
      subtitulo: 'Base para helado y aguas frescas',
      logoPath: 'brands/las-purepechas-logo.svg'
    }
  });

  return {
    helatte: helatte as BrandSeedContext,
    'las-purepechas': lasPurepechas as BrandSeedContext
  };
};

const registrarVenta = async (brandId: number, data: {
  items: { productId: number; cantidad: number }[];
  metodo: string;
  fecha: Date;
  cashBoxId?: number;
  customerId?: number;
  cajeroId: number;
  tipoVenta?: 'MOSTRADOR' | 'MAYOREO';
  descuentoTipo?: 'ninguno' | 'porcentaje' | 'monto';
  descuentoValor?: number;
  folioPrefix: string;
}) => {
  const productos = await prisma.product.findMany({
    where: { id: { in: data.items.map((item) => item.productId) }, brandId }
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
      brandId,
      folio: `${data.folioPrefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
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
        brandId,
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
        brandId,
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
        brandId,
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

async function resetData() {
  await prisma.productionPlanItem.deleteMany();
  await prisma.productionPlan.deleteMany();
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
}

async function seedHelatte(brand: BrandSeedContext, adminId: number, cajeroId: number) {
  const tipoPaleta = await prisma.productType.create({ data: { brandId: brand.id, nombre: 'Paleta', activo: true } });
  const tipoNieve = await prisma.productType.create({ data: { brandId: brand.id, nombre: 'Nieve', activo: true } });
  const tipoYogurt = await prisma.productType.create({ data: { brandId: brand.id, nombre: 'Yogurt', activo: true } });

  const fresa = await prisma.flavor.create({ data: { brandId: brand.id, nombre: 'Fresa cremosa', color: '#ff8aa1' } });
  const mango = await prisma.flavor.create({ data: { brandId: brand.id, nombre: 'Mango con chile', color: '#ffb347' } });
  const coco = await prisma.flavor.create({ data: { brandId: brand.id, nombre: 'Coco', color: '#f5f5f0' } });
  const tamarindo = await prisma.flavor.create({ data: { brandId: brand.id, nombre: 'Tamarindo', color: '#d4a373' } });

  const unidadKg = await prisma.unit.create({ data: { nombre: 'Kg' } });
  const unidadLitro = await prisma.unit.create({ data: { nombre: 'Litro' } });
  const unidadPieza = await prisma.unit.create({ data: { nombre: 'Pieza' } });

  const leche = await prisma.rawMaterial.create({
    data: { brandId: brand.id, nombre: 'Leche entera', unidadId: unidadLitro.id, stock: 50, costoProm: 18.4 }
  });
  const azucar = await prisma.rawMaterial.create({
    data: { brandId: brand.id, nombre: 'Azúcar refinada', unidadId: unidadKg.id, stock: 25, costoProm: 12 }
  });
  const palitos = await prisma.rawMaterial.create({
    data: { brandId: brand.id, nombre: 'Palitos de madera', unidadId: unidadPieza.id, stock: 500, costoProm: 0.5 }
  });

  await prisma.rawMaterialMovement.createMany({
    data: [
      { brandId: brand.id, materialId: leche.id, tipo: 'entrada', cantidad: 30, costoTotal: 540, createdAt: daysAgo(6) },
      { brandId: brand.id, materialId: leche.id, tipo: 'entrada', cantidad: 20, costoTotal: 380, createdAt: daysAgo(2) },
      { brandId: brand.id, materialId: azucar.id, tipo: 'entrada', cantidad: 15, costoTotal: 180, createdAt: daysAgo(5) },
      { brandId: brand.id, materialId: azucar.id, tipo: 'entrada', cantidad: 10, costoTotal: 120, createdAt: daysAgo(1) },
      { brandId: brand.id, materialId: palitos.id, tipo: 'entrada', cantidad: 500, costoTotal: 250, createdAt: daysAgo(4) }
    ]
  });

  const paletaFresa = await prisma.product.create({
    data: {
      brandId: brand.id,
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
      brandId: brand.id,
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
      brandId: brand.id,
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
      brandId: brand.id,
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
      { brandId: brand.id, productId: paletaFresa.id, tipo: 'entrada', cantidad: 100, referencia: 'Producción matutina', createdAt: daysAgo(6) },
      { brandId: brand.id, productId: paletaFresa.id, tipo: 'salida', cantidad: 30, referencia: 'Pedido mayorista', createdAt: daysAgo(5) },
      { brandId: brand.id, productId: paletaMango.id, tipo: 'entrada', cantidad: 80, referencia: 'Lote con chile', createdAt: daysAgo(4) },
      { brandId: brand.id, productId: paletaMango.id, tipo: 'salida', cantidad: 20, referencia: 'Merma', createdAt: daysAgo(3) },
      { brandId: brand.id, productId: nieveCoco.id, tipo: 'entrada', cantidad: 40, referencia: 'Producción especial', createdAt: daysAgo(2) },
      { brandId: brand.id, productId: yogurtTamarindo.id, tipo: 'entrada', cantidad: 50, referencia: 'Batch inicial', createdAt: daysAgo(1) }
    ]
  });

  const clienteMonarca = await prisma.customer.create({
    data: { brandId: brand.id, nombre: 'Cafetería Monarca', telefono: '333-000-0001', limite: 5000, saldo: 1500, permiteMayoreo: true }
  });
  const clienteEscuela = await prisma.customer.create({
    data: { brandId: brand.id, nombre: 'Escuela San Ángel', telefono: '333-000-0002', limite: 3000, saldo: 0, permiteMayoreo: true }
  });
  const clienteEventos = await prisma.customer.create({
    data: { brandId: brand.id, nombre: 'Eventos Luna', telefono: '333-000-0003', limite: 2000, saldo: 800, permiteMayoreo: true }
  });
  await prisma.customer.create({
    data: { brandId: brand.id, nombre: 'Cocina Doña Mary', telefono: '333-000-0004', limite: 3500, saldo: 0, estado: 'inactivo', permiteMayoreo: false }
  });

  const creditoMonarca = await prisma.credit.create({
    data: {
      brandId: brand.id,
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
      { brandId: brand.id, customerId: clienteMonarca.id, tipo: 'cargo', concepto: 'Venta mayoreo', monto: 1500, referencia: 'venta:seed-1', createdAt: daysAgo(4) },
      { brandId: brand.id, customerId: clienteMonarca.id, tipo: 'abono', concepto: 'Pago parcial', monto: 500, referencia: 'abono:seed-1', createdAt: daysAgo(3) },
      { brandId: brand.id, customerId: clienteEventos.id, tipo: 'cargo', concepto: 'Servicio evento', monto: 800, referencia: 'venta:seed-2', createdAt: daysAgo(2) }
    ]
  });

  const pagare = await prisma.promissoryNote.create({
    data: {
      brandId: brand.id,
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
    data: { brandId: brand.id, modelo: 'Imbera VR-16', serie: 'IMB-001', estado: 'activo' }
  });
  const refriB = await prisma.fridgeAsset.create({
    data: { brandId: brand.id, modelo: 'Mabe RVZ', serie: 'MAB-502', estado: 'activo' }
  });
  await prisma.fridgeAsset.create({
    data: { brandId: brand.id, modelo: 'Torrey TC-12', serie: 'TOR-889', estado: 'inactivo' }
  });

  await prisma.fridgeAssignment.create({
    data: {
      brandId: brand.id,
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
      brandId: brand.id,
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
      brandId: brand.id,
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
    data: { brandId: brand.id, nombre: 'Caja grande', tipo: 'grande' }
  });
  const cajaChica = await prisma.cashBox.create({
    data: { brandId: brand.id, nombre: 'Caja chica', tipo: 'chica' }
  });

  await prisma.cashMovement.createMany({
    data: [
      { brandId: brand.id, cashBoxId: cajaGrande.id, tipo: 'ingreso', concepto: 'Apertura', monto: 1500, fecha: daysAgo(6) },
      { brandId: brand.id, cashBoxId: cajaGrande.id, tipo: 'egreso', concepto: 'Compra insumos', monto: 300, fecha: daysAgo(5) },
      { brandId: brand.id, cashBoxId: cajaGrande.id, tipo: 'ingreso', concepto: 'Venta mostrador', monto: 780, fecha: daysAgo(4) },
      { brandId: brand.id, cashBoxId: cajaChica.id, tipo: 'ingreso', concepto: 'Recarga caja chica', monto: 400, fecha: daysAgo(3) },
      { brandId: brand.id, cashBoxId: cajaChica.id, tipo: 'egreso', concepto: 'Transporte', monto: 120, fecha: daysAgo(2) },
      { brandId: brand.id, cashBoxId: cajaGrande.id, tipo: 'ingreso', concepto: 'Venta mostrador', monto: 520, fecha: daysAgo(1) }
    ]
  });

  await registrarVenta(brand.id, {
    items: [
      { productId: paletaFresa.id, cantidad: 4 },
      { productId: paletaMango.id, cantidad: 3 }
    ],
    metodo: 'efectivo',
    fecha: daysAgo(0),
    cashBoxId: cajaGrande.id,
    cajeroId,
    folioPrefix: 'HLT'
  });

  await registrarVenta(brand.id, {
    items: [
      { productId: nieveCoco.id, cantidad: 1 },
      { productId: yogurtTamarindo.id, cantidad: 2 }
    ],
    metodo: 'crédito',
    fecha: daysAgo(1),
    cashBoxId: cajaGrande.id,
    customerId: clienteEventos.id,
    cajeroId,
    tipoVenta: 'MAYOREO',
    descuentoTipo: 'porcentaje',
    descuentoValor: 16.5,
    folioPrefix: 'HLT'
  });

  await registrarVenta(brand.id, {
    items: [{ productId: paletaFresa.id, cantidad: 6 }],
    metodo: 'efectivo',
    fecha: daysAgo(2),
    cashBoxId: cajaChica.id,
    cajeroId,
    folioPrefix: 'HLT'
  });

  await prisma.productionPlan.create({
    data: {
      brandId: brand.id,
      fecha: daysAgo(0),
      notas: 'Plan base Helatte',
      items: {
        create: [
          {
            productId: paletaFresa.id,
            nombre: 'Paleta Fresa cremosa',
            presentacion: 'pieza',
            cantidadBase: 20,
            cantidadAjuste: 5,
            cantidadAplicada: 25,
            orden: 0
          }
        ]
      }
    }
  });

  return { adminId, cajeroId };
}

async function seedLasPurepechas(brand: BrandSeedContext, cajeroId: number) {
  const tipoHelado = await prisma.productType.create({ data: { brandId: brand.id, nombre: 'Helado', activo: true } });
  const tipoPaleta = await prisma.productType.create({ data: { brandId: brand.id, nombre: 'Paleta artesanal', activo: true } });
  const zarzamora = await prisma.flavor.create({ data: { brandId: brand.id, nombre: 'Zarzamora con queso', color: '#8b5fbf' } });
  const limon = await prisma.flavor.create({ data: { brandId: brand.id, nombre: 'Limón con sal', color: '#b4d455' } });

  const unidadKg = await prisma.unit.findUniqueOrThrow({ where: { nombre: 'Kg' } });
  const unidadLitro = await prisma.unit.findUniqueOrThrow({ where: { nombre: 'Litro' } });

  const crema = await prisma.rawMaterial.create({
    data: { brandId: brand.id, nombre: 'Base cremosa Purepecha', unidadId: unidadLitro.id, stock: 18, costoProm: 42 }
  });
  const fruta = await prisma.rawMaterial.create({
    data: { brandId: brand.id, nombre: 'Pulpa de zarzamora', unidadId: unidadKg.id, stock: 12, costoProm: 58 }
  });

  await prisma.rawMaterialMovement.createMany({
    data: [
      { brandId: brand.id, materialId: crema.id, tipo: 'entrada', cantidad: 18, costoTotal: 756, createdAt: daysAgo(2) },
      { brandId: brand.id, materialId: fruta.id, tipo: 'entrada', cantidad: 12, costoTotal: 696, createdAt: daysAgo(1) }
    ]
  });

  const heladoZarzamora = await prisma.product.create({
    data: {
      brandId: brand.id,
      tipoId: tipoHelado.id,
      saborId: zarzamora.id,
      presentacion: 'litro',
      precio: 140,
      precioMayoreo: 126,
      costo: 68,
      sku: 'LPR-ZAR-01',
      stock: 24
    }
  });
  const paletaLimon = await prisma.product.create({
    data: {
      brandId: brand.id,
      tipoId: tipoPaleta.id,
      saborId: limon.id,
      presentacion: 'pieza',
      precio: 24,
      precioMayoreo: 20,
      costo: 8,
      sku: 'LPR-LIM-01',
      stock: 70
    }
  });

  await prisma.finishedStockMovement.createMany({
    data: [
      { brandId: brand.id, productId: heladoZarzamora.id, tipo: 'entrada', cantidad: 24, referencia: 'Arranque Las Purepechas', createdAt: daysAgo(1) },
      { brandId: brand.id, productId: paletaLimon.id, tipo: 'entrada', cantidad: 70, referencia: 'Arranque Las Purepechas', createdAt: daysAgo(1) }
    ]
  });

  const cliente = await prisma.customer.create({
    data: { brandId: brand.id, nombre: 'Tienda Purépecha Centro', telefono: '443-100-1001', limite: 1800, saldo: 350, permiteMayoreo: true }
  });

  await prisma.credit.create({
    data: { brandId: brand.id, customerId: cliente.id, saldo: 350, createdAt: daysAgo(1) }
  });

  await prisma.customerMovement.create({
    data: { brandId: brand.id, customerId: cliente.id, tipo: 'cargo', concepto: 'Saldo inicial', monto: 350, referencia: 'seed:purepechas', createdAt: daysAgo(1) }
  });

  const caja = await prisma.cashBox.create({
    data: { brandId: brand.id, nombre: 'Caja principal', tipo: 'grande' }
  });

  await prisma.cashMovement.create({
    data: { brandId: brand.id, cashBoxId: caja.id, tipo: 'ingreso', concepto: 'Apertura', monto: 900, fecha: daysAgo(1) }
  });

  const refri = await prisma.fridgeAsset.create({
    data: { brandId: brand.id, modelo: 'Metalfrio 12', serie: 'LPR-001', estado: 'activo' }
  });

  await prisma.fridgeAssignment.create({
    data: {
      brandId: brand.id,
      assetId: refri.id,
      customerId: cliente.id,
      ubicacion: 'Sucursal centro',
      entregadoEn: daysAgo(1),
      deposito: 1200,
      renta: 180
    }
  });

  await registrarVenta(brand.id, {
    items: [{ productId: heladoZarzamora.id, cantidad: 2 }],
    metodo: 'crédito',
    fecha: daysAgo(0),
    cashBoxId: caja.id,
    customerId: cliente.id,
    cajeroId,
    tipoVenta: 'MAYOREO',
    folioPrefix: 'LPR'
  });

  await prisma.productionPlan.create({
    data: {
      brandId: brand.id,
      fecha: daysAgo(1),
      notas: 'Plan inicial Las Purepechas',
      items: {
        create: [
          {
            productId: paletaLimon.id,
            nombre: 'Paleta artesanal Limón con sal',
            presentacion: 'pieza',
            cantidadBase: 15,
            cantidadAjuste: 0,
            cantidadAplicada: 15,
            orden: 0
          }
        ]
      }
    }
  });
}

async function main() {
  await resetData();
  const brands = await upsertBrands();

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

  await seedHelatte(brands.helatte, admin.id, cajero.id);
  await seedLasPurepechas(brands['las-purepechas'], cajero.id);

  console.log('Seed multi-marca listo', { admin: admin.email, brands: Object.keys(brands) });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
