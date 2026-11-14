'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  LayoutDashboard, Settings, School, BookOpen, DoorOpen, GraduationCap, Users, UserCog, Link2, CalendarRange, CalendarCheck,
  ClipboardCheck, LineChart, FileText, Wallet, AlertCircle, ReceiptText, Landmark, Building2, HandCoins, MessageSquare,
  KeyRound, ScrollText, DatabaseBackup, Menu, X, Search, LogOut, UserRound, ChevronRight, Command,
} from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';
import { cn } from '@/components/ui';
import { CredentialsHost } from './credentials';

type Item = { href: string; label: string; icon: typeof Settings; badge?: string; keywords?: string };
type Group = { title: string; items: Item[] };

const NAV: Group[] = [
  { title: 'Pilotage', items: [{ href: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, keywords: 'accueil statistiques' }] },
  {
    title: 'Structure',
    items: [
      { href: '/admin/parametres', label: 'Paramètres du centre', icon: Settings, keywords: 'logo nom horaires séances sms année' },
      { href: '/admin/classes', label: 'Classes', icon: School, keywords: 'pti tti niveau frais' },
      { href: '/admin/matieres', label: 'Matières', icon: BookOpen },
      { href: '/admin/salles', label: 'Salles', icon: DoorOpen, keywords: 'tarif location' },
    ],
  },
  {
    title: 'Personnes',
    items: [
      { href: '/admin/eleves', label: 'Élèves', icon: GraduationCap, keywords: 'inscription import liste' },
      { href: '/admin/parents', label: 'Parents', icon: Users, keywords: 'comptes téléphone' },
      { href: '/admin/encadreurs', label: 'Encadreurs', icon: UserCog, keywords: 'enseignants comptes identifiants' },
      { href: '/admin/attributions', label: 'Attributions', icon: Link2, keywords: 'classes matières encadreurs' },
    ],
  },
  {
    title: 'Pédagogie',
    items: [
      { href: '/admin/planning', label: 'Planning', icon: CalendarRange, keywords: 'emploi du temps génération pdf' },
      { href: '/admin/seances', label: 'Séances', icon: CalendarCheck, keywords: 'heures validation pointage' },
      { href: '/admin/presences', label: 'Présences', icon: ClipboardCheck, keywords: 'assiduité absences appel' },
      { href: '/admin/notes', label: 'Notes & suivi', icon: LineChart, keywords: 'évaluations moyennes progression' },
      { href: '/admin/documents', label: 'Documents pédagogiques', icon: FileText, keywords: 'fiches td pdf' },
    ],
  },
  {
    title: 'Finances',
    items: [
      { href: '/admin/paiements', label: 'Paiements des élèves', icon: Wallet, keywords: 'encaisser reçu scolarité' },
      { href: '/admin/impayes', label: 'Impayés & relances', icon: AlertCircle, keywords: 'rappel solde' },
      { href: '/admin/depenses', label: 'Dépenses', icon: ReceiptText },
      { href: '/admin/caisse', label: 'État de caisse', icon: Landmark, keywords: 'comptabilité journal pdf' },
      { href: '/admin/location', label: 'Location des salles', icon: Building2, keywords: 'loyer salle a b' },
      { href: '/admin/salaires', label: 'Salaires des encadreurs', icon: HandCoins, keywords: 'paie heures pourcentage' },
    ],
  },
  { title: 'Communication', items: [{ href: '/admin/messages', label: 'Messages aux parents', icon: MessageSquare, keywords: 'sms whatsapp rappel' }] },
  {
    title: 'Sécurité',
    items: [
      { href: '/admin/comptes', label: 'Comptes utilisateurs', icon: KeyRound, keywords: 'mots de passe accès' },
      { href: '/admin/journal', label: "Journal d'audit", icon: ScrollText, keywords: 'historique traces' },
      { href: '/admin/sauvegarde', label: 'Sauvegarde & export', icon: DatabaseBackup, keywords: 'csv json export' },
    ],
  },
];

function isActive(path: string, href: string) {
  return href === '/admin' ? path === '/admin' : path === href || path.startsWith(href + '/');
}

export function AdminShell({
  children, user, centerName, yearLabel, badges, logoUrl,
}: { children: ReactNode; user: { fullName: string; username: string }; centerName: string; yearLabel: string; badges: Record<string, number>; logoUrl: string | null }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const current = NAV.flatMap((g) => g.items).find((i) => isActive(path, i.href));

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/admin" className="flex items-center gap-3 px-5 pb-4 pt-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl ?? '/brand/emblem.webp'} alt="" className="h-11 w-auto drop-shadow-[0_0_14px_rgba(56,189,248,0.35)]" />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-[13px] font-bold tracking-wide text-white">SVTC Répétitions</p>
          <p className="truncate text-[11px] text-navy-300">{centerName}</p>
        </div>
      </Link>
      <div className="mx-5 mb-3 gold-rule opacity-70" />
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-6 [scrollbar-width:thin]">
        {NAV.map((g) => (
          <div key={g.title}>
            <p className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-navy-400">{g.title}</p>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const active = isActive(path, it.href);
                const badge = badges[it.href];
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] transition',
                        active ? 'bg-gradient-to-r from-royal-600/90 to-royal-700/40 font-medium text-white shadow-inner' : 'text-navy-200 hover:bg-white/5 hover:text-white',
                      )}
                    >
                      {active && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gold-400" />}
                      <it.icon size={17} className={active ? 'text-gold-300' : 'text-navy-400 group-hover:text-sky-300'} />
                      <span className="flex-1 truncate">{it.label}</span>
                      {badge ? <span className="rounded-full bg-gold-400 px-1.5 text-[11px] font-bold text-navy-950">{badge}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-400 text-sm font-bold text-navy-950">{user.fullName.slice(0, 1)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-white">{user.fullName}</p>
            <p className="truncate text-[11px] text-navy-300">@{user.username}</p>
          </div>
          <form action={logoutAction}>
            <button className="rounded-lg p-2 text-navy-300 hover:bg-white/10 hover:text-white" title="Se déconnecter" aria-label="Se déconnecter"><LogOut size={17} /></button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-[#f4f6fb]">
      <aside className="circuit-bg fixed inset-y-0 left-0 z-30 hidden w-[264px] bg-navy-950 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <aside className="circuit-bg absolute inset-y-0 left-0 w-[86%] max-w-[300px] bg-navy-950 shadow-2xl animate-fade-up">
            <button className="absolute right-3 top-4 rounded-lg p-2 text-navy-200 hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Fermer le menu"><X size={20} /></button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-20 border-b border-navy-100/70 bg-white/85 backdrop-blur-xl no-print">
          <div className="flex h-14 items-center gap-2 px-3 sm:px-6">
            <button className="btn-icon lg:hidden" onClick={() => setOpen(true)} aria-label="Ouvrir le menu"><Menu size={20} /></button>
            <div className="hidden min-w-0 items-center gap-1.5 text-sm text-slate-500 sm:flex">
              <span>Administration</span>
              {current && current.href !== '/admin' && (<><ChevronRight size={14} /><span className="truncate font-medium text-navy-900">{current.label}</span></>)}
            </div>
            <span className="truncate text-sm font-semibold text-navy-900 sm:hidden">{current?.label ?? 'Administration'}</span>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setPalette(true)} className="hidden items-center gap-2 rounded-xl border border-navy-100 bg-navy-50/60 px-3 py-1.5 text-sm text-slate-500 hover:border-royal-300 md:flex">
                <Search size={15} /> Rechercher une page… <kbd className="ml-4 inline-flex items-center gap-0.5 rounded-md border border-navy-100 bg-white px-1.5 text-[11px]"><Command size={11} />K</kbd>
              </button>
              <button onClick={() => setPalette(true)} className="btn-icon md:hidden" aria-label="Rechercher"><Search size={19} /></button>
              <span className="hidden rounded-full bg-gold-50 px-3 py-1 text-xs font-semibold text-gold-700 ring-1 ring-gold-200 sm:inline">Année {yearLabel}</span>
              <Link href="/admin/compte" className="btn-icon" title="Mon compte" aria-label="Mon compte"><UserRound size={19} /></Link>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] px-3 py-5 sm:px-6 sm:py-7">{children}</main>
      </div>
      {palette && <Palette onClose={() => setPalette(false)} />}
      <CredentialsHost />
    </div>
  );
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const items = useMemo(() => {
    const all = NAV.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title })));
    const n = q.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!n) return all;
    return all.filter((i) => `${i.label} ${i.group} ${i.keywords ?? ''}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(n));
  }, [q]);
  const go = (href: string) => {
    onClose();
    router.push(href);
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-navy-950/50 px-3 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl animate-fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-navy-50 px-4">
          <Search size={18} className="text-slate-400" />
          <input
            ref={input}
            value={q}
            onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              if (e.key === 'Enter' && items[idx]) go(items[idx].href);
            }}
            placeholder="Aller à… (élèves, salaires, planning, sms…)"
            className="h-14 w-full bg-transparent text-[15px] outline-none"
          />
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-500">Aucun résultat</li>}
          {items.map((i, k) => (
            <li key={i.href}>
              <button onMouseEnter={() => setIdx(k)} onClick={() => go(i.href)} className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm', k === idx ? 'bg-royal-50 text-royal-800' : 'text-navy-800')}>
                <i.icon size={17} className="text-royal-600" />
                <span className="flex-1">{i.label}</span>
                <span className="text-xs text-slate-400">{i.group}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
