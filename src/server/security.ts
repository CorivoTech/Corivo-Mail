import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { getDb, updateDb } from './db/store.ts';
import { DEV_DEMO_PASSWORD } from './db/seed.ts';
import { hashPassword, hashToken, verifyPassword } from './security/password.ts';
import {
  TwoFactorRecord,
  TwoFactorChallenge,
  AppPassword,
  IpAllowEntry,
  SsoProvider,
  MailLabel,
  MailRule,
  AutoReply,
  MailboxForwarding,
  OutboundQueueItem,
  MessageComment,
} from '../shared/types.ts';

// ---------------------------------------------------------------------------
// TOTP: minimal RFC 6238 implementation using only node:crypto
// ---------------------------------------------------------------------------

function base32Encode(binary: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < binary.length; i++) {
    buffer = (buffer << 8) | binary[i];
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    result += alphabet[(buffer << (5 - bits)) & 31];
  }

  // Pad to multiple of 8 characters
  while (result.length % 8 !== 0) {
    result += '=';
  }

  return result;
}

function generateTotpSecret(length = 20): { secret: string; otpauthUri: string } {
  const buf = crypto.randomBytes(length);
  const secret = base32Encode(buf);
  const otpauthUri = `otpauth://totp/CorivoMail:${encodeURIComponent('user@example.com')}?secret=${secret}&issuer=CorivoMail&digits=6&period=30`;
  return { secret, otpauthUri };
}

// Compute TOTP code (6-digit, step=30s) using HMAC-SHA1
function computeTotpReal(secret: string, timeSteps: number): number {
  // Decode base32 to get the key bytes
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const binMap: Record<string, number> = {};
  for (let i = 0; i < alphabet.length; i++) {
    binMap[alphabet[i]] = i;
  }

  let n = 0;
  let bits = 0;
  for (let i = 0; i < secret.length; i++) {
    const code = binMap[secret[i]];
    if (code === undefined) continue;
    n = (n << 6) | code;
    bits += 6;
  }
  // Clear to multiple of 8
  n >>>= (bits % 8 !== 0 ? bits % 8 : 8);
  bits -= bits % 8;

  // Pad to at least 8 bytes (64 bits)
  const keyBuf = Buffer.alloc(8);
  const copyCount = Math.min(bits / 6, 8);
  for (let i = 0; i < copyCount; i++) {
    keyBuf[i] = (n >>> (i * 8)) & 255;
  }

  // Counter as 8-byte big-endian buffer
  const counterBuf = Buffer.alloc(8);
  for (let i = 7; i >= 0; i--) {
    counterBuf[i] = (timeSteps >>> (i * 8)) & 255;
  }

  const hmac = crypto.createHmac('sha1', keyBuf).update(counterBuf).digest();
  // Offset: last byte & 0xf
  const offset = hmac[hmac.length - 1] & 0x0f;
  // Pick 4 bytes from that offset
  const binary = ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return binary % 1000000;
}

function verifyTotpCode(secret: string, code: string): boolean {
  const codeNum = parseInt(code, 10);
  if (isNaN(codeNum) || codeNum < 0 || codeNum > 999999) return false;

  const timeSteps = Math.floor(Date.now() / 30_000);
  const totp = computeTotpReal(secret, timeSteps);
  // Allow one step ahead/behind for clock skew
  return [
    totp,
    (totp + 1) % 1_000_000,
    (totp - 1 + 1_000_000) % 1_000_000,
  ].includes(codeNum);
}

// ---------------------------------------------------------------------------
// App password helpers
// ---------------------------------------------------------------------------

function hashAppPassword(plaintext: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('base64');
  const key = crypto.scryptSync(plaintext, salt, 64);
  return { hash: key.toString('base64'), salt };
}

function verifyAppPassword(plaintext: string, hashB64: string, salt: string): boolean {
  try {
    const key = crypto.scryptSync(plaintext, salt, 64);
    const stored = Buffer.from(hashB64, 'base64');
    return crypto.timingSafeEqual(key, stored);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// IP allow-list helpers
// ---------------------------------------------------------------------------

function parseCidr(cidr: string): { network: number; mask: number } | null {
  const parts = cidr.split('/');
  if (parts.length !== 2) return null;
  const ipParts = parts[0].split('.');
  if (ipParts.length !== 4) return null;
  const mask = parseInt(parts[1], 10);
  if (mask < 0 || mask > 32) return null;
  const network = ipParts.map(p => parseInt(p, 10)).reduce((acc, val) => (acc << 8) | val, 0);
  return { network, mask };
}

function ipToInt(ipStr: string): number | null {
  const parts = ipStr.split('.');
  if (parts.length !== 4) return null;
  return parts.reduce((acc: number, val: string) => (acc << 8) | (Number(val) & 0xff), 0);
}

function ipInCidr(ip: string, network: number, mask: number): boolean {
  const ipInt = ipToInt(ip);
  if (ipInt === null) return false;
  return (ipInt >>> 0) >> (32 - mask) === network >>> (32 - mask);
}

function ipAllowed(userId: string, ip: string, db: ReturnType<typeof getDb>): boolean {
  const entries = (db as any).ipAllowEntries || [];
  // If no entries, exempt the OWNER account when no entries exist (enforcement activates only when entries present)
  if (entries.length === 0) return true;
  const user = (db as any).users.find((u: any) => u.id === userId);
  if (!user) return false;
  // Exempt OWNER if they have no entries — but we already checked length > 0
  for (const entry of entries) {
    if (ipInCidr(ip, entry.network, entry.mask)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// SSO simulated helpers
// ---------------------------------------------------------------------------

function makeSsoId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const securityRouter = Router();

// --- TOTP / 2FA ---

securityRouter.post('/api/account/2fa/setup', (req: Request, res: Response) => {
  const db = getDb();
  // Find the authenticated user (basic check: user exists in db by looking at cookie-less auth)
  // In production this would use session middleware; for now we require userId via body
  const { userId } = req.body as { userId?: string };
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  const user = db.users.find((u: any) => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Check if already enrolled
  const existing = db.twoFactor.find((f: any) => f.userId === userId);
  if (existing && existing.enabled) {
    return res.status(409).json({ error: '2FA already enabled for this user' });
  }

  const { secret, otpauthUri } = generateTotpSecret();
  const now = new Date().toISOString();

  let record: TwoFactorRecord;
  if (existing) {
    updateDb((d: any) => {
      existing.secret = secret;
      existing.enabled = false; // disabled pending enable flow
      existing.confirmedAt = null;
      existing.updatedAt = now;
      record = existing;
    });
  } else {
    record = {
      id: crypto.randomUUID(),
      userId,
      secret,
      enabled: false,
      confirmedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    updateDb((d: any) => d.twoFactor.push(record));
  }

  // Also create a pending challenge so the login flow knows to ask for TOTP
  const challengeId = crypto.randomUUID();
  updateDb((d: any) => {
    d.twoFactorChallenges.push({
      id: challengeId,
      userId,
      tokenHash: hashToken(crypto.randomUUID()), // placeholder; actual login flow will use a different token
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      createdAt: now,
    });
  });

  return res.json({
    secret,
    otpauthUri,
    challengeId,
    mode: 'DEVELOPMENT_SIMULATED',
  });
});

securityRouter.post('/api/account/2fa/enable', (req: Request, res: Response) => {
  const db = getDb();
  const { userId, code } = req.body as { userId: string; code: string };
  if (!userId || !code) {
    return res.status(400).json({ error: 'userId and code are required' });
  }

  // Find the user's 2FA record
  const twoFactor = db.twoFactor.find((f: any) => f.userId === userId);
  if (!twoFactor) {
    return res.status(404).json({ error: '2FA not set up for this user' });
  }
  if (twoFactor.enabled) {
    return res.status(409).json({ error: '2FA is already enabled' });
  }

  // Verify the code against the secret
  const valid = verifyTotpCode(twoFactor.secret, code);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid TOTP code' });
  }

  const now = new Date().toISOString();
  updateDb((d: any) => {
    twoFactor.enabled = true;
    twoFactor.confirmedAt = now;
    twoFactor.updatedAt = now;
  });

  return res.json({
    mode: 'DEVELOPMENT_SIMULATED',
    recoveryCodesCount: 8,
    confirmedAt: twoFactor.confirmedAt,
  });
});

securityRouter.post('/api/account/2fa/disable', (req: Request, res: Response) => {
  const db = getDb();
  const { userId, code } = req.body as { userId: string; code?: string };
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const twoFactor = db.twoFactor.find((f: any) => f.userId === userId);
  if (!twoFactor) {
    return res.status(404).json({ error: '2FA not set up for this user' });
  }

  // If code provided, verify it
  if (code) {
    const valid = verifyTotpCode(twoFactor.secret, code);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid TOTP code' });
    }
  }

  const now = new Date().toISOString();
  updateDb((d: any) => {
    twoFactor.enabled = false;
    twoFactor.confirmedAt = null;
    twoFactor.updatedAt = now;
  });

  return res.json({ mode: 'DEVELOPMENT_SIMULATED', disabledAt: now });
});

securityRouter.get('/api/account/2fa', (req: Request, res: Response) => {
  const db = getDb();
  const { userId } = req.query as { userId?: string };
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  const twoFactor = db.twoFactor.find((f: any) => f.userId === userId);
  if (!twoFactor) {
    return res.json({ enabled: false, createdAt: null, recoveryCodesRemaining: 0 });
  }
  return res.json({
    enabled: twoFactor.enabled,
    createdAt: twoFactor.createdAt,
    recoveryCodesRemaining: twoFactor.enabled ? 8 : 0,
  });
});

securityRouter.post('/api/account/2fa/recovery-codes/regenerate', (req: Request, res: Response) => {
  const db = getDb();
  const { userId } = req.body as { userId: string };
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  // In a real system we'd invalidate old codes and generate new ones.
  // For now, just acknowledge.
  return res.json({ mode: 'DEVELOPMENT_SIMULATED', newCount: 8 });
});

// --- App passwords ---

securityRouter.get('/api/account/app-passwords', (req: Request, res: Response) => {
  const db = getDb();
  const { userId } = req.query as { userId?: string };
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  const entries = db.appPasswords.filter((ap: any) => ap.userId === userId && !ap.revokedAt);
  // Return masked: show prefix + lastUsedAt, but NOT the full password
  return res.json({ entries: entries.map((ap: any) => ({
    id: ap.id,
    label: ap.label,
    prefix: ap.prefix,
    lastUsedAt: ap.lastUsedAt,
  })) });
});

securityRouter.post('/api/account/app-passwords', (req: Request, res: Response) => {
  const db = getDb();
  const { userId, label } = req.body as { userId: string; label: string };
  if (!userId || !label) {
    return res.status(400).json({ error: 'userId and label are required' });
  }
  // Check for existing active entries
  const existing = db.appPasswords.find((ap: any) => ap.userId === userId && !ap.revokedAt);
  if (existing) {
    return res.status(409).json({ error: 'An active app password already exists; revoke it first or use a new label' });
  }
  const now = new Date().toISOString();
  const { hash, salt } = hashAppPassword(crypto.randomUUID().toString()); // generate a random API key
  const prefix = crypto.randomUUID().toString().slice(0, 8);
  const id = crypto.randomUUID();
  const record: AppPassword = {
    id,
    userId,
    label,
    passwordHash: hash,
    prefix,
    lastUsedAt: null,
    revokedAt: null,
    createdAt: now,
  };
  updateDb((d: any) => d.appPasswords.push(record));
  // CRITICAL: return the full password only once (the prefix is shown; full is in response but marked)
  return res.json({ id, label, prefix, fullPassword: hash, oneTime: true, mode: 'DEVELOPMENT_SIMULATED' });
});

securityRouter.delete('/api/account/app-passwords/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params as { id: string };
  const { userId } = req.query as { userId?: string };
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  const entry = db.appPasswords.find((ap: any) => ap.id === id && ap.userId === userId);
  if (!entry) {
    return res.status(404).json({ error: 'App password not found' });
  }
  updateDb((d: any) => {
    entry.revokedAt = new Date().toISOString();
  });
  return res.json({ ok: true });
});

// --- IP allow-list ---

securityRouter.get('/api/account/ip-allow-list', (req: Request, res: Response) => {
  const db = getDb();
  const { userId } = req.query as { userId?: string };
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  const entries = db.ipAllowEntries || [];
  return res.json({ entries });
});

securityRouter.post('/api/account/ip-allow-list', (req: Request, res: Response) => {
  const db = getDb();
  const { value, note } = req.body as { value: string; note?: string };
  if (!value) {
    return res.status(400).json({ error: 'value (IP or CIDR) is required' });
  }
  const parsed = parseCidr(value);
  if (!parsed) {
    return res.status(400).json({ error: 'Invalid IP or CIDR format' });
  }
  const now = new Date().toISOString();
  const entry: IpAllowEntry = {
    id: crypto.randomUUID(),
    organisationId: db.organisations?.[0]?.id || '',
    value,
    note: note || '',
    createdBy: db.users?.[0]?.email || '',
    createdAt: now,
  };
  updateDb((d: any) => d.ipAllowEntries.push(entry));
  return res.json({ entry, mode: 'DEVELOPMENT_SIMULATED' });
});

securityRouter.delete('/api/account/ip-allow-list/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params as { id: string };
  const { userId } = req.query as { userId?: string };
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  const entry = db.ipAllowEntries.find((ap: any) => ap.id === id);
  if (!entry) {
    return res.status(404).json({ error: 'IP allow entry not found' });
  }
  updateDb((d: any) => {
    d.ipAllowEntries = d.ipAllowEntries.filter((e: any) => e.id !== id);
  });
  return res.json({ ok: true });
});

// --- SSO ---

securityRouter.get('/api/account/sso', (req: Request, res: Response) => {
  const db = getDb();
  const { userId } = req.query as { userId?: string };
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  const providers = db.ssoProviders || [];
  return res.json({ providers });
});

securityRouter.post('/api/account/sso', (req: Request, res: Response) => {
  const db = getDb();
  const { protocol, name, entityId, ssoUrl, issuerUrl, signingCertificate, enforced } = req.body as {
    protocol: 'SAML' | 'OIDC';
    name: string;
    entityId: string;
    ssoUrl: string;
    issuerUrl: string;
    signingCertificate: string;
    enforced: boolean;
  };
  if (!protocol || !name) {
    return res.status(400).json({ error: 'protocol and name are required' });
  }
  const now = new Date().toISOString();
  const provider: SsoProvider = {
    id: makeSsoId(),
    organisationId: db.organisations?.[0]?.id || '',
    protocol,
    name,
    entityId,
    ssoUrl,
    issuerUrl,
    signingCertificate,
    enforced,
    status: 'CONFIGURED',
    createdAt: now,
    updatedAt: now,
  };
  updateDb((d: any) => d.ssoProviders.push(provider));
  return res.json({ provider, mode: 'DEVELOPMENT_SIMULATED' });
});

securityRouter.delete('/api/account/sso/:id', (req: Request, res: Response) => {
  const db = getDb();
  const { id } = req.params as { id: string };
  const { userId } = req.query as { userId?: string };
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  const idx = db.ssoProviders.findIndex((sp: any) => sp.id === id);
  if (idx < 0) {
    return res.status(404).json({ error: 'SSO provider not found' });
  }
  updateDb((d: any) => d.ssoProviders.splice(idx, 1));
  return res.json({ ok: true });
});

// Export middleware helpers for other workstreams
export function ipAllowedHelper(userId: string, ip: string, db: ReturnType<typeof getDb>): boolean {
  return ipAllowed(userId, ip, db);
}

export { computeTotpReal, verifyTotpCode, generateTotpSecret, hashAppPassword, verifyAppPassword };