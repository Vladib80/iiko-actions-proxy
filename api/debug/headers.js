export default function handler(req, res) {
  // never echo sensitive envs, only request headers/method/path
  res.status(200).json({
    method: req.method,
    path: req.url,
    // show a few common auth headers
    headers: {
      "x-bridge-key": req.headers["x-bridge-key"] || null,
      "authorization": req.headers["authorization"] || null,
      "content-type": req.headers["content-type"] || null
    }
  });
}
