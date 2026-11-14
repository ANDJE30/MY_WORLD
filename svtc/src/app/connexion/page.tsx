import Link from 'next/link';
import { ShieldCheck, BookOpenCheck, HeartHandshake, ArrowRight } from 'lucide-react';
import { Logo, CircuitLines } from '@/components/brand';

export const metadata = { title: 'Connexion' };

const PORTALS = [
  { href: '/parent/connexion', icon: HeartHandshake, title: 'Je suis parent', text: 'Suivre la scolarité de mon enfant', cls: 'bg-gold-400 text-navy-950 hover:bg-gold-300' },
  { href: '/encadreur/connexion', icon: BookOpenCheck, title: 'Je suis encadreur', text: 'Gérer mes séances et mes élèves', cls: 'bg-royal-600 text-white hover:bg-royal-500' },
  { href: '/admin/connexion', icon: ShieldCheck, title: 'Administration', text: 'Piloter le centre', cls: 'bg-white/5 text-white ring-1 ring-white/15 hover:bg-white/10' },
];

export default function ChoosePortal() {
  return (
    <main className="circuit-bg relative flex min-h-dvh items-center justify-center overflow-hidden bg-navy-950 px-4 py-10">
      <CircuitLines className="absolute -left-16 top-0 w-[560px] opacity-50" />
      <div className="relative w-full max-w-md text-center animate-fade-up">
        <Link href="/"><Logo className="mx-auto h-32 w-auto" /></Link>
        <h1 className="mt-6 text-2xl font-semibold text-white">Choisissez votre espace</h1>
        <p className="mt-1 text-sm text-navy-200">Chaque profil dispose de son propre espace sécurisé.</p>
        <div className="mt-8 space-y-3 text-left">
          {PORTALS.map((p) => (
            <Link key={p.href} href={p.href} className={`group flex items-center gap-4 rounded-2xl p-4 transition ${p.cls}`}>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/10"><p.icon /></span>
              <span className="flex-1">
                <span className="block font-semibold">{p.title}</span>
                <span className="block text-sm opacity-80">{p.text}</span>
              </span>
              <ArrowRight className="transition group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
