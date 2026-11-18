import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  Bell,
  Building2,
  ChevronDown,
  CreditCard,
  FileCheck,
  Globe,
  HardDrive,
  HelpCircle,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  Menu,
  Network,
  Puzzle,
  Receipt,
  Send,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  User,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { cn } from '../../lib/utils.ts';
import { CorivoLogo } from '../ui/CorivoLogo.tsx';
import { Avatar, Button, Modal } from '../ui/Primitives.tsx';

export function AdminLayout({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (profileOpen && profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setProfileOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [profileOpen]);

  const navGroups: {
    label: string;
    items: { to: string; label: string; icon: React.ComponentType<{ className?: string }>; end?: boolean }[];
  }[] = [
    {
      label: 'Directory & Mail',
      items: [
        { to: '/admin/overview', label: 'Overview', icon: LayoutDashboard, end: true },
        { to: '/admin/domains', label: 'Domains', icon: Globe, end: true },
        { to: '/admin/dns', label: 'DNS Records', icon: Server },
        { to: '/admin/mailboxes', label: 'Mailboxes', icon: Mail },
        { to: '/admin/users', label: 'Users', icon: Users },
        { to: '/admin/groups', label: 'Aliases & Groups', icon: Network },
        { to: '/admin/roles', label: 'Roles & Permissions', icon: KeyRound },
      ],
    },
    {
      label: 'Security & Delivery',
      items: [
        { to: '/admin/security', label: 'Security Dashboard', icon: Shield, end: true },
        { to: '/admin/security/settings', label: 'Security Settings', icon: ShieldAlert },
        { to: '/admin/deliverability', label: 'Deliverability', icon: Send, end: true },
        { to: '/admin/deliverability/queue', label: 'Delivery Queue', icon: Inbox },
      ],
    },
    {
      label: 'Storage & Organisation',
      items: [
        { to: '/admin/usage', label: 'Usage', icon: HardDrive, end: true },
        { to: '/admin/storage', label: 'Storage', icon: HardDrive, end: true },
        { to: '/admin/organisation', label: 'Org Profile', icon: Building2, end: true },
        { to: '/admin/organisation/preferences', label: 'Org Preferences', icon: SlidersHorizontal },
        { to: '/admin/organisation/security', label: 'Org Security', icon: Lock },
        { to: '/admin/organisation/notifications', label: 'Org Notifications', icon: Bell },
      ],
    },
    {
      label: 'Governance & Billing',
      items: [
        { to: '/admin/activity', label: 'Admin Activity', icon: Activity },
        { to: '/admin/audit-logs', label: 'Audit Logs (V2)', icon: FileCheck },
        { to: '/admin/billing', label: 'Billing (V1)', icon: CreditCard },
        { to: '/admin/subscription', label: 'Subscription', icon: Receipt },
        { to: '/admin/integrations', label: 'Integrations (V2)', icon: Puzzle },
      ],
    },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebar = (
    <div className="flex flex-col h-full bg-[#14243A] text-slate-200">
      <div className="px-4 h-14 border-b border-slate-800 flex items-center justify-between">
        <Link to="/admin/overview" className="flex items-center gap-2">
          <CorivoLogo inverse />
        </Link>
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          className="lg:hidden p-1 text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-3 border-b border-slate-800/80">
        <p className="text-[11px] font-medium text-slate-400">Admin Console</p>
        <p className="text-xs font-semibold text-white truncate mt-0.5">
          {session?.organisation?.name || 'Organisation'}
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {navGroups.map((group) => (
          <div key={group.label} className="space-y-0.5">
            <p className="px-3 pb-1 text-[11px] font-medium text-slate-400">{group.label}</p>
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setDrawerOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap',
                    isActive
                      ? 'bg-[#2563EB] text-white'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  )
                }
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-slate-800 space-y-2">
        <Link to="/app/mail/inbox">
          <Button variant="outline" size="sm" className="w-full justify-start bg-transparent border-slate-700 text-slate-200 hover:bg-white/10 hover:text-white">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Mail Workspace
          </Button>
        </Link>
        {session?.user.isPlatformAdmin && (
          <Link to="/platform">
            <Button variant="ghost" size="sm" className="w-full justify-start text-amber-300 hover:bg-white/10">
              <Activity className="w-3.5 h-3.5" />
              Platform Console
            </Button>
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F7F9FC] dark:bg-[#0B1220] text-[#172033] dark:text-slate-100">
      <aside className="hidden lg:block w-60 shrink-0">{sidebar}</aside>

      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-64 h-full">{sidebar}</div>
          <div className="flex-1 bg-black/40" onClick={() => setDrawerOpen(false)} />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 bg-white dark:bg-[#111A2E] border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-[#64748B] hover:bg-slate-100"
              aria-label="Open admin menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs text-[#64748B] truncate">
              <span>Admin Console</span>
              <span className="mx-1.5">/</span>
              <span className="font-semibold text-[#14243A] dark:text-white">{title}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                aria-label="Open account menu"
                aria-expanded={profileOpen}
              >
                <Avatar name={session?.user.displayName || 'Admin'} src={session?.user.avatarUrl} size="sm" />
                <span className="hidden sm:block text-xs font-medium text-[#14243A] dark:text-slate-100 max-w-[140px] truncate">
                  {session?.user.displayName}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#64748B]" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] shadow-lg z-50 py-2">
                  <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-sm font-semibold truncate">{session?.user.displayName}</p>
                    <p className="text-xs font-mono text-[#64748B] truncate">{session?.user.email}</p>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">
                      {session?.membership?.roleKey.replace(/_/g, ' ') || 'Organisation Admin'}
                    </p>
                  </div>
                  <div className="py-1">
                    <Link
                      to="/app/account/profile"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <User className="w-4 h-4 text-[#64748B]" />
                      <span>My Profile</span>
                    </Link>
                    <Link
                      to="/app/account/security"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <KeyRound className="w-4 h-4 text-[#64748B]" />
                      <span>Account Security</span>
                    </Link>
                    <Link
                      to="/app/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Settings className="w-4 h-4 text-[#64748B]" />
                      <span>Settings</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        setHelpOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-left"
                    >
                      <HelpCircle className="w-4 h-4 text-[#64748B]" />
                      <span>Help</span>
                    </button>
                  </div>
                  <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-xs text-[#DC2626] hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-bold text-[#14243A] dark:text-white">{title}</h1>
              {subtitle && <p className="text-sm text-[#64748B] dark:text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
          </div>

          {children}
        </main>
      </div>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Corivo Mail Admin & Workspace Guide">
        <div className="space-y-3 text-xs text-[#64748B]">
          <p><strong className="text-[#172033] dark:text-slate-100">Runtime Mode:</strong> {session?.runtimeMode === 'PRODUCTION' ? 'Production Mail Services' : 'Development Simulation Mode (local mailbox & DNS adapters active)'}</p>
          <p><strong className="text-[#172033] dark:text-slate-100">Role Permissions:</strong> Owners hold full legal, billing, and role-matrix authority; Admins manage domains, users, mailboxes, security, and deliverability.</p>
          <p><strong className="text-[#172033] dark:text-slate-100">Account &amp; Personal Settings:</strong> Use the profile menu to access My Profile, Account Security, Active Sessions, and Settings anytime.</p>
        </div>
      </Modal>
    </div>
  );
}
