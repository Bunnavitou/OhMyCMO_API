-- Customer groups: optional buckets (e.g. "Strategic", "SMB", "Q4 launch").
-- Each group is tenant-scoped; deleting the group nulls out customer.groupId.

CREATE TABLE "CustomerGroup" (
    "id"        TEXT NOT NULL,
    "ownerId"   TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "color"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerGroup_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CustomerGroup_ownerId_idx" ON "CustomerGroup"("ownerId");
ALTER TABLE "CustomerGroup" ADD CONSTRAINT "CustomerGroup_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Customer" ADD COLUMN "groupId" TEXT;
CREATE INDEX "Customer_groupId_idx" ON "Customer"("groupId");
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "CustomerGroup"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
