/**
 * Minimal static + /api reverse-proxy (interim BFF).
 * Serves `dist/` and forwards /api/* to FREEOS_UPSTREAM (a FreeOS host).
 *
 * Target end-state: replace this file with a self-contained org-module
 * server that implements /api/org-module/* and local JWT auth without
 * requiring a FreeOS process.
 */
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT || 3780);
const UPSTREAM = (process.env.FREEOS_UPSTREAM || "http://127.0.0.1:8088").replace(
  /\/$/,
  "",
);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

function spaFallback(res) {
  const index = path.join(ROOT, "index.html");
  if (!fs.existsSync(index)) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("dist/index.html missing — run npm run build first");
    return;
  }
  sendFile(res, index);
}

function proxyApi(req, res) {
  const target = new URL(req.url || "/", `${UPSTREAM}/`);
  const headers = { ...req.headers, host: target.host };
  const client = target.protocol === "https:" ? https : http;
  const upstream = client.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port,
      method: req.method,
      path: `${target.pathname}${target.search}`,
      headers,
    },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", (err) => {
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        error: "upstream_unreachable",
        message: `Cannot reach FreeOS at ${UPSTREAM}: ${err.message}`,
      }),
    );
  });
  req.pipe(upstream);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    proxyApi(req, res);
    return;
  }
  const rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  const filePath = path.normalize(path.join(ROOT, rel || "index.html"));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(400);
    res.end();
    return;
  }
  if (rel && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    sendFile(res, filePath);
    return;
  }
  spaFallback(res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`openxyos-web listening on :${PORT} (API → ${UPSTREAM})`);
});
