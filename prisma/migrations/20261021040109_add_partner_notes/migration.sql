-- Business card notes: one nullable Partner column for free text (who they
-- are, the business purpose). No existing row is changed.

-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "notes" TEXT;
