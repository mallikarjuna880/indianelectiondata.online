# Indian Election Data — Phase 1 + Phase 2

This branch implements the working backend foundation for `indianelectiondata.online`:

- PostgreSQL 16 via Docker
- Prisma ORM and an initial migration
- Normalized election data model with historical constituency versions
- Source/provenance relationships for published results
- TypeScript + Fastify REST API
- Pagination, filtering, search and UUID validation
- Election, constituency, candidate, party and state endpoints
- Constituency history endpoint
- Vote-share, seat-trend and turnout analytics endpoints
- Database health check
- Development seed dataset (synthetic only)

The frontend, admin authentication, CSV/XLSX import, review/approval workflow, maps and production historical datasets are intentionally **not** part of Phase 1 + Phase 2.

## Requirements

- Node.js 20+
- Docker Desktop
- npm 10+

## Run locally

```bash
npm install
cp .env.example .env
docker compose up -d postgres
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
npm run dev
```

API: `http://localhost:4000`

Health check:

```text
GET /health
```

## API

### Elections

```text
GET /api/v1/elections
GET /api/v1/elections/:id
GET /api/v1/elections/:id/results
```

Examples:

```text
/api/v1/elections?type=LOK_SABHA&year=2024&page=1&pageSize=25
/api/v1/elections/:id/results?stateId=:stateId&partyId=:partyId
```

### Constituencies

```text
GET /api/v1/constituencies
GET /api/v1/constituencies/:id
GET /api/v1/constituencies/:id/history
```

### Candidates / Parties / States

```text
GET /api/v1/candidates
GET /api/v1/candidates/:id
GET /api/v1/parties
GET /api/v1/parties/:id
GET /api/v1/states
GET /api/v1/states/:id
```

### Search

```text
GET /api/v1/search?q=Hyderabad&limit=20
```

### Analytics

```text
GET /api/v1/analytics/party-vote-share?electionId=:id
GET /api/v1/analytics/party-vote-share?electionId=:id&stateId=:stateId
GET /api/v1/analytics/seat-trends?type=LOK_SABHA
GET /api/v1/analytics/turnout?electionId=:id
```

All public election-result queries only expose elections marked `PUBLISHED`.

## Database

The canonical Prisma schema is:

```text
prisma/schema.prisma
```

The first migration is:

```text
prisma/migrations/0001_initial/migration.sql
```

Development seed:

```text
prisma/seed.ts
```

The seed records are synthetic and must never be presented as official election results.

## Production data policy

Do not import or publish election results without verified source provenance. The `DataSource` and `ResultSource` models provide the traceability needed for official-source-backed datasets.

## Next phase

Phase 3 should add secure admin authentication and the staged CSV/XLSX import → validation → review → approve → publish workflow. Phase 4 can then replace the static website with the Next.js public frontend.
