import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { ShieldCheck, ShieldX } from 'lucide-react';
import { db } from '@/db';
import { verifications, payments } from '@/db/schema';
import { Logo } from '@/components/brand';
import { dateTimeFr } from '@/lib/format';
import { rateLimit } from '@/lib/audit';
import { clientInfo } from '@/lib/auth';

export const metadata = { title: 'Vérification de document', robots: { index: false } };

export default async function Verify({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { ip } = await clientInfo();
  const allowed = (await rateLimit(`verify:${ip}`, 60, 600)).ok;
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  const [v] = allowed ? await db.select().from(verifications).where(eq(verifications.code, clean)) : [];
  let cancelled = false;
  if (v?.kind === 'RECU') {
    const [p] = await db.select({ c: payments.cancelled }).from(payments).where(eq(payments.id, Number(v.refId)));
    cancelled = !!p?.c;
  }
  const ok = !!v && !cancelled;
  return (
    <main className="circuit-bg flex min-h-dvh items-center justify-center bg-navy-950 px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="bg-navy-950 p-5"><Logo className="mx-auto h-20 w-auto" /></div>
        <div className="p-6 text-center">
          {ok ? <ShieldCheck size={56} className="mx-auto text-emerald-500" /> : <ShieldX size={56} className="mx-auto text-rose-500" />}
          <h1 className="mt-3 text-xl font-semibold text-navy-950">{ok ? 'Document authentique' : !allowed ? 'Trop de vérifications' : cancelled ? 'Reçu annulé' : 'Document introuvable'}</h1>
          <p className="mt-1 text-sm text-slate-500">{ok ? 'Ce document a bien été émis par la Silicon Valley Training Center.' : cancelled ? 'Ce reçu a été annulé par le centre : il n’a plus de valeur.' : 'Aucun document ne correspond à ce code. Méfiez-vous des contrefaçons.'}</p>
          {v && (
            <dl className="mt-5 space-y-2 rounded-2xl bg-navy-50/60 p-4 text-left text-sm">
              {Object.entries(v.summary).map(([k, val]) => <div key={k} className="flex justify-between gap-3"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium text-navy-950">{val}</dd></div>)}
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Code</dt><dd className="font-mono">{v.code}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Enregistré le</dt><dd>{dateTimeFr(v.createdAt)}</dd></div>
            </dl>
          )}
          <Link href="/" className="btn btn-ghost mt-6">Site de la SVTC</Link>
        </div>
      </div>
    </main>
  );
}
