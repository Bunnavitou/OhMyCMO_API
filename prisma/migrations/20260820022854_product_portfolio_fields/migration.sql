-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "lastActivityAt" TIMESTAMP(3),
ADD COLUMN     "pmoOwnerId" TEXT,
ADD COLUMN     "staff" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "stage" TEXT NOT NULL DEFAULT 'Intake',
ADD COLUMN     "tasks" JSONB NOT NULL DEFAULT '[]';

-- CreateIndex
CREATE INDEX "Product_pmoOwnerId_idx" ON "Product"("pmoOwnerId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_pmoOwnerId_fkey" FOREIGN KEY ("pmoOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
