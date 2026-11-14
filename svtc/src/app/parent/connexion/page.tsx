/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Heart } from 'lucide-react';
import { LoginForm } from '@/components/client/login-form';
import { Logo } from '@/components/brand';
import { getSessionUser, PORTALS } from '@/lib/auth';

export const metadata = { title: 'Espace parents — connexion' };

export default async function ParentLogin({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const u = await getSessionUser();
  if (u?.role === 'PARENT' && u.parentId) redirect(PORTALS.PARENT.home);
  const { erreur } = await searchParams;
  return (
    <main className="min-h-dvh bg-gradient-to-b from-gold-50 via-white to-royal-50/60">
      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-5 py-6">
        <div className="flex items-center justify-between">
          <Link href="/connexion" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-navy-900"><ArrowLeft size={16} /> Retour</Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-gold-700 shadow-sm ring-1 ring-gold-200"><Heart size={13} className="fill-gold-400 text-gold-400" /> Espace parents</span>
        </div>
        <div className="grid flex-1 items-center gap-10 py-8 md:grid-cols-2">
          <div className="order-2 md:order-1">
            <div className="relative overflow-hidden rounded-[2rem] bg-navy-950 shadow-[var(--shadow-lift)]">
              <img src="/brand/hero-students.jpg" alt="Élèves de la SVTC en séance de travail" className="h-64 w-full object-cover opacity-90 md:h-96" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950 via-navy-950/70 to-transparent p-6 text-white">
                <p className="text-lg font-semibold">Suivez la réussite de votre enfant</p>
                <p className="mt-1 text-sm text-navy-100">Planning, présences, notes, messages et paiements : tout au même endroit.</p>
              </div>
            </div>
          </div>
          <div className="order-1 mx-auto w-full max-w-sm md:order-2">
            <div className="mb-6 inline-block rounded-2xl bg-navy-950 px-4 py-3"><Logo className="h-16 w-auto" /></div>
            <h1 className="text-3xl font-semibold leading-tight text-navy-950">Bienvenue, chers parents</h1>
            <p className="mb-6 mt-2 text-[15px] text-slate-600">Votre identifiant est votre <strong>numéro de téléphone</strong> enregistré au centre.</p>
            {erreur === 'profil' && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Votre compte n&apos;est relié à aucune fiche parent. Contactez le centre.</p>}
            <LoginForm portal="PARENT" variant="parent" userLabel="Numéro de téléphone" userPlaceholder="6XX XX XX XX" userHint="Exemple : 657 51 36 41" />
            <p className="mt-6 text-center text-xs text-slate-500">Mot de passe oublié ? Appelez le centre : il vous en attribuera un nouveau.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
