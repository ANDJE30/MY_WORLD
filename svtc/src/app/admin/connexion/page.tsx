import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { LoginForm } from '@/components/client/login-form';
import { Logo, CircuitLines } from '@/components/brand';
import { getSessionUser, PORTALS } from '@/lib/auth';
import { adminExists } from '@/lib/bootstrap';

export const metadata = { title: 'Administration — connexion' };

export default async function AdminLogin() {
  const u = await getSessionUser();
  if (u?.role === 'ADMIN') redirect(PORTALS.ADMIN.home);
  const installed = await adminExists();
  return (
    <main className="circuit-bg relative flex min-h-dvh items-center justify-center overflow-hidden bg-navy-950 px-4 py-10">
      <CircuitLines className="absolute -left-10 top-10 w-[520px] opacity-60" />
      <CircuitLines className="absolute -right-16 bottom-0 w-[520px] rotate-180 opacity-50" />
      <div className="relative w-full max-w-md animate-fade-up">
        <Link href="/connexion" className="mb-6 inline-flex items-center gap-1.5 text-sm text-navy-200 hover:text-white"><ArrowLeft size={16} /> Choisir un autre espace</Link>
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <Logo className="mx-auto h-28 w-auto drop-shadow-[0_0_25px_rgba(56,189,248,0.25)]" />
          <div className="mx-auto my-5 gold-rule w-40" />
          <div className="mb-6 text-center">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-gold-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-gold-300"><ShieldCheck size={14} /> Console d&apos;administration</p>
            <h1 className="mt-3 text-xl font-semibold text-white">Pilotage du centre de répétitions</h1>
            <p className="mt-1 text-sm text-navy-200">Accès réservé à la direction de la SVTC.</p>
          </div>
          {installed ? (
            <LoginForm portal="ADMIN" variant="admin" userLabel="Identifiant administrateur" userPlaceholder="admin" />
          ) : (
            <div className="rounded-2xl border border-gold-400/30 bg-gold-400/10 p-4 text-sm text-gold-100">
              <p className="font-semibold text-gold-300">Première installation</p>
              <p className="mt-1">Aucun compte administrateur n&apos;existe encore. Créez-le maintenant.</p>
              <Link href="/installation" className="btn btn-gold mt-3 w-full">Installer l&apos;application</Link>
            </div>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-navy-300">Connexion chiffrée · verrouillage automatique après 5 échecs · journal d&apos;audit</p>
      </div>
    </main>
  );
}
