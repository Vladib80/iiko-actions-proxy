import crypto from "crypto";
import { makeHttp, ensureBridgeKeyNode } from "../../../lib/http.js";

async function getToken(base, login, password) {
  const http = makeHttp();
  const pass = crypto.createHash("sha1").update(`${login}#${password}`, "utf8").digest("hex");
  let r = await http.post(`${base}/resto/api/auth`, null, { params: { login, pass } });
  if (r.status === 200 && typeof r.data === "string" && r.data.trim()) return r.data.trim();
  r = await http.post(`${base}/api/0/auth/access_token`, null, { params: { login, password } });
  const token = typeof r.data === "string" ? r.data : r.data?.access_token;
  if (r.status === 200 && token) return token;
  throw new Error(`Auth failed: status=${r.status} body~=${JSON.stringify(r.data).slice(0,200)}`);
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
    const r = await http.get(`${base}/api/0/organization/list`, { params: { access_token: token, request_timeout: 30000 } });
    if (r.status !== 200) {
      return res.status(r.status).json({ error: true, code: "SERVER_ORGS_FAILED", message: "Org list failed", details: String((r.data && JSON.stringify(r.data).slice(0,200)) || r.status) });
    }
    const arr = Array.isArray(r.data) ? r.data : (r.data?.items || r.data?.rows || []);
    const orgs = arr.map(o => ({ id: o.id || o.organizationId || o.guid, name: o.name || o.title }));
    return res.status(200).json({ organizations: orgs });
  } catch (e) {
    return res.status(500).json({ error: true, code: "SERVER_ORGS_ERROR", message: "Server request failed", details: String(e?.message || e) });
  }
}
