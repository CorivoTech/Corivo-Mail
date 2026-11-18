import type { NextFunction, Request, Response } from 'express';

interface WindowEntry {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowEntry>();

/** Opportunistic cleanup so the map cannot grow without bound (blueprint §9). */
function sweep(now: number): void {
  if (windows.size < 5000) return;
  for (const [key, entry] of windows) {
    if (entry.resetAt <= now) windows.delete(key);
  }
}

/**
 * Fixed-window per-IP rate limiter for mutating and read-heavy API traffic.
 * Complements the stricter per-account login limiter in middleware/auth.ts
 * (blueprint §9: "brute-force protection and rate limiting").
 */
export function apiRateLimit(options: { windowMs?: number; max?: number; prefix?: string } = {}) {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 300;
  const prefix = options.prefix ?? 'api';

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api/')) return next();

    const now = Date.now();
    sweep(now);
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${prefix}:${ip}`;
    const entry = windows.get(key);

    if (!entry || entry.resetAt <= now) {
      windows.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'Too many requests. Please slow down and try again shortly.',
      });
    }
    return next();
  };
}

/** Exposed for tests so rate-limit state can be cleared between cases. */
export function resetRateLimitsForTests(): void {
  windows.clear();
}
