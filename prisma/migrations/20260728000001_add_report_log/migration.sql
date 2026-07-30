-- CreateTable
CREATE TABLE "ReportLog" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "reportId" TEXT,
    "actorId" TEXT NOT NULL,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "account" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "meta" JSONB,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportLog_ownerId_idx" ON "ReportLog"("ownerId");

-- CreateIndex
CREATE INDEX "ReportLog_ts_idx" ON "ReportLog"("ts");

-- AddForeignKey
ALTER TABLE "ReportLog" ADD CONSTRAINT "ReportLog_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
