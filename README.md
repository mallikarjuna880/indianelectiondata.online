# Indian Election Data — Full Platform

Full-stack foundation for indianelectiondata.online: PostgreSQL, Prisma, TypeScript REST API, Next.js, secure admin sessions, CSV/XLSX staging, validation, approval/publishing, historical constituency versions, analytics and map integration.

## Run locally

Requirements: Node 20+, Docker Desktop.

```bash
npm install
cp .env.example .env
docker compose up -d postgres redis
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
npm run dev
```

Web: http://localhost:3000  API: http://localhost:4000

Development admin: `admin@indianelectiondata.local` / `ChangeMe123!` (change before deployment).

## Data policy

Production historical results must be loaded from verified official datasets. Imports remain staged until validation and approval. ConstituencyVersion preserves historical delimitation/name/reservation changes.
