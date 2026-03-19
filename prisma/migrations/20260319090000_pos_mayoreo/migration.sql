ALTER TABLE "Product" ADD COLUMN "precioMayoreo" REAL;

ALTER TABLE "Customer" ADD COLUMN "permiteMayoreo" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Sale" ADD COLUMN "customerId" INTEGER;
ALTER TABLE "Sale" ADD COLUMN "tipoVenta" TEXT NOT NULL DEFAULT 'MOSTRADOR';
ALTER TABLE "Sale" ADD COLUMN "subtotal" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Sale" ADD COLUMN "descuentoTipo" TEXT NOT NULL DEFAULT 'ninguno';
ALTER TABLE "Sale" ADD COLUMN "descuentoValor" REAL NOT NULL DEFAULT 0;

UPDATE "Sale"
SET
  "subtotal" = "total",
  "descuentoTipo" = 'ninguno',
  "descuentoValor" = 0,
  "tipoVenta" = CASE WHEN "pagoMetodo" = 'crédito' THEN 'MAYOREO' ELSE 'MOSTRADOR' END;

ALTER TABLE "SaleItem" ADD COLUMN "subtotalLinea" REAL NOT NULL DEFAULT 0;

UPDATE "SaleItem"
SET "subtotalLinea" = "precio" * "cantidad";
