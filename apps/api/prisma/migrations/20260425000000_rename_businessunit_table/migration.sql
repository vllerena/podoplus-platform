-- Rename table from snake_case to PascalCase, following the convention
-- used by all other models in this schema (no @@map = PascalCase table name).
ALTER TABLE "business_units" RENAME TO "BusinessUnit";
