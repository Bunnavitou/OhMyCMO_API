-- AlterTable
ALTER TABLE "User" ADD COLUMN     "inChargeId" TEXT;

-- CreateIndex
CREATE INDEX "User_inChargeId_idx" ON "User"("inChargeId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_inChargeId_fkey" FOREIGN KEY ("inChargeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
