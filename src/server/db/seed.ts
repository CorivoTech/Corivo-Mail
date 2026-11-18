import type {
  Alias,
  ApiToken,
  AppPassword,
  Attachment,
  AuditLog,
  AutoReply,
  BillingPlan,
  CalendarEvent,
  Contact,
  ContactGroup,
  DeliveryEvent,
  DistributionGroup,
  DNSRecord,
  Domain,
  Draft,
  EmailMessage,
  IntegrationInstallation,
  Invoice,
  IpAllowEntry,
  Mailbox,
  MailboxForwarding,
  MailFolder,
  MailLabel,
  MailRule,
  MigrationJob,
  MessageComment,
  Organisation,
  OrganisationMembership,
  OrganisationSetting,
  OutboundQueueItem,
  PasswordResetToken,
  PermissionKey,
  Payment,
  PlatformOperator,
  PlatformSetting,
  PushSubscription,
  RetentionPolicy,
  RoleKey,
  SecurityEvent,
  SessionRecord,
  SharedMailbox,
  SsoProvider,
  Subscription,
  TwoFactorChallenge,
  TwoFactorRecord,
  User,
  UserNotification,
  UserPreference,
  WebhookDelivery,
  WebhookEndpoint,
  WorkspaceNote,
  WorkspaceTask,
} from '../../shared/types.ts';
import { hashPassword, hashToken } from '../security/password.ts';

export interface CorivoDatabase {
  organisations: Organisation[];
  users: User[];
  memberships: OrganisationMembership[];
  roleOverrides: Record<string, Record<RoleKey, PermissionKey[]>>;
  domains: Domain[];
  dnsRecords: DNSRecord[];
  mailboxes: Mailbox[];
  aliases: Alias[];
  distributionGroups: DistributionGroup[];
  folders: MailFolder[];
  messages: EmailMessage[];
  drafts: Draft[];
  attachments: Attachment[];
  contacts: Contact[];
  contactGroups: ContactGroup[];
  calendarEvents: CalendarEvent[];
  sharedMailboxes: SharedMailbox[];
  tasks: WorkspaceTask[];
  notes: WorkspaceNote[];
  userPreferences: UserPreference[];
  notifications: UserNotification[];
  sessions: SessionRecord[];
  passwordResetTokens: PasswordResetToken[];
  securityEvents: SecurityEvent[];
  auditLogs: AuditLog[];
  deliveryEvents: DeliveryEvent[];
  migrationJobs: MigrationJob[];
  organisationSettings: OrganisationSetting[];
  platformSettings: PlatformSetting;
  platformOperators: PlatformOperator[];
  // V1/V2 feature records
  twoFactor: TwoFactorRecord[];
  twoFactorChallenges: TwoFactorChallenge[];
  appPasswords: AppPassword[];
  ipAllowEntries: IpAllowEntry[];
  ssoProviders: SsoProvider[];
  mailLabels: MailLabel[];
  mailRules: MailRule[];
  autoReplies: AutoReply[];
  mailboxForwarding: MailboxForwarding[];
  outboundQueue: OutboundQueueItem[];
  messageComments: MessageComment[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  payments: Payment[];
  apiTokens: ApiToken[];
  webhookEndpoints: WebhookEndpoint[];
  webhookDeliveries: WebhookDelivery[];
  integrationInstallations: IntegrationInstallation[];
  retentionPolicies: RetentionPolicy[];
  pushSubscriptions: PushSubscription[];
}

/** Catalog of sellable plans (blueprint: plans per user per month). */
export const BILLING_PLANS: BillingPlan[] = [
  {
    code: 'STARTER',
    name: 'Starter',
    priceInrPerSeat: 149,
    storageGb: 10,
    trialDays: 14,
    features: ['10 GB mailbox storage', '1 custom domain', 'SPF & DKIM authentication', 'Webmail, contacts & calendar'],
  },
  {
    code: 'BUSINESS',
    name: 'Business',
    priceInrPerSeat: 299,
    storageGb: 30,
    trialDays: 14,
    features: ['30 GB mailbox storage', 'Up to 10 domains', 'Aliases, groups & shared mailboxes', 'Deliverability & queue monitoring'],
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    priceInrPerSeat: 549,
    storageGb: 100,
    trialDays: 30,
    features: ['100 GB mailbox storage', 'Unlimited domains', 'Compliance audit logs & retention', 'Dedicated migration & security policies'],
  },
];

/** Empty collections required by every database produced by older seeds or loaded from disk. */
export function emptyFeatureCollections(): Pick<
  CorivoDatabase,
  | 'twoFactor'
  | 'twoFactorChallenges'
  | 'appPasswords'
  | 'ipAllowEntries'
  | 'ssoProviders'
  | 'mailLabels'
  | 'mailRules'
  | 'autoReplies'
  | 'mailboxForwarding'
  | 'outboundQueue'
  | 'messageComments'
  | 'contactGroups'
  | 'subscriptions'
  | 'invoices'
  | 'payments'
  | 'apiTokens'
  | 'webhookEndpoints'
  | 'webhookDeliveries'
  | 'integrationInstallations'
  | 'retentionPolicies'
  | 'pushSubscriptions'
> {
  return {
    twoFactor: [],
    twoFactorChallenges: [],
    appPasswords: [],
    ipAllowEntries: [],
    ssoProviders: [],
    mailLabels: [],
    mailRules: [],
    autoReplies: [],
    mailboxForwarding: [],
    outboundQueue: [],
    messageComments: [],
    contactGroups: [],
    subscriptions: [],
    invoices: [],
    payments: [],
    apiTokens: [],
    webhookEndpoints: [],
    webhookDeliveries: [],
    integrationInstallations: [],
    retentionPolicies: [],
    pushSubscriptions: [],
  };
}

/**
 * Backfills feature collections onto a database loaded from an existing JSON file so
 * data written by an older build keeps working after an upgrade (blueprint §5 migrations).
 */
export function normalizeDatabase(db: Partial<CorivoDatabase> & Record<string, unknown>): CorivoDatabase {
  const filled = emptyFeatureCollections();
  for (const [key, value] of Object.entries(filled)) {
    if (!Array.isArray(db[key as keyof CorivoDatabase])) {
      (db as Record<string, unknown>)[key] = value;
    }
  }
  if (!db.roleOverrides) db.roleOverrides = {};
  return db as CorivoDatabase;
}

export const DEV_DEMO_PASSWORD = 'CorivoDev!2026';

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 3600 * 1000).toISOString();
}

export function createSeedDatabase(): CorivoDatabase {
  const demoHash = hashPassword(DEV_DEMO_PASSWORD);
  const now = new Date().toISOString();

  const orgCorivoId = '11111111-1111-4111-8111-111111111101';
  const orgVanguardId = '11111111-1111-4111-8111-111111111102';

  const userRazeenId = '22222222-2222-4222-8222-222222222201';
  const userAdminId = '22222222-2222-4222-8222-222222222202';
  const userAnanyaId = '22222222-2222-4222-8222-222222222203';
  const userVikramId = '22222222-2222-4222-8222-222222222204';
  const userSuspendedId = '22222222-2222-4222-8222-222222222205';
  const userPriyaId = '22222222-2222-4222-8222-222222222206';
  const userPlatformId = '22222222-2222-4222-8222-222222222207';

  const domainPrimaryId = '33333333-3333-4333-8333-333333333301';
  const domainSecondaryId = '33333333-3333-4333-8333-333333333302';
  const domainVanguardId = '33333333-3333-4333-8333-333333333303';

  const mailboxRazeenId = '44444444-4444-4444-8444-444444444401';
  const mailboxAdminId = '44444444-4444-4444-8444-444444444402';
  const mailboxAnanyaId = '44444444-4444-4444-8444-444444444403';
  const mailboxVikramId = '44444444-4444-4444-8444-444444444404';
  const mailboxSuspendedId = '44444444-4444-4444-8444-444444444405';
  const mailboxPriyaId = '44444444-4444-4444-8444-444444444406';

  const organisations: Organisation[] = [
    {
      id: orgCorivoId,
      name: 'Corivo Technologies',
      legalName: 'Corivo Technologies Private Limited',
      slug: 'corivo-technologies',
      logoUrl: null,
      businessCategory: 'Technology & Software',
      country: 'India',
      size: '11-50 employees',
      primaryDomain: 'corivotech.example',
      website: 'https://corivotech.example',
      contactEmail: 'razeen@corivotech.example',
      contactPhone: '+91 80 4120 8890',
      address: 'Indiranagar 100 Feet Road, Bengaluru, Karnataka 560038',
      timezone: 'Asia/Kolkata',
      status: 'ACTIVE',
      storageQuotaMb: 102400,
      onboardingComplete: true,
      createdAt: hoursAgo(720),
      updatedAt: hoursAgo(2),
    },
    {
      id: orgVanguardId,
      name: 'Vanguard Logistics Pvt Ltd',
      legalName: 'Vanguard Logistics Services Private Limited',
      slug: 'vanguard-logistics',
      logoUrl: null,
      businessCategory: 'Logistics & Supply Chain',
      country: 'India',
      size: '51-200 employees',
      primaryDomain: 'vanguardlogistics.example',
      website: 'https://vanguardlogistics.example',
      contactEmail: 'priya@vanguardlogistics.example',
      contactPhone: '+91 22 6789 4410',
      address: 'Andheri East, Mumbai, Maharashtra 400069',
      timezone: 'Asia/Kolkata',
      status: 'ACTIVE',
      storageQuotaMb: 204800,
      onboardingComplete: true,
      createdAt: hoursAgo(480),
      updatedAt: hoursAgo(12),
    },
  ];

  const users: User[] = [
    {
      id: userRazeenId,
      email: 'razeen@corivotech.example',
      passwordHash: demoHash,
      firstName: 'Razeen',
      lastName: 'Iqbal',
      displayName: 'Razeen Iqbal',
      jobTitle: 'Founder & Managing Director',
      department: 'Executive',
      phone: '+91 98450 11223',
      avatarUrl: null,
      status: 'ACTIVE',
      isPlatformAdmin: false,
      lastLoginAt: hoursAgo(1),
      passwordUpdatedAt: hoursAgo(300),
      createdAt: hoursAgo(720),
      updatedAt: hoursAgo(1),
    },
    {
      id: userAdminId,
      email: 'admin@corivotech.example',
      passwordHash: demoHash,
      firstName: 'Aarav',
      lastName: 'Mehta',
      displayName: 'Aarav Mehta',
      jobTitle: 'IT & Mail Administrator',
      department: 'Operations',
      phone: '+91 98450 22334',
      avatarUrl: null,
      status: 'ACTIVE',
      isPlatformAdmin: false,
      lastLoginAt: hoursAgo(4),
      passwordUpdatedAt: hoursAgo(240),
      createdAt: hoursAgo(680),
      updatedAt: hoursAgo(4),
    },
    {
      id: userAnanyaId,
      email: 'ananya@corivotech.example',
      passwordHash: demoHash,
      firstName: 'Ananya',
      lastName: 'Sharma',
      displayName: 'Ananya Sharma',
      jobTitle: 'Finance Lead',
      department: 'Finance',
      phone: '+91 98450 33445',
      avatarUrl: null,
      status: 'ACTIVE',
      isPlatformAdmin: false,
      lastLoginAt: hoursAgo(6),
      passwordUpdatedAt: hoursAgo(200),
      createdAt: hoursAgo(600),
      updatedAt: hoursAgo(6),
    },
    {
      id: userVikramId,
      email: 'vikram@corivotech.example',
      passwordHash: demoHash,
      firstName: 'Vikram',
      lastName: 'Nair',
      displayName: 'Vikram Nair',
      jobTitle: 'Customer Success Engineer',
      department: 'Support',
      phone: '+91 98450 44556',
      avatarUrl: null,
      status: 'ACTIVE',
      isPlatformAdmin: false,
      lastLoginAt: hoursAgo(18),
      passwordUpdatedAt: hoursAgo(150),
      createdAt: hoursAgo(500),
      updatedAt: hoursAgo(18),
    },
    {
      id: userSuspendedId,
      email: 'suspended@corivotech.example',
      passwordHash: demoHash,
      firstName: 'Karan',
      lastName: 'Verma',
      displayName: 'Karan Verma',
      jobTitle: 'Former Contractor',
      department: 'Operations',
      phone: '',
      avatarUrl: null,
      status: 'SUSPENDED',
      isPlatformAdmin: false,
      lastLoginAt: hoursAgo(240),
      passwordUpdatedAt: hoursAgo(400),
      createdAt: hoursAgo(450),
      updatedAt: hoursAgo(48),
    },
    {
      id: userPriyaId,
      email: 'priya@vanguardlogistics.example',
      passwordHash: demoHash,
      firstName: 'Priya',
      lastName: 'Kapoor',
      displayName: 'Priya Kapoor',
      jobTitle: 'Chief Operating Officer',
      department: 'Executive',
      phone: '+91 98201 77889',
      avatarUrl: null,
      status: 'ACTIVE',
      isPlatformAdmin: false,
      lastLoginAt: hoursAgo(3),
      passwordUpdatedAt: hoursAgo(180),
      createdAt: hoursAgo(480),
      updatedAt: hoursAgo(3),
    },
    {
      id: userPlatformId,
      email: 'operator@corivomail.example',
      passwordHash: demoHash,
      firstName: 'Siddharth',
      lastName: 'Rao',
      displayName: 'Siddharth Rao',
      jobTitle: 'Platform Infrastructure Lead',
      department: 'Corivo Platform Ops',
      phone: '+91 80 4120 0001',
      avatarUrl: null,
      status: 'ACTIVE',
      isPlatformAdmin: true,
      lastLoginAt: hoursAgo(2),
      passwordUpdatedAt: hoursAgo(120),
      createdAt: hoursAgo(800),
      updatedAt: hoursAgo(2),
    },
  ];

  const memberships: OrganisationMembership[] = [
    { id: 'mem-1', organisationId: orgCorivoId, userId: userRazeenId, roleKey: 'OWNER', status: 'ACTIVE', createdAt: hoursAgo(720), updatedAt: now },
    { id: 'mem-2', organisationId: orgCorivoId, userId: userAdminId, roleKey: 'ADMIN', status: 'ACTIVE', createdAt: hoursAgo(680), updatedAt: now },
    { id: 'mem-3', organisationId: orgCorivoId, userId: userAnanyaId, roleKey: 'MAILBOX_USER', status: 'ACTIVE', createdAt: hoursAgo(600), updatedAt: now },
    { id: 'mem-4', organisationId: orgCorivoId, userId: userVikramId, roleKey: 'MAILBOX_USER', status: 'ACTIVE', createdAt: hoursAgo(500), updatedAt: now },
    { id: 'mem-5', organisationId: orgCorivoId, userId: userSuspendedId, roleKey: 'MAILBOX_USER', status: 'SUSPENDED', createdAt: hoursAgo(450), updatedAt: now },
    { id: 'mem-6', organisationId: orgVanguardId, userId: userPriyaId, roleKey: 'OWNER', status: 'ACTIVE', createdAt: hoursAgo(480), updatedAt: now },
  ];

  const domains: Domain[] = [
    {
      id: domainPrimaryId,
      organisationId: orgCorivoId,
      domainName: 'corivotech.example',
      isPrimary: true,
      ownershipStatus: 'VERIFIED',
      verificationToken: 'corivo-verify=8f3c91a4d2e07b11',
      mxStatus: 'VERIFIED',
      spfStatus: 'VERIFIED',
      dkimStatus: 'VERIFIED',
      dmarcStatus: 'VERIFIED',
      tlsStatus: 'ENFORCED',
      dkimSelector: 'corivo1',
      dkimPublicKey: 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAy8xK9q2...',
      dkimKeyRef: 'kms://corivo-dev/dkim/corivotech.example',
      lastCheckedAt: hoursAgo(2),
      verificationMode: 'DEVELOPMENT_SIMULATED',
      createdAt: hoursAgo(720),
      updatedAt: hoursAgo(2),
    },
    {
      id: domainSecondaryId,
      organisationId: orgCorivoId,
      domainName: 'corivoapps.example',
      isPrimary: false,
      ownershipStatus: 'PENDING',
      verificationToken: 'corivo-verify=2d904b77ac185f30',
      mxStatus: 'PENDING',
      spfStatus: 'PENDING',
      dkimStatus: 'PENDING',
      dmarcStatus: 'PENDING',
      tlsStatus: 'UNKNOWN',
      dkimSelector: 'corivo1',
      dkimPublicKey: 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAr1vZ8p4...',
      dkimKeyRef: 'kms://corivo-dev/dkim/corivoapps.example',
      lastCheckedAt: null,
      verificationMode: 'DEVELOPMENT_SIMULATED',
      createdAt: hoursAgo(24),
      updatedAt: hoursAgo(24),
    },
    {
      id: domainVanguardId,
      organisationId: orgVanguardId,
      domainName: 'vanguardlogistics.example',
      isPrimary: true,
      ownershipStatus: 'VERIFIED',
      verificationToken: 'corivo-verify=9a71c308fe214b66',
      mxStatus: 'VERIFIED',
      spfStatus: 'VERIFIED',
      dkimStatus: 'VERIFIED',
      dmarcStatus: 'FAILED',
      tlsStatus: 'AVAILABLE',
      dkimSelector: 'corivo1',
      dkimPublicKey: 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv7tR4m9...',
      dkimKeyRef: 'kms://corivo-dev/dkim/vanguardlogistics.example',
      lastCheckedAt: hoursAgo(5),
      verificationMode: 'DEVELOPMENT_SIMULATED',
      createdAt: hoursAgo(480),
      updatedAt: hoursAgo(5),
    },
  ];

  const dnsRecords: DNSRecord[] = [
    { id: 'dns-1', domainId: domainPrimaryId, category: 'OWNERSHIP', type: 'TXT', host: '@', value: 'corivo-verify=8f3c91a4d2e07b11', priority: null, ttl: 3600, status: 'VERIFIED', lastCheckedAt: hoursAgo(2), errorMessage: null, createdAt: hoursAgo(720), updatedAt: hoursAgo(2) },
    { id: 'dns-2', domainId: domainPrimaryId, category: 'MX', type: 'MX', host: '@', value: 'mx1.corivomail.example', priority: 10, ttl: 3600, status: 'VERIFIED', lastCheckedAt: hoursAgo(2), errorMessage: null, createdAt: hoursAgo(720), updatedAt: hoursAgo(2) },
    { id: 'dns-3', domainId: domainPrimaryId, category: 'MX', type: 'MX', host: '@', value: 'mx2.corivomail.example', priority: 20, ttl: 3600, status: 'VERIFIED', lastCheckedAt: hoursAgo(2), errorMessage: null, createdAt: hoursAgo(720), updatedAt: hoursAgo(2) },
    { id: 'dns-4', domainId: domainPrimaryId, category: 'SPF', type: 'TXT', host: '@', value: 'v=spf1 include:_spf.corivomail.example ~all', priority: null, ttl: 3600, status: 'VERIFIED', lastCheckedAt: hoursAgo(2), errorMessage: null, createdAt: hoursAgo(720), updatedAt: hoursAgo(2) },
    { id: 'dns-5', domainId: domainPrimaryId, category: 'DKIM', type: 'TXT', host: 'corivo1._domainkey', value: 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAy8xK9q2...', priority: null, ttl: 3600, status: 'VERIFIED', lastCheckedAt: hoursAgo(2), errorMessage: null, createdAt: hoursAgo(720), updatedAt: hoursAgo(2) },
    { id: 'dns-6', domainId: domainPrimaryId, category: 'DMARC', type: 'TXT', host: '_dmarc', value: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@corivotech.example; pct=100', priority: null, ttl: 3600, status: 'VERIFIED', lastCheckedAt: hoursAgo(2), errorMessage: null, createdAt: hoursAgo(720), updatedAt: hoursAgo(2) },

    { id: 'dns-7', domainId: domainSecondaryId, category: 'OWNERSHIP', type: 'TXT', host: '@', value: 'corivo-verify=2d904b77ac185f30', priority: null, ttl: 3600, status: 'PENDING', lastCheckedAt: null, errorMessage: null, createdAt: hoursAgo(24), updatedAt: hoursAgo(24) },
    { id: 'dns-8', domainId: domainSecondaryId, category: 'MX', type: 'MX', host: '@', value: 'mx1.corivomail.example', priority: 10, ttl: 3600, status: 'PENDING', lastCheckedAt: null, errorMessage: null, createdAt: hoursAgo(24), updatedAt: hoursAgo(24) },
    { id: 'dns-9', domainId: domainSecondaryId, category: 'SPF', type: 'TXT', host: '@', value: 'v=spf1 include:_spf.corivomail.example ~all', priority: null, ttl: 3600, status: 'PENDING', lastCheckedAt: null, errorMessage: null, createdAt: hoursAgo(24), updatedAt: hoursAgo(24) },
    { id: 'dns-10', domainId: domainSecondaryId, category: 'DKIM', type: 'TXT', host: 'corivo1._domainkey', value: 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAr1vZ8p4...', priority: null, ttl: 3600, status: 'PENDING', lastCheckedAt: null, errorMessage: null, createdAt: hoursAgo(24), updatedAt: hoursAgo(24) },
    { id: 'dns-11', domainId: domainSecondaryId, category: 'DMARC', type: 'TXT', host: '_dmarc', value: 'v=DMARC1; p=none; rua=mailto:dmarc@corivoapps.example', priority: null, ttl: 3600, status: 'PENDING', lastCheckedAt: null, errorMessage: null, createdAt: hoursAgo(24), updatedAt: hoursAgo(24) },

    { id: 'dns-12', domainId: domainVanguardId, category: 'OWNERSHIP', type: 'TXT', host: '@', value: 'corivo-verify=9a71c308fe214b66', priority: null, ttl: 3600, status: 'VERIFIED', lastCheckedAt: hoursAgo(5), errorMessage: null, createdAt: hoursAgo(480), updatedAt: hoursAgo(5) },
    { id: 'dns-13', domainId: domainVanguardId, category: 'MX', type: 'MX', host: '@', value: 'mx1.corivomail.example', priority: 10, ttl: 3600, status: 'VERIFIED', lastCheckedAt: hoursAgo(5), errorMessage: null, createdAt: hoursAgo(480), updatedAt: hoursAgo(5) },
    { id: 'dns-14', domainId: domainVanguardId, category: 'SPF', type: 'TXT', host: '@', value: 'v=spf1 include:_spf.corivomail.example ~all', priority: null, ttl: 3600, status: 'VERIFIED', lastCheckedAt: hoursAgo(5), errorMessage: null, createdAt: hoursAgo(480), updatedAt: hoursAgo(5) },
    { id: 'dns-15', domainId: domainVanguardId, category: 'DKIM', type: 'TXT', host: 'corivo1._domainkey', value: 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv7tR4m9...', priority: null, ttl: 3600, status: 'VERIFIED', lastCheckedAt: hoursAgo(5), errorMessage: null, createdAt: hoursAgo(480), updatedAt: hoursAgo(5) },
    { id: 'dns-16', domainId: domainVanguardId, category: 'DMARC', type: 'TXT', host: '_dmarc', value: 'v=DMARC1; p=quarantine', priority: null, ttl: 3600, status: 'FAILED', lastCheckedAt: hoursAgo(5), errorMessage: 'Missing DMARC TXT record at _dmarc.vanguardlogistics.example', createdAt: hoursAgo(480), updatedAt: hoursAgo(5) },
  ];

  const mailboxes: Mailbox[] = [
    { id: mailboxRazeenId, organisationId: orgCorivoId, domainId: domainPrimaryId, userId: userRazeenId, username: 'razeen', emailAddress: 'razeen@corivotech.example', displayName: 'Razeen Iqbal', roleKey: 'OWNER', status: 'ACTIVE', quotaMb: 25600, usedMb: 4280, lastActivityAt: hoursAgo(1), createdAt: hoursAgo(720), updatedAt: hoursAgo(1) },
    { id: mailboxAdminId, organisationId: orgCorivoId, domainId: domainPrimaryId, userId: userAdminId, username: 'admin', emailAddress: 'admin@corivotech.example', displayName: 'Aarav Mehta', roleKey: 'ADMIN', status: 'ACTIVE', quotaMb: 15360, usedMb: 2890, lastActivityAt: hoursAgo(4), createdAt: hoursAgo(680), updatedAt: hoursAgo(4) },
    { id: mailboxAnanyaId, organisationId: orgCorivoId, domainId: domainPrimaryId, userId: userAnanyaId, username: 'ananya', emailAddress: 'ananya@corivotech.example', displayName: 'Ananya Sharma', roleKey: 'MAILBOX_USER', status: 'ACTIVE', quotaMb: 10240, usedMb: 8340, lastActivityAt: hoursAgo(6), createdAt: hoursAgo(600), updatedAt: hoursAgo(6) },
    { id: mailboxVikramId, organisationId: orgCorivoId, domainId: domainPrimaryId, userId: userVikramId, username: 'vikram', emailAddress: 'vikram@corivotech.example', displayName: 'Vikram Nair', roleKey: 'MAILBOX_USER', status: 'ACTIVE', quotaMb: 10240, usedMb: 1620, lastActivityAt: hoursAgo(18), createdAt: hoursAgo(500), updatedAt: hoursAgo(18) },
    { id: mailboxSuspendedId, organisationId: orgCorivoId, domainId: domainPrimaryId, userId: userSuspendedId, username: 'suspended', emailAddress: 'suspended@corivotech.example', displayName: 'Karan Verma', roleKey: 'MAILBOX_USER', status: 'SUSPENDED', quotaMb: 5120, usedMb: 940, lastActivityAt: hoursAgo(240), createdAt: hoursAgo(450), updatedAt: hoursAgo(48) },
    { id: mailboxPriyaId, organisationId: orgVanguardId, domainId: domainVanguardId, userId: userPriyaId, username: 'priya', emailAddress: 'priya@vanguardlogistics.example', displayName: 'Priya Kapoor', roleKey: 'OWNER', status: 'ACTIVE', quotaMb: 25600, usedMb: 5120, lastActivityAt: hoursAgo(3), createdAt: hoursAgo(480), updatedAt: hoursAgo(3) },
  ];

  const aliases: Alias[] = [
    { id: 'alias-1', organisationId: orgCorivoId, aliasAddress: 'founders@corivotech.example', targetAddress: 'razeen@corivotech.example', active: true, createdAt: hoursAgo(500), updatedAt: hoursAgo(500) },
    { id: 'alias-2', organisationId: orgCorivoId, aliasAddress: 'accounts@corivotech.example', targetAddress: 'ananya@corivotech.example', active: true, createdAt: hoursAgo(400), updatedAt: hoursAgo(400) },
    { id: 'alias-3', organisationId: orgCorivoId, aliasAddress: 'postmaster@corivotech.example', targetAddress: 'admin@corivotech.example', active: true, createdAt: hoursAgo(700), updatedAt: hoursAgo(700) },
  ];

  const distributionGroups: DistributionGroup[] = [
    {
      id: 'grp-1',
      organisationId: orgCorivoId,
      name: 'Support Desk',
      emailAddress: 'support@corivotech.example',
      description: 'Customer technical support and onboarding inquiries',
      members: ['vikram@corivotech.example', 'admin@corivotech.example'],
      createdAt: hoursAgo(600),
      updatedAt: hoursAgo(40),
    },
    {
      id: 'grp-2',
      organisationId: orgCorivoId,
      name: 'Finance & Compliance',
      emailAddress: 'finance@corivotech.example',
      description: 'GST filings, vendor invoices, and enterprise billing',
      members: ['ananya@corivotech.example', 'razeen@corivotech.example'],
      createdAt: hoursAgo(580),
      updatedAt: hoursAgo(60),
    },
  ];

  const createFoldersForMailbox = (mailboxId: string): MailFolder[] => [
    { id: `${mailboxId}-fld-inbox`, mailboxId, name: 'Inbox', slug: 'inbox', isSystem: true, createdAt: now, updatedAt: now },
    { id: `${mailboxId}-fld-sent`, mailboxId, name: 'Sent', slug: 'sent', isSystem: true, createdAt: now, updatedAt: now },
    { id: `${mailboxId}-fld-drafts`, mailboxId, name: 'Drafts', slug: 'drafts', isSystem: true, createdAt: now, updatedAt: now },
    { id: `${mailboxId}-fld-starred`, mailboxId, name: 'Starred', slug: 'starred', isSystem: true, createdAt: now, updatedAt: now },
    { id: `${mailboxId}-fld-snoozed`, mailboxId, name: 'Snoozed', slug: 'snoozed', isSystem: true, createdAt: now, updatedAt: now },
    { id: `${mailboxId}-fld-spam`, mailboxId, name: 'Spam', slug: 'spam', isSystem: true, createdAt: now, updatedAt: now },
    { id: `${mailboxId}-fld-trash`, mailboxId, name: 'Trash', slug: 'trash', isSystem: true, createdAt: now, updatedAt: now },
    { id: `${mailboxId}-fld-archive`, mailboxId, name: 'Archive', slug: 'archive', isSystem: true, createdAt: now, updatedAt: now },
  ];

  const folders: MailFolder[] = [
    ...createFoldersForMailbox(mailboxRazeenId),
    { id: 'fld-custom-proposals', mailboxId: mailboxRazeenId, name: 'Client Proposals', slug: 'client-proposals', isSystem: false, createdAt: hoursAgo(300), updatedAt: hoursAgo(20) },
    { id: 'fld-custom-finance', mailboxId: mailboxRazeenId, name: 'Finance & GST', slug: 'finance-gst', isSystem: false, createdAt: hoursAgo(280), updatedAt: hoursAgo(12) },
    { id: 'fld-custom-eng', mailboxId: mailboxRazeenId, name: 'Infrastructure', slug: 'infrastructure', isSystem: false, createdAt: hoursAgo(250), updatedAt: hoursAgo(48) },
    ...createFoldersForMailbox(mailboxAdminId),
    ...createFoldersForMailbox(mailboxAnanyaId),
    ...createFoldersForMailbox(mailboxVikramId),
    ...createFoldersForMailbox(mailboxPriyaId),
  ];

  const sampleAttachments: Attachment[] = [
    {
      id: 'att-1',
      organisationId: orgCorivoId,
      mailboxId: mailboxRazeenId,
      messageId: 'msg-1',
      fileName: 'Q4_Enterprise_Mail_Proposal_INR.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 428190,
      storageKey: 'seed/Q4_Enterprise_Mail_Proposal_INR.pdf',
      scanStatus: 'CLEAN',
      createdAt: hoursAgo(2),
    },
    {
      id: 'att-2',
      organisationId: orgCorivoId,
      mailboxId: mailboxRazeenId,
      messageId: 'msg-3',
      fileName: 'GST_Compliance_Summary_Oct2026.csv',
      mimeType: 'text/csv',
      sizeBytes: 34820,
      storageKey: 'seed/GST_Compliance_Summary_Oct2026.csv',
      scanStatus: 'CLEAN',
      createdAt: hoursAgo(8),
    },
    {
      id: 'att-3',
      organisationId: orgCorivoId,
      mailboxId: mailboxRazeenId,
      messageId: 'msg-6',
      fileName: 'DKIM_Key_Rotation_Schedule.txt',
      mimeType: 'text/plain',
      sizeBytes: 4120,
      storageKey: 'seed/DKIM_Key_Rotation_Schedule.txt',
      scanStatus: 'CLEAN',
      createdAt: hoursAgo(26),
    },
  ];

  const messages: EmailMessage[] = [
    {
      id: 'msg-1',
      organisationId: orgCorivoId,
      mailboxId: mailboxRazeenId,
      folderSlug: 'inbox',
      threadId: 'thr-1',
      externalStoreId: 'dovecot://corivotech.example/razeen/1001',
      fromName: 'Neha Deshmukh',
      fromAddress: 'neha.deshmukh@meridianbank.example',
      toAddresses: ['razeen@corivotech.example'],
      ccAddresses: ['ananya@corivotech.example'],
      bccAddresses: [],
      subject: 'Enterprise Email Onboarding — 120 Mailboxes for Meridian FinServe',
      snippet: 'Hi Razeen, our IT committee reviewed the domain isolation architecture and would like to proceed with onboarding...',
      bodyHtml: `<p>Hi Razeen,</p><p>Our IT committee reviewed the Corivo Mail domain isolation architecture and DNS authentication workflow. We would like to proceed with onboarding 120 employee mailboxes across <strong>meridianfin.example</strong>.</p><p>Could you confirm the timeline for IMAP migration from our legacy provider and review the attached commercial summary?</p><p>Regards,<br/>Neha Deshmukh<br/>VP Infrastructure, Meridian FinServe</p>`,
      isRead: false,
      isStarred: true,
      snoozedUntil: null,
      deliveryStatus: 'RECEIVED',
      spamScore: 0.1,
      sizeBytes: 432000,
      attachments: [sampleAttachments[0]],
      sentAt: hoursAgo(2),
      createdAt: hoursAgo(2),
      updatedAt: hoursAgo(2),
    },
    {
      id: 'msg-2',
      organisationId: orgCorivoId,
      mailboxId: mailboxRazeenId,
      folderSlug: 'inbox',
      threadId: 'thr-2',
      externalStoreId: 'dovecot://corivotech.example/razeen/1002',
      fromName: 'Aarav Mehta',
      fromAddress: 'admin@corivotech.example',
      toAddresses: ['razeen@corivotech.example'],
      ccAddresses: [],
      bccAddresses: [],
      subject: 'DMARC enforcement promoted to p=quarantine on corivotech.example',
      snippet: 'All outbound messages signed by selector corivo1 passed alignment across the last 72 hours...',
      bodyHtml: `<p>Hi Razeen,</p><p>Quick operational update: all outbound messages signed with DKIM selector <code>corivo1</code> passed SPF and DMARC alignment over the last 72 hours. I have updated our DMARC policy to <code>p=quarantine</code>.</p><p>We also added <strong>corivoapps.example</strong> in pending status — waiting for registrar TXT propagation before we run verification.</p><p>Best,<br/>Aarav</p>`,
      isRead: false,
      isStarred: false,
      snoozedUntil: null,
      deliveryStatus: 'RECEIVED',
      spamScore: 0.0,
      sizeBytes: 6400,
      attachments: [],
      sentAt: hoursAgo(4),
      createdAt: hoursAgo(4),
      updatedAt: hoursAgo(4),
    },
    {
      id: 'msg-3',
      organisationId: orgCorivoId,
      mailboxId: mailboxRazeenId,
      folderSlug: 'inbox',
      threadId: 'thr-3',
      externalStoreId: 'dovecot://corivotech.example/razeen/1003',
      fromName: 'Ananya Sharma',
      fromAddress: 'ananya@corivotech.example',
      toAddresses: ['razeen@corivotech.example'],
      ccAddresses: ['finance@corivotech.example'],
      bccAddresses: [],
      subject: 'October GST Reconciliation & Storage Utilisation Review',
      snippet: 'Attached is the October GST summary. Note that my mailbox storage is currently at 81% of its 10 GB quota...',
      bodyHtml: `<p>Hi Razeen,</p><p>Please find attached the October GST reconciliation sheet for Corivo Technologies.</p><p>Also a quick note: my mailbox (<code>ananya@corivotech.example</code>) is at 81% of its 10 GB quota due to vendor invoice archives. Could Aarav bump my quota to 20 GB?</p><p>Thanks,<br/>Ananya</p>`,
      isRead: true,
      isStarred: true,
      snoozedUntil: null,
      deliveryStatus: 'RECEIVED',
      spamScore: 0.2,
      sizeBytes: 41200,
      attachments: [sampleAttachments[1]],
      sentAt: hoursAgo(8),
      createdAt: hoursAgo(8),
      updatedAt: hoursAgo(8),
    },
    {
      id: 'msg-4',
      organisationId: orgCorivoId,
      mailboxId: mailboxRazeenId,
      folderSlug: 'inbox',
      threadId: 'thr-4',
      externalStoreId: 'dovecot://corivotech.example/razeen/1004',
      fromName: 'Vikram Nair',
      fromAddress: 'vikram@corivotech.example',
      toAddresses: ['razeen@corivotech.example'],
      ccAddresses: ['support@corivotech.example'],
      bccAddresses: [],
      subject: 'Weekly Support Queue Digest — School Domain Onboarding',
      snippet: 'Two educational institutions completed MX and SPF setup today with zero delivery bounces...',
      bodyHtml: `<p>Hello Razeen,</p><p>Two schools in Pune and Bengaluru completed their MX and SPF setup today. Their faculty mailboxes are receiving mail cleanly and onboarding feedback on the DNS checklist has been very positive.</p><p>Warm regards,<br/>Vikram Nair</p>`,
      isRead: false,
      isStarred: false,
      snoozedUntil: null,
      deliveryStatus: 'RECEIVED',
      spamScore: 0.1,
      sizeBytes: 5100,
      attachments: [],
      sentAt: hoursAgo(14),
      createdAt: hoursAgo(14),
      updatedAt: hoursAgo(14),
    },
    {
      id: 'msg-5',
      organisationId: orgCorivoId,
      mailboxId: mailboxRazeenId,
      folderSlug: 'inbox',
      threadId: 'thr-5',
      externalStoreId: 'dovecot://corivotech.example/razeen/1005',
      fromName: 'Rohan Kulkarni',
      fromAddress: 'rohan@kulkarniadvisory.example',
      toAddresses: ['razeen@corivotech.example'],
      ccAddresses: [],
      bccAddresses: [],
      subject: 'DPDP Act 2023 Readiness & Data Processing Addendum Review',
      snippet: 'I completed the initial review of your customer data retention schedule and incident response workflow...',
      bodyHtml: `<p>Dear Razeen,</p><p>I completed the initial review of Corivo Mail's Data Processing Addendum and retention configuration against India's Digital Personal Data Protection Act, 2023.</p><p>Let us schedule a 30-minute call on Thursday to finalise the wording for enterprise tenants.</p><p>Best regards,<br/>Rohan Kulkarni</p>`,
      isRead: true,
      isStarred: false,
      snoozedUntil: null,
      deliveryStatus: 'RECEIVED',
      spamScore: 0.0,
      sizeBytes: 5800,
      attachments: [],
      sentAt: hoursAgo(22),
      createdAt: hoursAgo(22),
      updatedAt: hoursAgo(22),
    },
    {
      id: 'msg-6',
      organisationId: orgCorivoId,
      mailboxId: mailboxRazeenId,
      folderSlug: 'client-proposals',
      threadId: 'thr-6',
      externalStoreId: 'dovecot://corivotech.example/razeen/1006',
      fromName: 'Meera Iyer',
      fromAddress: 'meera.iyer@northstar-edu.example',
      toAddresses: ['razeen@corivotech.example'],
      ccAddresses: [],
      bccAddresses: [],
      subject: 'Faculty & Student Domain Split — Northstar Academy',
      snippet: 'We would like faculty on northstar.example and students on students.northstar.example under one organisation...',
      bodyHtml: `<p>Hi Razeen,</p><p>We would like faculty mailboxes on our primary domain and student mailboxes on a dedicated subdomain under one Corivo organisation console. Attached is our proposed selector rotation note.</p><p>Regards,<br/>Meera Iyer</p>`,
      isRead: true,
      isStarred: true,
      snoozedUntil: null,
      deliveryStatus: 'RECEIVED',
      spamScore: 0.1,
      sizeBytes: 9800,
      attachments: [sampleAttachments[2]],
      sentAt: hoursAgo(26),
      createdAt: hoursAgo(26),
      updatedAt: hoursAgo(26),
    },
    {
      id: 'msg-7',
      organisationId: orgCorivoId,
      mailboxId: mailboxRazeenId,
      folderSlug: 'finance-gst',
      threadId: 'thr-7',
      externalStoreId: 'dovecot://corivotech.example/razeen/1007',
      fromName: 'Razorpay Sandbox Notices',
      fromAddress: 'billing-notices@razorpay-sandbox.example',
      toAddresses: ['razeen@corivotech.example', 'ananya@corivotech.example'],
      ccAddresses: [],
      bccAddresses: [],
      subject: 'Sandbox Webhook Verification Checklist for INR Subscriptions',
      snippet: 'Before enabling live INR mandate billing, verify HMAC webhook signatures on your production endpoint...',
      bodyHtml: `<p>Hello Corivo Finance Team,</p><p>Your billing integration is currently configured in sandbox mode. Before accepting live customer payments, configure live API keys and webhook signature verification.</p>`,
      isRead: true,
      isStarred: false,
      snoozedUntil: null,
      deliveryStatus: 'RECEIVED',
      spamScore: 0.3,
      sizeBytes: 4200,
      attachments: [],
      sentAt: hoursAgo(36),
      createdAt: hoursAgo(36),
      updatedAt: hoursAgo(36),
    },
    {
      id: 'msg-8',
      organisationId: orgCorivoId,
      mailboxId: mailboxRazeenId,
      folderSlug: 'infrastructure',
      threadId: 'thr-8',
      externalStoreId: 'dovecot://corivotech.example/razeen/1008',
      fromName: 'Siddharth Rao',
      fromAddress: 'operator@corivomail.example',
      toAddresses: ['razeen@corivotech.example', 'admin@corivotech.example'],
      ccAddresses: [],
      bccAddresses: [],
      subject: 'Postfix & Rspamd Maintenance Window Notice — Sunday 02:00 IST',
      snippet: 'Scheduled TLS certificate renewal and Rspamd rule update this Sunday between 02:00 and 02:20 IST...',
      bodyHtml: `<p>Dear Organisation Administrators,</p><p>We will perform scheduled TLS certificate renewal and Rspamd filter updates on Sunday between 02:00 and 02:20 IST. Inbound mail will queue cleanly without message loss.</p>`,
      isRead: true,
      isStarred: false,
      snoozedUntil: null,
      deliveryStatus: 'RECEIVED',
      spamScore: 0.0,
      sizeBytes: 3900,
      attachments: [],
      sentAt: hoursAgo(44),
      createdAt: hoursAgo(44),
      updatedAt: hoursAgo(44),
    },
    {
      id: 'msg-9',
      organisationId: orgCorivoId,
      mailboxId: mailboxRazeenId,
      folderSlug: 'sent',
      threadId: 'thr-1',
      externalStoreId: 'dovecot://corivotech.example/razeen/1009',
      fromName: 'Razeen Iqbal',
      fromAddress: 'razeen@corivotech.example',
      toAddresses: ['neha.deshmukh@meridianbank.example'],
      ccAddresses: ['admin@corivotech.example'],
      bccAddresses: [],
      subject: 'Re: Enterprise Email Onboarding — 120 Mailboxes for Meridian FinServe',
      snippet: 'Hi Neha, thank you for confirming. We can provision your primary domain and schedule the IMAP batch migration...',
      bodyHtml: `<p>Hi Neha,</p><p>Thank you for confirming. We can provision your primary domain and schedule the IMAP batch migration over the weekend to avoid any disruption during business hours.</p><p>Best regards,<br/>Razeen Iqbal</p>`,
      isRead: true,
      isStarred: false,
      snoozedUntil: null,
      deliveryStatus: 'ACCEPTED',
      spamScore: 0.0,
      sizeBytes: 4800,
      attachments: [],
      sentAt: hoursAgo(1.5),
      createdAt: hoursAgo(1.5),
      updatedAt: hoursAgo(1.5),
    },
    {
      id: 'msg-10',
      organisationId: orgCorivoId,
      mailboxId: mailboxRazeenId,
      folderSlug: 'sent',
      threadId: 'thr-9',
      externalStoreId: 'dovecot://corivotech.example/razeen/1010',
      fromName: 'Razeen Iqbal',
      fromAddress: 'razeen@corivotech.example',
      toAddresses: ['vikram@corivotech.example', 'ananya@corivotech.example'],
      ccAddresses: [],
      bccAddresses: [],
      subject: 'Q4 Customer Onboarding Targets & SLA Benchmarks',
      snippet: 'Team, please review our updated SLA targets for domain DNS verification assistance and migration support...',
      bodyHtml: `<p>Team,</p><p>Please review our updated SLA targets for domain DNS verification assistance and IMAP migration support for Indian SMB customers.</p><p>Thanks,<br/>Razeen</p>`,
      isRead: true,
      isStarred: false,
      snoozedUntil: null,
      deliveryStatus: 'SENT_TO_RECEIVING_SERVER',
      spamScore: 0.0,
      sizeBytes: 3600,
      attachments: [],
      sentAt: hoursAgo(28),
      createdAt: hoursAgo(28),
      updatedAt: hoursAgo(28),
    },
    {
      id: 'msg-11',
      organisationId: orgCorivoId,
      mailboxId: mailboxRazeenId,
      folderSlug: 'snoozed',
      threadId: 'thr-10',
      externalStoreId: 'dovecot://corivotech.example/razeen/1011',
      fromName: 'Devika Menon',
      fromAddress: 'devika@cloudinfra.example',
      toAddresses: ['razeen@corivotech.example'],
      ccAddresses: [],
      bccAddresses: [],
      subject: 'S3 Object Storage Bucket Lifecycle Policy Review',
      snippet: 'Following up on cold attachment archival rules and KMS encryption key rotation intervals...',
      bodyHtml: `<p>Hi Razeen,</p><p>Following up on cold attachment archival rules and KMS encryption key rotation intervals for attachments older than 365 days.</p>`,
      isRead: true,
      isStarred: false,
      snoozedUntil: hoursFromNow(18),
      deliveryStatus: 'RECEIVED',
      spamScore: 0.1,
      sizeBytes: 4100,
      attachments: [],
      sentAt: hoursAgo(52),
      createdAt: hoursAgo(52),
      updatedAt: hoursAgo(12),
    },
    {
      id: 'msg-12',
      organisationId: orgCorivoId,
      mailboxId: mailboxRazeenId,
      folderSlug: 'spam',
      threadId: 'thr-11',
      externalStoreId: 'dovecot://corivotech.example/razeen/1012',
      fromName: 'Unverified Sender',
      fromAddress: 'promo-alerts@unknown-mailer.example',
      toAddresses: ['razeen@corivotech.example'],
      ccAddresses: [],
      bccAddresses: [],
      subject: 'Urgent wire transfer verification — claim your prize',
      snippet: 'Quarantined by Rspamd (score 8.4): SPF softfail and mismatched Reply-To domain...',
      bodyHtml: `<p>This message was flagged by Rspamd spam heuristics (SPF alignment failure and suspicious keywords). Avoid clicking untrusted links.</p>`,
      isRead: false,
      isStarred: false,
      snoozedUntil: null,
      deliveryStatus: 'RECEIVED',
      spamScore: 8.4,
      sizeBytes: 2900,
      attachments: [],
      sentAt: hoursAgo(10),
      createdAt: hoursAgo(10),
      updatedAt: hoursAgo(10),
    },
    {
      id: 'msg-13',
      organisationId: orgCorivoId,
      mailboxId: mailboxRazeenId,
      folderSlug: 'trash',
      threadId: 'thr-12',
      externalStoreId: 'dovecot://corivotech.example/razeen/1013',
      fromName: 'Newsletter Digest',
      fromAddress: 'digest@techbrief.example',
      toAddresses: ['razeen@corivotech.example'],
      ccAddresses: [],
      bccAddresses: [],
      subject: 'Weekly Cloud Infrastructure Roundup — Issue #42',
      snippet: 'Highlights from this week in email security, MTA-STS adoption, and DANE deployments...',
      bodyHtml: `<p>Highlights from this week in email security, MTA-STS adoption, and open-source mail server operations.</p>`,
      isRead: true,
      isStarred: false,
      snoozedUntil: null,
      deliveryStatus: 'RECEIVED',
      spamScore: 0.2,
      sizeBytes: 5300,
      attachments: [],
      sentAt: hoursAgo(96),
      createdAt: hoursAgo(96),
      updatedAt: hoursAgo(30),
    },
    {
      id: 'msg-14',
      organisationId: orgCorivoId,
      mailboxId: mailboxRazeenId,
      folderSlug: 'inbox',
      threadId: 'thr-13',
      externalStoreId: 'dovecot://corivotech.example/razeen/1014',
      fromName: 'Arjun Subramanian',
      fromAddress: 'arjun@apexrobotics.example',
      toAddresses: ['razeen@corivotech.example'],
      ccAddresses: [],
      bccAddresses: [],
      subject: 'Evaluating Corivo Mail for 45 Engineering Mailboxes',
      snippet: 'Hi Razeen, we are migrating off legacy shared hosting email and need reliable DKIM and role-based admin...',
      bodyHtml: `<p>Hi Razeen,</p><p>We are migrating 45 engineering mailboxes off legacy cPanel email and need reliable DKIM signing, role-based administration, and shared support mailboxes.</p><p>Can we set up a trial organisation this week?</p><p>Regards,<br/>Arjun Subramanian</p>`,
      isRead: false,
      isStarred: false,
      snoozedUntil: null,
      deliveryStatus: 'RECEIVED',
      spamScore: 0.0,
      sizeBytes: 4900,
      attachments: [],
      sentAt: hoursAgo(3),
      createdAt: hoursAgo(3),
      updatedAt: hoursAgo(3),
    },
    {
      id: 'msg-15',
      organisationId: orgCorivoId,
      mailboxId: mailboxAdminId,
      folderSlug: 'inbox',
      threadId: 'thr-14',
      externalStoreId: 'dovecot://corivotech.example/admin/2001',
      fromName: 'Corivo Mail System',
      fromAddress: 'noreply@corivomail.example',
      toAddresses: ['admin@corivotech.example'],
      ccAddresses: [],
      bccAddresses: [],
      subject: 'Storage threshold alert: ananya@corivotech.example reached 81% quota',
      snippet: 'Mailbox ananya@corivotech.example is using 8.14 GB of 10.00 GB allocated storage...',
      bodyHtml: `<p>Mailbox <strong>ananya@corivotech.example</strong> has crossed 80% storage usage (8.14 GB / 10.00 GB). Consider adjusting the mailbox quota in the Admin Console.</p>`,
      isRead: false,
      isStarred: false,
      snoozedUntil: null,
      deliveryStatus: 'RECEIVED',
      spamScore: 0.0,
      sizeBytes: 3100,
      attachments: [],
      sentAt: hoursAgo(5),
      createdAt: hoursAgo(5),
      updatedAt: hoursAgo(5),
    },
    {
      id: 'msg-16',
      organisationId: orgVanguardId,
      mailboxId: mailboxPriyaId,
      folderSlug: 'inbox',
      threadId: 'thr-15',
      externalStoreId: 'dovecot://vanguardlogistics.example/priya/3001',
      fromName: 'Fleet Operations',
      fromAddress: 'ops@vanguardlogistics.example',
      toAddresses: ['priya@vanguardlogistics.example'],
      ccAddresses: [],
      bccAddresses: [],
      subject: 'Confidential: Mumbai-Pune Corridor Dispatch Manifest',
      snippet: 'Tenant-isolated message belonging strictly to Vanguard Logistics Pvt Ltd...',
      bodyHtml: `<p>Hi Priya,</p><p>Confidential dispatch manifest for Vanguard Logistics Pvt Ltd. Strictly isolated to vanguardlogistics.example.</p>`,
      isRead: false,
      isStarred: true,
      snoozedUntil: null,
      deliveryStatus: 'RECEIVED',
      spamScore: 0.0,
      sizeBytes: 4400,
      attachments: [],
      sentAt: hoursAgo(2),
      createdAt: hoursAgo(2),
      updatedAt: hoursAgo(2),
    },
  ];

  const drafts: Draft[] = [
    {
      id: 'drf-1',
      organisationId: orgCorivoId,
      mailboxId: mailboxRazeenId,
      toAddresses: ['arjun@apexrobotics.example'],
      ccAddresses: ['admin@corivotech.example'],
      bccAddresses: [],
      subject: 'Re: Evaluating Corivo Mail for 45 Engineering Mailboxes',
      bodyHtml: '<p>Hi Arjun,</p><p>We would be glad to onboard Apex Robotics. Let us walk through your DNS zone setup and mailbox migration plan.</p>',
      attachmentIds: [],
      createdAt: hoursAgo(2),
      updatedAt: hoursAgo(1),
    },
  ];

  const contacts: Contact[] = [
    { id: 'cnt-1', organisationId: orgCorivoId, userId: userRazeenId, fullName: 'Neha Deshmukh', email: 'neha.deshmukh@meridianbank.example', phone: '+91 98200 11442', company: 'Meridian FinServe', jobTitle: 'VP Infrastructure', groupName: 'Enterprise Clients', notes: '120 mailbox onboarding contact', createdAt: hoursAgo(200), updatedAt: hoursAgo(2) },
    { id: 'cnt-2', organisationId: orgCorivoId, userId: userRazeenId, fullName: 'Arjun Subramanian', email: 'arjun@apexrobotics.example', phone: '+91 99001 55321', company: 'Apex Robotics', jobTitle: 'Head of Engineering', groupName: 'Enterprise Clients', notes: 'Evaluating 45 seats', createdAt: hoursAgo(50), updatedAt: hoursAgo(3) },
    { id: 'cnt-3', organisationId: orgCorivoId, userId: userRazeenId, fullName: 'Aarav Mehta', email: 'admin@corivotech.example', phone: '+91 98450 22334', company: 'Corivo Technologies', jobTitle: 'IT & Mail Administrator', groupName: 'Internal Team', notes: 'Primary DNS & Postfix admin', createdAt: hoursAgo(600), updatedAt: hoursAgo(4) },
    { id: 'cnt-4', organisationId: orgCorivoId, userId: userRazeenId, fullName: 'Ananya Sharma', email: 'ananya@corivotech.example', phone: '+91 98450 33445', company: 'Corivo Technologies', jobTitle: 'Finance Lead', groupName: 'Internal Team', notes: 'GST & billing coordinator', createdAt: hoursAgo(600), updatedAt: hoursAgo(6) },
  ];

  const calendarEvents: CalendarEvent[] = [
    {
      id: 'evt-1',
      organisationId: orgCorivoId,
      userId: userRazeenId,
      title: 'Meridian FinServe DNS & Migration Kickoff',
      description: 'Review MX cutover sequence and IMAP batch schedule with Neha Deshmukh.',
      location: 'Corivo Meeting Room A / Video Call',
      startAt: hoursFromNow(3),
      endAt: hoursFromNow(4),
      attendees: ['razeen@corivotech.example', 'admin@corivotech.example', 'neha.deshmukh@meridianbank.example'],
      reminderMin: 15,
      createdAt: hoursAgo(12),
      updatedAt: hoursAgo(12),
    },
    {
      id: 'evt-2',
      organisationId: orgCorivoId,
      userId: userRazeenId,
      title: 'DPDP Act 2023 Legal Review',
      description: 'Finalise customer DPA retention schedules with Rohan Kulkarni.',
      location: 'Bengaluru HQ',
      startAt: hoursFromNow(27),
      endAt: hoursFromNow(28),
      attendees: ['razeen@corivotech.example', 'rohan@kulkarniadvisory.example'],
      reminderMin: 30,
      createdAt: hoursAgo(24),
      updatedAt: hoursAgo(24),
    },
  ];

  const sharedMailboxes: SharedMailbox[] = [
    {
      id: 'sm-1',
      organisationId: orgCorivoId,
      name: 'Customer Support Inbox',
      emailAddress: 'support@corivotech.example',
      description: 'Shared queue for customer domain onboarding and DNS helpdesk tickets',
      members: [
        { email: 'vikram@corivotech.example', access: 'SEND_AS' },
        { email: 'admin@corivotech.example', access: 'READ_WRITE' },
        { email: 'razeen@corivotech.example', access: 'READ_ONLY' },
      ],
      recentActivity: 'Vikram Nair replied to Northstar Academy 2 hours ago',
      createdAt: hoursAgo(500),
    },
    {
      id: 'sm-2',
      organisationId: orgCorivoId,
      name: 'Finance & Billing Desk',
      emailAddress: 'finance@corivotech.example',
      description: 'Shared mailbox for GST invoices, vendor remittances, and renewals',
      members: [
        { email: 'ananya@corivotech.example', access: 'SEND_AS' },
        { email: 'razeen@corivotech.example', access: 'READ_WRITE' },
      ],
      recentActivity: 'Ananya Sharma archived October GST filing 8 hours ago',
      createdAt: hoursAgo(480),
    },
  ];

  const tasks: WorkspaceTask[] = [
    { id: 'tsk-1', organisationId: orgCorivoId, title: 'Verify TXT & MX records for corivoapps.example', assigneeEmail: 'admin@corivotech.example', dueDate: hoursFromNow(24).slice(0, 10), priority: 'HIGH', status: 'IN_PROGRESS', createdAt: hoursAgo(20), updatedAt: hoursAgo(4) },
    { id: 'tsk-2', organisationId: orgCorivoId, title: 'Increase mailbox quota for ananya@corivotech.example to 20 GB', assigneeEmail: 'admin@corivotech.example', dueDate: hoursFromNow(12).slice(0, 10), priority: 'MEDIUM', status: 'TODO', createdAt: hoursAgo(8), updatedAt: hoursAgo(8) },
    { id: 'tsk-3', organisationId: orgCorivoId, title: 'Send Meridian FinServe onboarding checklist', assigneeEmail: 'razeen@corivotech.example', dueDate: hoursFromNow(48).slice(0, 10), priority: 'HIGH', status: 'DONE', createdAt: hoursAgo(16), updatedAt: hoursAgo(1.5) },
  ];

  const notes: WorkspaceNote[] = [
    { id: 'nte-1', organisationId: orgCorivoId, userId: userRazeenId, title: 'DNS Rollout Standard Checklist', content: '1. Verify domain ownership TXT.\n2. Configure MX1/MX2 with priority 10/20.\n3. Publish SPF with ~all.\n4. Enable 2048-bit DKIM selector corivo1.\n5. Start DMARC at p=none then promote to p=quarantine.', folder: 'Operations', createdAt: hoursAgo(300), updatedAt: hoursAgo(20) },
    { id: 'nte-2', organisationId: orgCorivoId, userId: userRazeenId, title: 'Q4 Enterprise Pricing Tiers (Illustrative)', content: 'Starter: ₹149/mailbox/mo (10 GB)\nBusiness: ₹299/mailbox/mo (30 GB + Shared Mailboxes)\nEnterprise: ₹549/mailbox/mo (100 GB + Compliance Audit Logs)', folder: 'Strategy', createdAt: hoursAgo(120), updatedAt: hoursAgo(10) },
  ];

  const defaultPref = (userId: string, signatureHtml: string): UserPreference => ({
    id: `pref-${userId}`,
    userId,
    language: 'en-IN',
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12h',
    theme: 'light',
    density: 'comfortable',
    defaultReplyMode: 'reply',
    threadingEnabled: true,
    readingPane: 'right',
    defaultFont: 'DM Sans',
    confirmBeforeSend: false,
    signatureHtml,
    signatureEnabled: true,
    newEmailAlerts: true,
    browserNotifications: false,
    securityAlerts: true,
    productAnnouncements: false,
    updatedAt: now,
  });

  const userPreferences: UserPreference[] = [
    defaultPref(userRazeenId, '<p><strong>Razeen Iqbal</strong><br/>Founder &amp; Managing Director, Corivo Technologies<br/>razeen@corivotech.example</p>'),
    defaultPref(userAdminId, '<p><strong>Aarav Mehta</strong><br/>IT &amp; Mail Administrator, Corivo Technologies</p>'),
    defaultPref(userAnanyaId, '<p><strong>Ananya Sharma</strong><br/>Finance Lead, Corivo Technologies</p>'),
    defaultPref(userVikramId, '<p><strong>Vikram Nair</strong><br/>Customer Success, Corivo Technologies</p>'),
    defaultPref(userPriyaId, '<p><strong>Priya Kapoor</strong><br/>COO, Vanguard Logistics Pvt Ltd</p>'),
    defaultPref(userPlatformId, '<p><strong>Siddharth Rao</strong><br/>Corivo Platform Operations</p>'),
  ];

  const notifications: UserNotification[] = [
    { id: 'notif-1', userId: userRazeenId, title: 'Storage threshold warning', message: 'ananya@corivotech.example has reached 81% of allocated mailbox storage.', severity: 'WARNING', isRead: false, createdAt: hoursAgo(5) },
    { id: 'notif-2', userId: userRazeenId, title: 'Domain verification pending', message: 'corivoapps.example is awaiting TXT ownership verification.', severity: 'INFO', isRead: false, createdAt: hoursAgo(24) },
    { id: 'notif-3', userId: userRazeenId, title: 'Domain health verified', message: 'corivotech.example passed MX, SPF, DKIM, and DMARC checks.', severity: 'SUCCESS', isRead: true, createdAt: hoursAgo(48) },
    { id: 'notif-4', userId: userAdminId, title: 'Storage threshold warning', message: 'ananya@corivotech.example reached 81% storage usage.', severity: 'WARNING', isRead: false, createdAt: hoursAgo(5) },
  ];

  const securityEvents: SecurityEvent[] = [
    { id: 'sec-1', organisationId: orgCorivoId, actorEmail: 'razeen@corivotech.example', eventType: 'LOGIN_SUCCESS', severity: 'INFO', ipAddress: '103.21.124.18', summary: 'Successful sign-in to Corivo Mail Workspace', createdAt: hoursAgo(1) },
    { id: 'sec-2', organisationId: orgCorivoId, actorEmail: 'unknown@external-probe.example', eventType: 'LOGIN_FAILED', severity: 'WARNING', ipAddress: '185.220.101.4', summary: '3 failed authentication attempts blocked by rate limiter', createdAt: hoursAgo(7) },
    { id: 'sec-3', organisationId: orgCorivoId, actorEmail: 'promo-alerts@unknown-mailer.example', eventType: 'SPAM_BLOCKED', severity: 'INFO', ipAddress: '91.199.212.52', summary: 'Inbound message quarantined by Rspamd heuristic (score 8.4)', createdAt: hoursAgo(10) },
    { id: 'sec-4', organisationId: orgCorivoId, actorEmail: 'suspended@corivotech.example', eventType: 'ACCOUNT_SUSPENDED_ATTEMPT', severity: 'WARNING', ipAddress: '49.207.190.12', summary: 'Sign-in rejected for suspended account', createdAt: hoursAgo(32) },
    { id: 'sec-5', organisationId: orgVanguardId, actorEmail: 'priya@vanguardlogistics.example', eventType: 'LOGIN_SUCCESS', severity: 'INFO', ipAddress: '115.98.42.19', summary: 'Successful sign-in to Vanguard Logistics workspace', createdAt: hoursAgo(3) },
  ];

  const auditLogs: AuditLog[] = [
    { id: 'aud-1', organisationId: orgCorivoId, actorId: userAdminId, actorEmail: 'admin@corivotech.example', action: 'DOMAIN_DNS_CHECKED', resource: 'corivotech.example (MX/SPF/DKIM/DMARC)', ipAddress: '103.21.124.19', result: 'SUCCESS', category: 'ADMIN_ACTIVITY', createdAt: hoursAgo(2) },
    { id: 'aud-2', organisationId: orgCorivoId, actorId: userAdminId, actorEmail: 'admin@corivotech.example', action: 'DOMAIN_ADDED', resource: 'corivoapps.example', ipAddress: '103.21.124.19', result: 'SUCCESS', category: 'ADMIN_ACTIVITY', createdAt: hoursAgo(24) },
    { id: 'aud-3', organisationId: orgCorivoId, actorId: userRazeenId, actorEmail: 'razeen@corivotech.example', action: 'MAILBOX_SUSPENDED', resource: 'suspended@corivotech.example', ipAddress: '103.21.124.18', result: 'SUCCESS', category: 'COMPLIANCE_AUDIT', createdAt: hoursAgo(48) },
    { id: 'aud-4', organisationId: null, actorId: userPlatformId, actorEmail: 'operator@corivomail.example', action: 'PLATFORM_HEALTH_AUDIT', resource: 'All Cluster Adapters', ipAddress: '10.0.4.12', result: 'SUCCESS', category: 'PLATFORM_AUDIT', createdAt: hoursAgo(6) },
  ];

  const deliveryEvents: DeliveryEvent[] = [
    { id: 'del-1', organisationId: orgCorivoId, messageRef: 'crv-99a81f', senderDomain: 'corivotech.example', recipientDomain: 'meridianbank.example', status: 'ACCEPTED', retryCount: 0, failureReason: null, createdAt: hoursAgo(1.5) },
    { id: 'del-2', organisationId: orgCorivoId, messageRef: 'crv-88b12c', senderDomain: 'corivotech.example', recipientDomain: 'northstar-edu.example', status: 'SENT_TO_RECEIVING_SERVER', retryCount: 0, failureReason: null, createdAt: hoursAgo(12) },
    { id: 'del-3', organisationId: orgCorivoId, messageRef: 'crv-77c04d', senderDomain: 'corivotech.example', recipientDomain: 'legacy-host.example', status: 'DEFERRED', retryCount: 2, failureReason: '451 4.3.0 Recipient MX greylisting active; retry scheduled', createdAt: hoursAgo(19) },
    { id: 'del-4', organisationId: orgCorivoId, messageRef: 'crv-66d19e', senderDomain: 'corivotech.example', recipientDomain: 'invalid-rcpt.example', status: 'BOUNCED', retryCount: 0, failureReason: '550 5.1.1 Mailbox does not exist on receiving server', createdAt: hoursAgo(38) },
  ];

  const migrationJobs: MigrationJob[] = [
    {
      id: 'mig-1',
      organisationId: orgCorivoId,
      sourceProvider: 'ZOHO',
      sourceAccount: 'legacy-razeen@corivotech.example',
      targetMailbox: 'razeen@corivotech.example',
      status: 'COMPLETED',
      totalItems: 1420,
      successCount: 1418,
      failedCount: 2,
      errorDetail: '2 oversized legacy attachments exceeded 25 MB policy limit (Development Simulation)',
      createdAt: hoursAgo(300),
      updatedAt: hoursAgo(296),
    },
  ];

  const organisationSettings: OrganisationSetting[] = [
    {
      id: 'orgset-1',
      organisationId: orgCorivoId,
      defaultLanguage: 'en-IN',
      defaultTimezone: 'Asia/Kolkata',
      dateFormat: 'DD/MM/YYYY',
      defaultQuotaMb: 10240,
      defaultRoleKey: 'MAILBOX_USER',
      minPasswordLength: 10,
      requireComplexity: true,
      sessionTimeoutHours: 24,
      maxLoginAttempts: 5,
      enforce2fa: false,
      notifyDomainAlerts: true,
      notifyQuotaWarnings: true,
      notifySecurity: true,
      notifyDelivery: true,
      updatedAt: hoursAgo(24),
    },
    {
      id: 'orgset-2',
      organisationId: orgVanguardId,
      defaultLanguage: 'en-IN',
      defaultTimezone: 'Asia/Kolkata',
      dateFormat: 'DD/MM/YYYY',
      defaultQuotaMb: 15360,
      defaultRoleKey: 'MAILBOX_USER',
      minPasswordLength: 10,
      requireComplexity: true,
      sessionTimeoutHours: 24,
      maxLoginAttempts: 5,
      enforce2fa: false,
      notifyDomainAlerts: true,
      notifyQuotaWarnings: true,
      notifySecurity: true,
      notifyDelivery: true,
      updatedAt: hoursAgo(48),
    },
  ];

  const platformSettings: PlatformSetting = {
    id: 'plat-set-1',
    platformName: 'Corivo Mail',
    defaultQuotaMb: 10240,
    maxAttachmentMb: 25,
    maintenanceNotice: '',
    allowPublicSignup: true,
    supportedDomainPolicy: 'Valid FQDN required; RFC 2606 .example domains routed to Development Simulator',
    updatedAt: hoursAgo(72),
  };

  const platformOperators: PlatformOperator[] = [
    {
      id: 'op-1',
      userId: userPlatformId,
      email: 'operator@corivomail.example',
      displayName: 'Siddharth Rao',
      scope: 'FULL_OPERATOR',
      status: 'ACTIVE',
      createdAt: hoursAgo(800),
    },
  ];

  // --- V1/V2 feature records ---

  const mailLabels: MailLabel[] = [
    { id: 'lbl-1', mailboxId: mailboxRazeenId, name: 'Important', color: '#EF4444', createdAt: hoursAgo(300), updatedAt: hoursAgo(300) },
    { id: 'lbl-2', mailboxId: mailboxRazeenId, name: 'Clients', color: '#3B82F6', createdAt: hoursAgo(290), updatedAt: hoursAgo(290) },
    { id: 'lbl-3', mailboxId: mailboxRazeenId, name: 'Follow up', color: '#F59E0B', createdAt: hoursAgo(280), updatedAt: hoursAgo(280) },
  ];

  const mailRules: MailRule[] = [
    {
      id: 'rule-1',
      mailboxId: mailboxRazeenId,
      organisationId: orgCorivoId,
      name: 'GST & finance to Finance folder',
      enabled: true,
      stopProcessing: false,
      conditions: [{ field: 'subject', operator: 'contains', value: 'GST' }],
      actions: [{ type: 'move', value: 'finance-gst' }],
      createdAt: hoursAgo(270),
      updatedAt: hoursAgo(270),
    },
    {
      id: 'rule-2',
      mailboxId: mailboxRazeenId,
      organisationId: orgCorivoId,
      name: 'Star enterprise onboarding mail',
      enabled: true,
      stopProcessing: true,
      conditions: [{ field: 'subject', operator: 'contains', value: 'onboarding' }],
      actions: [{ type: 'star' }, { type: 'label', value: 'lbl-2' }],
      createdAt: hoursAgo(260),
      updatedAt: hoursAgo(40),
    },
  ];

  const autoReplies: AutoReply[] = [
    {
      id: 'autoreply-1',
      mailboxId: mailboxRazeenId,
      enabled: false,
      audience: 'EXTERNAL_ONLY',
      subject: 'Out of office',
      bodyHtml: '<p>Thank you for your email. I am away until further notice and will respond on my return.</p>',
      startAt: null,
      endAt: null,
      lastTriggeredAt: null,
      createdAt: hoursAgo(200),
      updatedAt: hoursAgo(200),
    },
  ];

  const mailboxForwarding: MailboxForwarding[] = [
    { id: 'fwd-1', mailboxId: mailboxRazeenId, enabled: false, addresses: [], keepCopy: true, updatedAt: hoursAgo(200) },
  ];

  const contactGroups: ContactGroup[] = [
    { id: 'cg-1', userId: userRazeenId, organisationId: orgCorivoId, name: 'Enterprise Clients', createdAt: hoursAgo(200), updatedAt: hoursAgo(200) },
    { id: 'cg-2', userId: userRazeenId, organisationId: orgCorivoId, name: 'Internal Team', createdAt: hoursAgo(600), updatedAt: hoursAgo(600) },
    { id: 'cg-3', userId: userRazeenId, organisationId: orgCorivoId, name: 'Imported', createdAt: hoursAgo(120), updatedAt: hoursAgo(120) },
  ];

  const messageComments: MessageComment[] = [
    {
      id: 'cmt-1',
      organisationId: orgCorivoId,
      mailboxId: mailboxRazeenId,
      messageId: 'msg-1',
      authorId: userRazeenId,
      authorEmail: 'razeen@corivotech.example',
      body: 'Internal note: legal has cleared the 120-seat commitment. Loop Ananya in before replying.',
      createdAt: hoursAgo(1),
      updatedAt: hoursAgo(1),
    },
  ];

  const appPasswords: AppPassword[] = [
    {
      id: 'apw-1',
      userId: userRazeenId,
      label: 'Outlook on Windows laptop',
      passwordHash: hashPassword('sample-app-password-never-shown'),
      prefix: 'crvm-7f2a',
      lastUsedAt: hoursAgo(6),
      revokedAt: null,
      createdAt: hoursAgo(140),
    },
  ];

  const ipAllowEntries: IpAllowEntry[] = [
    { id: 'ipallow-1', organisationId: orgCorivoId, value: '103.21.124.0/24', note: 'Corivo Technologies office range', createdBy: userAdminId, createdAt: hoursAgo(120) },
  ];

  const retentionPolicies: RetentionPolicy[] = [
    {
      id: 'ret-1',
      organisationId: orgCorivoId,
      auditLogRetentionDays: 365,
      messageRetentionDays: null,
      legalHoldEnabled: false,
      legalHoldNote: '',
      updatedAt: hoursAgo(100),
    },
  ];

  const subscriptions: Subscription[] = [
    {
      id: 'sub-1',
      organisationId: orgCorivoId,
      planCode: 'BUSINESS',
      seats: 6,
      status: 'ACTIVE',
      trialEndsAt: null,
      renewsAt: hoursFromNow(24 * 22),
      createdAt: hoursAgo(600),
      updatedAt: hoursAgo(120),
    },
  ];

  const invoiceNow = new Date();
  const invoicePeriodStart = new Date(invoiceNow.getTime() - 30 * 24 * 3600 * 1000);
  const lineItems = [{ description: 'Business plan — 6 mailboxes (30 GB)', quantity: 6, unitPriceInr: 299, amountInr: 1794 }];
  const invoices: Invoice[] = [
    {
      id: 'inv-1',
      organisationId: orgCorivoId,
      invoiceNumber: 'CORIVO-2026-0042',
      subscriptionId: 'sub-1',
      lineItems,
      subtotalInr: 1794,
      gstRate: 18,
      gstInr: 323,
      totalInr: 2117,
      status: 'PAID',
      billingName: 'Corivo Technologies Private Limited',
      billingGstin: '29AABCC1234F1Z5',
      billingAddress: 'Indiranagar 100 Feet Road, Bengaluru, Karnataka 560038',
      periodStart: invoicePeriodStart.toISOString(),
      periodEnd: invoiceNow.toISOString(),
      issuedAt: hoursAgo(72),
      paidAt: hoursAgo(70),
      createdAt: hoursAgo(72),
    },
    {
      id: 'inv-2',
      organisationId: orgCorivoId,
      invoiceNumber: 'CORIVO-2026-0043',
      subscriptionId: 'sub-1',
      lineItems,
      subtotalInr: 1794,
      gstRate: 18,
      gstInr: 323,
      totalInr: 2117,
      status: 'ISSUED',
      billingName: 'Corivo Technologies Private Limited',
      billingGstin: '29AABCC1234F1Z5',
      billingAddress: 'Indiranagar 100 Feet Road, Bengaluru, Karnataka 560038',
      periodStart: invoiceNow.toISOString(),
      periodEnd: new Date(invoiceNow.getTime() + 30 * 24 * 3600 * 1000).toISOString(),
      issuedAt: hoursAgo(2),
      paidAt: null,
      createdAt: hoursAgo(2),
    },
  ];

  const payments: Payment[] = [
    {
      id: 'pay-1',
      organisationId: orgCorivoId,
      invoiceId: 'inv-1',
      provider: 'RAZORPAY',
      method: 'UPI',
      amountInr: 2117,
      status: 'PAID',
      providerRef: 'pay_Ql3xSampleRef01',
      failureReason: null,
      createdAt: hoursAgo(70),
      updatedAt: hoursAgo(70),
    },
  ];

  const apiTokens: ApiToken[] = [
    {
      id: 'tok-1',
      organisationId: orgCorivoId,
      name: 'Migration tooling',
      tokenHash: hashToken('crvm_sample_token_value_never_replayed'),
      prefix: 'crvm_live_8c31',
      scopes: ['mail:read', 'domains:read', 'mailboxes:read'],
      lastUsedAt: hoursAgo(30),
      revokedAt: null,
      createdBy: userAdminId,
      createdAt: hoursAgo(200),
    },
  ];

  const webhookEndpoints: WebhookEndpoint[] = [
    {
      id: 'whk-1',
      organisationId: orgCorivoId,
      url: 'https://hooks.corivotech.example/corivo/events',
      events: ['mail.bounced', 'domain.verified'],
      secret: 'whsec_seed_sample_secret',
      status: 'ACTIVE',
      createdAt: hoursAgo(150),
      updatedAt: hoursAgo(150),
    },
  ];

  const webhookDeliveries: WebhookDelivery[] = [
    {
      id: 'whd-1',
      webhookId: 'whk-1',
      organisationId: orgCorivoId,
      event: 'mail.bounced',
      payload: { messageRef: 'crv-66d19e', recipientDomain: 'invalid-rcpt.example', reason: '550 5.1.1 Mailbox does not exist' },
      status: 'SUCCESS',
      statusCode: 200,
      signature: 'sha256=seed-sample-signature',
      attempt: 1,
      createdAt: hoursAgo(38),
    },
  ];

  const integrationInstallations: IntegrationInstallation[] = [
    { id: 'intinst-1', organisationId: orgCorivoId, integrationId: 'int-razorpay', status: 'ENABLED', config: { mode: 'SANDBOX' }, createdAt: hoursAgo(500), updatedAt: hoursAgo(120) },
    { id: 'intinst-2', organisationId: orgCorivoId, integrationId: 'int-webhooks', status: 'ENABLED', config: { endpoint: 'whk-1' }, createdAt: hoursAgo(150), updatedAt: hoursAgo(150) },
    { id: 'intinst-3', organisationId: orgCorivoId, integrationId: 'int-oidc', status: 'DISABLED', config: {}, createdAt: hoursAgo(150), updatedAt: hoursAgo(150) },
    { id: 'intinst-4', organisationId: orgCorivoId, integrationId: 'int-api', status: 'ENABLED', config: { tokens: '1' }, createdAt: hoursAgo(200), updatedAt: hoursAgo(30) },
  ];

  return {
    organisations,
    users,
    memberships,
    roleOverrides: {},
    domains,
    dnsRecords,
    mailboxes,
    aliases,
    distributionGroups,
    folders,
    messages,
    drafts,
    attachments: sampleAttachments,
    contacts,
    calendarEvents,
    sharedMailboxes,
    tasks,
    notes,
    userPreferences,
    notifications,
    sessions: [],
    passwordResetTokens: [],
    securityEvents,
    auditLogs,
    deliveryEvents,
    migrationJobs,
    organisationSettings,
    platformSettings,
    platformOperators,
    ...emptyFeatureCollections(),
    mailLabels,
    mailRules,
    autoReplies,
    mailboxForwarding,
    contactGroups,
    messageComments,
    appPasswords,
    ipAllowEntries,
    retentionPolicies,
    subscriptions,
    invoices,
    payments,
    apiTokens,
    webhookEndpoints,
    webhookDeliveries,
    integrationInstallations,
  };
}
