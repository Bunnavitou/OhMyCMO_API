-- CRM domain: customers, products, partners, campaigns, assets, files,
-- plus the customer audit log table.

CREATE TABLE "Customer" (
    "id"           TEXT NOT NULL,
    "ownerId"      TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "industry"     TEXT,
    "contact"      TEXT,
    "email"        TEXT,
    "phone"        TEXT,
    "address"      TEXT,
    "vatTin"       TEXT,
    "stage"        TEXT NOT NULL DEFAULT 'Prospect',
    "staff"        JSONB NOT NULL DEFAULT '[]',
    "tasks"        JSONB NOT NULL DEFAULT '[]',
    "taskGroups"   JSONB NOT NULL DEFAULT '[]',
    "files"        JSONB NOT NULL DEFAULT '[]',
    "productLinks" JSONB NOT NULL DEFAULT '[]',
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Customer_ownerId_idx" ON "Customer"("ownerId");
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CustomerLog" (
    "id"         TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "ts"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type"       TEXT NOT NULL,
    "message"    TEXT NOT NULL,
    "meta"       JSONB,
    CONSTRAINT "CustomerLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CustomerLog_customerId_idx" ON "CustomerLog"("customerId");
CREATE INDEX "CustomerLog_ts_idx" ON "CustomerLog"("ts");
ALTER TABLE "CustomerLog" ADD CONSTRAINT "CustomerLog_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Product" (
    "id"        TEXT NOT NULL,
    "ownerId"   TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "type"      TEXT NOT NULL DEFAULT 'Service',
    "price"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "income"    JSONB NOT NULL DEFAULT '[]',
    "expenses"  JSONB NOT NULL DEFAULT '[]',
    "assets"    JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Product_ownerId_idx" ON "Product"("ownerId");
ALTER TABLE "Product" ADD CONSTRAINT "Product_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Partner" (
    "id"         TEXT NOT NULL,
    "ownerId"    TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "company"    TEXT,
    "role"       TEXT,
    "email"      TEXT,
    "phone"      TEXT,
    "tasks"      JSONB NOT NULL DEFAULT '[]',
    "activities" JSONB NOT NULL DEFAULT '[]',
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Partner_ownerId_idx" ON "Partner"("ownerId");
ALTER TABLE "Partner" ADD CONSTRAINT "Partner_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Campaign" (
    "id"          TEXT NOT NULL,
    "ownerId"     TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "productId"   TEXT,
    "startDate"   TEXT,
    "endDate"     TEXT,
    "status"      TEXT NOT NULL DEFAULT 'Planning',
    "todos"       JSONB NOT NULL DEFAULT '[]',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Campaign_ownerId_idx" ON "Campaign"("ownerId");
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Asset" (
    "id"        TEXT NOT NULL,
    "ownerId"   TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "category"  TEXT,
    "assignee"  TEXT,
    "serial"    TEXT,
    "status"    TEXT NOT NULL DEFAULT 'In use',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Asset_ownerId_idx" ON "Asset"("ownerId");
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "File" (
    "id"          TEXT NOT NULL,
    "ownerId"     TEXT NOT NULL,
    "uploadedBy"  TEXT,
    "name"        TEXT NOT NULL,
    "mimeType"    TEXT NOT NULL,
    "size"        INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "entityType"  TEXT,
    "entityId"    TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "File_ownerId_idx" ON "File"("ownerId");
CREATE INDEX "File_entityType_entityId_idx" ON "File"("entityType", "entityId");
ALTER TABLE "File" ADD CONSTRAINT "File_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
