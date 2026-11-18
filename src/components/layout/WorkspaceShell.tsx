import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Archive,
  Bell,
  Calendar,
  CheckSquare,
  ChevronDown,
  Clock,
  FileEdit,
  FileText,
  Folder,
  FolderPlus,
  HelpCircle,
  Inbox,
  KeyRound,
  LogOut,
  MailPlus,
  Menu,
  MoreHorizontal,
  Pencil,
  Search,
  Send,
  Settings,
  Shield,
  ShieldAlert,
  Sliders,
  Star,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';
import { useToast } from '../../context/ToastContext.tsx';
import { apiFetch, ApiError } from '../../lib/api.ts';
import { cn, formatDateTime } from '../../lib/utils.ts';
import type { MailFolder, UserNotification } from '../../shared/types.ts';
import { CorivoLogo } from '../ui/CorivoLogo.tsx';
import { Avatar, Button, Input, Modal } from '../ui/Primitives.tsx';

export function WorkspaceShell({
  children,
  onCompose,
  customFolders = [],
  unreadCounts = {},
  onFoldersChanged,
}: {
  children: React.ReactNode;
  onCompose?: () => void;
  customFolders?: MailFolder[];
  unreadCounts?: Record<string, number>;
  onFoldersChanged?: () => void;
}) {
  const { session, logout, isOrgAdminOrOwner, isPlatformAdmin } = useAuth();
  const { notify, confirm } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [renameTarget, setRenameTarget] = useState<MailFolder | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const notifRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  const loadNotifications = () => {
    apiFetch<{ notifications: UserNotification[] }>('/api/notifications')
      .then((res) => setNotifications(res.notifications))
      .catch(() => {});
  };

  useEffect(() => {
    loadNotifications();
    const qs = new URLSearchParams(location.search);
    if (location.pathname === '/app/search') {
      setSearchTerm(qs.get('q') || '');
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notifOpen && notifRef.current && !notifRef.current.contains(target)) {
        setNotifOpen(false);
      }
      if (profileOpen && profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotifOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [notifOpen, profileOpen]);

  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;

  const handleGlobalSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/app/search?q=${encodeURIComponent(searchTerm.trim())}`);
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    try {
      await apiFetch('/api/folders', {
        method: 'POST',
        body: JSON.stringify({ name: folderName.trim() }),
      });
      setFolderName('');
      setNewFolderOpen(false);
      notify('Custom folder created.', 'success');
      onFoldersChanged?.();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to create folder', 'error');
    }
  };

  const handleRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !renameValue.trim()) return;
    try {
      await apiFetch(`/api/folders/${renameTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      setRenameTarget(null);
      setRenameValue('');
      notify('Folder renamed.', 'success');
      onFoldersChanged?.();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Unable to rename folder', 'error');
    }
  };

  const handleDeleteFolder = async (f: MailFolder) => {
    const ok = await confirm({
      title: `Delete folder "${f.name}"?`,
      description: 'Messages inside this folder will be moved back to Inbox.',
      confirmLabel: 'Delete Folder',
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/folders/${f.id}`, { method: 'DELETE' });
      notify(`Folder "${f.name}" deleted.`, 'info');
      onFoldersChanged?.();
      if (location.pathname.includes(f.slug)) {
        navigate('/app/mail/inbox');
      }
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Failed to delete folder', 'error');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch('/api/notifications/all/read', { method: 'POST' });
      loadNotifications();
    } catch {
      notify('Unable to update notifications.', 'error');
    }
  };

  const handleMarkOneRead = async (id: string) => {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: 'POST' });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch {
      // handled gracefully
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const systemNav = [
    { label: 'Inbox', slug: 'inbox', to: '/app/mail/inbox', icon: Inbox },
    { label: 'Starred', slug: 'starred', to: '/app/mail/starred', icon: Star },
    { label: 'Snoozed', slug: 'snoozed', to: '/app/mail/snoozed', icon: Clock },
    { label: 'Sent', slug: 'sent', to: '/app/mail/sent', icon: Send },
    { label: 'Drafts', slug: 'drafts', to: '/app/mail/drafts', icon: FileEdit },
    { label: 'Archive', slug: 'archive', to: '/app/mail/archive', icon: Archive },
    { label: 'Spam', slug: 'spam', to: '/app/mail/spam', icon: ShieldAlert },
    { label: 'Trash', slug: 'trash', to: '/app/mail/trash', icon: Trash2 },
  ];

  const moduleNav = [
    { label: 'Contacts', to: '/app/contacts', icon: Users },
    { label: 'Calendar', to: '/app/calendar', icon: Calendar },
    { label: 'Shared Mailboxes', to: '/app/shared-mailboxes', icon: MoreHorizontal },
    { label: 'Tasks', to: '/app/tasks', icon: CheckSquare },
    { label: 'Notes', to: '/app/notes', icon: FileText },
    { label: 'Migration', to: '/app/migration', icon: Sliders },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full py-4 px-3 overflow-y-auto">
      <Button
        type="button"
        onClick={() => {
          setMobileNavOpen(false);
          if (onCompose) {
            onCompose();
          } else {
            navigate('/app/mail/inbox?compose=1');
          }
        }}
        className="w-full justify-center mb-4"
      >
        <MailPlus className="w-4 h-4" />
        Compose
      </Button>

      <div className="space-y-0.5">
        {systemNav.map((item) => {
          const count = unreadCounts[item.slug] || 0;
          return (
            <NavLink
              key={item.slug}
              to={item.to}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-[#2563EB]/10 text-[#2563EB] font-semibold'
                    : 'text-[#64748B] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#172033] dark:hover:text-slate-100'
                )
              }
            >
              <span className="flex items-center gap-2.5 truncate">
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {count > 0 && (
                <span className="font-mono text-xs tabular-nums">{count}</span>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Custom Folders */}
      <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="px-3 mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-[#64748B] dark:text-slate-400">Folders</span>
          <button
            type="button"
            onClick={() => setNewFolderOpen(true)}
            className="text-[#64748B] hover:text-[#2563EB] p-1 rounded cursor-pointer"
            title="Create custom folder"
            aria-label="Create custom folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="space-y-0.5">
          {customFolders.map((f) => (
            <div key={f.id} className="group flex items-center">
              <NavLink
                to={`/app/mail/folders/${f.slug}`}
                onClick={() => setMobileNavOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex-1 flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors min-w-0',
                    isActive
                      ? 'bg-[#2563EB]/10 text-[#2563EB] font-semibold'
                      : 'text-[#64748B] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  )
                }
              >
                <span className="flex items-center gap-2 truncate">
                  <Folder className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{f.name}</span>
                </span>
                {(unreadCounts[f.slug] || 0) > 0 && (
                  <span className="font-mono text-[11px]">{unreadCounts[f.slug]}</span>
                )}
              </NavLink>
              <button
                type="button"
                onClick={() => {
                  setRenameTarget(f);
                  setRenameValue(f.name);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-[#2563EB] transition-opacity"
                aria-label={`Rename folder ${f.name}`}
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteFolder(f)}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-[#DC2626] transition-opacity"
                aria-label={`Delete folder ${f.name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Workspace Modules */}
      <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
        <p className="px-3 mb-2 text-xs font-semibold text-[#64748B] dark:text-slate-400">Apps</p>
        <div className="space-y-0.5">
          {moduleNav.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              onClick={() => setMobileNavOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors',
                  isActive
                    ? 'bg-[#2563EB]/10 text-[#2563EB] font-semibold'
                    : 'text-[#64748B] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                )
              }
            >
              <m.icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{m.label}</span>
            </NavLink>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-4 border-t border-slate-200 dark:border-slate-800 space-y-1">
        <NavLink
          to="/app/account/profile"
          onClick={() => setMobileNavOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors',
              isActive
                ? 'bg-[#2563EB]/10 text-[#2563EB] font-semibold'
                : 'text-[#64748B] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            )
          }
        >
          <User className="w-4 h-4 shrink-0" />
          <span className="truncate">Account &amp; Profile</span>
        </NavLink>
        <NavLink
          to="/app/settings"
          onClick={() => setMobileNavOpen(false)}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors',
              isActive
                ? 'bg-[#2563EB]/10 text-[#2563EB] font-semibold'
                : 'text-[#64748B] dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            )
          }
        >
          <Settings className="w-4 h-4 shrink-0" />
          <span className="truncate">Settings Centre</span>
        </NavLink>
        {isOrgAdminOrOwner && (
          <Link
            to="/admin/overview"
            onClick={() => setMobileNavOpen(false)}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[#14243A] dark:text-slate-200 bg-[#F1F5F9] dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors mt-1"
          >
            <Shield className="w-4 h-4 text-[#2563EB]" />
            <span>Admin Console</span>
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-[#F7F9FC] dark:bg-[#0B1220] text-[#172033] dark:text-slate-100 overflow-hidden">
      {/* Top Bar */}
      <header className="h-14 shrink-0 bg-white dark:bg-[#111A2E] border-b border-slate-200 dark:border-slate-800 px-3 sm:px-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="lg:hidden p-2 rounded-lg text-[#64748B] hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Toggle workspace navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link to="/app/mail/inbox">
            <CorivoLogo />
          </Link>
        </div>

        <form onSubmit={handleGlobalSearch} className="hidden sm:flex flex-1 max-w-lg relative">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search emails, senders, attachments..."
            className="w-full h-9 pl-9 pr-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F7F9FC] dark:bg-[#0B1220] text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB]"
          />
        </form>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/app/search')}
            className="sm:hidden p-2 rounded-lg text-[#64748B] hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Search mail"
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="p-2 rounded-lg text-[#64748B] hover:text-[#172033] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="Workspace help"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => {
                setNotifOpen(!notifOpen);
                setProfileOpen(false);
              }}
              className="relative p-2 rounded-lg text-[#64748B] hover:text-[#172033] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-1 rounded-full bg-[#2563EB] text-white text-[9px] font-mono flex items-center justify-center tabular-nums">
                  {unreadNotifCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-semibold">Notifications</span>
                  {unreadNotifCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-xs text-[#2563EB] hover:underline cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {notifications.length === 0 ? (
                    <p className="p-4 text-xs text-[#64748B] text-center">No notifications.</p>
                  ) : (
                    notifications.slice(0, 6).map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          if (!n.isRead) handleMarkOneRead(n.id);
                        }}
                        className={cn(
                          'w-full text-left px-4 py-3 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer',
                          !n.isRead && 'bg-[#2563EB]/5'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-[#172033] dark:text-slate-100">{n.title}</p>
                          {!n.isRead && <span className="w-2 h-2 rounded-full bg-[#2563EB] mt-1 shrink-0" />}
                        </div>
                        <p className="text-[#64748B] dark:text-slate-400 mt-0.5">{n.message}</p>
                        <p className="text-[11px] font-mono text-[#94A3B8] mt-1 tabular-nums">
                          {formatDateTime(n.createdAt, session?.preferences.timezone, 'full', session?.preferences)}
                        </p>
                      </button>
                    ))
                  )}
                </div>
                <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-[#F7F9FC] dark:bg-[#0B1220] flex items-center justify-between text-xs">
                  <Link
                    to="/app/account/notifications"
                    onClick={() => setNotifOpen(false)}
                    className="text-[#2563EB] font-medium hover:underline"
                  >
                    View all notifications
                  </Link>
                  <Link
                    to="/app/settings/notifications"
                    onClick={() => setNotifOpen(false)}
                    className="text-[#64748B] hover:text-[#172033] dark:hover:text-white"
                  >
                    Preferences
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Profile Avatar Dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => {
                setProfileOpen(!profileOpen);
                setNotifOpen(false);
              }}
              className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Open account menu"
              aria-expanded={profileOpen}
            >
              <Avatar name={session?.user.displayName || 'User'} src={session?.user.avatarUrl} size="sm" />
              <span className="hidden md:block text-left max-w-[140px]">
                <span className="block text-xs font-semibold truncate">{session?.user.displayName}</span>
                <span className="block text-[11px] text-[#64748B] truncate">{session?.organisation?.name}</span>
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-[#64748B] hidden md:block" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] shadow-lg z-50 py-2">
                <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-sm font-semibold truncate">{session?.user.displayName}</p>
                  <p className="text-xs font-mono text-[#64748B] truncate">{session?.user.email}</p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">
                    {session?.membership?.roleKey.replace(/_/g, ' ') || 'Platform Operator'}
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
                  {(isOrgAdminOrOwner || isPlatformAdmin) && (
                    <div className="my-1 border-t border-slate-100 dark:border-slate-800 pt-1">
                      {isOrgAdminOrOwner && (
                        <Link
                          to="/admin/overview"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <Shield className="w-4 h-4 text-[#2563EB]" />
                          <span>Organisation Admin Console</span>
                        </Link>
                      )}
                      {isPlatformAdmin && (
                        <Link
                          to="/platform"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <Shield className="w-4 h-4 text-[#D97706]" />
                          <span>Platform Super Admin</span>
                        </Link>
                      )}
                    </div>
                  )}
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

      {/* Main Container */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-60 shrink-0 bg-white dark:bg-[#111A2E] border-r border-slate-200 dark:border-slate-800">
          {sidebarContent}
        </aside>

        {/* Mobile / Tablet Drawer */}
        {mobileNavOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <div className="w-64 bg-white dark:bg-[#111A2E] border-r border-slate-200 dark:border-slate-800 h-full z-50">
              {sidebarContent}
            </div>
            <div className="flex-1 bg-[#14243A]/40" onClick={() => setMobileNavOpen(false)} />
          </div>
        )}

        <main className="flex-1 min-w-0 overflow-hidden flex flex-col pb-14 lg:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 h-14 bg-white dark:bg-[#111A2E] border-t border-slate-200 dark:border-slate-800 flex items-center justify-around z-30">
        <Link to="/app/mail/inbox" className="flex flex-col items-center gap-0.5 text-[11px] text-[#64748B]">
          <Inbox className="w-4 h-4" />
          <span>Inbox</span>
        </Link>
        <Link to="/app/search" className="flex flex-col items-center gap-0.5 text-[11px] text-[#64748B]">
          <Search className="w-4 h-4" />
          <span>Search</span>
        </Link>
        <Link to="/app/contacts" className="flex flex-col items-center gap-0.5 text-[11px] text-[#64748B]">
          <Users className="w-4 h-4" />
          <span>Contacts</span>
        </Link>
        <Link to="/app/calendar" className="flex flex-col items-center gap-0.5 text-[11px] text-[#64748B]">
          <Calendar className="w-4 h-4" />
          <span>Calendar</span>
        </Link>
        <Link to="/app/account/profile" className="flex flex-col items-center gap-0.5 text-[11px] text-[#64748B]">
          <User className="w-4 h-4" />
          <span>Account</span>
        </Link>
      </nav>

      {/* New Custom Folder Modal */}
      <Modal open={newFolderOpen} onClose={() => setNewFolderOpen(false)} title="Create Custom Folder">
        <form onSubmit={handleCreateFolder} className="space-y-4">
          <Input
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="e.g., Vendor Invoices"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setNewFolderOpen(false)}>Cancel</Button>
            <Button type="submit">Create Folder</Button>
          </div>
        </form>
      </Modal>

      {/* Rename Custom Folder Modal */}
      <Modal open={Boolean(renameTarget)} onClose={() => setRenameTarget(null)} title="Rename Custom Folder">
        <form onSubmit={handleRenameFolder} className="space-y-4">
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            placeholder="Folder name"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button type="submit">Save Name</Button>
          </div>
        </form>
      </Modal>

      {/* Help Modal */}
      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Corivo Mail Workspace Guide">
        <div className="space-y-3 text-xs text-[#64748B]">
          <p><strong className="text-[#172033] dark:text-slate-100">Runtime Mode:</strong> {session?.runtimeMode === 'PRODUCTION' ? 'Production Mail Services' : 'Development Simulation Mode (local mailbox & DNS adapters active)'}</p>
          <p><strong className="text-[#172033] dark:text-slate-100">Attachment Policy:</strong> Maximum 25 MB per file. Executable scripts (.exe, .bat, .js) are blocked.</p>
          <p><strong className="text-[#172033] dark:text-slate-100">Simulated Bounce Test:</strong> Sending to any address containing &quot;bounce&quot; triggers a realistic 550 bounce event in the Delivery Queue.</p>
        </div>
      </Modal>
    </div>
  );
}
