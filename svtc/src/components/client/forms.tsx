'use client';

import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';

export type Result = { ok: boolean; message?: string; data?: unknown } | null;
type ServerAction = (fd: FormData) => Promise<Result>;

const ModalCtx = createContext<{ close: () => void } | null>(null);

export function Modal({
  trigger, title, subtitle, children, size = 'md', defaultOpen = false,
}: { trigger: ReactNode; title: string; subtitle?: ReactNode; children: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'; defaultOpen?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];
  return (
    <>
      <span className="contents" onClick={() => setOpen(true)}>
        {trigger}
      </span>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === ref.current) setOpen(false);
        }}
        className={`m-auto w-[calc(100%-1.5rem)] ${width} max-h-[92dvh] overflow-hidden rounded-2xl border border-navy-100 bg-white p-0 text-left shadow-2xl backdrop:bg-navy-950/55 backdrop:backdrop-blur-sm open:animate-fade-up`}
      >
        {open && (
          <ModalCtx.Provider value={{ close: () => setOpen(false) }}>
            <div className="flex items-start justify-between gap-3 border-b border-navy-50 bg-gradient-to-r from-navy-50 to-white px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-navy-950">{title}</h2>
                {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
              </div>
              <button type="button" className="btn-icon -mr-2 -mt-1" onClick={() => setOpen(false)} aria-label="Fermer">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[calc(92dvh-72px)] overflow-y-auto px-5 py-4">{children}</div>
          </ModalCtx.Provider>
        )}
      </dialog>
    </>
  );
}

export function useModal() {
  return useContext(ModalCtx);
}

const PendingCtx = createContext(false);

export function SubmitButton({ children, className = 'btn btn-primary', pendingText }: { children: ReactNode; className?: string; pendingText?: string }) {
  const status = useFormStatus();
  const ctxPending = useContext(PendingCtx);
  const pending = status.pending || ctxPending;
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending && <Loader2 size={16} className="animate-spin" />}
      {pending ? pendingText ?? 'Enregistrement…' : children}
    </button>
  );
}

/**
 * Formulaire relié à une action serveur : notifications, fermeture de la fenêtre et réinitialisation après succès.
 * La soumission est gérée manuellement pour conserver la saisie de l'utilisateur en cas d'erreur
 * (React réinitialise sinon automatiquement les formulaires après chaque action).
 */
export function ActionForm({
  action, children, className, reset = true, closeOnSuccess = true, onSuccess,
}: { action: ServerAction; children: ReactNode; className?: string; reset?: boolean; closeOnSuccess?: boolean; onSuccess?: (r: Result) => void }) {
  const modal = useModal();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  return (
    <PendingCtx.Provider value={pending}>
      <form
        ref={formRef}
        className={className}
        onSubmit={(e) => {
          e.preventDefault();
          if (pending) return;
          const form = e.currentTarget;
          const fd = new FormData(form);
          start(async () => {
            const r = await action(fd);
            if (r?.ok) {
              if (r.message) toast.success(r.message);
              if (reset) form.reset();
              onSuccess?.(r);
              if (closeOnSuccess) modal?.close();
            } else if (r) {
              toast.error(r.message ?? 'Échec de l’opération.');
            }
          });
        }}
      >
        {children}
      </form>
    </PendingCtx.Provider>
  );
}

/** Bouton qui déclenche une action serveur (avec confirmation facultative). */
export function ActionButton({
  action, children, className = 'btn btn-ghost btn-sm', confirm: confirmText, title, onDone,
}: { action: () => Promise<Result>; children: ReactNode; className?: string; confirm?: string; title?: string; onDone?: (r: Result) => void }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className={className}
      disabled={pending}
      onClick={() => {
        if (confirmText && !window.confirm(confirmText)) return;
        start(async () => {
          const r = await action();
          const details = Array.isArray(r?.data) && r.data.length && typeof r.data[0] === 'string' ? (r.data as string[]).join(' • ') : undefined;
          if (r?.ok) {
            if (r.message) toast.success(r.message, { description: details, duration: details ? 12000 : 4000 });
          } else toast.error(r?.message ?? 'Échec de l’opération.');
          onDone?.(r);
        });
      }}
    >
      {pending ? <Loader2 size={15} className="animate-spin" /> : null}
      {children}
    </button>
  );
}

/** Liste déroulante qui soumet automatiquement son formulaire GET (filtres). */
export function AutoSubmitSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}

export function AutoSubmitInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}

export function RefreshOnFocus() {
  const router = useRouter();
  useEffect(() => {
    const f = () => router.refresh();
    window.addEventListener('focus', f);
    return () => window.removeEventListener('focus', f);
  }, [router]);
  return null;
}

export function CopyButton({ text, label = 'Copier', className = 'btn btn-ghost btn-sm' }: { text: string; label?: string; className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast.success('Copié dans le presse-papiers');
        } catch {
          toast.error('Copie impossible sur cet appareil');
        }
      }}
    >
      {label}
    </button>
  );
}

export function PrintButton({ label = 'Imprimer' }: { label?: string }) {
  return (
    <button type="button" className="btn btn-ghost no-print" onClick={() => window.print()}>
      {label}
    </button>
  );
}
