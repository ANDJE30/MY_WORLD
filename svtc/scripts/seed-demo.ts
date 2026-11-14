/**
 * Jeu de démonstration réaliste (encadreurs, élèves, parents, planning, séances, présences, notes, paiements…).
 * Usage : DATABASE_URL=… npx tsx --conditions=react-server scripts/seed-demo.ts [--reset]
 * Identifiants de démonstration : voir README (mot de passe commun « Demo@2026 »).
 */
import { sql, eq } from 'drizzle-orm';
import { db } from '@/db';
import * as t from '@/db/schema';
import { ensureBootstrap } from '@/lib/bootstrap';
import { hashPassword } from '@/lib/passwords';
import { generatePlanning } from '@/lib/calc';
import { addDays, datesBetween, dayOfWeek, localToDate, todayISO, toMinutes, fromMinutes } from '@/lib/time';
import { DEFAULT_SETTINGS } from '@/lib/settings-types';

let seed = 20261114;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

const LAST = ['MBALLA', 'NGONO', 'ATANGANA', 'FOUDA', 'ESSOMBA', 'NJOYA', 'TCHOUPO', 'KAMGA', 'NANA', 'BELLA', 'OWONA', 'ABENA', 'MVONDO', 'ETOGA', 'NKOULOU', 'EBOLO', 'TALLA', 'FOTSO', 'DJOUMESSI', 'MANGA', 'BIYIK', 'ONANA', 'NDZANA', 'AYISSI', 'MESSI', 'EKANI', 'ZE', 'ONDOA', 'TSAFACK', 'KENFACK'];
const FIRST_M = ['Jean Paul', 'Arnaud', 'Brice', 'Cédric', 'Junior', 'Loïc', 'Steve', 'Yannick', 'Franck', 'Kevin', 'Hervé', 'Boris', 'Ulrich', 'Raoul', 'Christian'];
const FIRST_F = ['Marie', 'Grâce', 'Sandrine', 'Laure', 'Carine', 'Michelle', 'Prisca', 'Diane', 'Estelle', 'Murielle', 'Vanessa', 'Ornella', 'Linda', 'Christelle', 'Nadège'];
const SCHOOLS = ['Lycée Technique de Nkolbisson', 'Lycée Bilingue de Biyem-Assi', 'Collège de la Retraite', 'Lycée de Mendong', 'Collège Vogt', 'Lycée Général Leclerc', 'CES de Biyem-Assi', 'Lycée Technique Charles Atangana'];

const TUTORS = [
  { firstName: 'Paul', lastName: 'NDJOCK', gender: 'M', phone: '677112233', specialty: 'Génie logiciel', diploma: 'Master Informatique (Université de Yaoundé I)', baseSalary: 60000, hourlyRate: 2500, color: '#7c3aed', username: 'paul.ndjock' },
  { firstName: 'Aline', lastName: 'MEKONGO', gender: 'F', phone: '699445566', specialty: 'Réseaux et sécurité', diploma: 'Ingénieur des travaux informatiques (ENSPY)', baseSalary: 55000, hourlyRate: 2500, color: '#dc2626', username: 'aline.mekongo' },
  { firstName: 'Serge', lastName: 'TCHAMBA', gender: 'M', phone: '655778899', specialty: "Systèmes d'information", diploma: 'Licence professionnelle SI', baseSalary: 50000, hourlyRate: 2000, color: '#059669', username: 'serge.tchamba' },
  { firstName: 'Clarisse', lastName: 'NGUEMA', gender: 'F', phone: '691223344', specialty: 'Informatique générale', diploma: 'DIPES II Informatique (ENS Yaoundé)', baseSalary: 45000, hourlyRate: 2000, color: '#2453d6', username: 'clarisse.nguema' },
  { firstName: 'Hervé', lastName: 'KAMDEM', gender: 'M', phone: '678990011', specialty: 'Maintenance et création numérique', diploma: 'BTS Maintenance des systèmes informatiques', baseSalary: 45000, hourlyRate: 2000, color: '#d97706', username: 'herve.kamdem' },
  { firstName: 'Rodrigue', lastName: 'ESSAMA', gender: 'M', phone: '650334455', specialty: 'Programmation web et mobile', diploma: 'Master Génie logiciel', baseSalary: 55000, hourlyRate: 2500, color: '#0891b2', username: 'rodrigue.essama' },
];

// Classe → [matière, encadreur, créneaux/semaine]
const PLAN: Record<string, [string, number, number][]> = {
  '6E': [['INFO', 3, 1]], '5E': [['INFO', 3, 1]], '4E': [['INFO', 3, 1]], '3E': [['INFO', 3, 1], ['ALGO', 0, 1]],
  '2NDE': [['INFO', 3, 1]], '1ERE': [['ALGO', 0, 1]], 'TLE': [['ALGO', 0, 1], ['SI', 2, 1]],
  PTI: [['PROG', 5, 1], ['MRCN', 4, 1], ['RISI', 1, 1]], TTI: [['PROG', 5, 1], ['SI', 2, 1], ['RISI', 1, 1]],
};
const COUNTS: Record<string, number> = { '6E': 5, '5E': 5, '4E': 6, '3E': 8, '2NDE': 7, '1ERE': 6, TLE: 8, PTI: 9, TTI: 10 };

async function main() {
  if (process.argv.includes('--reset')) {
    await db.execute(sql`truncate ${t.messageRecipients}, ${t.messages}, ${t.grades}, ${t.evaluations}, ${t.attendances}, ${t.documents}, ${t.seances}, ${t.timeslots}, ${t.assignments}, ${t.payments}, ${t.salarySlips}, ${t.rentSettlements}, ${t.expenses}, ${t.students}, ${t.parents}, ${t.tutors}, ${t.verifications}, ${t.auditLogs}, ${t.authSessions}, ${t.rateLimits}, ${t.classes}, ${t.subjects}, ${t.rooms}, ${t.settings} restart identity cascade`);
    await db.delete(t.users).where(sql`${t.users.role} <> 'ADMIN'`);
    await db.delete(t.files);
  }
  await ensureBootstrap();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(t.students);
  if (Number(n) > 0) {
    console.log('Des élèves existent déjà : relancez avec --reset pour recréer la démonstration.');
    process.exit(0);
  }
  const [year] = await db.select().from(t.academicYears).where(eq(t.academicYears.isCurrent, true));
  const settings = {
    ...DEFAULT_SETTINGS,
    sessions: { days: DEFAULT_SETTINGS.sessions.days.map((d) => (d.day === 0 ? { ...d, slots: [{ start: '10:00', end: '11:20' }, { start: '11:20', end: '12:40' }, { start: '12:40', end: '14:00' }] } : d)) },
  };
  await db.insert(t.settings).values({ id: 1, data: { ...settings, identity: { ...settings.identity, directorName: 'M. NDJOCK Paul', email: 'contact@svtc.cm' } } }).onConflictDoUpdate({ target: t.settings.id, set: { data: { ...settings, identity: { ...settings.identity, directorName: 'M. NDJOCK Paul', email: 'contact@svtc.cm' } } } });
  const pw = await hashPassword('Demo@2026');
  const classes = await db.select().from(t.classes);
  const subjects = await db.select().from(t.subjects);
  const rooms = await db.select().from(t.rooms);
  const code = (c: string) => classes.find((x) => x.code === c)!;
  const subj = (c: string) => subjects.find((x) => x.code === c)!;

  // Encadreurs + comptes
  const tutorIds: number[] = [];
  for (const tu of TUTORS) {
    const [u] = await db.insert(t.users).values({ role: 'ENCADREUR', username: tu.username, passwordHash: pw, fullName: `${tu.firstName} ${tu.lastName}`, phone: tu.phone }).returning();
    const { username: _u, ...rest } = tu;
    void _u;
    const [row] = await db.insert(t.tutors).values({ ...rest, userId: u.id, hireDate: '2025-10-01' }).returning();
    tutorIds.push(row.id);
  }

  // Attributions
  const asg: { classId: number; subjectId: number; tutorId: number; count: number }[] = [];
  for (const [c, list] of Object.entries(PLAN)) for (const [s, ti, k] of list) asg.push({ classId: code(c).id, subjectId: subj(s).id, tutorId: tutorIds[ti], count: k });
  await db.insert(t.assignments).values(asg.map((a) => ({ academicYearId: year.id, classId: a.classId, subjectId: a.subjectId, tutorId: a.tutorId, sessionsPerWeek: a.count })));

  // Planning automatique
  const slots = settings.sessions.days.flatMap((d) => d.slots.map((x) => ({ day: d.day, start: x.start, end: x.end })));
  const extraRoom = rooms.length < 3 ? (await db.insert(t.rooms).values({ name: 'Salle C', capacity: 25, rates: { '3': 500, '0': 1000 }, notes: 'Salle informatique (20 postes)' }).returning())[0] : null;
  const roomIds = [...rooms.map((r) => r.id), ...(extraRoom ? [extraRoom.id] : [])];
  const { placements, unplaced } = generatePlanning(slots, roomIds, asg);
  if (unplaced.length) console.log('Non placés :', unplaced.length);
  const ts = await db.insert(t.timeslots).values(placements.map((p) => ({ academicYearId: year.id, dayOfWeek: p.day, startTime: p.start, endTime: p.end, classId: p.classId, subjectId: p.subjectId, tutorId: p.tutorId, roomId: p.roomId }))).returning();

  // Parents et élèves
  const studentRows: { id: number; classId: number }[] = [];
  let mat = 1;
  let phoneN = 0;
  for (const c of classes) {
    for (let i = 0; i < (COUNTS[c.code] ?? 5); i++) {
      const last = pick(LAST);
      const g = rnd() < 0.5 ? 'M' : 'F';
      const first = g === 'M' ? pick(FIRST_M) : pick(FIRST_F);
      // Fratries : 1 parent sur 6 a déjà un enfant inscrit
      let parentId: number;
      const existing = rnd() < 0.16 ? (await db.select().from(t.parents).where(sql`${t.parents.fullName} like ${'%' + last + '%'}`).limit(1))[0] : undefined;
      if (existing) parentId = existing.id;
      else {
        const phone = `6${pick(['5', '7', '9'])}${String(1000000 + phoneN++ * 7919).slice(-7)}`;
        const isMother = rnd() < 0.55;
        const name = `${isMother ? 'Mme' : 'M.'} ${last} ${isMother ? pick(FIRST_F) : pick(FIRST_M)}`;
        const [u] = await db.insert(t.users).values({ role: 'PARENT', username: phone, passwordHash: pw, fullName: name, phone }).returning();
        const [p] = await db.insert(t.parents).values({ fullName: name, phone, relation: isMother ? 'Mère' : 'Père', userId: u.id, profession: pick(['Enseignant(e)', 'Commerçant(e)', 'Fonctionnaire', 'Infirmier(ère)', 'Ingénieur', 'Comptable']) }).returning();
        parentId = p.id;
      }
      const birthYear = 2026 - (11 + Math.min(8, classes.indexOf(c)));
      const [s] = await db.insert(t.students).values({
        matricule: `SVTC-26-${String(mat++).padStart(4, '0')}`, firstName: first, lastName: last, gender: g, birthDate: `${birthYear}-${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rnd() * 27)).padStart(2, '0')}`,
        school: pick(SCHOOLS), classId: c.id, academicYearId: year.id, parentId, enrolledAt: rnd() < 0.8 ? '2026-10-01' : '2026-10-15', discountPct: rnd() < 0.08 ? 20 : 0,
      }).returning();
      studentRows.push({ id: s.id, classId: c.id });
    }
  }
  // Parent de démonstration avec identifiant facile
  const [demoParent] = await db.select().from(t.parents).limit(1);
  const [demoKid] = await db.select().from(t.students).where(eq(t.students.parentId, demoParent.id)).limit(1);
  const demoName = `Mme ${demoKid?.lastName ?? 'MBALLA'} Christine`;
  await db.update(t.users).set({ username: '690000001', fullName: demoName, phone: '690000001' }).where(eq(t.users.id, demoParent.userId!));
  await db.update(t.parents).set({ phone: '690000001', fullName: demoName, relation: 'Mère' }).where(eq(t.parents.id, demoParent.id));

  // Séances du 1er octobre à la fin novembre
  const today = todayISO();
  const end = '2026-11-30';
  const dates = datesBetween('2026-10-01', end, settings.sessions.days.map((d) => d.day));
  const seanceRows = dates.flatMap((date) => ts.filter((x) => x.dayOfWeek === dayOfWeek(date)).map((x) => ({
    academicYearId: year.id, timeslotId: x.id, date, dayOfWeek: x.dayOfWeek, startTime: x.startTime, endTime: x.endTime, classId: x.classId, subjectId: x.subjectId, tutorId: x.tutorId, roomId: x.roomId,
  })));
  const created = await db.insert(t.seances).values(seanceRows).returning();
  const admin = (await db.select().from(t.users).where(eq(t.users.role, 'ADMIN')))[0];
  for (const se of created) {
    if (se.date > today) continue;
    if (se.date === today) continue;
    if (se.date === '2026-11-01' || rnd() < 0.03) {
      await db.update(t.seances).set({ status: 'ANNULEE', cancelReason: se.date === '2026-11-01' ? 'Fête de la Toussaint' : 'Encadreur indisponible (reportée)' }).where(eq(t.seances.id, se.id));
      continue;
    }
    if (rnd() < 0.04 && se.date >= addDays(today, -10)) continue; // quelques séances non pointées
    const late = Math.floor(rnd() * 12) - 3;
    const early = Math.floor(rnd() * 8);
    const st = localToDate(se.date, fromMinutes(toMinutes(se.startTime) + Math.max(0, late)));
    const en = localToDate(se.date, fromMinutes(toMinutes(se.endTime) - early));
    const validated = se.date < addDays(today, -7);
    const sub = subjects.find((x) => x.id === se.subjectId)!;
    await db.update(t.seances).set({
      status: 'TERMINEE', actualStart: st, actualEnd: en, validated, validatedBy: validated ? admin?.id : null, validatedAt: validated ? new Date() : null,
      topic: pick({ INFO: ['Le système d’exploitation', 'Le traitement de texte', 'Le tableur : formules', 'Internet et messagerie', 'Les périphériques'], ALGO: ['Structures conditionnelles', 'Boucles POUR et TANTQUE', 'Tableaux', 'Fonctions et procédures', 'Algorithmes de tri'], PROG: ['Variables et types en Python', 'HTML et CSS', 'PHP et formulaires', 'Programmation en C : pointeurs', 'Bases de données et SQL'], SI: ['Modèle conceptuel des données', 'MLD et normalisation', 'Requêtes SQL', 'Diagramme de flux', 'Merise : dictionnaire de données'], MRCN: ['Montage d’un ordinateur', 'Maintenance préventive', 'Infographie avec GIMP', 'Installation de Windows'], RISI: ['Adressage IPv4', 'Topologies réseau', 'Sécurité : mots de passe et virus', 'Le modèle OSI', 'Câblage RJ45'] }[sub.code] ?? ['Révisions']),
      summary: 'Rappel du cours, exercices d’application et correction collective.', homework: rnd() < 0.6 ? 'Terminer les exercices de la fiche de TD.' : null,
    }).where(eq(t.seances.id, se.id));
    const kids = studentRows.filter((k) => k.classId === se.classId);
    await db.insert(t.attendances).values(kids.map((k) => {
      const r = rnd();
      return { seanceId: se.id, studentId: k.id, status: (r < 0.84 ? 'PRESENT' : r < 0.91 ? 'RETARD' : r < 0.97 ? 'ABSENT' : 'EXCUSE') as t.AttendanceStatus };
    }));
  }

  // Évaluations & notes (une par mois et par attribution)
  for (const a of asg) {
    for (const [d, title, type] of [['2026-10-18', 'TD n°1', 'TD'], ['2026-11-08', 'Interrogation n°1', 'INTERROGATION']] as const) {
      const [ev] = await db.insert(t.evaluations).values({ academicYearId: year.id, classId: a.classId, subjectId: a.subjectId, tutorId: a.tutorId, title: `${title} — ${subjects.find((x) => x.id === a.subjectId)!.name}`, type, date: d, maxScore: 20 }).returning();
      const kids = studentRows.filter((k) => k.classId === a.classId);
      await db.insert(t.grades).values(kids.map((k) => {
        const base = 8 + ((k.id * 7) % 9) + rnd() * 4;
        const absent = rnd() < 0.04;
        return { evaluationId: ev.id, studentId: k.id, score: absent ? null : Math.min(20, Math.round(base * 4) / 4), absent };
      }));
    }
  }

  // Paiements
  let rec = 1;
  const allStudents = await db.select({ s: t.students, c: t.classes }).from(t.students).innerJoin(t.classes, eq(t.classes.id, t.students.classId));
  for (const { s, c } of allStudents) {
    const monthly = Math.round((c.monthlyFee * (100 - s.discountPct)) / 100);
    const profile = rnd();
    const plan: [string, number, string][] = [['2026-10-02', c.registrationFee + monthly, 'INSCRIPTION']];
    if (profile > 0.2) plan.push(['2026-11-05', monthly, 'MENSUALITE']);
    if (profile > 0.85) plan.push(['2026-11-12', monthly, 'MENSUALITE']);
    if (profile < 0.08) plan[0][1] = c.registrationFee;
    for (const [d, amount, type] of plan) {
      const method = pick(['ESPECES', 'ESPECES', 'MTN_MOMO', 'ORANGE_MONEY']);
      await db.insert(t.payments).values({
        receiptNo: `SVTC-R2627-${String(rec++).padStart(5, '0')}`, academicYearId: year.id, studentId: s.id, amount, type, method, reference: method === 'ESPECES' ? null : `MP${d.replaceAll('-', '')}.${1000 + rec}`,
        paidAt: localToDate(d, `${9 + Math.floor(rnd() * 8)}:${String(Math.floor(rnd() * 60)).padStart(2, '0')}`), receivedBy: admin?.id,
      });
    }
  }

  // Dépenses d'octobre (location et salaires réglés), fournitures
  await db.insert(t.expenses).values([
    { academicYearId: year.id, date: '2026-10-03', category: 'FOURNITURES', label: 'Rames de papier et impression des fiches de TD', amount: 15000, method: 'ESPECES' },
    { academicYearId: year.id, date: '2026-10-10', category: 'COMMUNICATION', label: 'Forfait internet (clé 4G) — octobre', amount: 10000, method: 'ORANGE_MONEY' },
    { academicYearId: year.id, date: '2026-11-04', category: 'ENTRETIEN', label: 'Rallonges électriques et multiprises', amount: 8500, method: 'ESPECES' },
  ]);

  // Messages
  const parentsAll = await db.select().from(t.parents);
  const [m] = await db.insert(t.messages).values({ senderId: admin?.id, senderName: admin?.fullName ?? 'Administration', subject: 'Bienvenue à la SVTC', body: 'Bonjour {parent}, toute l’équipe de la Silicon Valley Training Center vous souhaite une excellente année scolaire. Le planning des séances est disponible dans votre espace.', category: 'INFO', channels: ['APP'], audience: 'Tous les parents' }).returning();
  await db.insert(t.messageRecipients).values(parentsAll.map((p) => ({ messageId: m.id, userId: p.userId, parentId: p.id, name: p.fullName, phone: p.phone, body: `Bonjour ${p.fullName}, toute l’équipe de la Silicon Valley Training Center vous souhaite une excellente année scolaire. Le planning des séances est disponible dans votre espace.`, readAt: rnd() < 0.5 ? new Date() : null })));

  // Document PDF de démonstration
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj 4 0 obj<</Length 120>>stream\nBT /F1 22 Tf 60 760 Td (Fiche de TD - Structures conditionnelles) Tj 0 -40 Td /F1 14 Tf (Exercice 1 : ecrire un algorithme ...) Tj ET\nendstream endobj 5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
  const [f] = await db.insert(t.files).values({ name: 'fiche-td-conditions.pdf', mime: 'application/pdf', size: pdf.length, sha256: 'demo', data: pdf }).returning();
  await db.insert(t.documents).values({ academicYearId: year.id, title: 'Fiche de TD n°2 — Structures conditionnelles', description: 'Exercices progressifs avec corrigé en séance.', type: 'FICHE_TD', classId: code('TLE').id, subjectId: subj('ALGO').id, tutorId: tutorIds[0], fileId: f.id, status: 'SOUMIS' });
  const [f2] = await db.insert(t.files).values({ name: 'td-adressage-ip.pdf', mime: 'application/pdf', size: pdf.length, sha256: 'demo2', data: pdf }).returning();
  await db.insert(t.documents).values({ academicYearId: year.id, title: 'TD — Adressage IPv4 et sous-réseaux', type: 'FICHE_TD', classId: code('TTI').id, subjectId: subj('RISI').id, tutorId: tutorIds[1], fileId: f2.id, status: 'APPROUVE', visibleToParents: true, reviewedBy: admin?.id, reviewedAt: new Date() });

  console.log(`Démonstration prête : ${tutorIds.length} encadreurs, ${studentRows.length} élèves, ${parentsAll.length} parents, ${created.length} séances.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
