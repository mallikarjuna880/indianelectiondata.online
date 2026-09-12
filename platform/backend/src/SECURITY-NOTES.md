# Security notes

- Never commit `.env` or real administrator credentials.
- Production requires a random `COOKIE_SECRET` of at least 32 characters.
- Sessions contain only SHA-256 hashes of random 32-byte tokens.
- Passwords are stored using Argon2id.
- Session cookies are HttpOnly, SameSite=Strict and Secure in production.
- Login is rate-limited to 5 attempts per minute per Fastify rate-limit policy.
- Uploads are limited to 10 MiB by default and 100,000 rows.
- Only ADMIN/SUPER_ADMIN can approve or publish data.
- Public election reads are restricted to PUBLISHED elections.
- Production imports must include source/provenance metadata.
