-- Regular check-ins (care proposal, feature 4): two nullable Customer
-- columns for the check-in rhythm and its owner. No existing row is changed.

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "careCadence" TEXT,
ADD COLUMN     "careOwnerId" TEXT;

-- CreateIndex
CREATE INDEX "Customer_ownerId_careOwnerId_idx" ON "Customer"("ownerId", "careOwnerId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_careOwnerId_fkey" FOREIGN KEY ("careOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
