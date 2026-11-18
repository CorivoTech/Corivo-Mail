import crypto from 'node:crypto';
import type { Request } from 'express';

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, expectedHex] = parts;
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(derived, expected);
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateOpaqueToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function parseClientContext(req: Request): {
  device: string;
  browser: string;
  ipAddress: string;
  location: string | null;
} {
  const ua = String(req.headers['user-agent'] || 'Unknown client');
  let browser = 'Unknown browser';
  if (ua.includes('Edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome/')) browser = 'Google Chrome';
  else if (ua.includes('Firefox/')) browser = 'Mozilla Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Apple Safari';
  else if (ua.includes('curl/')) browser = 'cURL CLI';

  let device = 'Desktop';
  if (/Mobile|Android|iPhone/i.test(ua)) device = 'Mobile';
  else if (/iPad|Tablet/i.test(ua)) device = 'Tablet';
  else if (/Macintosh|Mac OS X/i.test(ua)) device = 'macOS Workstation';
  else if (/Windows/i.test(ua)) device = 'Windows Workstation';
  else if (/Linux/i.test(ua)) device = 'Linux Workstation';

  const trustProxy = process.env.TRUST_PROXY === 'true';
  const forwarded = trustProxy ? req.headers['x-forwarded-for'] : undefined;
  const rawIp = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : req.socket?.remoteAddress || req.ip || '127.0.0.1';

  // Never invent geolocation; only show if header from reverse proxy exists
  const countryHeader = req.headers['x-appengine-country'] || req.headers['cf-ipcountry'];
  const location = typeof countryHeader === 'string' && countryHeader !== 'ZZ' ? countryHeader : null;

  return {
    device,
    browser,
    ipAddress: rawIp,
    location,
  };
}
