# Platform development notes

The working Phase 1 + Phase 2 implementation now lives at the repository root:

- `prisma/` — canonical database schema, migration and seed
- `apps/api/` — database-backed Fastify REST API
- `docker-compose.yml` — PostgreSQL development environment

The `platform/` directory is retained for future design/specification documents only. It is not a second backend or second Prisma schema.
