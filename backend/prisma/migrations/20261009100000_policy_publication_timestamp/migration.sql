ALTER TABLE "PolicyVersion"
  ADD COLUMN "publishedAt" TIMESTAMP(3);

UPDATE "PolicyVersion"
SET "publishedAt" = "createdAt"
WHERE "status" = 'published';
