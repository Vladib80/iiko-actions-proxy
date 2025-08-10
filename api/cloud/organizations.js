import { makeHttp, ensureBridgeKeyNode } from "../../../lib/http.js";

export default async function handler(req, res) {
  if (!ensureBridgeKeyNode(req, res)) return;

  const base = (process.env.IIKO_CLOUD_BASE_URL || "").replace(/\\/+$/, "");
  const apiLogin = process.env.IIKO_CLOUD_API_LOGIN || "";
  if (!base || !apiLogin) return res.status(400).json({ error: true, code: "MISSING_ENV", message: "Fill IIKO_CLOUD_* envs" });

  const http = makeHttp();
  const tokResp = await http.post(`${base}/api/1/access_token`, { apiLogin });
  const token = tokResp.data?.token;
  if (!token) return res.status(401).json({ error: true, code: "CLOUD_AUTH_FAILED", message: "No token from cloud" });

  const body = (req.body && typeof req.body === "object") ? req.body : { organizationIds: null, returnExternalData: false };
  const r = await http.post(`${base}/api/1/organizations`, body, { headers: { Authorization: `Bearer ${token}` } });
  return res.status(r.status).json(r.data);
}
