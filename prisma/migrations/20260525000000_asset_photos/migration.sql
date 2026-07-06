-- Multi-photo gallery attached to an asset (data-url entries serialized as JSON).
ALTER TABLE "Asset" ADD COLUMN "photos" JSONB NOT NULL DEFAULT '[]';
