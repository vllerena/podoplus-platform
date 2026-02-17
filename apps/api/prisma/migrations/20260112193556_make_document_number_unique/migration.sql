/*
  Warnings:

  - A unique constraint covering the columns `[documentNumber]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Customer_documentNumber_key" ON "Customer"("documentNumber");
