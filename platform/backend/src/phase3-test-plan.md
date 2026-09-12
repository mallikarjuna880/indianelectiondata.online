# Phase 3 verification checklist

1. `npm install`
2. `npm run prisma:validate`
3. `npm run prisma:generate`
4. `npm run prisma:migrate`
5. Provision an admin with environment variables.
6. `npm run typecheck`
7. `npm test --workspace platform/backend`
8. Upload the supplied import template.
9. Validate and confirm row counts/errors.
10. Approve as ADMIN/SUPER_ADMIN.
11. Publish with verified source metadata.
12. Confirm public `/api/v1/elections` returns only PUBLISHED elections.
