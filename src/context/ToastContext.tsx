import React, { createContext, useCallback, useContext, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '../lib/utils.ts';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ToastContextValue {
  notify: (title: string, variant?: ToastVariant, description?: string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    options: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);

  const notify = useCallback((title: string, variant: ToastVariant = 'info', description?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, title, description, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ options, resolve });
    });
  }, []);

  const handleConfirmClose = (result: boolean) => {
    if (confirmState) {
      confirmState.resolve(result);
      setConfirmState(null);
    }
  };

  return (
    <ToastContext.Provider value={{ notify, confirm }}>
      {children}

      {/* Global Toast Container */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-lg border bg-white dark:bg-[#111A2E] px-4 py-3 shadow-sm transition-all',
              t.variant === 'success' && 'border-[#16A34A]/30',
              t.variant === 'error' && 'border-[#DC2626]/30',
              t.variant === 'warning' && 'border-[#D97706]/30',
              t.variant === 'info' && 'border-slate-200 dark:border-slate-800'
            )}
          >
            {t.variant === 'success' && <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />}
            {t.variant === 'error' && <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />}
            {t.variant === 'warning' && <AlertTriangle className="w-4 h-4 text-[#D97706] shrink-0 mt-0.5" />}
            {t.variant === 'info' && <Info className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#172033] dark:text-slate-100">{t.title}</p>
              {t.description && (
                <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">{t.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Global Confirmation Dialog */}
      {confirmState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#14243A]/40 backdrop-blur-[1px] p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111A2E] p-6 shadow-lg">
            <h3 className="text-base font-semibold text-[#172033] dark:text-slate-100">
              {confirmState.options.title}
            </h3>
            <p className="text-sm text-[#64748B] dark:text-slate-400 mt-2">
              {confirmState.options.description}
            </p>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => handleConfirmClose(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-[#172033] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
              >
                {confirmState.options.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmClose(true)}
                className={cn(
                  'px-4 py-2 text-sm font-medium rounded-lg text-white whitespace-nowrap',
                  confirmState.options.destructive
                    ? 'bg-[#DC2626] hover:bg-red-700'
                    : 'bg-[#2563EB] hover:bg-[#1D4ED8]'
                )}
              >
                {confirmState.options.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
