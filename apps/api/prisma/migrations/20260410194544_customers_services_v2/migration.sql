/*
  Warnings:

  - Added the required column `updatedAt` to the `ServiceBranchPrice` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "color" TEXT NOT NULL DEFAULT '#6B7280',
ADD COLUMN     "hasIgv" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "igvAffectationCode" TEXT NOT NULL DEFAULT '10',
ADD COLUMN     "imageData" BYTEA,
ADD COLUMN     "imageMimeType" TEXT,
ADD COLUMN     "internalCode" TEXT,
ADD COLUMN     "sunatProductCode" TEXT,
ADD COLUMN     "unitTypeCode" TEXT NOT NULL DEFAULT 'ZZ';

-- AlterTable
ALTER TABLE "ServiceBranchPrice" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_name_key" ON "ServiceCategory"("name");

-- CreateIndex
CREATE INDEX "ServiceCategory_order_idx" ON "ServiceCategory"("order");

-- CreateIndex
CREATE INDEX "Service_name_idx" ON "Service"("name");

-- CreateIndex
CREATE INDEX "Service_categoryId_idx" ON "Service"("categoryId");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
