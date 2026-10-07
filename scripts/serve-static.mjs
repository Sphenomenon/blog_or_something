import { createServer as createHttpServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const MIME_TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".txt": "text/plain", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".woff2": "font/woff2" };

export async function createServer(options = {}) {
  const root = resolve(options.root ?? process.cwd());
  const output = resolve(root, "out");
  const middlewares = [];
  const server = {
    middlewares: { use: (middleware) => middlewares.push(middleware) },
    resolvedUrls: { local: [] },
    async ssrLoadModule(path) { return import(pathToFileURL(resolve(root, `.${path}`)).href); },
    async listen() {
      await stat(resolve(output, "index.html"));
      await new Promise((done) => server.httpServer.listen(options.server?.port ?? options.preview?.port ?? 0, options.server?.host ?? "127.0.0.1", done));
      server.resolvedUrls.local = [`http://127.0.0.1:${server.httpServer.address().port}/`];
    },
    close: () => new Promise((done) => server.httpServer.close(done))
  };
  server.httpServer = createHttpServer(async (request, response) => {
    async function serve() {
      try {
        const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
        let asset = resolve(output, `.${pathname}`);
        if (asset !== output && !asset.startsWith(`${output}${sep}`)) {
          response.writeHead(403).end();
          return;
        }
        if (pathname === "/admin" || pathname.startsWith("/admin/")) {
          try { await stat(asset); } catch { asset = resolve(output, "admin/index.html"); }
        }
        try {
          if ((await stat(asset)).isDirectory()) {
            const index = resolve(asset, "index.html");
            await stat(index);
            asset = index;
          }
        } catch {
          try { await stat(`${asset}.html`); asset += ".html"; }
          catch { response.statusCode = 404; asset = resolve(output, "404.html"); }
        }
        response.setHeader("Content-Type", `${MIME_TYPES[extname(asset)] ?? "application/octet-stream"}; charset=utf-8`);
        response.setHeader("Cache-Control", "no-cache");
        response.setHeader("Content-Length", (await stat(asset)).size);
        response.end(request.method === "HEAD" ? undefined : await readFile(asset));
      } catch {
        response.writeHead(404).end("Not found");
      }
    }
    let index = 0;
    const next = () => { const middleware = middlewares[index++]; if (middleware) middleware(request, response, next); else void serve(); };
    next();
  });
  return server;
}

export async function preview(options = {}) {
  const server = await createServer(options);
  await server.listen();
  return server;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const portIndex = process.argv.indexOf("--port");
  const hostIndex = process.argv.indexOf("--host");
  const port = portIndex >= 0 ? Number(process.argv[portIndex + 1]) : 4173;
  const host = hostIndex >= 0 ? process.argv[hostIndex + 1] : "127.0.0.1";
  const server = await preview({ server: { port, host } });
  console.log(`Nocturne Archive: ${server.resolvedUrls.local[0]}`);
}
