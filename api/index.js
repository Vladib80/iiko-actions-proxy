export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    message: "iiko-actions-proxy is running",
    endpoints: [
      "/api/health",
      "/api/server/auth/test",
      "/api/server/organizations",
      "/api/cloud/auth/test",
      "/api/cloud/organizations"
    ]
  });
}
