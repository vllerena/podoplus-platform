-- Replace String logo/banner with binary storage (consistent with Branch.photoData pattern)
ALTER TABLE "BusinessUnit" DROP COLUMN IF EXISTS "logo";
ALTER TABLE "BusinessUnit" DROP COLUMN IF EXISTS "banner";
ALTER TABLE "BusinessUnit" ADD COLUMN "logoData"       BYTEA;
ALTER TABLE "BusinessUnit" ADD COLUMN "logoMimeType"   VARCHAR(50);
ALTER TABLE "BusinessUnit" ADD COLUMN "bannerData"     BYTEA;
ALTER TABLE "BusinessUnit" ADD COLUMN "bannerMimeType" VARCHAR(50);
