-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "logs" JSONB NOT NULL DEFAULT '[]';
