// ORIENTIS — local preview server.
//   Run:  node serve.mjs      (or double-click  start.bat  on Windows)
import http from "http";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css",
  ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".mp4": "video/mp4", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".json": "application/json",
};

const server = http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";
  const fp = path.join(ROOT, rel);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("Not found: " + rel);
  }
  res.writeHead(200, {
    "Content-Type": TYPES[path.extname(fp).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-cache",
  });
  fs.createReadStream(fp).pipe(res);
});

const PORTS = [8080, 8081, 8090, 3000, 5173, 4173];
function listen(i = 0) {
  if (i >= PORTS.length) {
    console.error("Could not bind any port. Close other dev servers and retry.");
    process.exit(1);
  }
  const port = PORTS[i];
  server.once("error", (e) => {
    if (e.code === "EADDRINUSE") { console.log(`port ${port} busy, trying next...`); listen(i + 1); }
    else { console.error(e); process.exit(1); }
  });
  server.listen(port, () => {
    const url = `http://localhost:${port}`;
    console.log("\n  ORIENTIS is running.\n");
    console.log(`  Open:  ${url}\n`);
    console.log("  (leave this window open — press Ctrl+C to stop)\n");
    const cmd = process.platform === "win32" ? `start "" "${url}"`
      : process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;
    exec(cmd, () => {});
  });
}
listen();
