-- Phase 1 production hardening
-- Generated to align PostgreSQL with platform/prisma/schema.prisma.

CREATE TYPE "ElectionScope" AS ENUM ('GENERAL', 'BY_ELECTION', 'OTHER');
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'REVIEWED', 'APPROVED', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED', 'PARSING', 'VALIDATING', 'VALID', 'INVALID', 'REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED');
CREATE TYPE "ValidationSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR');
CREATE TYPE "DuplicateStatus" AS ENUM ('OPEN', 'ACCEPTED', 'REJECTED', 'MERGED');
CREATE TYPE "SourceType" AS ENUM ('ECI', 'CEO', 'GOVERNMENT', 'DOCUMENT', 'DATASET', 'OTHER');
CREATE TYPE "JurisdictionType" AS ENUM ('LOK_SABHA', 'ASSEMBLY', 'OTHER');

ALTER TABLE "Election" ADD COLUMN "electionScope" "ElectionScope" NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "Election" ADD COLUMN "electionNumber" INTEGER;
ALTER TABLE "Election" ADD COLUMN "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT';
CREATE UNIQUE INDEX "Election_electionType_year_electionNumber_key" ON "Election"("electionType", "year", "electionNumber");

ALTER TABLE "State" ADD COLUMN "stateType" TEXT;
ALTER TABLE "State" ADD COLUMN "validFrom" TIMESTAMP(3);
ALTER TABLE "State" ADD COLUMN "validTo" TIMESTAMP(3);
CREATE INDEX "State_stateCode_idx" ON "State"("stateCode");

CREATE TABLE "StateAlias" (
  "id" UUID NOT NULL,
  "stateId" UUID NOT NULL,
  "alias" TEXT NOT NULL,
  CONSTRAINT "StateAlias_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "StateAlias_stateId_alias_key" ON "StateAlias"("stateId", "alias");
CREATE INDEX "StateAlias_alias_idx" ON "StateAlias"("alias");
ALTER TABLE "StateAlias" ADD CONSTRAINT "StateAlias_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Constituency" ADD COLUMN "jurisdiction" "JurisdictionType" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "Constituency" ADD COLUMN "officialCode" TEXT;
DROP INDEX IF EXISTS "Constituency_stateId_name_idx";
CREATE UNIQUE INDEX "Constituency_stateId_name_jurisdiction_key" ON "Constituency"("stateId", "name", "jurisdiction");
CREATE INDEX "Constituency_stateId_jurisdiction_idx" ON "Constituency"("stateId", "jurisdiction");
CREATE INDEX "Constituency_officialCode_idx" ON "Constituency"("officialCode");

ALTER TABLE "ConstituencyVersion" ADD COLUMN "delimitationOrder" TEXT;
ALTER TABLE "ConstituencyVersion" ADD COLUMN "validFrom" TIMESTAMP(3);
ALTER TABLE "ConstituencyVersion" ADD COLUMN "validTo" TIMESTAMP(3);
CREATE INDEX "ConstituencyVersion_delimitationVersion_idx" ON "ConstituencyVersion"("delimitationVersion");

CREATE TABLE "PartyAlias" (
  "id" UUID NOT NULL,
  "partyId" UUID NOT NULL,
  "alias" TEXT NOT NULL,
  CONSTRAINT "PartyAlias_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PartyAlias_partyId_alias_key" ON "PartyAlias"("partyId", "alias");
CREATE INDEX "PartyAlias_alias_idx" ON "PartyAlias"("alias");
ALTER TABLE "PartyAlias" ADD CONSTRAINT "PartyAlias_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PartyExternalId" (
  "id" UUID NOT NULL,
  "partyId" UUID NOT NULL,
  "sourceName" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  CONSTRAINT "PartyExternalId_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PartyExternalId_sourceName_externalId_key" ON "PartyExternalId"("sourceName", "externalId");
ALTER TABLE "PartyExternalId" ADD CONSTRAINT "PartyExternalId_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PartyHistory" (
  "id" UUID NOT NULL,
  "partyId" UUID NOT NULL,
  "name" TEXT,
  "abbreviation" TEXT,
  "symbolUrl" TEXT,
  "validFrom" TIMESTAMP(3),
  "validTo" TIMESTAMP(3),
  "notes" TEXT,
  CONSTRAINT "PartyHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PartyHistory_partyId_validFrom_idx" ON "PartyHistory"("partyId", "validFrom");
ALTER TABLE "PartyHistory" ADD CONSTRAINT "PartyHistory_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Candidate" ADD COLUMN "normalizedName" TEXT NOT NULL DEFAULT '';
CREATE INDEX "Candidate_normalizedName_idx" ON "Candidate"("normalizedName");

CREATE TABLE "CandidateAlias" (
  "id" UUID NOT NULL,
  "candidateId" UUID NOT NULL,
  "alias" TEXT NOT NULL,
  CONSTRAINT "CandidateAlias_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CandidateAlias_candidateId_alias_key" ON "CandidateAlias"("candidateId", "alias");
CREATE INDEX "CandidateAlias_alias_idx" ON "CandidateAlias"("alias");
ALTER TABLE "CandidateAlias" ADD CONSTRAINT "CandidateAlias_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CandidateExternalId" (
  "id" UUID NOT NULL,
  "candidateId" UUID NOT NULL,
  "sourceName" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  CONSTRAINT "CandidateExternalId_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CandidateExternalId_sourceName_externalId_key" ON "CandidateExternalId"("sourceName", "externalId");
ALTER TABLE "CandidateExternalId" ADD CONSTRAINT "CandidateExternalId_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "CandidateResult_constituencyVersionId_position_idx" ON "CandidateResult"("constituencyVersionId", "position");
CREATE INDEX "CandidateResult_candidateId_idx" ON "CandidateResult"("candidateId");
ALTER TABLE "CandidateResult" ADD CONSTRAINT "CandidateResult_votes_check" CHECK ("votes" >= 0);
ALTER TABLE "CandidateResult" ADD CONSTRAINT "CandidateResult_position_check" CHECK ("position" >= 1);
ALTER TABLE "CandidateResult" ADD CONSTRAINT "CandidateResult_voteShare_check" CHECK ("voteShare" IS NULL OR ("voteShare" >= 0 AND "voteShare" <= 100));

ALTER TABLE "ConstituencyStatistic" ADD COLUMN "rejectedVotes" INTEGER;
ALTER TABLE "ConstituencyStatistic" ADD COLUMN "postalVotes" INTEGER;
ALTER TABLE "ConstituencyStatistic" ADD COLUMN "ePostalVotes" INTEGER;
ALTER TABLE "ConstituencyStatistic" ADD CONSTRAINT "ConstituencyStatistic_nonnegative_check" CHECK (
  ("electors" IS NULL OR "electors" >= 0) AND
  ("votesPolled" IS NULL OR "votesPolled" >= 0) AND
  ("validVotes" IS NULL OR "validVotes" >= 0) AND
  ("notaVotes" IS NULL OR "notaVotes" >= 0) AND
  ("rejectedVotes" IS NULL OR "rejectedVotes" >= 0) AND
  ("postalVotes" IS NULL OR "postalVotes" >= 0) AND
  ("ePostalVotes" IS NULL OR "ePostalVotes" >= 0) AND
  ("turnoutPercentage" IS NULL OR ("turnoutPercentage" >= 0 AND "turnoutPercentage" <= 100))
);

ALTER TABLE "DataSource" ADD COLUMN "documentUrl" TEXT;
ALTER TABLE "DataSource" ADD COLUMN "sourceType" "SourceType" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "DataSource" ADD COLUMN "checksum" TEXT;
ALTER TABLE "DataSource" ADD COLUMN "notes" TEXT;
CREATE INDEX "DataSource_organization_idx" ON "DataSource"("organization");
CREATE INDEX "DataSource_sourceType_idx" ON "DataSource"("sourceType");

CREATE TABLE "SourceDocument" (
  "id" UUID NOT NULL,
  "sourceId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "documentUrl" TEXT,
  "checksum" TEXT,
  "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SourceDocument_sourceId_idx" ON "SourceDocument"("sourceId");
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ImportBatch" (
  "id" UUID NOT NULL,
  "filename" TEXT NOT NULL,
  "fileHash" TEXT NOT NULL,
  "electionId" UUID,
  "sourceId" UUID,
  "status" "ImportStatus" NOT NULL DEFAULT 'UPLOADED',
  "uploadedById" UUID,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ImportBatch_fileHash_key" ON "ImportBatch"("fileHash");
CREATE INDEX "ImportBatch_electionId_status_idx" ON "ImportBatch"("electionId", "status");
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ImportRow" (
  "id" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "rawData" JSONB NOT NULL,
  "normalizedData" JSONB,
  "status" "ImportStatus" NOT NULL DEFAULT 'UPLOADED',
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ImportRow_batchId_rowNumber_key" ON "ImportRow"("batchId", "rowNumber");
CREATE INDEX "ImportRow_batchId_status_idx" ON "ImportRow"("batchId", "status");
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ValidationError" (
  "id" UUID NOT NULL,
  "importRowId" UUID NOT NULL,
  "ruleCode" TEXT NOT NULL,
  "severity" "ValidationSeverity" NOT NULL DEFAULT 'ERROR',
  "field" TEXT,
  "message" TEXT NOT NULL,
  "details" JSONB,
  CONSTRAINT "ValidationError_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ValidationError_importRowId_severity_idx" ON "ValidationError"("importRowId", "severity");
ALTER TABLE "ValidationError" ADD CONSTRAINT "ValidationError_importRowId_fkey" FOREIGN KEY ("importRowId") REFERENCES "ImportRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "DuplicateCandidate" (
  "id" UUID NOT NULL,
  "importRowId" UUID NOT NULL,
  "existingCandidateId" UUID,
  "confidence" DECIMAL(6,5),
  "reason" TEXT NOT NULL,
  "status" "DuplicateStatus" NOT NULL DEFAULT 'OPEN',
  CONSTRAINT "DuplicateCandidate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DuplicateCandidate_status_idx" ON "DuplicateCandidate"("status");
ALTER TABLE "DuplicateCandidate" ADD CONSTRAINT "DuplicateCandidate_importRowId_fkey" FOREIGN KEY ("importRowId") REFERENCES "ImportRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DuplicateCandidate" ADD CONSTRAINT "DuplicateCandidate_existingCandidateId_fkey" FOREIGN KEY ("existingCandidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "DuplicateResult" (
  "id" UUID NOT NULL,
  "importRowId" UUID NOT NULL,
  "existingResultId" UUID,
  "confidence" DECIMAL(6,5),
  "reason" TEXT NOT NULL,
  "status" "DuplicateStatus" NOT NULL DEFAULT 'OPEN',
  CONSTRAINT "DuplicateResult_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DuplicateResult_status_idx" ON "DuplicateResult"("status");
ALTER TABLE "DuplicateResult" ADD CONSTRAINT "DuplicateResult_importRowId_fkey" FOREIGN KEY ("importRowId") REFERENCES "ImportRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DuplicateResult" ADD CONSTRAINT "DuplicateResult_existingResultId_fkey" FOREIGN KEY ("existingResultId") REFERENCES "CandidateResult"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PublicationVersion" (
  "id" UUID NOT NULL,
  "electionId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "createdById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  CONSTRAINT "PublicationVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PublicationVersion_electionId_version_key" ON "PublicationVersion"("electionId", "version");
CREATE INDEX "PublicationVersion_electionId_status_idx" ON "PublicationVersion"("electionId", "status");
ALTER TABLE "PublicationVersion" ADD CONSTRAINT "PublicationVersion_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicationVersion" ADD CONSTRAINT "PublicationVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
