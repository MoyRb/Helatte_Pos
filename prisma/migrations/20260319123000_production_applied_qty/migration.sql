ALTER TABLE "ProductionPlanItem" ADD COLUMN "cantidadAplicada" INTEGER NOT NULL DEFAULT 0;

UPDATE "ProductionPlanItem"
SET "cantidadAplicada" = CASE
  WHEN ("cantidadBase" + "cantidadAjuste") > 0 THEN ("cantidadBase" + "cantidadAjuste")
  ELSE 0
END;
