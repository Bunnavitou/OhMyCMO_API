-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tasks" JSONB NOT NULL DEFAULT '[]';
