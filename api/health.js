export default async function handler(_req, res) {
  res.setHeader("content-type", "application/json");
  res.status(200).send({ status: "ok", time: new Date().toISOString() });
}
