-- Store a bare filename in File.storagePath instead of an absolute path.
--
-- It previously held whatever absolute path multer wrote to, which describes
-- the machine rather than the file. Rows uploaded on a developer's laptop
-- recorded /Users/<someone>/Desktop/OhMyCMO/OhMyCMO_API/uploads/<name>, so once
-- the database moved into a container every one of them answered 404 — the
-- bytes were present under /app/uploads, just not where the row pointed.
--
-- The filename is kept as-is and only the directory is dropped; the API now
-- resolves it against FILE_STORAGE_DIR at read time. Rows already holding a
-- bare filename are left alone, so this is safe to re-run.
UPDATE "File"
SET "storagePath" = regexp_replace("storagePath", '^.*/', '')
WHERE "storagePath" LIKE '%/%';
