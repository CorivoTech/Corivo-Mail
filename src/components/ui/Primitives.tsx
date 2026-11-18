import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  X,
} from 'lucide-react';
import { cn, getInitials } from '../../lib/utils.ts';

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}) {
  const variants = {
    primary: 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white border border-transparent',
    secondary: 'bg-[#14243A] hover:bg-[#1E3352] text-white border border-transparent dark:bg-slate-800 dark:hover:bg-slate-700',
    outline: 'bg-white dark:bg-[#111A2E] border border-slate-200 dark:border-slate-700 text-[#172033] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800',
    ghost: 'bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-[#64748B] dark:text-slate-300 hover:text-[#172033] dark:hover:text-white border border-transparent',
    danger: 'bg-[#DC2626] hover:bg-red-700 text-white border border-transparent',
  };

  const sizes = {
    sm: 'h-8 px-3 text-xs rounded-lg',
    md: 'h-10 px-4 text-sm rounded-lg',
    lg: 'h-11 px-6 text-sm rounded-lg',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB]',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E]',
        className
      )}
    >
      {children}
    </div>
  );
}

export function Input({
  className,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <div className="w-full">
      <input
        className={cn(
          'w-full h-10 rounded-lg border bg-white dark:bg-[#0B1220] px-3 text-sm text-[#172033] dark:text-slate-100 placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB] transition-colors',
          error ? 'border-[#DC2626]' : 'border-slate-200 dark:border-slate-700',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-[#DC2626]">{error}</p>}
    </div>
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1220] px-3 text-sm text-[#172033] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB]',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({
  className,
  error,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: string }) {
  return (
    <div className="w-full">
      <textarea
        className={cn(
          'w-full rounded-lg border bg-white dark:bg-[#0B1220] p-3 text-sm text-[#172033] dark:text-slate-100 placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/25 focus:border-[#2563EB]',
          error ? 'border-[#DC2626]' : 'border-slate-200 dark:border-slate-700',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-[#DC2626]">{error}</p>}
    </div>
  );
}

export function FieldLabel({
  children,
  htmlFor,
  hint,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-[#172033] dark:text-slate-200"
      >
        {children}
      </label>
      {hint && <span className="text-xs text-[#64748B] dark:text-slate-400">{hint}</span>}
    </div>
  );
}

// Semantic Status Indicator: clean icon + text label (no pill capsules)
export function StatusText({
  status,
  label,
}: {
  status: 'VERIFIED' | 'ACTIVE' | 'CLEAN' | 'SUCCESS' | 'ACCEPTED' | 'DELIVERED' | 'SENT_TO_RECEIVING_SERVER' | 'PENDING' | 'CHECKING' | 'QUEUED' | 'DEFERRED' | 'WARNING' | 'SANDBOX' | 'FAILED' | 'SUSPENDED' | 'BOUNCED' | 'DENIED' | 'QUARANTINED' | string;
  label?: string;
}) {
  const s = status.toUpperCase();
  const isGood = ['VERIFIED', 'ACTIVE', 'CLEAN', 'SUCCESS', 'ACCEPTED', 'DELIVERED', 'SENT_TO_RECEIVING_SERVER', 'COMPLETED', 'LIVE'].includes(s);
  const isWarn = ['PENDING', 'CHECKING', 'QUEUED', 'DEFERRED', 'WARNING', 'SANDBOX', 'ILLUSTRATIVE', 'PARTIAL', 'DEVELOPMENT_SIMULATED', 'UNCONFIGURED', 'PLANNED'].includes(s);
  const isBad = ['FAILED', 'SUSPENDED', 'BOUNCED', 'DENIED', 'QUARANTINED', 'CRITICAL'].includes(s);

  const text = label || status.replace(/_/g, ' ');

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap',
        isGood && 'text-[#16A34A]',
        isWarn && 'text-[#D97706]',
        isBad && 'text-[#DC2626]',
        !isGood && !isWarn && !isBad && 'text-[#64748B] dark:text-slate-400'
      )}
    >
      {isGood && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
      {isWarn && <Clock className="w-3.5 h-3.5 shrink-0" />}
      {isBad && <ShieldAlert className="w-3.5 h-3.5 shrink-0" />}
      {!isGood && !isWarn && !isBad && <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
      <span>{text}</span>
    </span>
  );
}

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = {
    sm: 'w-7 h-7 text-[11px]',
    md: 'w-9 h-9 text-xs',
    lg: 'w-14 h-14 text-base',
  };
  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-[#14243A] text-white font-semibold shrink-0 select-none overflow-hidden',
        sizes[size],
        className
      )}
    >
      {src ? (
        <img src={src} alt={name} className="w-full h-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[#64748B] dark:text-slate-400 mb-3">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-semibold text-[#172033] dark:text-slate-100">{title}</h3>
      <p className="text-sm text-[#64748B] dark:text-slate-400 mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SkeletonRows({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100 dark:divide-slate-800">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-4 py-3.5 flex items-center gap-4 animate-pulse">
          <div className="w-4 h-4 rounded bg-slate-200 dark:bg-slate-800 shrink-0" />
          <div className="h-3.5 w-32 rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-3.5 flex-1 rounded bg-slate-100 dark:bg-slate-800/60" />
          <div className="h-3.5 w-16 rounded bg-slate-200 dark:bg-slate-800 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#14243A]/45 backdrop-blur-[1px] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] shadow-lg overflow-hidden max-h-[90vh] flex flex-col',
          maxWidth
        )}
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4">
          <div>
            <h3 id={titleId} className="text-base font-semibold text-[#172033] dark:text-slate-100">{title}</h3>
            {description && (
              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function DevelopmentModeNotice({
  label = 'Development Simulation',
  detail,
}: {
  label?: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 px-4 py-2.5 flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
      <Clock className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />
      <div>
        <span className="font-semibold">{label}: </span>
        <span>{detail}</span>
      </div>
    </div>
  );
}
