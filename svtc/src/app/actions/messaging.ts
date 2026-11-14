'use server';

import { revalidatePath } from 'next/cache';
import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { messages, messageRecipients, parents, students, tutors, classes, assignments } from '@/db/schema';
import { assertRole, type SessionUser } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { formObject, safe, UserError, zs, type ActionResult } from '@/lib/action';
import { getCurrentYear, getSettings } from '@/lib/settings';
import { balances, studentProgress } from '@/lib/queries';
import { sendSmsBatch, smsConfig, whatsappLink } from '@/lib/sms';
import { appreciation } from '@/lib/calc';
import { money, phoneFr, pct, score } from '@/lib/format';
import { MESSAGE_CATEGORIES } from '@/lib/constants';

type Recipient = { userId: string | null; parentId: number | null; tutorId: number | null; name: string; phone: string | null; vars: Record<string, string> };

function fill(tpl: string, vars: Record<string, string>) {
  return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

function joinNames(list: string[]) {
  return list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} et ${list[list.length - 1]}`;
}

async function parentRecipients(filter: { parentIds?: number[]; classIds?: number[]; arrearsOnly?: boolean }): Promise<Recipient[]> {
  const year = await getCurrentYear();
  const s = await getSettings();
  const bal = (await balances(year.id)).filter((b) => b.status === 'ACTIF' && b.parentId);
  const map = new Map<number, typeof bal>();
  for (const b of bal) {
    if (filter.classIds && !filter.classIds.includes(b.classId)) continue;
    if (filter.parentIds && !filter.parentIds.includes(b.parentId!)) continue;
    if (filter.arrearsOnly && b.balance <= 0) continue;
    map.set(b.parentId!, [...(map.get(b.parentId!) ?? []), b]);
  }
  // Parents sans enfant actif ciblés individuellement
  if (filter.parentIds) for (const id of filter.parentIds) if (!map.has(id)) map.set(id, []);
  if (map.size === 0) return [];
  const ps = await db.select().from(parents).where(inArray(parents.id, [...map.keys()]));
  return ps.map((p) => {
    const kids = map.get(p.id) ?? [];
    return {
      userId: p.userId, parentId: p.id, tutorId: null, name: p.fullName, phone: p.whatsapp || p.phone,
      vars: {
        parent: p.fullName,
        eleve: joinNames(kids.map((k) => k.firstName)) || 'votre enfant',
        classe: joinNames([...new Set(kids.map((k) => k.className))]),
        solde: money(kids.reduce((a, k) => a + Math.max(0, k.balance), 0)),
        centre: s.identity.shortName,
        telephone: phoneFr(s.identity.phones[0]),
      },
    };
  });
}

async function deliver(
  me: Pick<SessionUser, 'id' | 'fullName' | 'username'>,
  msg: { subject: string; body: string; category: string; audience: string; studentId?: number | null; attachmentKind?: string | null; attachmentRef?: string | null },
  list: Recipient[],
  sendSms: boolean,
) {
  const s = await getSettings();
  const channels = ['APP', ...(sendSms ? ['SMS'] : [])];
  const [m] = await db.insert(messages).values({ senderId: me.id, senderName: me.fullName, ...msg, channels }).returning({ id: messages.id });
  const bodies = list.map((r) => fill(msg.body, r.vars));
  let results: { status: string; error?: string }[] = [];
  if (sendSms) {
    const sig = s.sms.signature ? `\n${s.sms.signature}` : '';
    results = await sendSmsBatch(list.map((r, i) => ({ phone: r.phone ?? '', body: (bodies[i] + sig).slice(0, 459) })));
  }
  if (list.length) {
    await db.insert(messageRecipients).values(list.map((r, i) => ({
      messageId: m.id, userId: r.userId, parentId: r.parentId, tutorId: r.tutorId, name: r.name, phone: r.phone, body: bodies[i],
      smsStatus: sendSms ? results[i]?.status ?? 'ECHEC' : 'NON_DEMANDE', smsError: results[i]?.error ?? null,
    })));
  }
  const wa = list.map((r, i) => ({ r, i })).filter(({ r }) => r.phone).map(({ r, i }) => ({ name: r.name, phone: r.phone!, link: whatsappLink(r.phone!, bodies[i]) }));
  const sent = results.filter((r) => r.status === 'ENVOYE').length;
  const simulated = results.filter((r) => r.status === 'SIMULE').length;
  const failed = results.filter((r) => r.status === 'ECHEC').length;
  return { id: m.id, count: list.length, sent, simulated, failed, wa, phones: list.map((r) => r.phone).filter(Boolean) as string[], sample: bodies[0] ?? '' };
}

const sendSchema = z.object({
  subject: zs.text('Objet', 120),
  body: zs.text('Message', 1000),
  category: z.enum(Object.keys(MESSAGE_CATEGORIES) as [string, ...string[]]),
  audience: z.enum(['ALL', 'CLASSES', 'PARENTS', 'ARREARS', 'TUTORS']),
});

export async function sendMessage(fd: FormData): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN');
    const d = sendSchema.parse(formObject(fd));
    const sms = fd.get('sms') === 'on';
    let list: Recipient[] = [];
    let audienceLabel = '';
    if (d.audience === 'TUTORS') {
      const s = await getSettings();
      const tts = await db.select().from(tutors).where(eq(tutors.isActive, true));
      list = tts.map((t) => ({ userId: t.userId, parentId: null, tutorId: t.id, name: `${t.firstName} ${t.lastName}`, phone: t.phone, vars: { parent: `${t.firstName} ${t.lastName}`, encadreur: `${t.firstName} ${t.lastName}`, centre: s.identity.shortName, telephone: phoneFr(s.identity.phones[0]), eleve: '', classe: '', solde: '' } }));
      audienceLabel = 'Tous les encadreurs';
    } else if (d.audience === 'CLASSES') {
      const ids = fd.getAll('classIds').map(Number).filter(Boolean);
      if (!ids.length) throw new UserError('Choisissez au moins une classe.');
      list = await parentRecipients({ classIds: ids });
      const cls = await db.select({ name: classes.name }).from(classes).where(inArray(classes.id, ids));
      audienceLabel = `Parents — ${cls.map((c) => c.name).join(', ')}`;
    } else if (d.audience === 'PARENTS') {
      const ids = fd.getAll('parentIds').map(Number).filter(Boolean);
      if (!ids.length) throw new UserError('Choisissez au moins un parent.');
      list = await parentRecipients({ parentIds: ids });
      audienceLabel = list.length === 1 ? `Parent — ${list[0].name}` : `${list.length} parents sélectionnés`;
    } else if (d.audience === 'ARREARS') {
      list = await parentRecipients({ arrearsOnly: true });
      audienceLabel = 'Parents en retard de paiement';
    } else {
      list = await parentRecipients({});
      audienceLabel = 'Tous les parents';
    }
    if (list.length === 0) throw new UserError('Aucun destinataire ne correspond à ce choix.');
    const r = await deliver(me, { subject: d.subject, body: d.body, category: d.category, audience: audienceLabel }, list, sms);
    await audit(me, 'MESSAGE_ENVOYE', { entity: 'message', entityId: r.id, details: { audience: audienceLabel, count: r.count, sms } });
    revalidatePath('/admin/messages');
    const smsInfo = !sms ? '' : smsConfig().configured ? ` — SMS : ${r.sent} envoyé(s), ${r.failed} échec(s)` : ' — SMS en mode simulation (passerelle non configurée)';
    return { ok: true, message: `Message déposé dans l’espace de ${r.count} destinataire(s)${smsInfo}.`, data: r };
  });
}

/** Envoie l'état de suivi (assiduité et performances) d'un élève à son parent. Admin ou encadreur de la classe. */
export async function sendProgressReport(studentId: number): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('ADMIN', 'ENCADREUR');
    const [st] = await db.select({ s: students, className: classes.name }).from(students).innerJoin(classes, eq(classes.id, students.classId)).where(eq(students.id, studentId));
    if (!st) throw new UserError('Élève introuvable.');
    if (me.role === 'ENCADREUR') {
      const [a] = await db.select({ id: assignments.id }).from(assignments).where(and(eq(assignments.tutorId, me.tutorId!), eq(assignments.classId, st.s.classId))).limit(1);
      if (!a) throw new UserError('Cet élève ne fait pas partie de vos classes.');
    }
    if (!st.s.parentId) throw new UserError('Aucun parent n’est rattaché à cet élève.');
    const p = await studentProgress(studentId);
    const s = await getSettings();
    const name = `${st.s.firstName} ${st.s.lastName}`;
    const subjectsLine = p.subjectsAvg.filter((x) => x.average !== null).map((x) => `${x.name} : ${score(x.average)}/20`).join(' ; ');
    const body =
      `Bonjour {parent}, voici l'état de suivi de ${name} (${st.className}) au ${s.identity.shortName}.\n` +
      `• Assiduité : ${pct(p.stats.rate)} (${p.stats.PRESENT + p.stats.RETARD} présence(s), ${p.stats.ABSENT} absence(s), ${p.stats.RETARD} retard(s)).\n` +
      `• Moyenne générale : ${p.average === null ? 'pas encore de note' : `${score(p.average)}/20 — ${appreciation(p.average)}`}.\n` +
      (subjectsLine ? `• Par matière : ${subjectsLine}.\n` : '') +
      `Le bulletin détaillé (PDF) est disponible dans votre espace parent.`;
    const list = await parentRecipients({ parentIds: [st.s.parentId] });
    const r = await deliver(me, { subject: `État de suivi — ${name}`, body, category: 'SUIVI', audience: `Parent de ${name}`, studentId, attachmentKind: 'SUIVI', attachmentRef: String(studentId) }, list, smsConfig().configured);
    await audit(me, 'SUIVI_ENVOYE', { entity: 'eleve', entityId: studentId });
    revalidatePath('/admin/messages');
    return { ok: true, message: `État de suivi envoyé à ${list[0]?.name ?? 'au parent'}.`, data: r };
  });
}

export async function markRead(recipientId: number): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('PARENT', 'ENCADREUR');
    await db.update(messageRecipients).set({ readAt: new Date() }).where(and(eq(messageRecipients.id, recipientId), eq(messageRecipients.userId, me.id), sql`${messageRecipients.readAt} is null`));
    revalidatePath(me.role === 'PARENT' ? '/parent' : '/encadreur');
    return { ok: true };
  });
}

export async function markAllRead(): Promise<ActionResult> {
  return safe(async () => {
    const me = await assertRole('PARENT', 'ENCADREUR');
    await db.update(messageRecipients).set({ readAt: new Date() }).where(and(eq(messageRecipients.userId, me.id), sql`${messageRecipients.readAt} is null`, isNotNull(messageRecipients.userId)));
    revalidatePath(me.role === 'PARENT' ? '/parent/messages' : '/encadreur/messages');
    return { ok: true, message: 'Tous les messages sont marqués comme lus.' };
  });
}

/** Envoie l'état de suivi de chaque élève d'une classe à son parent. */
export async function sendClassReports(classId: number): Promise<ActionResult> {
  return safe(async () => {
    await assertRole('ADMIN');
    const year = await getCurrentYear();
    const list = await db.select({ id: students.id }).from(students).where(and(eq(students.classId, classId), eq(students.academicYearId, year.id), eq(students.status, 'ACTIF'), isNotNull(students.parentId)));
    let n = 0;
    for (const s of list) {
      const r = await sendProgressReport(s.id);
      if (r.ok) n++;
    }
    if (n === 0) throw new UserError('Aucun élève de cette classe n’a de parent rattaché.');
    return { ok: true, message: `${n} état(s) de suivi envoyé(s) aux parents.` };
  });
}
