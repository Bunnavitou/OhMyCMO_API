-- Sales planner phase 1 (PHASE-1-ACTIVITIES.md): new Sale and Activity tables,
-- plus two nullable columns on Partner linking a prospect to the customer it
-- became. No existing row is changed.

-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "convertedAt" TIMESTAMP(3),
ADD COLUMN     "customerId" TEXT;

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "saleAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'New',
    "channel" TEXT,
    "dueDate" DATE,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "userId" TEXT,
    "customerId" TEXT,
    "partnerId" TEXT,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'New',
    "dueDate" DATE,
    "doneAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sale_ownerId_saleAt_idx" ON "Sale"("ownerId", "saleAt");

-- CreateIndex
CREATE INDEX "Sale_ownerId_userId_saleAt_idx" ON "Sale"("ownerId", "userId", "saleAt");

-- CreateIndex
CREATE INDEX "Sale_ownerId_status_dueDate_idx" ON "Sale"("ownerId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");

-- CreateIndex
CREATE INDEX "Sale_partnerId_idx" ON "Sale"("partnerId");

-- CreateIndex
CREATE INDEX "Activity_saleId_position_idx" ON "Activity"("saleId", "position");

-- CreateIndex
CREATE INDEX "Activity_ownerId_dueDate_idx" ON "Activity"("ownerId", "dueDate");

-- CreateIndex
CREATE INDEX "Activity_ownerId_assigneeId_dueDate_idx" ON "Activity"("ownerId", "assigneeId", "dueDate");

-- CreateIndex
CREATE INDEX "Activity_ownerId_type_doneAt_idx" ON "Activity"("ownerId", "type", "doneAt");

-- CreateIndex
CREATE UNIQUE INDEX "Partner_customerId_key" ON "Partner"("customerId");

-- AddForeignKey
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- A sale is with a customer, a prospect (Partner), or — after the prospect
-- converts — both; never neither.
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customer_or_partner_check"
  CHECK ("customerId" IS NOT NULL OR "partnerId" IS NOT NULL);
