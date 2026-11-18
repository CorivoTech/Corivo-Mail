import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export { sanitizeHtml } from '../shared/validation.ts';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatStorageMb(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${Math.round(mb)} MB`;
}

export interface DateTimePreferenceOptions {
  dateFormat?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  timeFormat?: '12h' | '24h';
  language?: string;
}

function formatDateParts(date: Date, timezone: string, dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  if (dateFormat === 'MM/DD/YYYY') return `${map.month}/${map.day}/${map.year}`;
  if (dateFormat === 'YYYY-MM-DD') return `${map.year}-${map.month}-${map.day}`;
  return `${map.day}/${map.month}/${map.year}`;
}

export function formatDateTime(
  iso: string | null | undefined,
  timezone = 'Asia/Kolkata',
  mode: 'short' | 'full' | 'time' = 'short',
  prefs?: DateTimePreferenceOptions
): string {
  if (!iso) return 'Never';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  const locale = prefs?.language || 'en-IN';
  const hour12 = prefs?.timeFormat ? prefs.timeFormat === '12h' : true;

  try {
    const timeStr = new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12,
    }).format(date);

    if (mode === 'time') {
      return timeStr;
    }
    if (mode === 'full') {
      if (prefs?.dateFormat) {
        return `${formatDateParts(date, timezone, prefs.dateFormat)}, ${timeStr}`;
      }
      return new Intl.DateTimeFormat(locale, {
        timeZone: timezone,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12,
      }).format(date);
    }
    const now = new Date();
    const sameDay =
      date.toLocaleDateString('en-CA', { timeZone: timezone }) ===
      now.toLocaleDateString('en-CA', { timeZone: timezone });
    if (sameDay) {
      return timeStr;
    }
    if (prefs?.dateFormat) {
      return formatDateParts(date, timezone, prefs.dateFormat);
    }
    return new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      day: '2-digit',
      month: 'short',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return 'CM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
