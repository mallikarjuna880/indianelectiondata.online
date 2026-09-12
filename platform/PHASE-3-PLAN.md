# Phase 3 — Admin, Import, Validation & Publishing

## Goal
Add a safe editorial pipeline between raw election files and public published results.

## Workflow
1. Admin authenticates with secure session cookie.
2. Data editor creates an import batch and uploads CSV/XLSX.
3. Rows are parsed into staging records; no public result is changed.
4. Deterministic validation checks schema, references, duplicates, vote totals, positions, winner uniqueness and percentage ranges.
5. Batch moves to REVIEWED only after validation passes and an authorised reviewer approves it.
6. Publishing is a separate privileged action that changes the election/source status to PUBLISHED.
7. Every state change and data mutation is written to the audit log.
8. Public APIs continue to expose only PUBLISHED elections/results.

## Roles
- SUPER_ADMIN: full access, user administration, approve and publish.
- ADMIN: manage data, review and publish.
- DATA_EDITOR: upload and edit drafts; cannot publish.

## Security requirements
- Passwords are hashed with Argon2id.
- Sessions are opaque random tokens; only SHA-256 token hashes are stored.
- Session cookies are HttpOnly, SameSite=Lax and Secure in production.
- Login attempts are rate-limited.
- RBAC is enforced server-side on every admin endpoint.
- Never log passwords, raw session tokens or uploaded secrets.

## Import contract
Required CSV columns:
`election_id,constituency_version_id,candidate_id,party_id,votes,position,is_winner`

Optional:
`vote_share`

Imports are staged and must include a source record. Existing canonical IDs are used so imports cannot silently create ambiguous entities.

## Acceptance criteria
- Unauthenticated admin requests receive 401.
- Insufficient role receives 403.
- Invalid UUIDs and malformed rows are rejected with row-level errors.
- Duplicate candidate/election/constituency rows are rejected.
- Only one winner exists per constituency.
- Winner has position 1.
- Vote share is 0–100 when supplied.
- Published data is immutable through the import endpoint; corrections require a new batch/review cycle.
- Audit logs record import, review, approval and publication actions.
