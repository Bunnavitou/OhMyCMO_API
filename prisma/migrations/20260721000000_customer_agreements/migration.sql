-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "agreements" JSONB NOT NULL DEFAULT '[]';
