-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mailBcc" TEXT,
ADD COLUMN     "mailFromName" TEXT,
ADD COLUMN     "mailHost" TEXT,
ADD COLUMN     "mailPassEnc" TEXT,
ADD COLUMN     "mailPort" INTEGER,
ADD COLUMN     "mailUser" TEXT;
