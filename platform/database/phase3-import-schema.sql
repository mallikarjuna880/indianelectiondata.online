-- Phase 3 staging tables. Apply after the existing Prisma migration.
-- These tables intentionally do not mutate public CandidateResult rows until approval/publish.

CREATE TYPE "ImportBatchStatus" AS ENUM ('UPLOADED','VALIDATING','VALIDATED','REVIEWED','REJECTED','PUBLISHED');

CREATE TABLE "ImportBatch" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "filename" text NOT NULL,
  "sourceId" uuid NOT NULL REFERENCES "DataSource"("id"),
  "uploadedBy" uuid NOT NULL REFERENCES "User"("id"),
  "status" "ImportBatchStatus" NOT NULL DEFAULT 'UPLOADED',
  "totalRows" integer NOT NULL DEFAULT 0,
  "validRows" integer NOT NULL DEFAULT 0,
  "errorRows" integer NOT NULL DEFAULT 0,
  "reviewedBy" uuid REFERENCES "User"("id"),
  "reviewedAt" timestamptz,
  "publishedBy" uuid REFERENCES "User"("id"),
  "publishedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "ImportRow" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "batchId" uuid NOT NULL REFERENCES "ImportBatch"("id") ON DELETE CASCADE,
  "rowNumber" integer NOT NULL,
  "payload" jsonb NOT NULL,
  "valid" boolean NOT NULL DEFAULT false,
  "errors" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("batchId", "rowNumber")
);

CREATE INDEX "ImportBatch_status_createdAt_idx" ON "ImportBatch"("status", "createdAt");
CREATE INDEX "ImportRow_batchId_valid_idx" ON "ImportRow"("batchId", "valid");

ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "requestId" text;
CREATE INDEX IF NOT EXISTS "AuditLog_requestId_idx" ON "AuditLog"("requestId");
