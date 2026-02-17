-- CreateTable
CREATE TABLE "BranchScheduleException" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchScheduleException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BranchScheduleException_branchId_idx" ON "BranchScheduleException"("branchId");

-- CreateIndex
CREATE INDEX "BranchScheduleException_date_idx" ON "BranchScheduleException"("date");

-- CreateIndex
CREATE UNIQUE INDEX "BranchScheduleException_branchId_date_key" ON "BranchScheduleException"("branchId", "date");

-- AddForeignKey
ALTER TABLE "BranchScheduleException" ADD CONSTRAINT "BranchScheduleException_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchScheduleException" ADD CONSTRAINT "BranchScheduleException_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
