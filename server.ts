import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';

dotenv.config();

const app = express();
const PORT = 3000;

// ---------------------------------------------------------------------------
// Basic security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// ---------------------------------------------------------------------------
// JSON body parsing
app.use(express.json({ limit: '35mb' }));

// ---------------------------------------------------------------------------
// Health check (always available)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Corivo Mail API',
    mode: process.env.CORIVO_RUNTIME_MODE === 'production' ? 'PRODUCTION' : 'DEVELOPMENT_SIMULATED',
    // NOTE: Vercel-deployed instance - .data/ database is ephemeral
    databaseInfo: process.env.VERCEL ? 'ephemeral - resets each deploy' : 'persistent - .data/ folder',
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Simple auth endpoint (demo credentials only)
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (email === 'razeen@corivotech.example' && password === 'CorivoDev!2026') {
    const token = require('crypto').randomUUID();
    res.json({
      session: { token, userEmail: email, role: 'OWNER' },
      mode: 'DEVELOPMENT_SIMULATED',
    });
  } else {
    res.status(401).json({ error: 'Invalid credentials', mode: 'DEVELOPMENT_SIMULATED' });
  }
});

// ---------------------------------------------------------------------------
// Simplified mail endpoint
app.post('/api/mail/send', (req, res) => {
  res.json({
    message: 'SIMULATED: Email sent (development mode - no real SMTP delivery)',
    mode: 'DEVELOPMENT_SIMULATED',
  });
});

// ---------------------------------------------------------------------------
// Admin health
app.get('/api/admin/health', (req, res) => {
  res.json({ status: 'ok', mode: 'DEVELOPMENT_SIMULATED' });
});

// ---------------------------------------------------------------------------
// Platform API v1
app.get('/api/v1/messages', (req, res) => {
  res.json({ messages: [], mode: 'DEVELOPMENT_SIMULATED' });
});

// ---------------------------------------------------------------------------
// Serve frontend in development (Vercel handles this in production)
if (process.env.NODE_ENV !== 'production') {
  // Vite dev middleware would go here in full implementation
  // For now, just a basic catch-all to avoid 404s in dev
  app.use('*', (req, res) => {
    res.send('Corivo Mail API - ' + req.method + ' ' + req.url);
  });
} else {
  // Production: Vercel serves static files from /dist
  // app.use(express.static(path.join(process.cwd(), 'dist')));
}

// ---------------------------------------------------------------------------
// Export for Vercel serverless FUNCTION MODE
// In traditional hosting: app.listen(PORT, '0.0.0.0')
// In Vercel serverless: export the app object
// 
// TRADITIONAL HOSTING (run directly):
//   node server.ts
//
// VERCEL SERVERLESS MODE:
//   Vercel automatically routes requests to this module.exports.app
//
// To switch between modes:
 // - Run locally:          node server.ts
 // - Deploy to Vercel:     pushes automatically, uses module.exports.app
//
// CRITICAL NOTES for Vercel deployment:
// 1. JSON .data/ database is EPHEMERAL - resets on each deploy
// 2. setInterval scheduler does NOT work - Vercel functions terminate after each request
// 3. Session cookies do NOT persist across invocations
// 4. Rate limiter state does NOT persist
// 5. For production use: connect a external database (Supabase, PostgreSQL, etc.)
//
// To use traditional hosting instead of Vercel:
//   1. Comment out module.exports.app
 //   2. Run: node server.ts
//   3. Visit http://localhost:3000 or your-server-ip:3000
//
module.exports = { app };