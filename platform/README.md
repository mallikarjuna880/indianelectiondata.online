# Indian Election Data — Production Platform

This branch adds the Version 2 platform foundation while preserving the existing static site on `main`.

## Architecture

- Frontend: Next.js / React
- Backend: Node.js + TypeScript REST API
- Database: PostgreSQL
- Cache: Redis
- Authentication: server-side session with secure HttpOnly cookies
- Admin roles: SUPER_ADMIN, ADMIN, DATA_EDITOR
- Data workflow: import -> validate -> review -> approve -> publish

## Data principles

Election records must retain source provenance and historical constituency versions. Do not place database credentials, API keys, passwords, or admin tokens in browser JavaScript.

## Planned routes

Public: `/api/v1/elections`, `/api/v1/constituencies`, `/api/v1/constituencies/:id/history`, `/api/v1/parties`, `/api/v1/candidates`, `/api/v1/search`, `/api/v1/analytics/*`.

Admin: `/api/v1/admin/imports`, `/api/v1/admin/results`, `/api/v1/admin/sources`, `/api/v1/admin/audit-logs`.

The existing root site remains unchanged on this branch except for the new `platform/` foundation.
