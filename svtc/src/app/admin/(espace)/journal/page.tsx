import { desc, ilike, or, sql } from 'drizzle-orm';
import { ScrollText, Search } from 'lucide-react';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { dateTimeFr } from '@/lib/format';
import { Badge, Card, Empty, PageHeader, TableWrap } from '@/components/ui';

export const metadata = { title: "Journal d'audit" };

const tone = (a: string) => (/ECHEC|VERROU|SUPPRIM|ANNUL|DESACTIV/.test(a) ? 'red' : /CONNEXION|DECONNEXION/.test(a) ? 'slate' : /PAIEMENT|SALAIRE|LOCATION|DEPENSE/.test(a) ? 'gold' : 'blue');

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const q = (sp.q ?? '').trim();
  const where = q ? or(ilike(auditLogs.action, `%${q}%`), ilike(auditLogs.username, `%${q}%`), ilike(auditLogs.entity, `%${q}%`), sql`${auditLogs.details}::text ilike ${'%' + q + '%'}`) : undefined;
  const rows = await db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(100).offset((page - 1) * 100);
  return (
    <div className="space-y-6">
      <PageHeader kicker="Sécurité" title="Journal d'audit" subtitle="Traçabilité de toutes les opérations sensibles : connexions, paiements, comptes, planning, documents…" />
      <Card pad={false}>
        <form method="get" className="flex gap-2 border-b border-navy-50 p-3 sm:p-4">
          <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input name="q" defaultValue={q} className="input pl-9" placeholder="Action, utilisateur, élément…" /></div>
          <button className="btn btn-navy">Rechercher</button>
        </form>
        {rows.length === 0 ? <Empty icon={<ScrollText />} title="Aucune entrée" /> : (
          <TableWrap>
            <table className="tbl">
              <thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th className="hidden md:table-cell">Détails</th><th className="hidden lg:table-cell">Adresse IP</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-xs">{dateTimeFr(r.createdAt)}</td>
                    <td className="font-mono text-xs">{r.username ?? '—'}</td>
                    <td><Badge tone={tone(r.action)}>{r.action.replaceAll('_', ' ').toLowerCase()}</Badge></td>
                    <td className="hidden max-w-md truncate text-xs text-slate-500 md:table-cell">{[r.entity, r.entityId].filter(Boolean).join(' #')} {r.details ? JSON.stringify(r.details) : ''}</td>
                    <td className="hidden font-mono text-xs text-slate-500 lg:table-cell">{r.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
        <div className="flex justify-between border-t border-navy-50 p-3 text-sm">
          {page > 1 ? <a className="btn btn-ghost btn-sm" href={`?q=${encodeURIComponent(q)}&page=${page - 1}`}>← Plus récents</a> : <span />}
          {rows.length === 100 && <a className="btn btn-ghost btn-sm" href={`?q=${encodeURIComponent(q)}&page=${page + 1}`}>Plus anciens →</a>}
        </div>
      </Card>
    </div>
  );
}
