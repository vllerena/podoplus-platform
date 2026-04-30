-- AlterTable: add electronic billing fields to Sale
ALTER TABLE "Sale"
  ADD COLUMN "tipoComprobante"     TEXT,
  ADD COLUMN "serieDocumento"      TEXT,
  ADD COLUMN "numeroDocumento"     TEXT,
  ADD COLUMN "billingTipoDoc"      TEXT,
  ADD COLUMN "billingNumDoc"       TEXT,
  ADD COLUMN "billingRazonSocial"  TEXT,
  ADD COLUMN "billingDireccion"    TEXT,
  ADD COLUMN "billingEmail"        TEXT,
  ADD COLUMN "billingTelefono"     TEXT,
  ADD COLUMN "billingUbigeo"       TEXT,
  ADD COLUMN "sunatExternalId"     TEXT,
  ADD COLUMN "sunatFilename"       TEXT,
  ADD COLUMN "sunatStateTypeId"    TEXT,
  ADD COLUMN "sunatStateDesc"      TEXT,
  ADD COLUMN "sunatHash"           TEXT,
  ADD COLUMN "sunatPrintTicketUrl" TEXT,
  ADD COLUMN "sunatPrintA4Url"     TEXT,
  ADD COLUMN "sunatPdfUrl"         TEXT,
  ADD COLUMN "sunatXmlUrl"         TEXT,
  ADD COLUMN "sunatCdrUrl"         TEXT,
  ADD COLUMN "sunatResponseCode"   TEXT,
  ADD COLUMN "sunatResponseDesc"   TEXT,
  ADD COLUMN "sunatEmittedAt"      TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Sale_serieDocumento_idx" ON "Sale"("serieDocumento");
CREATE INDEX "Sale_numeroDocumento_idx" ON "Sale"("numeroDocumento");

-- AlterTable: add SUNAT fields to SaleItem
ALTER TABLE "SaleItem"
  ADD COLUMN "igvAffectationCode" TEXT,
  ADD COLUMN "sunatProductCode"   TEXT,
  ADD COLUMN "unitTypeCode"       TEXT;
