import { PrismaClient } from '@prisma/client';

process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'file:./prisma/helatte.db';
const prisma = new PrismaClient();

type BrandSeedContext = {
  slug: string;
  nombre: string;
  subtitulo: string;
  logoPath: string;
};

const BASE_BRANDS: BrandSeedContext[] = [
  {
    slug: 'helatte',
    nombre: 'Helatte',
    subtitulo: 'Nevería & Paletería',
    logoPath: 'brands/helatte-logo.svg'
  },
  {
    slug: 'las-purepechas',
    nombre: 'Las Purepechas',
    subtitulo: 'Base para helado y aguas frescas',
    logoPath: 'brands/las-purepechas-logo.svg'
  }
];

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
  await prisma.brand.deleteMany();
}

async function seedBaseBrands() {
  for (const brand of BASE_BRANDS) {
    await prisma.brand.create({ data: brand });
  }

  return prisma.brand.findMany({
    where: { slug: { in: BASE_BRANDS.map((brand) => brand.slug) } },
    orderBy: { id: 'asc' }
  });
}

async function seedAdminUser() {
  return prisma.user.create({
    data: {
      email: 'admin@helatte.local',
      nombre: 'Admin',
      password: 'admin123',
      role: 'ADMIN'
    }
  });
}

async function main() {
  await resetData();
  const brands = await seedBaseBrands();
  const admin = await seedAdminUser();

  console.log('Seed base listo', {
    admin: admin.email,
    brands: brands.map((brand) => brand.slug),
    operationalData: {
      productTypes: 0,
      flavors: 0,
      products: 0,
      units: 0,
      rawMaterials: 0,
      customers: 0,
      sales: 0,
      productionPlans: 0,
      fridgeAssets: 0,
      credits: 0,
      cashBoxes: 0
    }
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
