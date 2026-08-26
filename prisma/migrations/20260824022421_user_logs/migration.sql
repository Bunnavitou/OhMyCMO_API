-- AlterTable
ALTER TABLE "User" ADD COLUMN     "logs" JSONB NOT NULL DEFAULT '[]';
