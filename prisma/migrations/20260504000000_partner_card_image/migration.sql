-- Store scanned partner name-card image metadata and preview data.
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "cardImage" JSONB;
