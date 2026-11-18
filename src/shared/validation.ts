import { z } from 'zod';

export const domainRegex = /^(?!-)[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

export const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
  .regex(/[a-z]/, 'Password must include at least one lowercase letter')
  .regex(/[0-9]/, 'Password must include at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must include at least one special character');

export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid business email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, 'Full name is required').max(120),
    email: z.string().trim().email('Enter a valid business email address'),
    password: passwordSchema,
    confirmPassword: z.string(),
    organisationName: z.string().trim().min(2, 'Organisation name is required').max(120),
    country: z.string().trim().min(2, 'Country is required'),
    acceptTerms: z.literal(true, {
      error: 'You must accept the Terms of Service and Privacy Policy',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Enter a valid business email address'),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, 'Reset token is invalid'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const organisationSetupSchema = z.object({
  name: z.string().trim().min(2, 'Organisation name is required'),
  legalName: z.string().trim().optional().default(''),
  businessCategory: z.string().trim().min(2, 'Business category is required'),
  country: z.string().trim().min(2, 'Country is required'),
  size: z.string().trim().min(1, 'Organisation size is required'),
  website: z.string().trim().optional().default(''),
  contactEmail: z.string().trim().email('Valid contact email is required'),
  contactPhone: z.string().trim().optional().default(''),
  address: z.string().trim().optional().default(''),
  timezone: z.string().trim().min(2, 'Timezone is required'),
});

export const addDomainSchema = z.object({
  domainName: z
    .string()
    .trim()
    .toLowerCase()
    .regex(domainRegex, 'Enter a valid domain name such as company.com'),
  isPrimary: z.boolean().optional().default(false),
});

export const createMailboxSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]+$/, 'Username can only contain lowercase letters, numbers, dots, hyphens, and underscores'),
  domainId: z.string().min(1, 'Select a domain'),
  password: passwordSchema,
  roleKey: z.enum(['OWNER', 'ADMIN', 'MAILBOX_USER']),
  quotaMb: z.number().int().min(1024).max(1024000),
});

export const sendMailSchema = z.object({
  to: z.array(z.string().trim().email('Invalid recipient email address')).min(1, 'At least one recipient is required'),
  cc: z.array(z.string().trim().email('Invalid CC email address')).optional().default([]),
  bcc: z.array(z.string().trim().email('Invalid BCC email address')).optional().default([]),
  subject: z.string().trim().min(1, 'Subject is required').max(300),
  bodyHtml: z.string().min(1, 'Message body cannot be empty'),
  attachmentIds: z.array(z.string()).optional().default([]),
  draftId: z.string().optional(),
  inReplyToId: z.string().optional(),
});

export const draftSchema = z.object({
  to: z.array(z.string()).optional().default([]),
  cc: z.array(z.string()).optional().default([]),
  bcc: z.array(z.string()).optional().default([]),
  subject: z.string().optional().default(''),
  bodyHtml: z.string().optional().default(''),
  attachmentIds: z.array(z.string()).optional().default([]),
});

export const avatarDataUriRegex = /^data:image\/(png|jpeg|jpg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/i;

export const profileUpdateSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(60),
  lastName: z.string().trim().min(1, 'Last name is required').max(60),
  displayName: z.string().trim().min(2, 'Display name is required').max(100),
  jobTitle: z.string().trim().max(100).optional().default(''),
  department: z.string().trim().max(100).optional().default(''),
  phone: z
    .string()
    .trim()
    .max(30, 'Phone number is too long')
    .regex(/^[0-9+\-().\s]*$/, 'Phone number contains invalid characters')
    .optional()
    .default(''),
  avatarUrl: z
    .string()
    .max(500_000, 'Profile photo payload is too large')
    .regex(avatarDataUriRegex, 'Profile photo must be a PNG, JPG, WebP, or SVG image')
    .nullable()
    .optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
    invalidateOtherSessions: z.boolean().optional().default(true),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'New passwords do not match',
    path: ['confirmPassword'],
  });

export const contactSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required'),
  email: z.string().trim().email('Valid email is required'),
  phone: z.string().trim().optional().default(''),
  company: z.string().trim().optional().default(''),
  jobTitle: z.string().trim().optional().default(''),
  groupName: z.string().trim().optional().default('General'),
  notes: z.string().trim().optional().default(''),
});

export const calendarEventSchema = z
  .object({
    title: z.string().trim().min(2, 'Event title is required').max(150),
    description: z.string().trim().max(2000).optional().default(''),
    location: z.string().trim().max(200).optional().default(''),
    startAt: z.string().min(1, 'Start time is required').refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid start time'),
    endAt: z.string().min(1, 'End time is required').refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid end time'),
    attendees: z.array(z.string().trim().email('Invalid attendee email')).max(50).optional().default([]),
    reminderMin: z.number().int().min(0).max(1440).default(15),
  })
  .refine((data) => Date.parse(data.endAt) >= Date.parse(data.startAt), {
    message: 'End time must be after or equal to start time',
    path: ['endAt'],
  });

export function isValidIanaTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function sanitizeHtml(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<(iframe|object|embed|form|meta|link|base|svg|math|template|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(iframe|object|embed|form|meta|link|base|svg|math|template|noscript)\b[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\ssrcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src|action|formaction|xlink:href)\s*=\s*(["'])\s*(?:javascript|vbscript|data\s*:\s*text\/html|data\s*:\s*application)[^"']*\2/gi, '$1="#"')
    .replace(/(href|src|action|formaction|xlink:href)\s*=\s*(?:javascript|vbscript|data\s*:\s*text\/html)[^\s>]*/gi, '$1="#"');
}

