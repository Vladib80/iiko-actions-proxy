import crypto from "node:crypto";
import { makeHttp, mask, ensureBridgeKeyNode } from "../../../lib/http.js";

export default async function handler(req, res) {
  if (!ensureBridgeKeyNode(req, res)) return;

  const base = (process.env.IIKO_SERVER_BASE_URL || "").replace(/\\/+$/, "");
  const login = process.env.IIKO_SERVER_LOGIN || "";
  const password = process.env.IIKO_SERVER_PASSWORD || "";
  const http = makeHttp();

  if (!base || !login || !password) {
    return res.status(400).json({ error: true, code: "MISSING_ENV", message: "Fill IIKO_SERVER_* envs" });
  }

  try {
    const pass = crypto.createHash("sha1").update(`${login}#${password}`, "utf8").digest("hex");
    const r = await http.post(`${base}/resto/api/auth`, null, { params: { login, pass } });
    if (r.status === 200 && typeof r.data === "string" && r.data.trim()) {
      return res.status(200).json({ ok: true, flow: "classic+hash", token: mask(r.data.trim()) });
    }
  } catch {}

  const r2 = await http.post(`${base}/api/0/auth/access_token`, null, { params: { login, password } });
  const token = typeof r2.data === "string" ? r2.data : r2.data?.access_token;
  if (r2.status === 200 && token) {
    return res.status(200).json({ ok: true, flow: "alt", token: mask(token) });
  }
  return res.status(401).json({ error: true, code: "SERVER_AUTH_FAILED", message: "Server auth failed", details: String((r2.data && JSON.stringify(r2.data).slice(0,200)) || r2.status) });
}
