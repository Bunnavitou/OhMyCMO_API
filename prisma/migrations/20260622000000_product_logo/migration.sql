-- Store optional product/service logo image reference.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "logo" JSONB;
