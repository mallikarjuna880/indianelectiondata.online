-- Phase 3: staged election-data import, review and publishing
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED','VALIDATED','IN_REVIEW','APPROVED','PUBLISHED','REJECTED');

ALTER TABLE "Election" ADD COLUMN "importBatches" TEXT;
ALTER TABLE "DataSource" ADD COLUMN "importBatches" TEXT;
ALTER TABLE "User" ADD COLUMN "imports" TEXT;
ALTER TABLE "User" ADD COLUMN "reviews" TEXT;

CREATE TABLE "ImportBatch" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "filename" TEXT NOT NULL,
  "fileType" TEXT NOT NULL,
  "status" "ImportStatus" NOT NULL DEFAULT 'UPLOADED',
  "electionId" UUID,
  "sourceId" UUID,
  "uploadedById" UUID NOT NULL,
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "validRows" INTEGER NOT NULL DEFAULT 0,
  "errorRows" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validatedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImportBatch_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ImportBatch_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ImportBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ImportBatch_status_uploadedAt_idx" ON "ImportBatch"("status", "uploadedAt");

CREATE TABLE "ImportRow" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "batchId" UUID NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "errors" JSONB,
  "normalized" JSONB,
  CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ImportRow_batchId_rowNumber_key" ON "ImportRow"("batchId", "rowNumber");
CREATE INDEX "ImportRow_batchId_status_idx" ON "ImportRow"("batchId", "status");

CREATE TABLE "ImportReview" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "batchId" UUID NOT NULL,
  "reviewerId" UUID NOT NULL,
  "decision" TEXT NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImportReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImportReview_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ImportReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ImportReview_batchId_createdAt_idx" ON "ImportReview"("batchId", "createdAt");

-- Prisma relation fields are virtual; remove placeholder columns if this migration
-- is applied to an existing database generated from the prior schema.
ALTER TABLE "Election" DROP COLUMN "importBatches";
ALTER TABLE "DataSource" DROP COLUMN "importBatches";
ALTER TABLE "User" DROP COLUMN "imports";
ALTER TABLE "User" DROP COLUMN "reviews";
