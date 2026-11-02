// Modèles Word (.docx) des documents périodiques : en-tête officiel, données de l'établissement déjà renseignées,
// rubriques « [À compléter] » à rédiger. Le fichier s'ouvre et se modifie dans Word ou LibreOffice.
import { db, getSettings, titres, applyTerms, seqLabel } from './db.js';
import { buildDocx, p, r, table } from './docx.js';
import { image } from './docx.js';
import { MODELES, norm } from './chrono.js';
import { computeStats } from './routes/admin.js';
import { attendanceRange, attendanceSummary, schoolDays, longDate } from './staff.js';
import { enDelegations } from './pdf.js';

const GREY = '6B6B6B';
const TODO = (t) => p([r(`[À compléter : ${t}]`, { i: true, color: GREY })], { after: 8 });
/** Capitales en gardant les ordinaux en minuscules (« 1er TRIMESTRE », « 2e SÉQUENCE »). */
const MAJ = (t) => String(t).toUpperCase().replace(/(\d)(ER|RE|E)(?![A-ZÀ-Ý])/g, (_m, d, x) => d + x.toLowerCase());
const H1 = (t) => p([r(MAJ(t), { b: true, size: 12 })], { before: 10, after: 6, keepNext: true, border: true });
const H2 = (t) => p([r(t, { b: true, size: 11.5 })], { before: 8, after: 4, keepNext: true });
const fmt = (v, d = 2) => (v == null ? '—' : typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toFixed(d).replace('.', ',')) : String(v));
const pct = (v) => (v == null ? '—' : `${fmt(v, 1)} %`);
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** En-tête officiel bilingue (tableau sans bordure : français | logo | anglais). */
function officialHeader(s, images) {
  const sep = p([r('-----------', { size: 7 })], { align: 'center', after: 0 });
  const L = (t, o = {}) => (t ? p([r(t, { size: 9, ...o })], { align: 'center', after: 0 }) : '');
  const en = enDelegations(s);
  const fr = [L('RÉPUBLIQUE DU CAMEROUN', { b: true, size: 10 }), L('Paix – Travail – Patrie', { i: true }), sep, L(String(s.ministere || '').toUpperCase()), sep,
    s.delegation_regionale ? L(`DÉLÉGATION RÉGIONALE ${s.delegation_regionale}`.toUpperCase()) : '', s.delegation_regionale ? sep : '',
    s.delegation_departementale ? L(`DÉLÉGATION DÉPARTEMENTALE ${s.delegation_departementale}`.toUpperCase()) : '', s.delegation_departementale ? sep : '',
    L(String(s.nom || '').toUpperCase(), { b: true }), L([s.bp ? `BP ${s.bp}` : '', s.tel ? `Tél. ${s.tel}` : ''].filter(Boolean).join(' – '), { size: 8 })].filter(Boolean);
  const eng = [L('REPUBLIC OF CAMEROON', { b: true, size: 10 }), L('Peace – Work – Fatherland', { i: true }), sep, L(String(s.ministere_en || '').toUpperCase()), sep,
    en.reg ? L(en.reg) : '', en.reg ? sep : '', en.dep ? L(en.dep) : '', en.dep ? sep : '',
    L(String(s.nom_en || s.nom_court || '').toUpperCase(), { b: true }), L([s.bp ? `P.O. Box ${s.bp}` : '', s.tel ? `Phone ${s.tel}` : ''].filter(Boolean).join(' – '), { size: 8 })].filter(Boolean);
  let center;
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(s.logo || '');
  if (m) { images.push({ rid: 'rIdLogo', ext: m[1] === 'png' ? 'png' : 'jpeg', data: Buffer.from(m[2], 'base64') }); center = [`<w:p><w:pPr><w:jc w:val="center"/></w:pPr>${image('rIdLogo', 2.4, 2.4)}</w:p>`]; }
  else center = [p([r(String(s.nom_court || 'SX').toUpperCase(), { b: true, size: 18, color: '0B5D4B' })], { align: 'center', before: 18, after: 0 })];
  if (s.devise) center.push(p([r(s.devise, { i: true, size: 7.5, color: GREY })], { align: 'center', after: 0 }));
  return table([[{ content: fr, valign: 'top' }, { content: center }, { content: eng, valign: 'top' }]], { widths: [7.3, 3.4, 7.3], header: false, borders: false });
}

/** Choix de la période des données d'après l'intitulé et la date limite. */
function periodFor(e, s) {
  const t = norm(e.titre);
  const m = /(sequence|situation)\s*(\d)/.exec(t); if (m) return `S${m[2]}`;
  const tm = /(1er|1re|premier|2e|deuxieme|second|3e|troisieme)\s+trimestre/.exec(t);
  if (tm) return `T${/^(1|premier)/.test(tm[1]) ? 1 : /^(2|deuxieme|second)/.test(tm[1]) ? 2 : 3}`;
  if (e.modele === 'rapport_annuel') return 'A';
  const due = e.date_limite || new Date().toISOString().slice(0, 10);
  const ps = db.prepare('SELECT seq, start_date, end_date FROM periods ORDER BY seq').all();
  const done = ps.filter((x) => x.end_date && x.end_date <= due).pop() || ps.filter((x) => x.start_date && x.start_date <= due).pop() || ps[0];
  if (['rapport_trimestriel', 'pv_conseils', 'discipline', 'couverture'].includes(e.modele)) return `T${Math.ceil(done.seq / 2)}`;
  return `S${done.seq}`;
}
const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
function monthFor(e) {
  const m = new RegExp(`(${MOIS.join('|')})\\s+(\\d{4})`).exec(norm(e.titre));
  return m ? `M${m[2]}-${String(MOIS.indexOf(m[1]) + 1).padStart(2, '0')}` : null;
}

/* ---------- Rubriques réutilisables ---------- */
function effectifsTable() {
  const rows = db.prepare(`SELECT c.name, c.level, SUM(s.sexe = 'M') g, SUM(s.sexe = 'F') f, COUNT(s.id) n, SUM(s.redoublant) red FROM classes c
    LEFT JOIN students s ON s.class_id = c.id AND s.active = 1 GROUP BY c.id ORDER BY c.name`).all();
  const tot = rows.reduce((a, x) => ({ g: a.g + (x.g || 0), f: a.f + (x.f || 0), n: a.n + x.n, red: a.red + (x.red || 0) }), { g: 0, f: 0, n: 0, red: 0 });
  const c = (v) => ({ content: String(v ?? 0), align: 'center' });
  return table([['Classe', 'Niveau', 'Garçons', 'Filles', 'Total', 'Redoublants'], ...rows.map((x) => [x.name, x.level || '', c(x.g), c(x.f), c(x.n), c(x.red)]),
    [{ content: 'TOTAL', b: true, shade: 'F3F1EA' }, { content: '', shade: 'F3F1EA' }, ...[tot.g, tot.f, tot.n, tot.red].map((v) => ({ content: String(v), align: 'center', b: true, shade: 'F3F1EA' }))]],
  { widths: [3.4, 3.4, 2.6, 2.6, 2.6, 3] });
}
function resultatsTables(st) {
  const c = (v) => ({ content: v, align: 'center' });
  return [table([['Classe', 'Effectif', 'Classés', 'Moyenne', 'Plus forte', 'Plus faible', 'Admis', 'Réussite'],
    ...st.classes.map((x) => [x.classe, c(fmt(x.effectif)), c(fmt(x.classes)), c(fmt(x.moyenne)), c(fmt(x.max)), c(fmt(x.min)), c(fmt(x.admis)), c(pct(x.reussite))]),
    [{ content: 'TOTAL', b: true, shade: 'F3F1EA' }, ...[fmt(st.global.effectif), fmt(st.global.n), fmt(st.global.moyenne), '', '', fmt(st.global.admis), pct(st.global.reussite)].map((v) => ({ content: v, align: 'center', b: true, shade: 'F3F1EA' }))]],
  { widths: [3, 1.9, 1.9, 2, 2, 2, 1.9, 2.3], fontSize: 9.5 }),
  p([r(`Garçons : ${st.global.garcons.n} classés, taux de réussite ${pct(st.global.garcons.reussite)}. Filles : ${st.global.filles.n} classées, taux de réussite ${pct(st.global.filles.reussite)}.`, { size: 10.5 })], { before: 4 })];
}
function couvertureTable() {
  const rows = db.prepare(`SELECT c.name classe, s.name subject, u.full_name teacher, COALESCE(SUM(p.planned),0) planned, COALESCE(SUM(p.done),0) done, COALESCE(SUM(p.digital),0) digital
    FROM class_subjects cs JOIN classes c ON c.id = cs.class_id JOIN subjects s ON s.id = cs.subject_id LEFT JOIN users u ON u.id = cs.teacher_id
    LEFT JOIN progressions p ON p.class_subject_id = cs.id GROUP BY cs.id ORDER BY c.name, s.name`).all();
  const c = (v) => ({ content: v, align: 'center' });
  return table([['Classe', 'Discipline', 'Enseignant', 'Prévues', 'Faites', 'Couverture', 'Digitalisées', 'Digitalisation'],
    ...rows.map((x) => [x.classe, x.subject, x.teacher || '—', c(String(x.planned)), c(String(x.done)), c(x.planned ? pct((x.done / x.planned) * 100) : '—'), c(String(x.digital)), c(x.planned ? pct((x.digital / x.planned) * 100) : '—')])],
  { widths: [1.7, 3.3, 3.6, 1.6, 1.5, 2, 1.9, 2.2], fontSize: 9 });
}
function assiduiteTable(rangeQ) {
  const range = attendanceRange(rangeQ); const days = schoolDays(range.from, range.to);
  const rows = db.prepare("SELECT id, full_name, grade FROM users WHERE role = 'teacher' AND active = 1 ORDER BY full_name COLLATE NOCASE").all().map((u) => ({ ...u, ...attendanceSummary(u.id, range, days) }));
  const c = (v) => ({ content: v, align: 'center' });
  return { range, xml: table([['Enseignant', 'Grade', 'Heures dues', 'Effectuées', 'Abs. justifiées', 'Abs. non justifiées', 'Retards', 'Taux'],
    ...rows.map((x) => [x.full_name, x.grade || '', c(fmt(x.dues, 1)), c(fmt(x.faites, 1)), c(fmt(x.abs_j, 1)), c(fmt(x.abs_nj, 1)), c(String(x.retards)), c(pct(x.taux))])],
  { widths: [4.6, 1.6, 1.8, 1.9, 2, 2.2, 1.6, 2], fontSize: 9 }) };
}
function disciplineTable(st) {
  const c = (v) => ({ content: String(v ?? 0), align: 'center' });
  return table([['Classe', 'Abs. justifiées (h)', 'Abs. non justifiées (h)', 'Retards', 'Avertissements', 'Blâmes', 'Incidents'],
    ...st.discipline.map((x) => [x.classe, c(x.abs_j), c(x.abs_nj), c(x.retards), c(x.avertissements), c(x.blames), c(x.incidents)])],
  { widths: [3, 2.6, 2.8, 2, 2.6, 2, 2], fontSize: 9.5 });
}
function personnelTable() {
  const rows = db.prepare(`SELECT COALESCE(grade, 'Non renseigné') g, COUNT(*) n, SUM(sexe = 'F') f FROM users WHERE role = 'teacher' AND active = 1 GROUP BY g ORDER BY n DESC`).all();
  const resp = db.prepare("SELECT COUNT(*) n FROM users WHERE role = 'discipline' AND active = 1").get().n;
  const c = (v) => ({ content: String(v ?? 0), align: 'center' });
  return table([['Catégorie', 'Effectif', 'dont femmes'], ...rows.map((x) => [`Enseignants — ${x.g}`, c(x.n), c(x.f)]), ['Personnel de la vie scolaire', c(resp), c('—')]], { widths: [9, 4, 4] });
}
function candidatsTables() {
  const classes = db.prepare('SELECT id, name, level FROM classes ORDER BY name').all().filter((c) => /^(3e|3eme|terminale|tle|1ere|1re|premiere|form 5|upper|4e annee)/i.test(norm(`${c.level || ''} ${c.name}`).trim()) || /\b(3e|tle|1ere|terminale)\b/i.test(norm(c.name)));
  if (!classes.length) return [TODO('aucune classe d’examen trouvée : complétez la liste des candidats')];
  const out = [];
  for (const cl of classes) {
    const st = db.prepare('SELECT matricule, nom, prenom, sexe, date_naissance, lieu_naissance FROM students WHERE class_id = ? AND active = 1 ORDER BY nom COLLATE NOCASE, prenom COLLATE NOCASE').all(cl.id);
    out.push(H2(`Classe de ${cl.name} — ${st.length} candidat(s)`));
    out.push(table([['N°', 'Matricule', 'Nom et prénoms', 'Sexe', 'Date et lieu de naissance'],
      ...st.map((x, i) => [{ content: String(i + 1), align: 'center' }, x.matricule, `${x.nom} ${x.prenom}`.trim(), { content: x.sexe || '', align: 'center' },
        [x.date_naissance ? x.date_naissance.split('-').reverse().join('/') : '', x.lieu_naissance ? `à ${x.lieu_naissance}` : ''].filter(Boolean).join(' ')])],
    { widths: [1.1, 3, 6.6, 1.4, 5.9], fontSize: 9.5 }));
  }
  return out;
}

/** Document Word d'une échéance (ou d'un modèle seul) : Buffer .docx. */
export function buildModele(e) {
  const s = getSettings(); const t = titres(s); const images = [];
  const modele = MODELES[e.modele] ? e.modele : 'generique';
  const titre = e.titre || MODELES[modele];
  const mil = `${String(s.annee_scolaire).slice(2, 4)}-${String(s.annee_scolaire).slice(7, 9)}`;
  const body = [officialHeader(s, images), p('', { after: 4 }),
    table([[{ content: [p([r(`N° _____/${mil}/${s.ref_documents || `MINESEC/${s.nom_court || 'ETAB'}`}`, { b: true, size: 9.5 })], { after: 0 })] },
      { content: [p([r('Fait à ', { i: true, size: 11 }), r(String(s.ville || '………').toUpperCase(), { b: true, size: 11 }), r(', le ', { i: true, size: 11 }), r('……………………', { size: 11 })], { align: 'right', after: 0 })] }]],
    { widths: [10, 8], header: false, borders: false }),
    p([r(MAJ(titre), { b: true, size: 15 })], { align: 'center', before: 14, after: 2 }),
    p([r(`Année scolaire ${s.annee_scolaire}`, { i: true, size: 11 }), e.date_limite ? r(`  —  à déposer au plus tard le ${longDate(e.date_limite)}`, { i: true, size: 11 }) : r('')], { align: 'center', after: 8 })];
  if (e.destinataire) body.push(p([r('Destinataire : ', { b: true }), r(e.destinataire)], { after: 10 }));
  const sec = (() => { let i = 0; return (txt) => H1(`${ROMAN[i++] || ''}. ${txt}`); })();
  const period = periodFor({ ...e, modele }, s);
  const st = ['resultats', 'pv_conseils', 'discipline', 'rapport_trimestriel', 'rapport_annuel'].includes(modele) ? computeStats(period) : null;
  const lbl = st ? applyTerms(st.label, s) : '';
  switch (modele) {
    case 'effectifs':
      body.push(sec('Effectifs par classe et par sexe'), p([r(`Situation au ${longDate(new Date().toISOString().slice(0, 10))} (élèves inscrits et actifs).`, { i: true, size: 10.5 })]), effectifsTable(),
        sec('Observations'), TODO('mouvements d’élèves (arrivées, départs, abandons), effectifs pléthoriques, besoins en salles'));
      break;
    case 'rapport_rentree':
      body.push(sec('Déroulement de la rentrée'), TODO('date effective de la reprise des cours, taux de présence des élèves et du personnel le jour de la rentrée, cérémonies'),
        sec('Personnel'), personnelTable(), TODO('personnel arrivé ou parti, postes non pourvus, besoins par discipline'),
        sec('Effectifs des élèves'), effectifsTable(), sec('Infrastructures et équipements'), TODO('état des salles, du mobilier, des laboratoires et des ateliers ; travaux réalisés pendant les vacances'),
        sec('Difficultés rencontrées'), TODO('difficultés et solutions apportées'), sec('Besoins et perspectives'), TODO('besoins prioritaires et actions prévues pour l’année'));
      break;
    case 'resultats':
      body.push(sec(`Résultats par classe — ${lbl}`), ...resultatsTables(st), sec('Analyse des résultats'), TODO('classes et disciplines en difficulté, comparaison avec la période précédente'),
        sec('Mesures de remédiation'), TODO('cours de soutien, suivi personnalisé, rencontres avec les parents'));
      break;
    case 'pv_conseils':
      body.push(p([r(`Synthèse des conseils de classe — ${lbl}`, { i: true })], { align: 'center' }));
      for (const c of st.classes) {
        body.push(H2(`Classe de ${c.classe}`), table([['Effectif', 'Classés', 'Moyenne de la classe', 'Plus forte', 'Plus faible', 'Taux de réussite'],
          [fmt(c.effectif), fmt(c.classes), fmt(c.moyenne), fmt(c.max), fmt(c.min), pct(c.reussite)].map((v) => ({ content: v, align: 'center' }))], { widths: [2.6, 2.6, 3.4, 2.8, 2.8, 3.8], fontSize: 10 }),
        TODO(`décisions, distinctions, sanctions et recommandations du conseil de la classe de ${c.classe}`));
      }
      break;
    case 'couverture':
      body.push(sec('Couverture des programmes et digitalisation des leçons (cumul de l’année)'), couvertureTable(), sec('Analyse'), TODO('disciplines en retard, causes, mesures de rattrapage'));
      break;
    case 'assiduite_personnel': {
      const a = assiduiteTable(monthFor(e) ? { period: monthFor(e) } : { period: 'A' });
      body.push(sec(`Présence et assiduité du personnel enseignant — ${a.range.label}`), p([r(`Du ${a.range.from.split('-').reverse().join('/')} au ${a.range.to.split('-').reverse().join('/')}, d'après l'emploi du temps et le pointage de l'établissement.`, { i: true, size: 10.5 })]),
        a.xml, sec('Observations'), TODO('absences prolongées, remplacements, mesures prises'));
      break;
    }
    case 'discipline':
      body.push(sec(`Synthèse disciplinaire — ${lbl}`), disciplineTable(st), sec('Faits marquants'), TODO('incidents graves, conseils de discipline tenus, exclusions'), sec('Mesures prises et propositions'), TODO('sensibilisation, partenariat avec les parents'));
      break;
    case 'rapport_trimestriel':
    case 'rapport_annuel': {
      const a = assiduiteTable({ period: modele === 'rapport_annuel' ? 'A' : `T${period.slice(1)}` });
      body.push(sec('Introduction'), TODO('contexte et principaux faits de la période'), sec('Effectifs'), effectifsTable(), sec(`Résultats scolaires — ${lbl}`), ...resultatsTables(st),
        sec('Couverture des programmes'), couvertureTable(), sec('Discipline'), disciplineTable(st), sec(`Assiduité du personnel — ${a.range.label}`), a.xml,
        sec('Activités menées'), TODO('activités pédagogiques, post et périscolaires, journées pédagogiques, conseils d’enseignement'),
        sec('Difficultés et perspectives'), TODO('difficultés rencontrées et actions envisagées'));
      break;
    }
    case 'candidats':
      body.push(sec('Liste des candidats par classe'), ...candidatsTables(), sec('Observations'), TODO('candidats libres, dossiers incomplets, cas particuliers'));
      break;
    default:
      body.push(p([r('Objet : ', { b: true }), r(titre)]), sec('Introduction'), TODO('rappel de la demande et objet du document'), sec('Développement'), TODO('contenu du document'), sec('Conclusion'), TODO('conclusion et propositions'));
  }
  // signature
  body.push(p('', { after: 10 }), table([[{ content: [p('', { after: 0 })] }, { content: [p([r(String(t.chef).toUpperCase(), { b: true, size: 12 })], { align: 'center', after: 0 }),
    p([r('(signature et cachet)', { i: true, size: 8.5, color: GREY })], { align: 'center', after: 40 }), p([r(t.chefNom || '', { b: true, size: 11.5 })], { align: 'center', after: 0 })] }]],
  { widths: [9.5, 8.5], header: false, borders: false }));
  const buf = buildDocx({ body: body.map((x) => (typeof x === 'string' ? applyTerms(x, s) : x)), images, title: titre, landscape: false });
  return { buf, filename: `${titre.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_|_$/g, '').slice(0, 80) || 'document'}.docx` };
}
