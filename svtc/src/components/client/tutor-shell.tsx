'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { House, CalendarCheck, Users, PenLine, FileUp, Clock, MessageCircle, UserRound, LogOut, Grid2x2, X } from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';
import { cn } from '@/components/ui';

const NAV = [
  { href: '/encadreur', label: 'Accueil', icon: House },
  { href: '/encadreur/seances', label: 'Séances', icon: CalendarCheck },
  { href: '/encadreur/eleves', label: 'Élèves', icon: Users },
  { href: '/encadreur/notes', label: 'Notes', icon: PenLine },
  { href: '/encadreur/documents', label: 'Fiches de TD', icon: FileUp },
  { href: '/encadreur/heures', label: 'Mes heures', icon: Clock },
  { href: '/encadreur/messages', label: 'Messages', icon: MessageCircle },
];
const active = (p: string, h: string) => (h === '/encadreur' ? p === h : p.startsWith(h));

export function TutorShell({ children, name, unread }: { children: ReactNode; name: string; unread: number }) {
  const path = usePathname();
  const [more, setMore] = useState(false);
  useEffect(() => setMore(false), [path]);
  const first = name.split(' ')[0];
  return (
    <div className="min-h-dvh bg-[#f3f6fd] pb-24 lg:pb-10">
      <header className="sticky top-0 z-30 bg-gradient-to-r from-royal-700 via-royal-800 to-navy-900 text-white shadow-lg no-print">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link href="/encadreur" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/emblem.webp" alt="" className="h-9 w-auto" />
            <div className="leading-tight">
              <p className="text-[13px] font-semibold">Espace encadreur</p>
              <p className="text-[11px] text-royal-100">SVTC Répétitions</p>
            </div>
          </Link>
          <nav className="ml-6 hidden items-center gap-1 lg:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={cn('relative rounded-full px-3.5 py-1.5 text-[13.5px] transition', active(path, n.href) ? 'bg-white text-royal-800 shadow' : 'text-royal-50 hover:bg-white/10')}>
                {n.label}
                {n.href === '/encadreur/messages' && unread > 0 && <span className="ml-1.5 rounded-full bg-gold-400 px-1.5 text-[11px] font-bold text-navy-950">{unread}</span>}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/encadreur/compte" className="hidden items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 text-sm hover:bg-white/20 sm:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-400 text-xs font-bold text-navy-950">{first[0]}</span>{first}
            </Link>
            <form action={logoutAction}><button className="rounded-full p-2 hover:bg-white/10" aria-label="Se déconnecter" title="Se déconnecter"><LogOut size={18} /></button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:py-7">{children}</main>

      {/* Barre d'onglets mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-navy-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden no-print">
        <div className="grid grid-cols-5">
          {NAV.slice(0, 4).map((n) => (
            <Link key={n.href} href={n.href} className={cn('flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium', active(path, n.href) ? 'text-royal-700' : 'text-slate-500')}>
              <span className={cn('rounded-full px-4 py-1 transition', active(path, n.href) && 'bg-royal-100')}><n.icon size={20} /></span>
              {n.label}
            </Link>
          ))}
          <button onClick={() => setMore(true)} className="relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium text-slate-500">
            <span className="rounded-full px-4 py-1"><Grid2x2 size={20} /></span>Plus
            {unread > 0 && <span className="absolute right-5 top-2 h-2.5 w-2.5 rounded-full bg-rose-500" />}
          </button>
        </div>
      </nav>
      {more && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMore(false)}>
          <div className="absolute inset-0 bg-navy-950/50" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] animate-fade-up" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between"><p className="font-semibold text-navy-950">Menu</p><button onClick={() => setMore(false)} aria-label="Fermer"><X size={20} /></button></div>
            <div className="grid grid-cols-3 gap-3">
              {[...NAV.slice(4), { href: '/encadreur/compte', label: 'Mon compte', icon: UserRound }].map((n) => (
                <Link key={n.href} href={n.href} className="flex flex-col items-center gap-2 rounded-2xl bg-royal-50 p-4 text-center text-xs font-medium text-royal-800">
                  <n.icon size={22} />{n.label}{n.href === '/encadreur/messages' && unread > 0 ? ` (${unread})` : ''}
                </Link>
              ))}
            </div>
            <form action={logoutAction} className="mt-4"><button className="btn btn-danger-soft w-full"><LogOut size={16} /> Se déconnecter</button></form>
          </div>
        </div>
      )}
    </div>
  );
}
