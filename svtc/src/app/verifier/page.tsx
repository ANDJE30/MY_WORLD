import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/brand';

export const metadata = { title: 'Vérifier un document' };

async function go(fd: FormData) {
  'use server';
  const code = String(fd.get('code') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  redirect(`/verifier/${code || 'X'}`);
}

export default function VerifyHome() {
  return (
    <main className="circuit-bg flex min-h-dvh items-center justify-center bg-navy-950 px-4">
      <form action={go} className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
        <div className="-mx-6 -mt-6 mb-5 rounded-t-3xl bg-navy-950 p-4"><Logo className="mx-auto h-16 w-auto" /></div>
        <ShieldCheck className="mx-auto text-royal-600" />
        <h1 className="mt-2 text-lg font-semibold text-navy-950">Vérifier un reçu ou un état de suivi</h1>
        <input name="code" className="input mt-4 text-center font-mono uppercase tracking-widest" placeholder="CODE" required maxLength={16} />
        <button className="btn btn-primary mt-3 w-full">Vérifier</button>
      </form>
    </main>
  );
}
