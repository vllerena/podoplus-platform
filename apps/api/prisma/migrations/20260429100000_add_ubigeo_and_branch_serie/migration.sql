-- AlterTable: add ubigeo to Branch
ALTER TABLE "Branch" ADD COLUMN "ubigeo" VARCHAR(10);

-- CreateTable: BranchSerie
CREATE TABLE "BranchSerie" (
    "id"            TEXT         NOT NULL,
    "branchId"      TEXT         NOT NULL,
    "tipoDocumento" VARCHAR(10)  NOT NULL,
    "serie"         VARCHAR(10)  NOT NULL,
    "contingencia"  BOOLEAN      NOT NULL DEFAULT false,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchSerie_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BranchSerie_branchId_serie_key" ON "BranchSerie"("branchId", "serie");
CREATE INDEX "BranchSerie_branchId_idx" ON "BranchSerie"("branchId");

-- AddForeignKey
ALTER TABLE "BranchSerie" ADD CONSTRAINT "BranchSerie_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
