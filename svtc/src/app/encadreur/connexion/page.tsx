import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, CalendarCheck, ClipboardCheck, FileUp, LineChart } from 'lucide-react';
import { LoginForm } from '@/components/client/login-form';
import { Logo } from '@/components/brand';
import { getSessionUser, PORTALS } from '@/lib/auth';

export const metadata = { title: 'Espace encadreur — connexion' };

export default async function TutorLogin({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const u = await getSessionUser();
  if (u?.role === 'ENCADREUR' && u.tutorId) redirect(PORTALS.ENCADREUR.home);
  const { erreur } = await searchParams;
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-royal-700 via-royal-800 to-navy-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 opacity-30 circuit-bg" />
        <div className="relative">
          <Logo className="h-24 w-auto" />
        </div>
        <div className="relative max-w-lg">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-300">Espace encadreur</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight">Votre salle de classe,<br />dans votre poche.</h1>
          <ul className="mt-8 space-y-4 text-[15px] text-royal-50">
            <li className="flex gap-3"><CalendarCheck className="shrink-0 text-gold-300" /> Démarrez et clôturez vos séances en un geste</li>
            <li className="flex gap-3"><ClipboardCheck className="shrink-0 text-gold-300" /> Faites l&apos;appel en quelques secondes</li>
            <li className="flex gap-3"><FileUp className="shrink-0 text-gold-300" /> Déposez vos fiches de TD au format PDF</li>
            <li className="flex gap-3"><LineChart className="shrink-0 text-gold-300" /> Suivez la progression de chaque élève et informez les parents</li>
          </ul>
        </div>
        <p className="relative text-sm text-royal-100">Comprendre. <span className="text-gold-300">Pratiquer.</span> Maîtriser.</p>
      </section>
      <section className="flex items-center justify-center bg-white px-5 py-10">
        <div className="w-full max-w-sm animate-fade-up">
          <Link href="/connexion" className="mb-8 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-navy-900"><ArrowLeft size={16} /> Autres espaces</Link>
          <div className="mb-6 rounded-2xl bg-navy-950 p-3 lg:hidden"><Logo className="mx-auto h-20 w-auto" /></div>
          <span className="inline-flex rounded-full bg-royal-50 px-3 py-1 text-xs font-semibold text-royal-700">Encadreurs</span>
          <h2 className="mt-3 text-2xl font-semibold text-navy-950">Bonjour, prêt pour la séance&nbsp;?</h2>
          <p className="mb-6 mt-1 text-sm text-slate-500">Connectez-vous avec les identifiants remis par l&apos;administration.</p>
          {erreur === 'profil' && <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">Votre compte n&apos;est relié à aucune fiche encadreur. Contactez l&apos;administration.</p>}
          <LoginForm portal="ENCADREUR" variant="encadreur" userLabel="Identifiant" userPlaceholder="prenom.nom" />
        </div>
      </section>
    </main>
  );
}
