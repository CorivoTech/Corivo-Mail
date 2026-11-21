import dotenv from 'dotenv';
import express from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';

import { authRouter } from './src/server/routes/auth.ts';
import { mailRouter } from './src/server/routes/mail.ts';
import { adminRouter } from './src/server/routes/admin.ts';
import { platformRouter } from './src/server/routes/platform.ts';
import { workspaceModulesRouter } from './src/server/routes/workspaceModules.ts';
import { securityRouter } from './src/server/security.ts';
import { mailAutomationRouter } from './src/server/routes/mailAutomation.ts';
import { billingRouter } from './src/server/routes/billing.ts';
import { platformApiRouter } from './src/server/routes/platformApi.ts';
import { getDb } from './src/server/db/store.ts';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction =
  process.env.NODE_ENV === 'production' || process.env.VERCEL === '1' || process.argv.includes('--production');

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === 'true');

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ---------------------------------------------------------------------------
// Body / cookie parsing
// ---------------------------------------------------------------------------
app.use(express.json({ limit: '35mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ---------------------------------------------------------------------------
// Health check — verifies the JSON store is readable
// ---------------------------------------------------------------------------
app.get('/api/health', (_req, res) => {
  try {
    const db = getDb();
    res.json({
      status: 'ok',
      service: 'Corivo Mail API',
      mode: process.env.CORIVO_RUNTIME_MODE === 'production' ? 'PRODUCTION' : 'DEVELOPMENT_SIMULATED',
      database: {
        status: 'connected',
        provider: 'local JSON store',
        organisations: db.organisations.length,
        users: db.users.length,
        messages: db.messages.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      service: 'Corivo Mail API',
      error: err instanceof Error ? err.message : 'Database unavailable',
    });
  }
});

// ---------------------------------------------------------------------------
// API routers. Order matters: more specific routers are registered first.
// ---------------------------------------------------------------------------
app.use(authRouter);
app.use(platformApiRouter);
app.use(mailAutomationRouter);
app.use(billingRouter);
app.use(securityRouter);
app.use(mailRouter);
app.use(adminRouter);
app.use(platformRouter);
app.use(workspaceModulesRouter);

// Unknown API routes must return JSON, never a frontend HTML shell.
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// ---------------------------------------------------------------------------
// Frontend delivery
// ---------------------------------------------------------------------------
if (isProduction) {
  const distDir = path.join(process.cwd(), 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
  }
} else {
  app.get('/', (_req, res) => {
    res.type('html').send(
      '<!doctype html><html><body style="font-family:system-ui;padding:2rem">' +
      '<h1>Corivo Mail API</h1>' +
      '<p>The API is running. Open the frontend dev server (Vite) on its configured port.</p>' +
      '<p>Health check: <a href="/api/health">/api/health</a></p>' +
      '</body></html>'
    );
  });
}

// ---------------------------------------------------------------------------
// Centralized error handling
// ---------------------------------------------------------------------------
app.use((err: Error & { type?: string; status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof SyntaxError || err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON request body.' });
  }
  if (err.status === 413 || err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request payload is too large.' });
  }
  console.error('[corivo] Unhandled server error:', err);
  return res.status(500).json({ error: 'Internal server error' });
});

// ---------------------------------------------------------------------------
// Listen only when invoked directly. Vercel imports the default export.
// ---------------------------------------------------------------------------
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[corivo] API listening on http://localhost:${PORT}`);
    console.log(`[corivo] Health check: http://localhost:${PORT}/api/health`);
  });
}

export default app;
