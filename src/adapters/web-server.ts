#!/usr/bin/env node
import { createReadStream, existsSync, realpathSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function option(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function runWebServer(argv = process.argv) {
  const host = option(argv, "--host") ?? "127.0.0.1";
  const port = Number(option(argv, "--port") ?? "4317");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("Port must be an integer from 1 to 65535.");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../ui");
  if (!existsSync(resolve(root, "index.html"))) throw new Error("Built UI not found. Run npm run build first.");

  const server = createServer((request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${host}:${port}`);
      const requested = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const target = resolve(root, `.${requested}`);
      if (target !== root && !target.startsWith(`${root}${sep}`)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const stats = statSync(target);
      if (!stats.isFile()) {
        response.writeHead(404).end("Not found");
        return;
      }
      response.writeHead(200, {
        "Content-Type": MIME[extname(target)] ?? "application/octet-stream",
        "Content-Length": stats.size,
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'",
        "X-Content-Type-Options": "nosniff",
      });
      const stream = createReadStream(target);
      stream.on("error", () => {
        if (!response.headersSent) response.writeHead(500);
        response.end();
      });
      stream.pipe(response);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  server.listen(port, host, () => console.log(`State Machine editor: http://${host}:${port}`));
  return server;
}

function isDirectEntry(): boolean {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectEntry()) runWebServer();

