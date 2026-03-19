-- CreateTable
CREATE TABLE "ProductionPlan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fecha" DATETIME NOT NULL,
    "notas" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProductionPlanItem" (
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
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionPlan_fecha_key" ON "ProductionPlan"("fecha");

-- CreateIndex
CREATE INDEX "productionplanitem_plan_idx" ON "ProductionPlanItem"("planId");

-- CreateIndex
CREATE INDEX "productionplanitem_product_idx" ON "ProductionPlanItem"("productId");
