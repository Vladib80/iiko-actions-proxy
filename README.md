# iiko Actions Proxy (JS version for Vercel)

This is a JavaScript-only proxy so a Custom GPT (Actions) can call iiko Server and iiko Cloud.

## Deploy (GitHub → Vercel)
1) Create a GitHub repo and upload the **contents** of this folder (do not upload the zip itself).
2) In Vercel → Add New → Project → Import the repo.
3) In Vercel → Project → Settings → Environment Variables (Production + Preview), add:
```
BRIDGE_KEY=your-long-random-key

IIKO_SERVER_BASE_URL=https://chicago-pizza-almaty.iiko.it
IIKO_SERVER_LOGIN=your_office_login
IIKO_SERVER_PASSWORD=your_office_password

IIKO_CLOUD_BASE_URL=https://api-ru.iiko.services
IIKO_CLOUD_API_LOGIN=your_transport_apiLogin

# only if your curl works with -k but Vercel fails TLS
IIKO_TLS_INSECURE=1
```
4) Redeploy.

## Test
Replace YOUR_APP and KEY:
```bash
export HOST=https://YOUR_APP.vercel.app
export KEY=<YOUR_BRIDGE_KEY>

curl -s $HOST/api/health
curl -s -X POST $HOST/api/server/auth/test -H "X-Bridge-Key: $KEY"
curl -s $HOST/api/server/organizations -H "X-Bridge-Key: $KEY"

curl -s -X POST $HOST/api/cloud/auth/test -H "X-Bridge-Key: $KEY"
curl -s -X POST $HOST/api/cloud/organizations -H "X-Bridge-Key: $KEY" -H "Content-Type: application/json" -d '{"organizationIds":null,"returnExternalData":false}'
```

## Connect to Custom GPT (Actions)
1) In GPT Builder → **Actions** → **Import OpenAPI** (`openapi.yaml`).
2) Server URL: `https://YOUR_APP.vercel.app`
3) Authentication: API Key → header `X-Bridge-Key` → value = your `BRIDGE_KEY`.
