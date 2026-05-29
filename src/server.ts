import "./lib/error-capture";
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const CLIENT_DIR = join(process.cwd(), "dist", "client");
const PORT = Number(process.env.PORT ?? 3000);

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;
  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }
  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function serveStaticFile(pathname: string, res: import("node:http").ServerResponse): boolean {
  const filePath = join(CLIENT_DIR, pathname);
  if (!existsSync(filePath)) return false;

  const ext = extname(filePath);
  const mimeType = MIME_TYPES[ext] ?? "application/octet-stream";

  try {
    const content = readFileSync(filePath);
    res.writeHead(200, { "Content-Type": mimeType });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

async function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

  // Serve static files from dist/client
  if (url.pathname !== "/" && serveStaticFile(url.pathname, res)) {
    return;
  }

  // Build a Web API Request for TanStack Start
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const bodyText = hasBody ? await readBody(req) : null;

  const request = new Request(url.toString(), {
    method: req.method,
    headers,
    body: bodyText?.length ? bodyText : null,
  });

  try {
    const handler = await getServerEntry();
    const response = await handler.fetch(request, {}, {});
    const normalized = await normalizeCatastrophicSsrResponse(response);

    const responseHeaders: Record<string, string> = {};
    normalized.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    res.writeHead(normalized.status, responseHeaders);
    const buffer = await normalized.arrayBuffer();
    res.end(Buffer.from(buffer));
  } catch (error) {
    console.error(error);
    res.writeHead(500, { "content-type": "text/html; charset=utf-8" });
    res.end(renderErrorPage());
  }
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});