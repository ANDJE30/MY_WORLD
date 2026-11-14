'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { House, CalendarDays, LineChart, MessageCircle, Wallet, LogOut, UserRound } from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';
import { cn } from '@/components/ui';

const NAV = [
  { href: '/parent', label: 'Accueil', icon: House },
  { href: '/parent/planning', label: 'Planning', icon: CalendarDays },
  { href: '/parent/suivi', label: 'Suivi', icon: LineChart },
  { href: '/parent/messages', label: 'Messages', icon: MessageCircle },
  { href: '/parent/paiements', label: 'Paiements', icon: Wallet },
];
const active = (p: string, h: string) => (h === '/parent' ? p === h : p.startsWith(h));

export function ParentShell({ children, name, kids, unread }: { children: ReactNode; name: string; kids: { id: number; firstName: string; className: string; color: string }[]; unread: number }) {
  const path = usePathname();
  const sp = useSearchParams();
  const current = Number(sp.get('enfant')) || kids[0]?.id;
  const q = (id: number) => `?enfant=${id}`;
  return (
    <div className="min-h-dvh bg-gradient-to-b from-gold-50/70 via-[#fbfaf6] to-[#f6f7fb] pb-24 lg:pb-10">
      <header className="sticky top-0 z-30 border-b border-gold-200/60 bg-white/85 backdrop-blur-xl no-print">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4">
          <Link href={`/parent${current ? q(current) : ''}`} className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-navy-950 p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/emblem.webp" alt="" className="h-full w-full object-contain" />
            </span>
            <div className="leading-tight"><p className="text-[13px] font-semibold text-navy-950">Espace parents</p><p className="text-[11px] text-gold-700">Silicon Valley Training Center</p></div>
          </Link>
          <nav className="ml-6 hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={`${n.href}${current ? q(current) : ''}`} className={cn('rounded-full px-3.5 py-1.5 text-[13.5px] font-medium transition', active(path, n.href) ? 'bg-navy-950 text-white' : 'text-navy-700 hover:bg-gold-100')}>
                {n.label}{n.href === '/parent/messages' && unread > 0 && <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 text-[11px] text-white">{unread}</span>}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <Link href="/parent/compte" className="rounded-full p-2 text-navy-700 hover:bg-gold-100" title="Mon compte" aria-label="Mon compte"><UserRound size={19} /></Link>
            <form action={logoutAction}><button className="rounded-full p-2 text-navy-700 hover:bg-gold-100" title="Se déconnecter" aria-label="Se déconnecter"><LogOut size={19} /></button></form>
          </div>
        </div>
        {kids.length > 1 && (
          <div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto px-4 pb-3">
            {kids.map((k) => (
              <Link key={k.id} href={`${path}${q(k.id)}`} className={cn('flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition', k.id === current ? 'border-navy-950 bg-navy-950 text-white' : 'border-gold-200 bg-white text-navy-800')}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: k.color }} />{k.firstName} · {k.className}
              </Link>
            ))}
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-5 sm:py-7">
        <p className="mb-4 text-sm text-slate-500">Bonjour <span className="font-medium text-navy-900">{name}</span></p>
        {children}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-gold-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden no-print">
        <div className="grid grid-cols-5">
          {NAV.map((n) => (
            <Link key={n.href} href={`${n.href}${current ? q(current) : ''}`} className={cn('relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', active(path, n.href) ? 'text-navy-950' : 'text-slate-500')}>
              <span className={cn('rounded-full px-3.5 py-1 transition', active(path, n.href) && 'bg-gold-300')}><n.icon size={20} /></span>{n.label}
              {n.href === '/parent/messages' && unread > 0 && <span className="absolute right-4 top-1.5 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{unread}</span>}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
