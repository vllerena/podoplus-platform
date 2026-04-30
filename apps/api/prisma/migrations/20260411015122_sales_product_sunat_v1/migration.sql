-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "hasIgv" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "igvAffectationCode" TEXT NOT NULL DEFAULT '10',
ADD COLUMN     "internalCode" TEXT,
ADD COLUMN     "sunatProductCode" TEXT,
ADD COLUMN     "unitTypeCode" TEXT NOT NULL DEFAULT 'NIU';

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "refundAmount" DECIMAL(12,2),
ADD COLUMN     "refundReason" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "refundedById" TEXT;

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Sale_refundedById_idx" ON "Sale"("refundedById");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_refundedById_fkey" FOREIGN KEY ("refundedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
