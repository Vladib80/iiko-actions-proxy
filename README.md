# iiko Actions Proxy (for Custom GPT Actions)

A tiny Vercel proxy so ChatGPT can talk to iiko Server + iiko Cloud.

## Upload to GitHub
1) Create a GitHub repo (e.g. `iiko-actions-proxy`).
2) Click **Add file → Upload files** and upload the **contents** of this folder (keep the structure).

## Deploy on Vercel (GUI)
1) Sign in at vercel.com (GitHub login is easiest).
2) **Add New → Project** → Import your GitHub repo.
3) After first deploy, open **Settings → Environment Variables** and add:
```
BRIDGE_KEY=your-long-random-key

IIKO_SERVER_BASE_URL=https://chicago-pizza-almaty.iiko.it
IIKO_SERVER_LOGIN=
IIKO_SERVER_PASSWORD=

IIKO_CLOUD_BASE_URL=https://api-ru.iiko.services
IIKO_CLOUD_API_LOGIN=

# set to 1 only if curl works with -k but Vercel fails TLS
IIKO_TLS_INSECURE=
```
4) **Redeploy**.

## Test
Replace YOUR_APP with your Vercel domain:
```bash
export HOST=https://YOUR_APP.vercel.app
export KEY=<your BRIDGE_KEY>

curl -s $HOST/api/health
curl -s -X POST $HOST/api/server/auth/test -H "X-Bridge-Key: $KEY"
curl -s $HOST/api/server/organizations -H "X-Bridge-Key: $KEY"

curl -s -X POST $HOST/api/cloud/auth/test -H "X-Bridge-Key: $KEY"
curl -s -X POST $HOST/api/cloud/organizations -H "X-Bridge-Key: $KEY" -H "Content-Type: application/json" -d '{"organizationIds":null,"returnExternalData":false}'
```

## Connect to Custom GPT
1) In GPT Builder → **Actions** → **Import OpenAPI** (`openapi.yaml` in this repo).
2) **Server URL**: `https://YOUR_APP.vercel.app`.
3) **Authentication**: API Key → header **X-Bridge-Key** → value = your `BRIDGE_KEY`.
4) Test `/api/server/organizations` and `/api/cloud/organizations` in the tester.

Notes:
- iiko Server auth here uses **SHA‑1** `pass=SHA1(login#password)` to `/resto/api/auth`, and falls back to `/api/0/auth/access_token` if needed.
- `/api/0/*` endpoints use `?access_token=...` query.
- iiko Cloud uses `{ apiLogin }` → token → `Authorization: Bearer <token>`.
- Tokens are masked in responses; we never log secrets.
