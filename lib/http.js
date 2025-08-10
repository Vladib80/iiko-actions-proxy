import axios from "axios";
import https from "https";

export function makeHttp() {
  const cfg = { timeout: 20000, validateStatus: () => true };
  if (process.env.IIKO_TLS_INSECURE === "1") {
    cfg.httpsAgent = new https.Agent({ rejectUnauthorized: false });
  }
  return axios.create(cfg);
}

export function mask(v) {
  if (!v) return "";
  if (v.length <= 8) return "****";
  return v.slice(0, 4) + "***" + v.slice(-4);
}

export function ensureBridgeKeyNode(req, res) {
  const key = req.headers["x-bridge-key"] || req.headers["X-Bridge-Key"];
  if (!key || key !== process.env.BRIDGE_KEY) {
    res.status(401).json({ error: true, code: "NO_AUTH", message: "Missing or invalid X-Bridge-Key" });
    return false;
  }
  return true;
}
