import fs from 'node:fs';
import path from 'node:path';
import { createSeedDatabase, normalizeDatabase, type CorivoDatabase } from './seed.ts';

const DATA_DIR = process.env.CORIVO_DATA_DIR
  ? path.resolve(process.env.CORIVO_DATA_DIR)
  : path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'corivo-mail-db.json');
export const ATTACHMENTS_DIR = path.join(DATA_DIR, 'attachments');

let cachedDb: CorivoDatabase | null = null;

export function resetDbCacheForTests(): void {
  cachedDb = null;
}

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ATTACHMENTS_DIR)) {
    fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
  }
}

export function getDb(): CorivoDatabase {
  if (cachedDb) return cachedDb;
  ensureDirs();
  if (fs.existsSync(DB_FILE)) {
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      // Backfill any collections introduced after this file was written.
      cachedDb = normalizeDatabase(JSON.parse(raw) as Partial<CorivoDatabase>);
      return cachedDb;
    } catch (err) {
      const backupFile = `${DB_FILE}.corrupt-${Date.now()}.bak`;
      try {
        fs.copyFileSync(DB_FILE, backupFile);
      } catch {
        // Ignore backup failure if unreadable
      }
      console.error(`Failed to parse persisted DB file (backup saved to ${path.basename(backupFile)}), regenerating seed:`, err);
    }
  }
  cachedDb = createSeedDatabase();
  persistDb(cachedDb);
  return cachedDb;
}

export function persistDb(db: CorivoDatabase): void {
  ensureDirs();
  const tmpFile = `${DB_FILE}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}.tmp`;
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
    cachedDb = db;
  } catch (err) {
    if (fs.existsSync(tmpFile)) {
      try {
        fs.unlinkSync(tmpFile);
      } catch {
        // Ignore cleanup failure
      }
    }
    throw err;
  }
}

export function updateDb<T>(mutator: (db: CorivoDatabase) => T): T {
  const db = getDb();
  const result = mutator(db);
  persistDb(db);
  return result;
}
