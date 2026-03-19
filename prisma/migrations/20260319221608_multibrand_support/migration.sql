/*
  Warnings:

  - Added the required column `brandId` to the `CashBox` table without a default value. This is not possible if the table is not empty.
  - Added the required column `brandId` to the `CashMovement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `brandId` to the `Credit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `brandId` to the `Customer` table without a default value. This is not possible if the table is not empty.
  - Added the required column `brandId` to the `CustomerMovement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `brandId` to the `FinishedStockMovement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `brandId` to the `Flavor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `brandId` to the `FridgeAsset` table without a default value. This is not possible if the table is not empty.
  - Added the required column `brandId` to the `FridgeAssignment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `brandId` to the `FridgeVisit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `brandId` to the `Product` table without a default value. This is not possible if the table is not empty.
  - Added the required column `brandId` to the `ProductType` table without a default value. This is not possible if the table is not empty.
  - Added the required column `brandId` to the `ProductionPlan` table without a default value. This is not possible if the table is not empty.
  - Added the required column `brandId` to the `PromissoryNote` table without a default value. This is not possible if the table is not empty.
  - Added the required column `brandId` to the `RawMaterial` table without a default value. This is not possible if the table is not empty.
  - Added the required column `brandId` to the `RawMaterialMovement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `brandId` to the `Sale` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "Brand" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "subtitulo" TEXT,
    "logoPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CashBox" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "brandId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    CONSTRAINT "CashBox_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CashBox" ("id", "nombre", "tipo") SELECT "id", "nombre", "tipo" FROM "CashBox";
DROP TABLE "CashBox";
ALTER TABLE "new_CashBox" RENAME TO "CashBox";
CREATE INDEX "cashbox_brand_idx" ON "CashBox"("brandId");
CREATE TABLE "new_CashMovement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "brandId" INTEGER NOT NULL,
    "cashBoxId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" REAL NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashMovement_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CashMovement_cashBoxId_fkey" FOREIGN KEY ("cashBoxId") REFERENCES "CashBox" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CashMovement" ("cashBoxId", "concepto", "fecha", "id", "monto", "tipo") SELECT "cashBoxId", "concepto", "fecha", "id", "monto", "tipo" FROM "CashMovement";
DROP TABLE "CashMovement";
ALTER TABLE "new_CashMovement" RENAME TO "CashMovement";
CREATE INDEX "cashmovement_brand_idx" ON "CashMovement"("brandId");
CREATE INDEX "cashmovement_cashbox_idx" ON "CashMovement"("cashBoxId");
CREATE INDEX "cashmovement_fecha_idx" ON "CashMovement"("fecha");
CREATE TABLE "new_Credit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "brandId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "saldo" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Credit_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Credit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Credit" ("createdAt", "customerId", "id", "saldo") SELECT "createdAt", "customerId", "id", "saldo" FROM "Credit";
DROP TABLE "Credit";
ALTER TABLE "new_Credit" RENAME TO "Credit";
CREATE INDEX "credit_brand_idx" ON "Credit"("brandId");
CREATE INDEX "credit_customer_idx" ON "Credit"("customerId");
CREATE TABLE "new_Customer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "brandId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "telefono" TEXT,
    "limite" REAL NOT NULL DEFAULT 0,
    "saldo" REAL NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "permiteMayoreo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Customer_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Customer" ("estado", "id", "limite", "nombre", "permiteMayoreo", "saldo", "telefono") SELECT "estado", "id", "limite", "nombre", "permiteMayoreo", "saldo", "telefono" FROM "Customer";
DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";
CREATE INDEX "customer_brand_idx" ON "Customer"("brandId");
CREATE TABLE "new_CustomerMovement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "brandId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" REAL NOT NULL,
    "referencia" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerMovement_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CustomerMovement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_CustomerMovement" ("concepto", "createdAt", "customerId", "id", "monto", "referencia", "tipo") SELECT "concepto", "createdAt", "customerId", "id", "monto", "referencia", "tipo" FROM "CustomerMovement";
DROP TABLE "CustomerMovement";
ALTER TABLE "new_CustomerMovement" RENAME TO "CustomerMovement";
CREATE INDEX "customermovement_brand_idx" ON "CustomerMovement"("brandId");
CREATE INDEX "customermovement_customer_idx" ON "CustomerMovement"("customerId");
CREATE TABLE "new_FinishedStockMovement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "brandId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "referencia" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinishedStockMovement_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FinishedStockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FinishedStockMovement" ("cantidad", "createdAt", "id", "productId", "referencia", "tipo") SELECT "cantidad", "createdAt", "id", "productId", "referencia", "tipo" FROM "FinishedStockMovement";
DROP TABLE "FinishedStockMovement";
ALTER TABLE "new_FinishedStockMovement" RENAME TO "FinishedStockMovement";
CREATE INDEX "finishedstockmovement_brand_idx" ON "FinishedStockMovement"("brandId");
CREATE TABLE "new_Flavor" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "brandId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "color" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Flavor_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Flavor" ("activo", "color", "id", "nombre") SELECT "activo", "color", "id", "nombre" FROM "Flavor";
DROP TABLE "Flavor";
ALTER TABLE "new_Flavor" RENAME TO "Flavor";
CREATE INDEX "flavor_brand_idx" ON "Flavor"("brandId");
CREATE TABLE "new_FridgeAsset" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "brandId" INTEGER NOT NULL,
    "modelo" TEXT NOT NULL,
    "serie" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    CONSTRAINT "FridgeAsset_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FridgeAsset" ("estado", "id", "modelo", "serie") SELECT "estado", "id", "modelo", "serie" FROM "FridgeAsset";
DROP TABLE "FridgeAsset";
ALTER TABLE "new_FridgeAsset" RENAME TO "FridgeAsset";
CREATE INDEX "fridgeasset_brand_idx" ON "FridgeAsset"("brandId");
CREATE TABLE "new_FridgeAssignment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "brandId" INTEGER NOT NULL,
    "assetId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "ubicacion" TEXT NOT NULL,
    "entregadoEn" DATETIME NOT NULL,
    "fechaFin" DATETIME,
    "deposito" REAL,
    "renta" REAL,
    CONSTRAINT "FridgeAssignment_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FridgeAssignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FridgeAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FridgeAssignment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FridgeAssignment" ("assetId", "customerId", "deposito", "entregadoEn", "fechaFin", "id", "renta", "ubicacion") SELECT "assetId", "customerId", "deposito", "entregadoEn", "fechaFin", "id", "renta", "ubicacion" FROM "FridgeAssignment";
DROP TABLE "FridgeAssignment";
ALTER TABLE "new_FridgeAssignment" RENAME TO "FridgeAssignment";
CREATE INDEX "fridgeassignment_brand_idx" ON "FridgeAssignment"("brandId");
CREATE TABLE "new_FridgeVisit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "brandId" INTEGER NOT NULL,
    "assetId" INTEGER NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notas" TEXT,
    CONSTRAINT "FridgeVisit_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FridgeVisit_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FridgeAsset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FridgeVisit" ("assetId", "fecha", "id", "notas") SELECT "assetId", "fecha", "id", "notas" FROM "FridgeVisit";
DROP TABLE "FridgeVisit";
ALTER TABLE "new_FridgeVisit" RENAME TO "FridgeVisit";
CREATE INDEX "fridgevisit_brand_idx" ON "FridgeVisit"("brandId");
CREATE TABLE "new_Product" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "brandId" INTEGER NOT NULL,
    "sku" TEXT,
    "tipoId" INTEGER NOT NULL,
    "saborId" INTEGER NOT NULL,
    "presentacion" TEXT NOT NULL,
    "precio" REAL NOT NULL,
    "precioMayoreo" REAL,
    "costo" REAL NOT NULL,
    "foto" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Product_tipoId_fkey" FOREIGN KEY ("tipoId") REFERENCES "ProductType" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Product_saborId_fkey" FOREIGN KEY ("saborId") REFERENCES "Flavor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("activo", "costo", "foto", "id", "precio", "precioMayoreo", "presentacion", "saborId", "sku", "stock", "tipoId") SELECT "activo", "costo", "foto", "id", "precio", "precioMayoreo", "presentacion", "saborId", "sku", "stock", "tipoId" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE INDEX "product_brand_idx" ON "Product"("brandId");
CREATE UNIQUE INDEX "product_brand_sku_key" ON "Product"("brandId", "sku");
CREATE TABLE "new_ProductType" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "brandId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ProductType_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ProductType" ("activo", "id", "nombre") SELECT "activo", "id", "nombre" FROM "ProductType";
DROP TABLE "ProductType";
ALTER TABLE "new_ProductType" RENAME TO "ProductType";
CREATE INDEX "producttype_brand_idx" ON "ProductType"("brandId");
CREATE TABLE "new_ProductionPlan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "brandId" INTEGER NOT NULL,
    "fecha" DATETIME NOT NULL,
    "notas" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductionPlan_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ProductionPlan" ("createdAt", "fecha", "id", "notas", "updatedAt") SELECT "createdAt", "fecha", "id", "notas", "updatedAt" FROM "ProductionPlan";
DROP TABLE "ProductionPlan";
ALTER TABLE "new_ProductionPlan" RENAME TO "ProductionPlan";
CREATE INDEX "productionplan_brand_idx" ON "ProductionPlan"("brandId");
CREATE UNIQUE INDEX "productionplan_brand_fecha_key" ON "ProductionPlan"("brandId", "fecha");
CREATE TABLE "new_PromissoryNote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "brandId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "monto" REAL NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL DEFAULT 'vigente',
    CONSTRAINT "PromissoryNote_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PromissoryNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PromissoryNote" ("customerId", "estado", "fecha", "id", "monto") SELECT "customerId", "estado", "fecha", "id", "monto" FROM "PromissoryNote";
DROP TABLE "PromissoryNote";
ALTER TABLE "new_PromissoryNote" RENAME TO "PromissoryNote";
CREATE INDEX "promissorynote_brand_idx" ON "PromissoryNote"("brandId");
CREATE TABLE "new_RawMaterial" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "brandId" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidadId" INTEGER NOT NULL,
    "stock" REAL NOT NULL DEFAULT 0,
    "costoProm" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "RawMaterial_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RawMaterial_unidadId_fkey" FOREIGN KEY ("unidadId") REFERENCES "Unit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RawMaterial" ("costoProm", "id", "nombre", "stock", "unidadId") SELECT "costoProm", "id", "nombre", "stock", "unidadId" FROM "RawMaterial";
DROP TABLE "RawMaterial";
ALTER TABLE "new_RawMaterial" RENAME TO "RawMaterial";
CREATE INDEX "rawmaterial_brand_idx" ON "RawMaterial"("brandId");
CREATE TABLE "new_RawMaterialMovement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "brandId" INTEGER NOT NULL,
    "materialId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "cantidad" REAL NOT NULL,
    "costoTotal" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RawMaterialMovement_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RawMaterialMovement_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "RawMaterial" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RawMaterialMovement" ("cantidad", "costoTotal", "createdAt", "id", "materialId", "tipo") SELECT "cantidad", "costoTotal", "createdAt", "id", "materialId", "tipo" FROM "RawMaterialMovement";
DROP TABLE "RawMaterialMovement";
ALTER TABLE "new_RawMaterialMovement" RENAME TO "RawMaterialMovement";
CREATE INDEX "rawmaterialmovement_brand_idx" ON "RawMaterialMovement"("brandId");
CREATE TABLE "new_Sale" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "brandId" INTEGER NOT NULL,
    "folio" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cajeroId" INTEGER NOT NULL,
    "customerId" INTEGER,
    "tipoVenta" TEXT NOT NULL DEFAULT 'MOSTRADOR',
    "subtotal" REAL NOT NULL DEFAULT 0,
    "descuentoTipo" TEXT NOT NULL DEFAULT 'ninguno',
    "descuentoValor" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL,
    "pagoMetodo" TEXT NOT NULL,
    CONSTRAINT "Sale_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Sale_cajeroId_fkey" FOREIGN KEY ("cajeroId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Sale" ("cajeroId", "customerId", "descuentoTipo", "descuentoValor", "fecha", "folio", "id", "pagoMetodo", "subtotal", "tipoVenta", "total") SELECT "cajeroId", "customerId", "descuentoTipo", "descuentoValor", "fecha", "folio", "id", "pagoMetodo", "subtotal", "tipoVenta", "total" FROM "Sale";
DROP TABLE "Sale";
ALTER TABLE "new_Sale" RENAME TO "Sale";
CREATE INDEX "sale_brand_idx" ON "Sale"("brandId");
CREATE INDEX "sale_fecha_idx" ON "Sale"("fecha");
CREATE UNIQUE INDEX "sale_brand_folio_key" ON "Sale"("brandId", "folio");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "Brand"("slug");
