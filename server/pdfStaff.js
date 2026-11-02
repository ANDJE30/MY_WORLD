// Documents administratifs des enseignants (PDF) : attestation de présence effective au poste, certificat de prise de service,
// rappel à l'ordre, lettre d'observation, demande d'explication (avec espace de réponse), états d'assiduité et registre.
import { header, infoGrid, table, ensureSpace, C, fmt } from './pdf.js';
import { DOC_TYPES, DOC_STATUS, civilite, accord, fonctionOf, chefFonction, frDate, longDate, assiduiteLabel } from './staff.js';

const box = (doc) => { const L = doc.page.margins.left; return { L, W: doc.page.width - L - doc.page.margins.right }; };
const pct = (v) => (v == null ? '—' : `${fmt(v, 1)} %`);
const h1 = (v) => fmt(v, Number.isInteger(v) ? 0 : 1);
const dt = (ts) => (ts ? new Date(ts * 1000).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Douala' }) : '');
const sub = (range) => (range.code === 'A' ? "Cumul de l'année" : range.label);

function paragraph(doc, y, text, { indent = 0, size = 10.5, font = 'Helvetica', gap = 8, align = 'justify', color = C.dark } = {}) {
  const { L, W } = box(doc);
  doc.font(font).fontSize(size).fillColor(color);
  const hgt = doc.heightOfString(text, { width: W - indent, align, lineGap: 2.5 });
  y = ensureSpace(doc, y, Math.min(hgt, 120));
  doc.text(text, L + indent, y, { width: W - indent, align, lineGap: 2.5 });
  return doc.y + gap;
}
function bullets(doc, y, text) {
  const items = String(text || '').split(/\n+/).map((t) => t.replace(/^[-•*]\s*/, '').trim()).filter(Boolean);
  const { L, W } = box(doc);
  for (const it of items) {
    doc.font('Helvetica').fontSize(10.5);
    const hgt = doc.heightOfString(it, { width: W - 30, lineGap: 2.5 });
    y = ensureSpace(doc, y, hgt + 4);
    doc.fillColor(C.accent).text('•', L + 14, y).fillColor(C.dark).text(it, L + 28, y, { width: W - 30, align: 'justify', lineGap: 2.5 });
    y = doc.y + 5;
  }
  return y + 4;
}
/** Bloc de signature du chef d'établissement (à droite). */
function signature(doc, y, s) {
  const { L, W } = box(doc);
  y = ensureSpace(doc, y, 90);
  const x = L + W * 0.52, w = W * 0.48;
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.dark).text(s.chef_titre || "Le Chef d'établissement", x, y, { width: w, align: 'center' });
  doc.font('Helvetica-Oblique').fontSize(8).fillColor(C.muted).text('(signature et cachet)', x, doc.y + 2, { width: w, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.dark).text(s.chef_nom || '', x, y + 62, { width: w, align: 'center' });
  return y + 84;
}
function ampliations(doc, y, list) {
  const items = String(list || '').split(/\n+/).map((x) => x.trim()).filter(Boolean);
  if (!items.length) return y;
  const { L } = box(doc);
  y = ensureSpace(doc, y, 14 + items.length * 11);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.dark).text('Ampliations :', L, y, { underline: true });
  y = doc.y + 2;
  items.forEach((it) => { doc.font('Helvetica').fontSize(8.5).text(`– ${it}`, L + 6, y); y = doc.y + 1; });
  return y + 6;
}
/** Lignes réglées : espace d'écriture manuscrite. */
function ruled(doc, x, y, w, n, step = 19) {
  for (let i = 1; i <= n; i++) doc.moveTo(x, y + i * step).lineTo(x + w, y + i * step).lineWidth(0.4).dash(1.5, { space: 2 }).strokeColor('#9CA3AF').stroke().undash();
  return y + n * step + 6;
}
function refLine(doc, y, d, s) {
  const { L, W } = box(doc);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.dark).text(d.reference, L, y, { width: W * 0.6 });
  doc.font('Helvetica').fontSize(9.5).text(`${s.ville || '................'}, le ${longDate(d.date_doc)}`, L + W * 0.6, y, { width: W * 0.4, align: 'right' });
  return y + 22;
}
/** « Enseignante de SVT » → « d'enseignante de SVT » ; « Censeur » → « de censeur ». */
const deQualite = (f) => { const low = f.charAt(0).toLowerCase() + f.slice(1); return /^[aeiouyéèêâîôh]/i.test(low) ? `d'${low}` : `de ${low}`; };
const agentLine = (a) => [a.grade, fonctionOf(a)].filter(Boolean).join(', ');

/* ---------------- Attestations ---------------- */
function titleBlock(doc, y, d) {
  const { L, W } = box(doc);
  y += 6;
  doc.font('Helvetica-Bold').fontSize(16).fillColor(C.primary).text(DOC_TYPES[d.type].titre.toUpperCase(), L, y, { width: W, align: 'center', characterSpacing: 0.5 });
  y = doc.y + 3;
  doc.font('Helvetica').fontSize(9.5).fillColor(C.dark).text(d.reference, L, y, { width: W, align: 'center' });
  y = doc.y + 3;
  doc.moveTo(L + W / 2 - 60, y + 2).lineTo(L + W / 2 + 60, y + 2).lineWidth(1).strokeColor(C.accent).stroke();
  return y + 20;
}
function agentGrid(doc, y, a) {
  return infoGrid(doc, y, [['Nom et prénoms', a.full_name], ['Matricule', a.matricule || '—'], ['Grade', a.grade || '—'], ['Statut', a.statut_agent || '—'],
    ['Discipline', a.specialite || '—'], ['Fonction', fonctionOf(a)], ['Date de prise de service', frDate(a.date_prise_service) || '—'],
    ['Classes', (a.classes || []).join(', ') || '—']], 2);
}

function priseDeService(doc, d, s) {
  const a = d.data.agent; const { L } = box(doc);
  let y = titleBlock(doc, header(doc, null), d);
  y = paragraph(doc, y, `Je soussigné(e), ${s.chef_nom || '..............................'}, ${chefFonction(s)} du ${s.nom}, certifie que ${civilite(a.sexe, true)} ${a.full_name}`
    + `${a.grade ? `, ${a.grade}` : ''}${a.matricule ? `, matricule ${a.matricule}` : ''}${a.acte_affectation ? `, ${accord(a.sexe, 'affecté', 'affectée')} dans mon établissement par ${a.acte_affectation}` : ''}, `
    + `a effectivement pris service le ${longDate(a.date_prise_service) || '....................'} en qualité ${deQualite(fonctionOf(a))}.`);
  y = agentGrid(doc, y + 4, a);
  if (d.faits) y = paragraph(doc, y + 2, d.faits, { size: 10 });
  y = paragraph(doc, y + 4, 'En foi de quoi, le présent certificat lui est délivré pour servir et valoir ce que de droit.');
  y = signature(doc, y + 10, s);
  ampliations(doc, y, d.ampliations);
  doc.x = L;
}

function presence(doc, d, s) {
  const a = d.data.agent, as = d.data.assiduite || {};
  let y = titleBlock(doc, header(doc, null), d);
  y = paragraph(doc, y, `Je soussigné(e), ${s.chef_nom || '..............................'}, ${chefFonction(s)} du ${s.nom}, atteste que ${civilite(a.sexe, true)} ${a.full_name}`
    + `${a.grade ? `, ${a.grade}` : ''}${a.matricule ? `, matricule ${a.matricule}` : ''}, en service dans mon établissement${a.date_prise_service ? ` depuis le ${longDate(a.date_prise_service)}` : ''} `
    + `en qualité ${deQualite(fonctionOf(a))}, est effectivement ${accord(a.sexe, 'présent', 'présente')} à son poste de travail.`);
  y = paragraph(doc, y, `Au titre de la période « ${as.label || ''} » (du ${frDate(as.from)} au ${frDate(as.to)}), son assiduité, établie à partir de l'emploi du temps et du registre de pointage de l'établissement, se présente comme suit :`);
  const rows = (d.data.parSequence || []).map((x) => ({ p: `Séquence ${x.seq}`, ...x }));
  rows.push({ p: 'Total de la période', ...as, _bold: true, _highlight: true });
  y = table(doc, ensureSpace(doc, y, 80), [
    { header: 'Période', width: 2.2, key: 'p' }, { header: 'Heures dues', width: 1.1, align: 'center', value: (r) => h1(r.dues) },
    { header: 'Heures effectuées', width: 1.2, align: 'center', value: (r) => h1(r.faites) },
    { header: 'Absences justifiées (h)', width: 1.3, align: 'center', value: (r) => h1(r.abs_j) },
    { header: 'Absences non justifiées (h)', width: 1.4, align: 'center', value: (r) => h1(r.abs_nj) },
    { header: 'Retards', width: 0.9, align: 'center', value: (r) => `${r.retards}${r.retards ? ` (${r.retard_minutes} min)` : ''}` },
    { header: "Taux d'assiduité", width: 1.1, align: 'center', value: (r) => pct(r.taux) }], rows, { fontSize: 8.5 });
  // jauge du taux d'assiduité
  const { L, W } = box(doc);
  y = ensureSpace(doc, y + 2, 50);
  const t = as.taux ?? 0, col = t >= 90 ? C.primary : t >= 70 ? C.accent : C.red;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(C.dark).text("Taux d'assiduité : ", L, y, { continued: true }).fillColor(col).text(`${pct(as.taux)} — ${assiduiteLabel(as.taux)}`);
  y = doc.y + 4;
  doc.roundedRect(L, y, W, 9, 4).fill('#E5E7EB');
  if (t > 0) doc.roundedRect(L, y, Math.max(9, (W * Math.min(100, t)) / 100), 9, 4).fill(col);
  doc.font('Helvetica').fontSize(8).fillColor(C.muted).text(`Heures effectuées / heures dues. Hors absences justifiées : ${pct(as.taux_hors_justifiees)}. Charge hebdomadaire : ${h1(as.hebdo)} h (${as.source}).`, L, y + 13, { width: W });
  y = doc.y + 10;
  if (d.faits) y = paragraph(doc, y, d.faits, { size: 10 });
  y = paragraph(doc, y, 'En foi de quoi, la présente attestation lui est délivrée pour servir et valoir ce que de droit.');
  y = signature(doc, y + 8, s);
  ampliations(doc, y, d.ampliations);
  doc.x = L;
}

/* ---------------- Courriers : rappel à l'ordre, lettre d'observation, demande d'explication ---------------- */
function letter(doc, d, s, refDoc) {
  const a = d.data.agent; const { L, W } = box(doc);
  let y = refLine(doc, header(doc, null), d, s);
  // destinataire
  const x = L + W * 0.48, w = W * 0.52;
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.dark).text(`${s.chef_titre || "Le Chef d'établissement"} du ${s.nom}`, x, y, { width: w });
  doc.font('Helvetica-Oblique').fontSize(10).text('à', x, doc.y + 3, { width: w, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(10.5).text(`${civilite(a.sexe)} ${a.full_name}`, x, doc.y + 3, { width: w });
  doc.font('Helvetica').fontSize(9.5).text([agentLine(a), a.matricule ? `Matricule ${a.matricule}` : ''].filter(Boolean).join(' — '), x, doc.y + 1, { width: w });
  y = doc.y + 18;
  doc.font('Helvetica-Bold').fontSize(10.5).text('Objet : ', L, y, { continued: true }).font('Helvetica').text(d.objet || DOC_TYPES[d.type].titre);
  y = doc.y + 3;
  if (refDoc) { doc.font('Helvetica-Bold').text('Réf. : ', L, y, { continued: true }).font('Helvetica').text(`${DOC_TYPES[refDoc.type].titre} ${refDoc.reference} du ${frDate(refDoc.date_doc)}`); y = doc.y + 3; }
  y += 12;
  const civ = civilite(a.sexe);
  y = paragraph(doc, y, `${civ},`, { align: 'left' });
  if (d.type === 'rappel_ordre') {
    y = paragraph(doc, y, "Il m'a été donné de constater les manquements suivants dans l'exercice de vos fonctions :");
    y = bullets(doc, y, d.faits);
    y = paragraph(doc, y, "Ces agissements sont contraires aux obligations professionnelles de l'enseignant, notamment l'assiduité, la ponctualité et le respect des instructions de la hiérarchie, telles que prévues par le Statut général de la Fonction publique et le règlement intérieur de l'établissement.");
    y = paragraph(doc, y, "Par la présente, je vous rappelle à l'ordre et vous invite à vous ressaisir sans délai. Je ne doute pas que vous prendrez les dispositions nécessaires pour que de tels faits ne se reproduisent plus.");
  } else if (d.type === 'observation') {
    y = paragraph(doc, y, 'Les faits suivants vous sont reprochés :');
    y = bullets(doc, y, d.faits);
    if (refDoc?.type === 'demande_explication') y = paragraph(doc, y, refDoc.reponse
      ? `Les explications que vous avez fournies en réponse à la demande d'explication citée en référence ne justifient pas ces manquements.`
      : `Vous n'avez pas répondu, dans le délai imparti, à la demande d'explication citée en référence.`);
    y = paragraph(doc, y, `Un tel comportement constitue un manquement à vos obligations professionnelles. En conséquence, je vous adresse la présente lettre d'observation, qui sera versée à votre dossier administratif.`);
    y = paragraph(doc, y, 'Je vous exhorte à faire preuve désormais de plus de rigueur et de professionnalisme. Toute récidive vous exposerait à des sanctions disciplinaires plus sévères, conformément à la réglementation en vigueur.');
  } else {
    y = paragraph(doc, y, "Il m'a été donné de constater les faits suivants vous concernant :");
    y = bullets(doc, y, d.faits);
    const ech = d.echeance ? ` (soit au plus tard le ${dt(d.echeance)})` : '';
    y = paragraph(doc, y, `Je vous saurais gré de bien vouloir me fournir, par écrit, dans un délai de ${d.delai_heures || 72} heures à compter de la réception de la présente${ech}, des explications sur ces faits. Votre réponse sera portée dans l'espace prévu à cet effet ci-dessous ou transmise depuis votre espace enseignant.`);
  }
  y = paragraph(doc, y, `Recevez, ${civ}, l'assurance de ma considération distinguée.`);
  y = signature(doc, y + 4, s);
  y = ampliations(doc, y, d.ampliations);
  if (d.type === 'demande_explication') responseSection(doc, y, d, a);
  doc.x = L;
}

/** Espace de réponse de l'intéressé(e) + suite réservée par le chef d'établissement. */
function responseSection(doc, y, d, a) {
  const { L, W } = box(doc);
  const bottom = () => doc.page.height - doc.page.margins.bottom - 24;
  const need = 70 + (d.reponse ? doc.heightOfString(d.reponse, { width: W - 20 }) : 12 * 19) + 60;
  if (y + Math.min(need, 420) > bottom()) { doc.addPage(); y = doc.page.margins.top; }
  // espace d'écriture : tout l'espace disponible, en réservant la signature et la suite réservée
  const lines = d.reponse ? 0 : Math.max(10, Math.min(24, Math.floor((bottom() - y - 60 - 60 - 150) / 19)));
  doc.rect(L, y, W, 20).fill(C.primary);
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#fff').text(`RÉPONSE DE ${accord(a.sexe, "L'INTÉRESSÉ", "L'INTÉRESSÉE").toUpperCase()}`, L, y + 5.5, { width: W, align: 'center' });
  y += 28;
  doc.font('Helvetica').fontSize(9).fillColor(C.dark)
    .text(`Nom : ${a.full_name}${a.matricule ? `   •   Matricule : ${a.matricule}` : ''}`, L + 4, y, { width: W - 8 });
  y = doc.y + 3;
  doc.text(`Demande reçue le : ${d.ack_at ? dt(d.ack_at) : '........................................'}${d.reponse_at ? `      Réponse transmise le : ${dt(d.reponse_at)}` : ''}`, L + 4, y, { width: W - 8 });
  y = doc.y + 8;
  const top = y;
  if (d.reponse) {
    doc.font('Helvetica').fontSize(10).fillColor(C.dark);
    // la réponse peut s'étendre sur plusieurs pages
    const parts = String(d.reponse).split(/\n/);
    for (const p of parts) { y = ensureSpace(doc, y, 16); doc.text(p || ' ', L + 10, y, { width: W - 20, align: 'justify', lineGap: 2 }); y = doc.y + 2; }
    y += 6;
    if (doc.y > top) doc.rect(L, top - 4, W, Math.max(30, y - top + 4)).lineWidth(0.6).strokeColor(C.line).stroke();
  } else {
    y = ruled(doc, L + 6, y - 6, W - 12, lines);
  }
  y = ensureSpace(doc, y + 6, 60);
  doc.font('Helvetica').fontSize(9.5).fillColor(C.dark).text(`Fait à ......................................, le ............................`, L, y, { width: W / 2 });
  doc.font('Helvetica-Bold').text(`Signature de ${accord(a.sexe, "l'intéressé", "l'intéressée")}`, L + W / 2, y, { width: W / 2, align: 'center', underline: true });
  y += 52;
  // suite réservée
  y = ensureSpace(doc, y, 110);
  doc.rect(L, y, W, 18).fill('#F3F4F6');
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.dark).text("SUITE RÉSERVÉE PAR LE CHEF D'ÉTABLISSEMENT", L, y + 5, { width: W, align: 'center' });
  y += 24;
  if (d.suite) { doc.font('Helvetica').fontSize(10).text(d.suite, L + 8, y, { width: W - 16, align: 'justify' }); y = doc.y + 8; }
  else y = ruled(doc, L + 6, y - 6, W - 12, 4);
  return y;
}

/** Point d'entrée : un document administratif du registre. */
export function adminDocument(doc, d, refDoc) {
  const s = doc._settings;
  if (d.status === 'annule') {
    doc.save().rotate(-35, { origin: [doc.page.width / 2, doc.page.height / 2] }).font('Helvetica-Bold').fontSize(80).fillColor('#B42318').opacity(0.12)
      .text('ANNULÉ', 0, doc.page.height / 2 - 40, { width: doc.page.width, align: 'center' }).restore().opacity(1);
  }
  if (d.type === 'prise_service') priseDeService(doc, d, s);
  else if (d.type === 'presence') presence(doc, d, s);
  else letter(doc, d, s, refDoc);
}

/* ---------------- États ---------------- */
export function assiduiteEtat(doc, { range, rows }) {
  let y = header(doc, "État d'assiduité du personnel enseignant", `${sub(range)} — du ${frDate(range.from)} au ${frDate(rows[0]?.to || range.to)}`);
  const tot = rows.reduce((a, r) => ({ dues: a.dues + r.dues, faites: a.faites + r.faites, abs_j: a.abs_j + r.abs_j, abs_nj: a.abs_nj + r.abs_nj, retards: a.retards + r.retards }), { dues: 0, faites: 0, abs_j: 0, abs_nj: 0, retards: 0 });
  const tg = tot.dues ? Math.round((tot.faites / tot.dues) * 1000) / 10 : null;
  y = infoGrid(doc, y, [['Enseignants', rows.length], ['Heures dues', h1(Math.round(tot.dues * 10) / 10)], ['Heures effectuées', h1(Math.round(tot.faites * 10) / 10)],
    ['Absences justifiées (h)', h1(Math.round(tot.abs_j * 10) / 10)], ['Absences non justifiées (h)', h1(Math.round(tot.abs_nj * 10) / 10)], ['Taux global', pct(tg)]], 3);
  table(doc, y, [
    { header: 'N°', width: 0.4, align: 'center', value: (_r, i) => String(i + 1) }, { header: 'Nom et prénoms', width: 2.4, key: 'full_name' },
    { header: 'Matricule', width: 1, key: 'matricule' }, { header: 'Grade', width: 0.9, key: 'grade' }, { header: 'Discipline', width: 1.6, key: 'specialite' },
    { header: 'Heures dues', width: 0.8, align: 'center', value: (r) => h1(r.dues) }, { header: 'Heures effectuées', width: 0.9, align: 'center', value: (r) => h1(r.faites) },
    { header: 'Abs. J (h)', width: 0.7, align: 'center', value: (r) => h1(r.abs_j) }, { header: 'Abs. NJ (h)', width: 0.7, align: 'center', value: (r) => h1(r.abs_nj) },
    { header: 'Retards', width: 0.7, align: 'center', value: (r) => String(r.retards) }, { header: 'Taux', width: 0.8, align: 'center', value: (r) => pct(r.taux) },
    { header: 'Appréciation', width: 1.1, key: 'appreciation' }], rows.map((r) => ({ ...r, _highlight: r.taux != null && r.taux < 80 })), { fontSize: 7.5 });
}

export function assiduiteEnseignant(doc, { agent, summary, parSequence }) {
  let y = header(doc, "Relevé d'assiduité", `${agent.full_name} — ${summary.code === 'A' ? "cumul de l'année" : summary.label} (du ${frDate(summary.from)} au ${frDate(summary.to)})`);
  y = agentGrid(doc, y, agent);
  y = infoGrid(doc, y, [['Heures dues', h1(summary.dues)], ['Heures effectuées', h1(summary.faites)], ["Taux d'assiduité", pct(summary.taux)],
    ['Absences justifiées (h)', h1(summary.abs_j)], ['Absences non justifiées (h)', h1(summary.abs_nj)], ['Retards', `${summary.retards} (${summary.retard_minutes} min)`]], 3);
  if (parSequence.length) y = table(doc, y, [{ header: 'Séquence', width: 1, value: (r) => `Séquence ${r.seq}` }, { header: 'Dues', width: 1, align: 'center', value: (r) => h1(r.dues) },
    { header: 'Effectuées', width: 1, align: 'center', value: (r) => h1(r.faites) }, { header: 'Abs. J', width: 1, align: 'center', value: (r) => h1(r.abs_j) },
    { header: 'Abs. NJ', width: 1, align: 'center', value: (r) => h1(r.abs_nj) }, { header: 'Retards', width: 1, align: 'center', value: (r) => String(r.retards) },
    { header: 'Taux', width: 1, align: 'center', value: (r) => pct(r.taux) }], parSequence, { fontSize: 8.5 });
  const { L } = box(doc);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(C.primary).text('Détail des absences et retards', L, ensureSpace(doc, y, 40));
  y = doc.y + 4;
  if (!summary.records.length) { doc.font('Helvetica').fontSize(9).fillColor(C.muted).text('Aucune absence ni aucun retard enregistré sur la période.', L, y); return; }
  table(doc, y, [{ header: 'Date', width: 0.9, value: (r) => frDate(r.date) }, { header: 'Nature', width: 0.8, value: (r) => (r.kind === 'absence' ? 'Absence' : 'Retard') },
    { header: 'Durée', width: 0.8, align: 'center', value: (r) => (r.kind === 'absence' ? `${h1(r.hours)} h` : `${r.minutes} min`) },
    { header: 'Classe / créneau', width: 1.3, value: (r) => [r.classe, r.creneau].filter(Boolean).join(' — ') || 'Journée' },
    { header: 'Justifiée', width: 0.7, align: 'center', value: (r) => (r.justified ? 'Oui' : 'Non') }, { header: 'Motif', width: 2.2, value: (r) => r.motif || '' }],
  summary.records, { fontSize: 8 });
}

export function registreDocuments(doc, { annee, rows }) {
  const y = header(doc, 'Registre des documents administratifs', `Personnel enseignant — ${annee}`);
  table(doc, y, [{ header: 'Référence', width: 2.2, key: 'reference' }, { header: 'Date', width: 0.8, value: (r) => frDate(r.date_doc) },
    { header: 'Document', width: 1.6, value: (r) => DOC_TYPES[r.type].court }, { header: 'Enseignant', width: 1.8, key: 'agent' },
    { header: 'Objet / faits', width: 3, value: (r) => (r.objet || r.faits || '').slice(0, 160) }, { header: 'Statut', width: 1, value: (r) => DOC_STATUS[r.status] }],
  rows, { fontSize: 7.5 });
}
