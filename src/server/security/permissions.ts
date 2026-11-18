import type { PermissionKey, RoleDefinition, RoleKey } from '../../shared/types.ts';

export const ALL_PERMISSIONS: { key: PermissionKey; label: string; description: string }[] = [
  { key: 'domains.manage', label: 'Manage Domains', description: 'Add, verify, and configure DNS for organisation domains' },
  { key: 'mailboxes.create', label: 'Create Mailboxes', description: 'Provision new employee mailboxes and aliases' },
  { key: 'mailboxes.delete', label: 'Delete Mailboxes', description: 'Permanently remove mailboxes from the organisation' },
  { key: 'mailboxes.suspend', label: 'Suspend Mailboxes', description: 'Suspend or reactivate mailbox access' },
  { key: 'users.manage', label: 'Manage Users', description: 'Invite users, edit profiles, and assign permitted roles' },
  { key: 'quotas.change', label: 'Change Quotas', description: 'Adjust mailbox storage limits within organisation cap' },
  { key: 'usage.view', label: 'View Usage & Storage', description: 'Inspect storage analytics and deliverability telemetry' },
  { key: 'security.manage', label: 'Manage Security', description: 'Configure password policy, session timeouts, and login protection' },
  { key: 'organisation.settings', label: 'Organisation Preferences', description: 'Update default timezone, language, and alerts' },
  { key: 'organisation.legal', label: 'Legal & Owner Settings', description: 'Modify legal entity name, primary domain, and billing plan' },
  { key: 'audit.view', label: 'View Audit Logs', description: 'Inspect administrative and security activity logs' },
];

export const DEFAULT_ROLES: RoleDefinition[] = [
  {
    id: 'role-owner',
    key: 'OWNER',
    name: 'Organisation Owner',
    description: 'Full control over organisation legal profile, domains, mailboxes, security, roles, and billing.',
    permissions: ALL_PERMISSIONS.map((p) => p.key),
  },
  {
    id: 'role-admin',
    key: 'ADMIN',
    name: 'Organisation Admin',
    description: 'Manages permitted users, mailboxes, domains, quotas, and operational usage.',
    permissions: [
      'domains.manage',
      'mailboxes.create',
      'mailboxes.suspend',
      'users.manage',
      'quotas.change',
      'usage.view',
      'organisation.settings',
      'audit.view',
    ],
  },
  {
    id: 'role-user',
    key: 'MAILBOX_USER',
    name: 'Mailbox User',
    description: 'Standard employee mailbox user with access to personal email, folders, profile, and personal settings.',
    permissions: [],
  },
];

export function getPermissionsForRole(roleKey: RoleKey, customOverrides?: Record<string, PermissionKey[]>): PermissionKey[] {
  if (roleKey === 'PLATFORM_SUPER_ADMIN') {
    return [];
  }
  if (customOverrides && customOverrides[roleKey]) {
    return customOverrides[roleKey];
  }
  const role = DEFAULT_ROLES.find((r) => r.key === roleKey);
  return role ? [...role.permissions] : [];
}

export function hasPermission(
  roleKey: RoleKey | undefined,
  permission: PermissionKey,
  customOverrides?: Record<string, PermissionKey[]>
): boolean {
  if (!roleKey) return false;
  return getPermissionsForRole(roleKey, customOverrides).includes(permission);
}
