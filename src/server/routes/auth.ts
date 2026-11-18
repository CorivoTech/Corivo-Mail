import { Router } from 'express';

export const authRouter = Router();

// Demo auth endpoint for Vercel serverless
authRouter.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  // Demo credentials only - no real auth in serverless mode
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

authRouter.get('/api/auth/session', (req, res) => {
  res.json({ authenticated: false, session: null });
});

authRouter.get('/api/auth/demo-accounts', (req, res) => {
  res.json({
    accounts: [
      {
        email: 'razeen@corivotech.example',
        displayName: 'Razeen Iqbal',
        role: 'OWNER',
        organisationName: 'Corivo Platform Ops',
        status: 'ACTIVE',
        devPassword: 'CorivoDev!2026',
        mode: 'DEVELOPMENT_SIMULATED',
      },
    ],
    mode: 'DEVELOPMENT_SIMULATED',
  });
});

// Vercel serverless export - makes app available to Vercel platform
// In traditional hosting, this module.export would be skipped for direct node server.js run
if (typeof window === 'undefined') {
  // Node.js environment - export for Vercel
  // This allows Vercel to use this file as a serverless function
  module.exports = { authRouter };
}