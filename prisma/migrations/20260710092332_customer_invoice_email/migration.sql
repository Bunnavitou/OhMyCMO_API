-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "billingEmail" TEXT,
ADD COLUMN     "emailCc" JSONB,
ADD COLUMN     "emailTemplate" JSONB;
