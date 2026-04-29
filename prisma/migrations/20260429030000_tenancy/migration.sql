-- Tenancy: owners (email) and sub-users (username, owned by an owner).

-- Allow email to be null (sub-users have only username).
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- New columns.
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "User" ADD COLUMN "permissions" JSONB;

-- Unique on username (multiple NULLs allowed by Postgres default).
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Index for tenant lookups.
CREATE INDEX "User_ownerId_idx" ON "User"("ownerId");

-- Self-FK; cascade so removing an owner removes their sub-users.
ALTER TABLE "User"
  ADD CONSTRAINT "User_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
