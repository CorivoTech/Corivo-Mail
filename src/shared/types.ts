export type RoleKey = 'PLATFORM_SUPER_ADMIN' | 'OWNER' | 'ADMIN' | 'MAILBOX_USER';

export type AccountStatus = 'ACTIVE' | 'SUSPENDED';

export type VerificationState = 'PENDING' | 'CHECKING' | 'VERIFIED' | 'FAILED';

export type DeliveryStatus =
  | 'DRAFT'
  | 'QUEUED'
  | 'ACCEPTED'
  | 'SENT_TO_RECEIVING_SERVER'
  | 'DELIVERED'
  | 'DEFERRED'
  | 'BOUNCED'
  | 'FAILED'
  | 'RECEIVED';

export type PermissionKey =
  | 'domains.manage'
  | 'mailboxes.create'
  | 'mailboxes.delete'
  | 'mailboxes.suspend'
  | 'users.manage'
  | 'quotas.change'
  | 'usage.view'
  | 'security.manage'
  | 'organisation.legal'
  | 'organisation.settings'
  | 'audit.view';

export interface Organisation {
  id: string;
  name: string;
  legalName: string;
  slug: string;
  logoUrl: string | null;
  businessCategory: string;
  country: string;
  size: string;
  primaryDomain: string | null;
  website: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  timezone: string;
  status: AccountStatus;
  storageQuotaMb: number;
  onboardingComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  displayName: string;
  jobTitle: string;
  department: string;
  phone: string;
  avatarUrl: string | null;
  status: AccountStatus;
  isPlatformAdmin: boolean;
  lastLoginAt: string | null;
  passwordUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type PublicUser = Omit<User, 'passwordHash'>;

export interface OrganisationMembership {
  id: string;
  organisationId: string;
  userId: string;
  roleKey: RoleKey;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RoleDefinition {
  id: string;
  key: RoleKey;
  name: string;
  description: string;
  permissions: PermissionKey[];
}

export interface Domain {
  id: string;
  organisationId: string;
  domainName: string;
  isPrimary: boolean;
  ownershipStatus: VerificationState;
  verificationToken: string;
  mxStatus: VerificationState;
  spfStatus: VerificationState;
  dkimStatus: VerificationState;
  dmarcStatus: VerificationState;
  tlsStatus: 'ENFORCED' | 'AVAILABLE' | 'UNKNOWN';
  dkimSelector: string;
  dkimPublicKey: string;
  dkimKeyRef: string;
  lastCheckedAt: string | null;
  verificationMode: 'DEVELOPMENT_SIMULATED' | 'LIVE_DNS';
  createdAt: string;
  updatedAt: string;
}

export interface DNSRecord {
  id: string;
  domainId: string;
  category: 'OWNERSHIP' | 'MX' | 'SPF' | 'DKIM' | 'DMARC';
  type: 'TXT' | 'MX' | 'CNAME';
  host: string;
  value: string;
  priority: number | null;
  ttl: number;
  status: VerificationState;
  lastCheckedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Mailbox {
  id: string;
  organisationId: string;
  domainId: string;
  userId: string;
  username: string;
  emailAddress: string;
  displayName: string;
  roleKey: RoleKey;
  status: AccountStatus;
  quotaMb: number;
  usedMb: number;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Alias {
  id: string;
  organisationId: string;
  aliasAddress: string;
  targetAddress: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DistributionGroup {
  id: string;
  organisationId: string;
  name: string;
  emailAddress: string;
  description: string;
  members: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MailFolder {
  id: string;
  mailboxId: string;
  name: string;
  slug: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Attachment {
  id: string;
  organisationId: string;
  mailboxId: string;
  messageId: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  scanStatus: 'PENDING' | 'CLEAN' | 'QUARANTINED';
  createdAt: string;
}

export interface EmailMessage {
  id: string;
  organisationId: string;
  mailboxId: string;
  folderSlug: string;
  threadId: string;
  externalStoreId: string;
  fromName: string;
  fromAddress: string;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  subject: string;
  snippet: string;
  bodyHtml: string;
  isRead: boolean;
  isStarred: boolean;
  snoozedUntil: string | null;
  deliveryStatus: DeliveryStatus;
  spamScore: number;
  sizeBytes: number;
  attachments: Attachment[];
  sentAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Draft {
  id: string;
  organisationId: string;
  mailboxId: string;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  subject: string;
  bodyHtml: string;
  attachmentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  organisationId: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  groupName: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  organisationId: string;
  userId: string;
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  attendees: string[];
  reminderMin: number;
  /** Other workspace members who can see this event (shared calendars). */
  sharedWith?: string[];
  /** Set when the event is an email invite that can be answered. */
  rsvpToken?: string;
  responses?: Array<{ email: string; status: 'NEEDS_ACTION' | 'ACCEPTED' | 'DECLINED'; updatedAt: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface SharedMailbox {
  id: string;
  organisationId: string;
  name: string;
  emailAddress: string;
  description: string;
  members: { email: string; access: 'READ_WRITE' | 'READ_ONLY' | 'SEND_AS' }[];
  recentActivity: string;
  createdAt: string;
}

export interface WorkspaceTask {
  id: string;
  organisationId: string;
  title: string;
  assigneeEmail: string;
  dueDate: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceNote {
  id: string;
  organisationId: string;
  userId: string;
  title: string;
  content: string;
  folder: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreference {
  id: string;
  userId: string;
  language: string;
  timezone: string;
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  timeFormat: '12h' | '24h';
  theme: 'light' | 'dark';
  density: 'comfortable' | 'compact';
  defaultReplyMode: 'reply' | 'reply_all';
  threadingEnabled: boolean;
  readingPane: 'right' | 'bottom' | 'off';
  defaultFont: string;
  confirmBeforeSend: boolean;
  signatureHtml: string;
  signatureEnabled: boolean;
  newEmailAlerts: boolean;
  browserNotifications: boolean;
  securityAlerts: boolean;
  productAnnouncements: boolean;
  updatedAt: string;
}

export interface UserNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  isRead: boolean;
  createdAt: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  device: string;
  browser: string;
  ipAddress: string;
  location: string | null;
  lastActiveAt: string;
  expiresAt: string;
  createdAt: string;
}

export interface PasswordResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

export interface SecurityEvent {
  id: string;
  organisationId: string | null;
  actorEmail: string;
  eventType:
    | 'LOGIN_SUCCESS'
    | 'LOGIN_FAILED'
    | 'ACCOUNT_SUSPENDED_ATTEMPT'
    | 'PASSWORD_CHANGED'
    | 'SESSION_REVOKED'
    | 'SPAM_BLOCKED'
    | 'MALWARE_QUARANTINED'
    | 'RATE_LIMIT_TRIGGERED';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  ipAddress: string;
  summary: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  organisationId: string | null;
  actorId: string | null;
  actorEmail: string;
  action: string;
  resource: string;
  ipAddress: string;
  result: 'SUCCESS' | 'DENIED' | 'FAILED';
  category: 'ADMIN_ACTIVITY' | 'COMPLIANCE_AUDIT' | 'PLATFORM_AUDIT';
  createdAt: string;
}

export interface DeliveryEvent {
  id: string;
  organisationId: string;
  messageRef: string;
  senderDomain: string;
  recipientDomain: string;
  status: DeliveryStatus;
  retryCount: number;
  failureReason: string | null;
  createdAt: string;
}

export interface MigrationJob {
  id: string;
  organisationId: string;
  sourceProvider: 'GMAIL' | 'ZOHO' | 'OUTLOOK' | 'IMAP';
  sourceAccount: string;
  targetMailbox: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  totalItems: number;
  successCount: number;
  failedCount: number;
  errorDetail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganisationSetting {
  id: string;
  organisationId: string;
  defaultLanguage: string;
  defaultTimezone: string;
  dateFormat: string;
  defaultQuotaMb: number;
  defaultRoleKey: RoleKey;
  minPasswordLength: number;
  requireComplexity: boolean;
  sessionTimeoutHours: number;
  maxLoginAttempts: number;
  enforce2fa: boolean;
  notifyDomainAlerts: boolean;
  notifyQuotaWarnings: boolean;
  notifySecurity: boolean;
  notifyDelivery: boolean;
  updatedAt: string;
}

export interface PlatformSetting {
  id: string;
  platformName: string;
  defaultQuotaMb: number;
  maxAttachmentMb: number;
  maintenanceNotice: string;
  allowPublicSignup: boolean;
  supportedDomainPolicy: string;
  updatedAt: string;
}

export interface PlatformOperator {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  scope: 'FULL_OPERATOR' | 'HEALTH_READONLY' | 'ORG_SUPPORT';
  status: AccountStatus;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// V1 / V2 feature records (blueprint sections 6–7)
// ---------------------------------------------------------------------------

/** TOTP enrolment state kept separate from User so existing seed rows stay valid. */
export interface TwoFactorRecord {
  id: string;
  userId: string;
  /** Base32 shared secret. Stored encrypted-at-rest in production (KMS/Vault reference). */
  secret: string;
  enabled: boolean;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Pending second-factor challenge bridging password step → TOTP step. */
export interface TwoFactorChallenge {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  createdAt: string;
}

/** IMAP/SMTP/POP3 credential for Outlook, Apple Mail and phone clients. */
export interface AppPassword {
  id: string;
  userId: string;
  label: string;
  passwordHash: string;
  /** Displayable prefix, e.g. `crvm-a91f`. Full value is only shown once at creation. */
  prefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface IpAllowEntry {
  id: string;
  organisationId: string;
  /** Single IPv4/IPv6 address or CIDR block. */
  value: string;
  note: string;
  createdBy: string;
  createdAt: string;
}

export interface SsoProvider {
  id: string;
  organisationId: string;
  protocol: 'SAML' | 'OIDC';
  name: string;
  entityId: string;
  ssoUrl: string;
  issuerUrl: string;
  signingCertificate: string;
  enforced: boolean;
  status: 'DISABLED' | 'CONFIGURED' | 'ACTIVE';
  createdAt: string;
  updatedAt: string;
}

/** Colour-coded label, orthogonal to folders (blueprint: "folders and labels"). */
export interface MailLabel {
  id: string;
  mailboxId: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export type MailRuleField = 'from' | 'to' | 'subject' | 'body' | 'hasAttachment';
export type MailRuleOperator = 'contains' | 'not_contains' | 'equals';
export type MailRuleActionType = 'move' | 'star' | 'markRead' | 'markSpam' | 'forward' | 'delete' | 'label';

export interface MailRuleCondition {
  field: MailRuleField;
  operator: MailRuleOperator;
  value: string;
}

export interface MailRuleAction {
  type: MailRuleActionType;
  value?: string;
}

/** Filter/rule evaluated on every inbound message (blueprint: filters/rules, V1). */
export interface MailRule {
  id: string;
  mailboxId: string;
  organisationId: string;
  name: string;
  enabled: boolean;
  stopProcessing: boolean;
  conditions: MailRuleCondition[];
  actions: MailRuleAction[];
  createdAt: string;
  updatedAt: string;
}

/** Vacation / out-of-office responder (blueprint: auto-reply, V1). */
export interface AutoReply {
  id: string;
  mailboxId: string;
  enabled: boolean;
  audience: 'ALL' | 'INTERNAL_ONLY' | 'EXTERNAL_ONLY';
  subject: string;
  bodyHtml: string;
  startAt: string | null;
  endAt: string | null;
  /** Guard so one message never triggers the same responder twice. */
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Per-mailbox automatic forwarding (blueprint: forwarding, V1). */
export interface MailboxForwarding {
  id: string;
  mailboxId: string;
  enabled: boolean;
  addresses: string[];
  keepCopy: boolean;
  updatedAt: string;
}

export type OutboundQueueStatus = 'PENDING_UNDO' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'CANCELLED' | 'FAILED';

/** Undo-send window and scheduled delivery both ride on this outbound queue. */
export interface OutboundQueueItem {
  id: string;
  organisationId: string;
  mailboxId: string;
  status: OutboundQueueStatus;
  undoUntil: string | null;
  scheduledAt: string | null;
  payload: {
    to: string[];
    cc: string[];
    bcc: string[];
    subject: string;
    bodyHtml: string;
    attachmentIds: string[];
    draftId?: string;
    inReplyToId?: string;
  };
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Internal annotation attached to a conversation (blueprint: comments on mail, V2). */
export interface MessageComment {
  id: string;
  organisationId: string;
  mailboxId: string;
  messageId: string;
  authorId: string;
  authorEmail: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactGroup {
  id: string;
  userId: string;
  organisationId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface BillingPlan {
  code: string;
  name: string;
  priceInrPerSeat: number;
  storageGb: number;
  trialDays: number;
  features: string[];
}

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED';

export interface Subscription {
  id: string;
  organisationId: string;
  planCode: string;
  seats: number;
  status: SubscriptionStatus;
  trialEndsAt: string | null;
  renewsAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPriceInr: number;
  amountInr: number;
}

export interface Invoice {
  id: string;
  organisationId: string;
  invoiceNumber: string;
  subscriptionId: string | null;
  lineItems: InvoiceLineItem[];
  subtotalInr: number;
  gstRate: number;
  gstInr: number;
  totalInr: number;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'VOID';
  billingName: string;
  billingGstin: string;
  billingAddress: string;
  periodStart: string;
  periodEnd: string;
  issuedAt: string;
  paidAt: string | null;
  createdAt: string;
}

export interface Payment {
  id: string;
  organisationId: string;
  invoiceId: string | null;
  provider: 'RAZORPAY' | 'STRIPE' | 'UPI';
  method: 'UPI' | 'CARD' | 'NETBANKING' | 'MANDATE';
  amountInr: number;
  status: 'CREATED' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'REFUNDED';
  providerRef: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Scoped bearer token for the public REST API (blueprint: public API, V2). */
export interface ApiToken {
  id: string;
  organisationId: string;
  name: string;
  tokenHash: string;
  prefix: string;
  scopes: Array<'mail:read' | 'mail:send' | 'domains:read' | 'mailboxes:read' | 'audit:read'>;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdBy: string;
  createdAt: string;
}

export type WebhookEvent =
  | 'mail.sent'
  | 'mail.delivered'
  | 'mail.bounced'
  | 'mail.quarantined'
  | 'domain.verified'
  | 'domain.dns_failed'
  | 'mailbox.created'
  | 'billing.invoice_issued';

export interface WebhookEndpoint {
  id: string;
  organisationId: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  status: 'ACTIVE' | 'PAUSED';
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  organisationId: string;
  event: WebhookEvent;
  payload: Record<string, unknown>;
  status: 'QUEUED' | 'SUCCESS' | 'FAILED';
  statusCode: number | null;
  signature: string;
  attempt: number;
  createdAt: string;
}

export interface IntegrationInstallation {
  id: string;
  organisationId: string;
  integrationId: string;
  status: 'ENABLED' | 'DISABLED';
  config: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

/** Legal hold + retention (blueprint: retention and legal hold, V2 / audit 1 year). */
export interface RetentionPolicy {
  id: string;
  organisationId: string;
  auditLogRetentionDays: number;
  messageRetentionDays: number | null;
  legalHoldEnabled: boolean;
  legalHoldNote: string;
  updatedAt: string;
}

export interface PushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
}

export interface AuthSessionPayload {
  user: PublicUser;
  organisation: Organisation | null;
  membership: OrganisationMembership | null;
  mailbox: Mailbox | null;
  permissions: PermissionKey[];
  preferences: UserPreference;
  runtimeMode: 'DEVELOPMENT_SIMULATED' | 'PRODUCTION';
  sessionId: string;
}
