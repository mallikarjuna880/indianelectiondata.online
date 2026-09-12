# Phase 3 Admin API Contract

These routes are the integration contract for the existing Fastify server. Implement them behind the existing authentication middleware before exposing them publicly.

| Method | Route | Minimum role | Purpose |
|---|---|---|---|
| POST | `/api/v1/admin/auth/login` | public | Create secure session |
| POST | `/api/v1/admin/auth/logout` | authenticated | Revoke current session |
| GET | `/api/v1/admin/me` | authenticated | Current user/role |
| POST | `/api/v1/admin/imports` | DATA_EDITOR | Create staged import batch |
| GET | `/api/v1/admin/imports` | DATA_EDITOR | List batches |
| GET | `/api/v1/admin/imports/:id` | DATA_EDITOR | Inspect batch + errors |
| POST | `/api/v1/admin/imports/:id/validate` | DATA_EDITOR | Run deterministic validation |
| POST | `/api/v1/admin/imports/:id/review` | ADMIN | Approve/reject validated batch |
| POST | `/api/v1/admin/imports/:id/publish` | ADMIN | Publish approved batch |
| GET | `/api/v1/admin/audit` | ADMIN | Audit trail |

## Publish guard

Publishing must fail unless:
- batch status is `REVIEWED`;
- there are zero validation errors;
- the batch has a verified `DataSource`;
- the target election is not already published through this batch;
- the authenticated user has ADMIN or SUPER_ADMIN role.

Public result endpoints must continue filtering `Election.sourceStatus = PUBLISHED`.
