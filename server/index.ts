
// server/index.ts
// Dev:     NODE_ENV=development tsx server/index.ts          (no hardcoded PORT)
// Build:   vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
// Prod:    NODE_ENV=production node dist/index.js            (Replit sets PORT=5000 automatically)

import express, { type Request, type Response, type NextFunction } from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

// In dev we attach Vite as middleware
import type { ViteDevServer } from "vite";
import { createServer as createViteServer } from "vite";

// ----------------------------------------------------------------------------
// ESM-friendly __dirname / __filename
// ----------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths:
// - clientRoot: the Vite app (index.html + src/*)
// - prodPublicDir: where vite build writes static assets (dist/public)
//   NOTE: When running the bundled server from dist/, __dirname === dist/
//   so __dirname/public correctly points at dist/public.
const clientRoot = path.resolve(__dirname, "../client");
const prodPublicDir = path.resolve(__dirname, "public");

// ----------------------------------------------------------------------------
// Simple logger
// ----------------------------------------------------------------------------
function log(message: string) {
  const ts = new Date().toISOString();
  const out = message.length > 200 ? message.slice(0, 199) + "…" : message;
  console.log(`[${ts}] ${out}`);
}

// ----------------------------------------------------------------------------
// Express app
// ----------------------------------------------------------------------------
const app = express();

// Augment IncomingMessage to keep rawBody (useful for webhook verifications)
declare module "http" {
  interface IncomingMessage {
    rawBody?: Buffer;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      // Store raw body for HMAC/webhook verification scenarios
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

// ----------------------------------------------------------------------------
// Request logging for /api responses (fixes TS2556 in res.json wrapper)
// ----------------------------------------------------------------------------
app.use((req, res, next) => {
  const start = Date.now();
  const { path: reqPath, method } = req;
  let capturedJson: unknown;

  // Preserve `this` and type for original res.json
  const originalJson: Response["json"] = res.json.bind(res);

  // Override res.json to capture the body for logging
  res.json = ((body?: any) => {
    capturedJson = body;
    return originalJson(body);
  }) as Response["json"];

  res.on("finish", () => {
    if (reqPath.startsWith("/api")) {
      const duration = Date.now() - start;
      let line = `${method} ${reqPath} ${res.statusCode} in ${duration}ms`;
      if (capturedJson && typeof capturedJson === "object") {
        try {
          const snippet = JSON.stringify(capturedJson);
          line += ` :: ${snippet}`;
        } catch {
          /* ignore */
        }
      }
      if (line.length > 200) line = line.slice(0, 199) + "…";
      log(line);
    }
  });

  next();
});

// ----------------------------------------------------------------------------
// Health endpoint (definitive connectivity check)
// ----------------------------------------------------------------------------
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    env: process.env.NODE_ENV,
    port: process.env.PORT ?? "3000 (default)",
    time: new Date().toISOString(),
  });
});

// ----------------------------------------------------------------------------
// Mount your real routes here (Passport, storage, etc.)
// ----------------------------------------------------------------------------
// import { registerRoutes } from "./routes";
// await registerRoutes(app);

// ----------------------------------------------------------------------------
// Error handler (JSON for API; SPA remains intact in prod)
// ----------------------------------------------------------------------------
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err?.status ?? err?.statusCode ?? 500;
  const message = err?.message ?? "Internal Server Error";
  res.status(status).json({ message });

  if (app.get("env") === "development") {
    // Show full stacks in dev
    // eslint-disable-next-line no-console
    console.error(err);
  }
});

// ----------------------------------------------------------------------------
// Dev vs Prod: attach Vite middleware in dev; serve static in prod
// ----------------------------------------------------------------------------
async function attachClient(app: express.Express) {
  if (app.get("env") === "development") {
    // ✅ Force Vite to load your config so aliases/root/plugins apply.
    const vite: ViteDevServer = await createViteServer({
      configFile: path.resolve(__dirname, "../vite.config.js"),
      appType: "custom",
      server: { middlewareMode: true },
    });

    // Use Vite's connect instance as middleware
    app.use(vite.middlewares);

    // SPA fallback: for non-API routes, stream index.html through Vite
    app.use(async (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      try {
        const indexHtmlPath = path.resolve(clientRoot, "index.html");
        let html = fs.readFileSync(indexHtmlPath, "utf-8");
        html = await vite.transformIndexHtml(req.originalUrl, html);
        res.status(200).setHeader("Content-Type", "text/html").end(html);
      } catch (e) {
        next(e);
      }
    });

    log("Vite dev middleware attached (single-port dev)");
  } else {
    // Production: serve built assets from dist/public
    app.use(express.static(prodPublicDir));

    // SPA fallback to built index.html
    app.get("*", (_req, res) => {
      res.sendFile(path.join(prodPublicDir, "index.html"));
    });

    log(`Serving static client from ${prodPublicDir}`);
  }
}

// ----------------------------------------------------------------------------
// Start the single-port server (Replit-friendly)
// ----------------------------------------------------------------------------
(async () => {
  await attachClient(app);

  // ✅ Permanent port handling: honor env, default to 3000 locally.
  // Replit sets PORT=5000 automatically for preview/public URL.
  
const port = Number(process.env.PORT ?? 3000);
const host = "0.0.0.0";
app.listen(port, host, () => {
  console.log(`Server listening at http://${host}:${port}`)


  });
})();
