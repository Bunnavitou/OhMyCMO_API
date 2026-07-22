-- CreateTable
CREATE TABLE "PartnerLog" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "meta" JSONB,

    CONSTRAINT "PartnerLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerLog_partnerId_idx" ON "PartnerLog"("partnerId");

-- CreateIndex
CREATE INDEX "PartnerLog_ts_idx" ON "PartnerLog"("ts");

-- AddForeignKey
ALTER TABLE "PartnerLog" ADD CONSTRAINT "PartnerLog_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
