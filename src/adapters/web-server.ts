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

const HELP = `Step Switch editor server 0.1

Usage:
  state-machine-ui [--host <host>] [--port <port>]

Options:
  --host <host>  Bind address (default: 127.0.0.1)
  --port <port>  TCP port from 1 to 65535 (default: 4317)
  --help         Show this help
`;

function parseOptions(argv: string[]): { host: string; port: number } | null {
  const args = argv.slice(2);
  if (args.includes("--help")) {
    if (args.length !== 1) throw new Error("--help cannot be combined with other arguments.");
    process.stdout.write(HELP);
    return null;
  }
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    if (name !== "--host" && name !== "--port") throw new Error(`Unknown option '${name ?? ""}'.`);
    if (values.has(name)) throw new Error(`Option '${name}' may only be provided once.`);
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`${name} requires a value.`);
    values.set(name, value);
    index += 1;
  }
  const host = values.get("--host") ?? "127.0.0.1";
  const port = Number(values.get("--port") ?? "4317");
  if (host.length === 0) throw new Error("Host must not be empty.");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("Port must be an integer from 1 to 65535.");
  return { host, port };
}

export function runWebServer(argv = process.argv) {
  const options = parseOptions(argv);
  if (!options) return null;
  const { host, port } = options;
  const rootPath = resolve(dirname(fileURLToPath(import.meta.url)), "../../ui");
  if (!existsSync(resolve(rootPath, "index.html"))) throw new Error("Built UI not found. Run npm run build first.");
  const root = realpathSync(rootPath);

  const server = createServer((request, response) => {
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
        return;
      }
      const url = new URL(request.url ?? "/", "http://localhost");
      const requested = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const target = resolve(root, `.${requested}`);
      if (target !== root && !target.startsWith(`${root}${sep}`)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const canonicalTarget = realpathSync(target);
      if (canonicalTarget !== root && !canonicalTarget.startsWith(`${root}${sep}`)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const stats = statSync(canonicalTarget);
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
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      const stream = createReadStream(canonicalTarget);
      stream.on("error", () => {
        if (!response.headersSent) response.writeHead(500);
        response.end();
      });
      stream.pipe(response);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  server.listen(port, host, () => console.log(`Step Switch editor: http://${host}:${port}`));
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

if (isDirectEntry()) {
  try {
    const server = runWebServer();
    if (server) {
      server.on("error", (error) => {
        console.error(`CLI_USAGE_ERROR: ${error instanceof Error ? error.message : "Editor server failed to start."}`);
        process.exitCode = 2;
      });
    }
  } catch (error) {
    console.error(`CLI_USAGE_ERROR: ${error instanceof Error ? error.message : "Editor server failed."}`);
    process.exitCode = 2;
  }
}
