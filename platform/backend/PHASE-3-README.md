# Phase 3 Admin API

## Setup

From the repository root:

```bash
npm install
cp platform/.env.example platform/.env
npm run prisma:validate
npm run prisma:generate
npm run prisma:migrate
```

Provision the first admin without committing credentials:

```bash
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD='use-a-unique-12+-character-password' npm run admin:provision
```

Start the API:

```bash
npm run dev
```

## Authentication

`POST /api/v1/admin/login` accepts `{ "email": "...", "password": "..." }`.

The server stores only an Argon2id password hash and a SHA-256 session-token hash. The raw session token is sent only as an HttpOnly, SameSite=Strict cookie.

`POST /api/v1/admin/logout` revokes the current session.

`GET /api/v1/admin/me` returns the authenticated user and role.

## Import flow

1. `POST /api/v1/admin/imports` — multipart upload of one CSV/XLS/XLSX file.
2. `POST /api/v1/admin/imports/:id/validate` — validates every staged row and stores row-level errors.
3. `POST /api/v1/admin/imports/:id/review` — ADMIN/SUPER_ADMIN approves or rejects a fully validated batch.
4. `POST /api/v1/admin/imports/:id/publish` — ADMIN/SUPER_ADMIN writes validated results, records source provenance, and marks the election PUBLISHED.

Import columns:

`electionId,constituencyVersionId,candidateId,partyId,votes,voteShare,position,isWinner`

Public election APIs query only elections with `sourceStatus = PUBLISHED`.

## Production requirements

- Set a long random `COOKIE_SECRET` and never use the development fallback.
- Use HTTPS so production cookies are Secure.
- Keep DATABASE_URL and admin credentials outside Git.
- Import only verified source-backed election data.
- Review and approve data before publishing.
- Do not publish the synthetic development seed as official results.
