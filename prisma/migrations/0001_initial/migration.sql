CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "ElectionType" AS ENUM ('LOK_SABHA','ASSEMBLY','OTHER');
CREATE TYPE "SourceStatus" AS ENUM ('DRAFT','REVIEWED','PUBLISHED');
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN','ADMIN','DATA_EDITOR');

CREATE TABLE "State" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "abbreviation" TEXT, "stateCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "State_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "State_name_key" ON "State"("name");

CREATE TABLE "Election" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "electionType" "ElectionType" NOT NULL,
  "year" INTEGER NOT NULL, "electionDate" TIMESTAMP(3), "description" TEXT,
  "sourceStatus" "SourceStatus" NOT NULL DEFAULT 'DRAFT', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Election_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Election_electionType_year_idx" ON "Election"("electionType","year");

CREATE TABLE "Constituency" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "stateId" UUID NOT NULL, "name" TEXT NOT NULL,
  "latitude" DECIMAL(10,7), "longitude" DECIMAL(10,7), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Constituency_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Constituency_stateId_name_idx" ON "Constituency"("stateId","name");
ALTER TABLE "Constituency" ADD CONSTRAINT "Constituency_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "State"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ConstituencyVersion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "constituencyId" UUID NOT NULL, "electionId" UUID NOT NULL,
  "name" TEXT NOT NULL, "constituencyNumber" INTEGER, "reservedCategory" TEXT, "delimitationVersion" TEXT,
  CONSTRAINT "ConstituencyVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConstituencyVersion_constituencyId_electionId_key" ON "ConstituencyVersion"("constituencyId","electionId");
CREATE INDEX "ConstituencyVersion_electionId_name_idx" ON "ConstituencyVersion"("electionId","name");
ALTER TABLE "ConstituencyVersion" ADD CONSTRAINT "ConstituencyVersion_constituencyId_fkey" FOREIGN KEY ("constituencyId") REFERENCES "Constituency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConstituencyVersion" ADD CONSTRAINT "ConstituencyVersion_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Party" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "abbreviation" TEXT, "symbolUrl" TEXT,
  "foundedYear" INTEGER, "dissolvedYear" INTEGER,
  CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Party_name_idx" ON "Party"("name");

CREATE TABLE "Candidate" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "gender" TEXT, "dateOfBirth" TIMESTAMP(3),
  "biography" TEXT, "photoUrl" TEXT,
  CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Candidate_name_idx" ON "Candidate"("name");

CREATE TABLE "CandidateResult" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "electionId" UUID NOT NULL, "constituencyVersionId" UUID NOT NULL,
  "candidateId" UUID NOT NULL, "partyId" UUID, "votes" INTEGER NOT NULL, "voteShare" DECIMAL(8,4),
  "position" INTEGER NOT NULL, "isWinner" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "CandidateResult_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CandidateResult_electionId_constituencyVersionId_candidateId_key" ON "CandidateResult"("electionId","constituencyVersionId","candidateId");
CREATE INDEX "CandidateResult_electionId_partyId_idx" ON "CandidateResult"("electionId","partyId");
CREATE INDEX "CandidateResult_constituencyVersionId_position_idx" ON "CandidateResult"("constituencyVersionId","position");
ALTER TABLE "CandidateResult" ADD CONSTRAINT "CandidateResult_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CandidateResult" ADD CONSTRAINT "CandidateResult_constituencyVersionId_fkey" FOREIGN KEY ("constituencyVersionId") REFERENCES "ConstituencyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CandidateResult" ADD CONSTRAINT "CandidateResult_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CandidateResult" ADD CONSTRAINT "CandidateResult_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ConstituencyStatistic" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "electionId" UUID NOT NULL, "constituencyVersionId" UUID NOT NULL,
  "electors" INTEGER, "votesPolled" INTEGER, "validVotes" INTEGER, "notaVotes" INTEGER,
  "turnoutPercentage" DECIMAL(8,4),
  CONSTRAINT "ConstituencyStatistic_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConstituencyStatistic_electionId_constituencyVersionId_key" ON "ConstituencyStatistic"("electionId","constituencyVersionId");
ALTER TABLE "ConstituencyStatistic" ADD CONSTRAINT "ConstituencyStatistic_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConstituencyStatistic" ADD CONSTRAINT "ConstituencyStatistic_constituencyVersionId_fkey" FOREIGN KEY ("constituencyVersionId") REFERENCES "ConstituencyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "DataSource" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "name" TEXT NOT NULL, "organization" TEXT, "url" TEXT,
  "publicationDate" TIMESTAMP(3), "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "sourceType" TEXT,
  CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ResultSource" (
  "resultId" UUID NOT NULL, "sourceId" UUID NOT NULL, CONSTRAINT "ResultSource_pkey" PRIMARY KEY ("resultId","sourceId")
);
ALTER TABLE "ResultSource" ADD CONSTRAINT "ResultSource_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "CandidateResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResultSource" ADD CONSTRAINT "ResultSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "User" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "email" TEXT NOT NULL, "passwordHash" TEXT, "role" "UserRole" NOT NULL DEFAULT 'DATA_EDITOR',
  "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE TABLE "Session" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "userId" UUID NOT NULL, "tokenHash" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId","expiresAt");
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "AuditLog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "userId" UUID, "action" TEXT NOT NULL, "entityType" TEXT NOT NULL, "entityId" TEXT,
  "oldValue" JSONB, "newValue" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType","entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
