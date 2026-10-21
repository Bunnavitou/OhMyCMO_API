-- Customer notes: one nullable column for free text about the account. No
-- existing row is changed.

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "notes" TEXT;
