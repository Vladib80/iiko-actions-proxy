import crypto from "crypto";
import { makeHttp, ensureBridgeKeyNode } from "../../lib/http.js"; // ← exactly 2 dots

async function getToken(base, login, password) {
  const http = makeHttp();
  const pass = crypto.createHash("sha1").update(`${login}#${password}`, "utf8").digest("hex");

  // 1) Classic hashed auth (/resto/api/auth)
  try {
    const r = await http.post(`${base}/resto/api/auth`, null, { params: { login, pass } });
    if (r.status === 200 && typeof r.data === "string" && r.data.trim()) return r.data.trim();
  } catch {}

  // 2) Alternative token endpoint (/api/0/auth/access_token)
  const r2 = await http.post(`${base}/api/0/auth/access_token`, null, { params: { login, password } });
  const token = typeof r2.data === "string" ? r2.data : r2.data?.access_token;
  if (r2.status === 200 && token) return token;

  throw new Error(`Auth failed: status=${r2.status} body~=${JSON.stringify(r2.data).slice(0,200)}`);
}

export default async function handler(req, res) {
  if (!ensureBridgeKeyNode(req, res)) return;

  const base = (process.env.IIKO_SERVER_BASE_URL || "").replace(/\/+$/, "");
  const login = process.env.IIKO_SERVER_LOGIN || "";
  const password = process.env.IIKO_SERVER_PASSWORD || "";
  if (!base || !login || !password) {
    return res.status(400).json({ error: true, code: "MISSING_ENV", message: "Fill IIKO_SERVER_* envs" });
  }

  try {
    const http = makeHttp();
    const token = await getToken(base, login, password);

    // We’ll try up to 3 known paths; some servers expect header bearer, some query param
    const tries = [
      { url: `${base}/api/0/organization/list`, params: { access_token: token, request_timeout: 30 }, headers: { Accept: "application/json" } },
      { url: `${base}/resto/api/organization/list`, params: { access_token: token, request_timeout: 30 }, headers: { Accept: "application/json" } },
      { url: `${base}/resto/api/organization/list`, params: { request_timeout: 30 }, headers: { Accept: "application/json", Authorization: `Bearer ${token}` } },
    ];

    let last;
    for (const t of tries) {
      const r = await http.get(t.url, { params: t.params, headers: t.headers });
      last = r;
      if (r.status === 200) {
        const data = r.data;
        const arr = Array.isArray(data) ? data : (data?.items || data?.rows || []);
        const orgs = (arr || []).map(o => ({ id: o.id || o.organizationId || o.guid, name: o.name || o.title }));
        return res.status(200).json({ organizations: orgs, source: t.url.replace(base, "") });
      }
    }

    // If we’re here, all attempts failed — return the last result details, not a crash
    const detail = typeof last?.data === "string" ? last.data.slice(0, 200) : JSON.stringify(last?.data || "").slice(0, 200);
    return res.status(last?.status || 502).json({
      error: true,
      code: "SERVER_ORGS_FAILED",
      message: "Org list failed on all known endpoints",
      details: detail
    });
  } catch (e) {
    return res.status(500).json({
      error: true,
      code: "SERVER_ORGS_ERROR",
      message: "Server request failed",
      details: String(e?.message || e)
    });
  }
}
