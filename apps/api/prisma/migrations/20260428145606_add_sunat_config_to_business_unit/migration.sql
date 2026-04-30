-- AlterTable: add SUNAT integration fields to BusinessUnit
ALTER TABLE "BusinessUnit"
  ADD COLUMN "sunatEndpoint" VARCHAR(500),
  ADD COLUMN "sunatToken"    VARCHAR(500);
