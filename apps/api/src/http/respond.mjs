export async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function sendJson(res, status, data, origin, allowedOrigins) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,X-Actor",
    "Cache-Control": "no-store"
  };
  if (origin && allowedOrigins.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  res.writeHead(status, headers);
  res.end(JSON.stringify({ ok: status < 400, data }, null, 2));
}

export function sendError(res, error, origin, allowedOrigins) {
  const status = error.status || 500;
  sendJson(res, status, { message: error.message || "Internal server error" }, origin, allowedOrigins);
}
