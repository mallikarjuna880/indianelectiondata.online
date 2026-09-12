# Smoke test examples

```bash
curl -i -c cookies.txt -H 'content-type: application/json' \
  -d '{"email":"admin@example.com","password":"CHANGE_ME"}' \
  http://localhost:4000/api/v1/admin/login

curl -b cookies.txt http://localhost:4000/api/v1/admin/me

curl -b cookies.txt -F 'file=@platform/database/import-template.csv' \
  http://localhost:4000/api/v1/admin/imports
```

Use the returned import id for validation, review and publish. Never put real passwords in shell history on shared systems.
