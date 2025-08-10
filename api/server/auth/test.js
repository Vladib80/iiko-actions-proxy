import { makeHttp, mask, ensureBridgeKeyNode } from "../../../lib/http.js";

export default async function handler(req, res) {
  if (!ensureBridgeKeyNode(req, res)) return;

  const base = (process.env.IIKO_CLOUD_BASE_URL || "").replace(/\/+$/, "");
  const apiLogin = process.env.IIKO_CLOUD_API_LOGIN || "";
  if (!base || !apiLogin) return res.status(400).json({ error: true, code: "MISSING_ENV", message: "Fill IIKO_CLOUD_* envs" });

  const http = makeHttp();
  const r = await http.post(`${base}/api/1/access_token`, { apiLogin });
  if (r.status === 200 && r.data?.token) return res.status(200).json({ ok: true, token: mask(r.data.token) });
  return res.status(401).json({ error: true, code: "CLOUD_AUTH_FAILED", message: "Cloud auth failed", details: String((r.data && JSON.stringify(r.data).slice(0,200)) || r.status) });
}
