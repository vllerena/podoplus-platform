/*
  Warnings:

  - You are about to drop the column `deletedAt` on the `User` table. All the data in the column will be lost.
  - Made the column `email` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "deletedAt",
ADD COLUMN     "avatarData" BYTEA,
ADD COLUMN     "avatarMimeType" TEXT,
ALTER COLUMN "email" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Appointment_branchId_status_startAt_idx" ON "Appointment"("branchId", "status", "startAt");

-- CreateIndex
CREATE INDEX "Appointment_customerId_startAt_idx" ON "Appointment"("customerId", "startAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_branchId_createdAt_idx" ON "AuditLog"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerSubscription_customerId_status_idx" ON "CustomerSubscription"("customerId", "status");

-- CreateIndex
CREATE INDEX "CustomerSubscription_status_endDate_idx" ON "CustomerSubscription"("status", "endDate");

-- CreateIndex
CREATE INDEX "Sale_branchId_createdAt_idx" ON "Sale"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_branchId_status_idx" ON "Sale"("branchId", "status");
