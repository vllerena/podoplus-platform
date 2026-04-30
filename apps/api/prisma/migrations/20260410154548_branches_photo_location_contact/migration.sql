/*
  Warnings:

  - You are about to drop the column `deletedAt` on the `Branch` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Branch" DROP COLUMN "deletedAt",
ADD COLUMN     "email" TEXT,
ADD COLUMN     "googleMapsUrl" TEXT,
ADD COLUMN     "latitude" DECIMAL(10,7),
ADD COLUMN     "longitude" DECIMAL(10,7),
ADD COLUMN     "photoData" BYTEA,
ADD COLUMN     "photoMimeType" TEXT;
