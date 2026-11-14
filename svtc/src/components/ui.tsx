import type { ReactNode } from 'react';
import { initials } from '@/lib/format';

export function cn(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export type Tone = 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'violet' | 'gold';

export function Badge({ tone = 'slate', children, className }: { tone?: Tone | string; children: ReactNode; className?: string }) {
  return <span className={cn('badge', `badge-${tone}`, className)}>{children}</span>;
}

export function PageHeader({ title, subtitle, actions, kicker }: { title: string; subtitle?: ReactNode; actions?: ReactNode; kicker?: string }) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 animate-fade-up">
        {kicker && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-600">{kicker}</p>}
        <h1 className="text-xl font-semibold tracking-tight text-navy-950 sm:text-2xl">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title, subtitle, actions, children, className, pad = true, id,
}: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean; id?: string }) {
  return (
    <section id={id} className={cn('card animate-fade-up', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b border-navy-50 px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="card-title">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={pad ? 'card-pad' : ''}>{children}</div>
    </section>
  );
}

const TONES: Record<string, string> = {
  blue: 'from-royal-500 to-royal-700 text-white',
  navy: 'from-navy-800 to-navy-950 text-white',
  gold: 'from-gold-300 to-gold-500 text-navy-950',
  green: 'from-emerald-500 to-emerald-700 text-white',
  red: 'from-rose-500 to-rose-700 text-white',
  violet: 'from-violet-500 to-violet-700 text-white',
  cyan: 'from-sky-400 to-cyan-600 text-white',
};

export function Stat({ label, value, hint, icon, tone = 'blue' }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: keyof typeof TONES }) {
  return (
    <div className="card relative overflow-hidden p-4 animate-fade-up">
      <div className="flex items-start gap-3">
        {icon && (
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm', TONES[tone])}>{icon}</div>
        )}
        <div className="min-w-0">
          <p className="truncate text-[12px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-0.5 truncate text-xl font-semibold text-navy-950 sm:text-[22px]">{value}</p>
          {hint && <div className="mt-0.5 truncate text-xs text-slate-500">{hint}</div>}
        </div>
      </div>
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-50 text-navy-500">{icon}</div>}
      <p className="font-medium text-navy-900">{title}</p>
      {text && <p className="mt-1 max-w-md text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

export function Avatar({ name, color = '#2453d6', size = 36 }: { name: string; color?: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-sm"
      style={{ background: `linear-gradient(135deg, ${color}, #0a163a)`, width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function Progress({ value, tone = 'blue' }: { value: number | null; tone?: 'blue' | 'green' | 'amber' | 'red' | 'gold' }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  const bar = { blue: 'bg-royal-600', green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-rose-500', gold: 'bg-gold-400' }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-navy-50" role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-all', bar)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function rateTone(rate: number | null): 'green' | 'amber' | 'red' | 'blue' {
  if (rate === null) return 'blue';
  if (rate >= 85) return 'green';
  if (rate >= 65) return 'amber';
  return 'red';
}

export function avgTone(avg: number | null): Tone {
  if (avg === null) return 'slate';
  if (avg >= 14) return 'green';
  if (avg >= 10) return 'blue';
  if (avg >= 8) return 'amber';
  return 'red';
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="-mx-px overflow-x-auto">{children}</div>;
}

export function Dot({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden />;
}
