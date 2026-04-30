-- AlterTable
ALTER TABLE "CustomerSubscription" ADD COLUMN     "canceledAt" TIMESTAMP(3),
ADD COLUMN     "pausedAt" TIMESTAMP(3),
ADD COLUMN     "pausedReason" TEXT,
ADD COLUMN     "renewedFromId" TEXT;

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "color" TEXT;

-- AlterTable
ALTER TABLE "SubscriptionConsumption" ADD COLUMN     "notes" TEXT;

-- CreateIndex
CREATE INDEX "Plan_name_idx" ON "Plan"("name");
