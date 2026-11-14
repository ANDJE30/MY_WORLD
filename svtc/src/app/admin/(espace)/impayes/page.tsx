import Link from 'next/link';
import { AlertCircle, MessageCircle, Send, FileDown, Phone } from 'lucide-react';
import { getCurrentYear } from '@/lib/settings';
import { balances, refData } from '@/lib/queries';
import { money, periodLabel, phoneFr, phoneIntl } from '@/lib/format';
import { MESSAGE_TEMPLATES } from '@/lib/constants';
import { Card, Dot, Empty, PageHeader, Stat, TableWrap } from '@/components/ui';
import { ActionForm, AutoSubmitSelect, Modal, SubmitButton } from '@/components/client/forms';
import { sendMessage } from '@/app/actions/messaging';

export const metadata = { title: 'Impayés & relances' };

export default async function ArrearsPage({ searchParams }: { searchParams: Promise<{ classe?: string }> }) {
  const sp = await searchParams;
  const [year, ref] = await Promise.all([getCurrentYear(), refData()]);
  const all = (await balances(year.id)).filter((b) => b.status === 'ACTIF' && b.balance > 0);
  const list = all.filter((b) => !sp.classe || String(b.classId) === sp.classe).sort((a, b) => b.balance - a.balance);
  const total = list.reduce((a, b) => a + b.balance, 0);
  const tpl = MESSAGE_TEMPLATES.find((t) => t.key === 'rappel')!;
  return (
    <div className="space-y-6">
      <PageHeader kicker="Finances" title="Impayés & relances" subtitle="Élèves dont le montant dû à ce jour (inscription + mensualités échues) n'est pas entièrement réglé."
        actions={<>
          <a href={`/api/pdf/impayes${sp.classe ? `?classe=${sp.classe}` : ''}`} target="_blank" className="btn btn-ghost"><FileDown size={17} /> Liste PDF</a>
          {list.length > 0 && (
            <Modal title="Rappel de paiement à tous les parents concernés" trigger={<button className="btn btn-gold"><Send size={17} /> Relancer tous les parents</button>}>
              <ActionForm action={sendMessage} className="space-y-3">
                <input type="hidden" name="audience" value="ARREARS" />
                <input type="hidden" name="category" value="RAPPEL_PAIEMENT" />
                <label className="block"><span className="label">Objet</span><input name="subject" className="input" defaultValue={tpl.subject} required /></label>
                <label className="block"><span className="label">Message (personnalisé pour chaque parent)</span><textarea name="body" className="input" rows={5} defaultValue={tpl.body} required /></label>
                <p className="hint">Variables : {'{parent}'}, {'{eleve}'}, {'{classe}'}, {'{solde}'}, {'{centre}'}, {'{telephone}'}</p>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="sms" className="check" defaultChecked /> Envoyer aussi par SMS</label>
                <SubmitButton>Envoyer le rappel</SubmitButton>
              </ActionForm>
            </Modal>
          )}
        </>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Total des impayés" value={money(total)} tone="red" icon={<AlertCircle size={20} />} />
        <Stat label="Élèves concernés" value={list.length} tone="navy" />
        <Stat label="Impayé moyen" value={money(list.length ? total / list.length : 0)} tone="gold" />
      </div>
      <Card pad={false}>
        <form method="get" className="border-b border-navy-50 p-3 sm:p-4">
          <AutoSubmitSelect name="classe" defaultValue={sp.classe ?? ''} className="input w-auto"><option value="">Toutes les classes</option>{ref.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</AutoSubmitSelect>
        </form>
        {list.length === 0 ? <Empty icon={<AlertCircle />} title="Aucun impayé" text="Tous les élèves sont à jour de leurs paiements." /> : (
          <TableWrap>
            <table className="tbl">
              <thead><tr><th>Élève</th><th className="hidden md:table-cell">Mois non soldés</th><th>Parent</th><th className="text-right">Payé</th><th className="text-right">Reste dû</th><th /></tr></thead>
              <tbody>
                {list.map((b) => {
                  const unpaid = b.alloc.months.filter((m) => m.state !== 'PAYE' && b.dueMonths.includes(m.period));
                  const msg = `Bonjour ${b.parentName ?? ''}, sauf erreur, il reste ${money(b.balance)} à régler pour les répétitions de ${b.firstName} (${b.className}) à la SVTC. Merci.`;
                  return (
                    <tr key={b.id}>
                      <td><Link href={`/admin/eleves/${b.id}`} className="font-medium hover:text-royal-700">{b.lastName} {b.firstName}</Link><p className="flex items-center gap-1.5 text-xs text-slate-500"><Dot color={b.classColor} />{b.className}</p></td>
                      <td className="hidden text-xs first-up text-slate-600 md:table-cell">{b.alloc.registration.paid < b.alloc.registration.due ? 'Inscription, ' : ''}{unpaid.map((m) => periodLabel(m.period)).join(', ')}</td>
                      <td>{b.parentName ? <><p className="text-sm">{b.parentName}</p><p className="text-xs text-slate-500">{phoneFr(b.parentPhone)}</p></> : '—'}</td>
                      <td className="text-right text-sm">{money(b.paid)}</td>
                      <td className="text-right font-semibold text-rose-600">{money(b.balance)}</td>
                      <td>
                        {b.parentPhone && (
                          <div className="flex justify-end gap-0.5">
                            <a href={`tel:${phoneIntl(b.parentPhone)}`} className="btn-icon" title="Appeler"><Phone size={16} /></a>
                            <a href={`https://wa.me/${phoneIntl(b.parentPhone).replace('+', '')}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" className="btn-icon text-emerald-600" title="Relance WhatsApp"><MessageCircle size={16} /></a>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
