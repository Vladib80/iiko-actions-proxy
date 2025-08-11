import crypto from "crypto";
import axios from "axios";
import https from "https";

/** Minimal local HTTP client (no shared imports). */
function http() {
  const cfg = { timeout: 60000, validateStatus: () => true };
  if (process.env.IIKO_TLS_INSECURE === "1") {
    cfg.httpsAgent = new https.Agent({ rejectUnauthorized: false });
  }
  return axios.create(cfg);
}

/** Accept X-Bridge-Key or Authorization: Bearer <key>. */
function ensureKey(req, res) {
  const keyHeader = req.headers["x-bridge-key"] || req.headers["X-Bridge-Key"];
  const auth = req.headers["authorization"];
  const bearer = auth && /^bearer\s+(.+)$/i.test(auth) ? auth.replace(/^bearer\s+/i, "") : null;
  const ok = (keyHeader && keyHeader === process.env.BRIDGE_KEY) || (bearer && bearer === process.env.BRIDGE_KEY);
  if (!ok) {
    res.status(401).json({ error: true, code: "NO_AUTH", message: "Missing or invalid key" });
    return false;
  }
  return true;
}

/** iiko Server token via classic hash or alt /api/0/auth/access_token. */
async function getServerToken(base, login, password) {
  const h = http();
  const pass = crypto.createHash("sha1").update(`${login}#${password}`, "utf8").digest("hex");

  // 1) classic hashed
  try {
    const r = await h.post(`${base}/resto/api/auth`, null, { params: { login, pass } });
    if (r.status === 200 && typeof r.data === "string" && r.data.trim()) return r.data.trim();
  } catch {}

  // 2) alt access_token
  const r2 = await h.post(`${base}/api/0/auth/access_token`, null, { params: { login, password } });
  const token = typeof r2.data === "string" ? r2.data : r2.data?.access_token;
  if (r2.status === 200 && token) return token;

  throw new Error(`Auth failed: status=${r2.status} body~=${JSON.stringify(r2.data).slice(0,200)}`);
}

/** Simple preset mapper (optional usage). */
function buildBodyFromPreset(preset, from, to) {
  switch (preset) {
    case "sales_by_dish":
      return {
        measures: ["Sales", "DishCount", "AvgPrice"],
        groupByRowFields: ["ProductName", "ProductGroupName"],
        groupByColFields: [],
        filters: [{ field: "OpenDate", op: "Between", value1: from, value2: to }],
      };
    case "sales_by_category":
      return {
        measures: ["Sales", "DishCount"],
        groupByRowFields: ["ProductGroupName"],
        groupByColFields: [],
        filters: [{ field: "OpenDate", op: "Between", value1: from, value2: to }],
      };
    case "sales_by_hour":
      return {
        measures: ["Sales", "Checks"],
        groupByRowFields: ["OpenDate", "OpenHour"],
        groupByColFields: [],
        filters: [{ field: "OpenDate", op: "Between", value1: from, value2: to }],
      };
    case "payments_by_type":
      return {
        measures: ["PaymentAmount", "PaymentCount", "AvgCheck"],
        groupByRowFields: ["PaymentTypeName"],
        groupByColFields: [],
        filters: [{ field: "OpenDate", op: "Between", value1: from, value2: to }],
      };
    default:
      return null;
  }
}

export default async function handler(req, res) {
  if (!ensureKey(req, res)) return;

  const base = (process.env.IIKO_SERVER_BASE_URL || "").replace(/\/+$/, "");
  const login = process.env.IIKO_SERVER_LOGIN || "";
  const password = process.env.IIKO_SERVER_PASSWORD || "";
  if (!base || !login || !password) {
    return res.status(400).json({ error: true, code: "MISSING_ENV", message: "Set IIKO_SERVER_* envs" });
  }

  // Accept either a direct OLAP body or a preset + dates.
  const payload = (req.body && typeof req.body === "object") ? req.body : {};
  let olapBody = payload;

  // Optional: build from preset
  if (payload.preset) {
    const from = payload.from || payload.dateFrom || payload.start || payload.fromDate;
    const to = payload.to || payload.dateTo || payload.end || payload.toDate;
    const built = buildBodyFromPreset(payload.preset, from, to);
    if (!built) {
      return res.status(400).json({ error: true, code: "BAD_PRESET", message: "Unknown preset", details: payload.preset });
    }
    // allow extra filters to merge
    if (Array.isArray(payload.filters) && payload.filters.length) {
      built.filters = [...built.filters, ...payload.filters];
    }
    // allow report name if you use saved templates
    if (payload.report) built.report = payload.report;
    olapBody = built;
  }

  // Minimal validation
  if (!olapBody || (!olapBody.measures && !olapBody.report)) {
    return res.status(400).json({
      error: true,
      code: "BAD_REQUEST",
      message: "Provide either { report: 'SavedReportName', ... } or { measures, groupByRowFields, filters }",
    });
  }

  try {
    const h = http();
    const token = await getServerToken(base, login, password);

    // Try common endpoints / auth styles
    const tries = [
      { url: `${base}/resto/api/reports/olap`, headers: { Authorization: `Bearer ${token}` } },
      { url: `${base}/api/0/reports/olap`, headers: { Authorization: `Bearer ${token}` } },
      { url: `${base}/resto/api/reports/olap?access_token=${encodeURIComponent(token)}` },
      { url: `${base}/api/0/reports/olap?access_token=${encodeURIComponent(token)}` },
    ];

    let last;
    for (const t of tries) {
      const r = await h.post(t.url, olapBody, { headers: { "Accept": "application/json", "Content-Type": "application/json", ...(t.headers || {}) } });
      last = r;
      if (r.status === 200) {
        // Try to normalize a bit: some servers return { rows: [...] }, some return an array
        const rows = Array.isArray(r.data) ? r.data : (r.data?.rows || r.data?.items || r.data?.data || []);
        return res.status(200).json({ rows, meta: { source: t.url.replace(base, ""), status: r.status } });
      }
    }

    const details = typeof last?.data === "string" ? last.data.slice(0, 300) : JSON.stringify(last?.data || "").slice(0, 300);
    return res.status(last?.status || 502).json({
      error: true,
      code: "OLAP_FAILED",
      message: "OLAP failed on all known endpoints",
      details,
      tried: tries.map(t => t.url.replace(base, "")),
    });
  } catch (e) {
    return res.status(500).json({
      error: true,
      code: "OLAP_ERROR",
      message: "OLAP request crashed",
      details: String(e?.message || e),
    });
  }
}
