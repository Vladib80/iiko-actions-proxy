export default function handler(req, res) {
  res.status(200).json({
    method: req.method,
    path: req.url,
    headers: {
      "x-bridge-key": req.headers["x-bridge-key"] || null,
      authorization: req.headers["authorization"] || null,
      "content-type": req.headers["content-type"] || null
    }
  });
}
