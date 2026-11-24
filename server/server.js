import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeLook, AnalysisError, MEDIA_TYPES } from "./analyze.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT) || 3000;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // Claude API limit for one base64 image
const MAX_BODY_BYTES = Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 4096;
const RATE_LIMIT = Number(process.env.RATE_LIMIT_PER_HOUR) || 20; // analyses per IP per hour

const hits = new Map(); // ip -> timestamps of recent analyses
function allow(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3_600_000);
  if (recent.length >= RATE_LIMIT) { hits.set(ip, recent); return false; }
  recent.push(now);
  hits.set(ip, recent);
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, ts] of hits) if (ts.every((t) => now - t >= 3_600_000)) hits.delete(ip);
}, 600_000).unref();

const send = (res, status, body, type = "application/json; charset=utf-8") => {
  res.writeHead(status, { "content-type": type, "x-content-type-options": "nosniff" });
  res.end(type.startsWith("application/json") ? JSON.stringify(body) : body);
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) { reject(new AnalysisError("too_large", 413)); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

async function handleAnalyze(req, res) {
  const ip = (process.env.TRUST_PROXY ? String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() : "")
    || req.socket.remoteAddress || "unknown";
  if (!allow(ip)) return send(res, 429, { error: "rate_limited" });

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch (err) {
    return send(res, err.status || 400, { error: err.code || "bad_request" });
  }
  const mediaType = str(body?.mediaType, 50);
  const imageBase64 = typeof body?.image === "string" ? body.image : "";
  if (!MEDIA_TYPES.includes(mediaType) || !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) {
    return send(res, 400, { error: "image_rejected" });
  }
  if (Buffer.byteLength(imageBase64, "base64") > MAX_IMAGE_BYTES) return send(res, 413, { error: "too_large" });

  try {
    const look = await analyzeLook({ imageBase64, mediaType, movie: str(body.movie, 200), scene: str(body.scene, 200) });
    send(res, 200, look);
  } catch (err) {
    if (err instanceof AnalysisError) return send(res, err.status, { error: err.code });
    console.error(err);
    send(res, 500, { error: "upstream_error" });
  }
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  try {
    if (pathname === "/api/health" && req.method === "GET") {
      return send(res, 200, { ok: true, maxImageBytes: MAX_IMAGE_BYTES });
    }
    if (pathname === "/api/analyze") {
      if (req.method !== "POST") return send(res, 405, { error: "method_not_allowed" });
      return await handleAnalyze(req, res);
    }
    if ((pathname === "/" || pathname === "/index.html") && req.method === "GET") {
      return send(res, 200, await readFile(path.join(ROOT, "index.html")), "text/html; charset=utf-8");
    }
    send(res, 404, { error: "not_found" });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, 500, { error: "upstream_error" });
  }
});

server.listen(PORT, () => {
  console.log(`BollyLook running at http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn("ANTHROPIC_API_KEY is not set; uploads will fail.");
});
