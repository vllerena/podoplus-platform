-- DropIndex
DROP INDEX "Customer_documentNumber_key";

-- DropIndex
DROP INDEX "Customer_phone_key";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "familyHeadId" TEXT,
ALTER COLUMN "documentType" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_familyHeadId_idx" ON "Customer"("familyHeadId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_familyHeadId_fkey" FOREIGN KEY ("familyHeadId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
