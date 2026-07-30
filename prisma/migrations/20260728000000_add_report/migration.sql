-- CreateTable: WeBill365 usage reports (one row per account type per month).
CREATE TABLE "Report" (
    "id"        TEXT NOT NULL,
    "ownerId"   TEXT NOT NULL,
    "account"   TEXT NOT NULL,
    "year"      INTEGER NOT NULL,
    "month"     INTEGER NOT NULL,
    "data"      JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Report_ownerId_idx" ON "Report"("ownerId");

ALTER TABLE "Report" ADD CONSTRAINT "Report_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
