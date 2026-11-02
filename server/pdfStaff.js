// Documents administratifs des enseignants (PDF) : attestation de présence effective au poste, certificat de prise de service,
// rappel à l'ordre, lettre d'observation, demande d'explication (avec espace de réponse), états d'assiduité et registre.
// Mise en page des actes administratifs : en-tête officiel bilingue, titre en capitales condensées (Anton), corps en Liberation Serif.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { header, infoGrid, table, ensureSpace, C, fmt, enDelegations } from './pdf.js';
import { DOC_TYPES, DOC_STATUS, civilite, accord, fonctionOf, chefFonction, frDate, longDate, assiduiteLabel } from './staff.js';
import { seqLabel } from './db.js';

const FONTS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fonts');
const F = { R: 'Serif', B: 'Serif-Bold', I: 'Serif-Italic', BI: 'Serif-BoldItalic', T: 'Display' };
const INK = '#111111', GREY = '#555555', RULE = '#333333';
function registerFonts(doc) {
  if (doc._officialFonts) return;
  doc.registerFont(F.R, path.join(FONTS, 'LiberationSerif-Regular.ttf'));
  doc.registerFont(F.B, path.join(FONTS, 'LiberationSerif-Bold.ttf'));
  doc.registerFont(F.I, path.join(FONTS, 'LiberationSerif-Italic.ttf'));
  doc.registerFont(F.BI, path.join(FONTS, 'LiberationSerif-BoldItalic.ttf'));
  doc.registerFont(F.T, path.join(FONTS, 'Anton-Regular.woff'));
  doc._officialFonts = true;
}

const box = (doc) => { const L = doc.page.margins.left; return { L, W: doc.page.width - L - doc.page.margins.right }; };
const pct = (v) => (v == null ? '—' : `${fmt(v, 1)} %`);
const h1 = (v) => fmt(v, Number.isInteger(v) ? 0 : 1);
const dt = (ts) => (ts ? new Date(ts * 1000).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Africa/Douala' }) : '');
const sub = (range) => (range.code === 'A' ? "Cumul de l'année" : range.label);
const DOTS = '……………………………';
const BODY = 12, LEAD = 6.5; // corps et interligne des actes

/* ---------------- En-tête officiel bilingue ---------------- */
function officialHeader(doc, s) {
  const { L, W } = box(doc);
  const colW = 196, top = doc.page.margins.top;
  const block = (x, lines) => {
    let yy = top;
    for (const ln of lines) {
      if (ln === '-') { doc.moveTo(x + colW / 2 - 20, yy + 3.5).lineTo(x + colW / 2 + 20, yy + 3.5).lineWidth(0.45).strokeColor(GREY).stroke(); yy += 8; continue; }
      const [t, font, size] = ln; if (!t) continue;
      doc.font(font).fontSize(size).fillColor(INK);
      doc.text(t, x, yy, { width: colW, align: 'center', lineGap: 0 });
      yy = doc.y + 1;
    }
    return yy;
  };
  const en = enDelegations(s);
  const contact = (fr) => [s.tel ? `${fr ? 'Tél.' : 'Phone'} : ${s.tel}` : '', s.bp ? `${fr ? 'BP' : 'P.O. Box'} ${s.bp}` : ''].filter(Boolean).join('  •  ');
  const y1 = block(L, [['RÉPUBLIQUE DU CAMEROUN', F.B, 10.5], ['Paix – Travail – Patrie', F.I, 9], '-', [String(s.ministere || '').toUpperCase(), F.R, 8.8], '-',
    [s.delegation_regionale ? `DÉLÉGATION RÉGIONALE ${s.delegation_regionale}`.toUpperCase() : '', F.R, 8.4], '-',
    [s.delegation_departementale ? `DÉLÉGATION DÉPARTEMENTALE ${s.delegation_departementale}`.toUpperCase() : '', F.R, 8.4], '-',
    [String(s.nom || '').toUpperCase(), F.B, 9.4], [contact(true), 'Helvetica', 7]]);
  const y2 = block(L + W - colW, [['REPUBLIC OF CAMEROON', F.B, 10.5], ['Peace – Work – Fatherland', F.I, 9], '-', [String(s.ministere_en || '').toUpperCase(), F.R, 8.8], '-',
    [en.reg, F.R, 8.4], '-', [en.dep, F.R, 8.4], '-', [String(s.nom_en || s.nom_court || '').toUpperCase(), F.B, 9.4], [contact(false), 'Helvetica', 7]]);
  // logo (ou monogramme) au centre
  const cx = L + W / 2, lw = 92;
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(s.logo || '');
  let drawn = false;
  if (m) { try { doc.image(Buffer.from(m[2], 'base64'), cx - lw / 2, top + 2, { fit: [lw, lw], align: 'center', valign: 'center' }); drawn = true; } catch { /* logo illisible */ } }
  if (!drawn) {
    doc.circle(cx, top + 42, 38).lineWidth(1.6).strokeColor(C.primary).stroke();
    doc.circle(cx, top + 42, 34).lineWidth(0.5).strokeColor(C.accent).stroke();
    doc.font(F.T).fontSize(19).fillColor(C.primary).text(String(s.nom_court || 'SX').toUpperCase().slice(0, 6), cx - 34, top + 30, { width: 68, align: 'center' });
  }
  if (s.devise) doc.font(F.I).fontSize(7.5).fillColor(GREY).text(s.devise, cx - 70, top + lw + 6, { width: 140, align: 'center' });
  return Math.max(y1, y2, top + lw + 18) + 10;
}

/** Titre de l'acte (capitales condensées) + filet + numéro. */
function actTitle(doc, y, title, reference) {
  const { L, W } = box(doc);
  doc.font(F.T).fontSize(24).fillColor(INK);
  const tw = Math.min(W, doc.widthOfString(title.toUpperCase(), { characterSpacing: 0.4 }));
  doc.text(title.toUpperCase(), L, y, { width: W, align: 'center', characterSpacing: 0.4 });
  y = doc.y + 2;
  doc.moveTo(L + (W - tw) / 2, y).lineTo(L + (W + tw) / 2, y).lineWidth(1.1).strokeColor(INK).stroke();
  y += 4;
  doc.font('Helvetica').fontSize(9.5).fillColor(INK).text(`${reference}.`, L, y, { width: W, align: 'center' });
  return doc.y + 22;
}

/** Paragraphe composé de segments [texte, police] (gras, italique…), justifié. */
function rich(doc, y, segs, { indent = 0, firstIndent = 0, size = BODY, align = 'justify', gap = 10, lineGap = LEAD } = {}) {
  const { L, W } = box(doc);
  const parts = segs.filter(([t]) => t !== '' && t != null);
  // la justification de PDFKit répartit mal les espaces entre segments de styles différents : alignement à gauche dans ce cas
  if (parts.length > 1 && align === 'justify') align = 'left';
  const plain = parts.map(([t]) => t).join('');
  doc.font(F.R).fontSize(size);
  y = ensureSpace(doc, y, Math.min(doc.heightOfString(plain, { width: W - indent, lineGap }) + 4, 140));
  parts.forEach(([t, font = F.R], i) => {
    const last = i === parts.length - 1;
    doc.font(font).fontSize(size).fillColor(INK);
    if (i === 0) doc.text(t, L + indent, y, { width: W - indent, align, lineGap, indent: firstIndent, continued: !last });
    else doc.text(t, { continued: !last });
  });
  return doc.y + gap;
}
const P = (doc, y, text, o = {}) => rich(doc, y, [[text, o.font || F.R]], o);
function bullets(doc, y, text) {
  const items = String(text || '').split(/\n+/).map((t) => t.replace(/^[-•*–]\s*/, '').trim()).filter(Boolean);
  const { L, W } = box(doc);
  for (const it of items) {
    doc.font(F.R).fontSize(11.5);
    const hgt = doc.heightOfString(it, { width: W - 34, lineGap: 3 });
    y = ensureSpace(doc, y, hgt + 4);
    doc.fillColor(INK).text('–', L + 16, y).text(it, L + 30, y, { width: W - 32, align: 'justify', lineGap: 3 });
    y = doc.y + 4;
  }
  return y + 6;
}
/** « Fait à VILLE, le … » à droite. */
function faitA(doc, y, s, dateIso) {
  const { L, W } = box(doc);
  y = ensureSpace(doc, y, 120);
  const segs = [['Fait à ', F.I], [String(s.ville || '…………………').toUpperCase(), F.B], [', le ', F.I], [dateIso ? longDate(dateIso) : DOTS, F.R], ['.', F.R]];
  doc.font(F.R).fontSize(BODY);
  const widths = segs.map(([t, f]) => { doc.font(f).fontSize(BODY); return doc.widthOfString(t); });
  let x = L + W - widths.reduce((a, v) => a + v, 0);
  segs.forEach(([t, f], i) => { doc.font(f).fontSize(BODY).fillColor(INK).text(t, x, y, { lineBreak: false }); x += widths[i]; });
  return y + 28;
}
/** Ampliations (à gauche) et bloc de signature du chef d'établissement (à droite), côte à côte. */
function closing(doc, y, s, d) {
  const { L, W } = box(doc);
  y = ensureSpace(doc, y, 110);
  const x = L + W * 0.5, w = W * 0.5;
  doc.font(F.B).fontSize(BODY + 0.5).fillColor(INK).text(String(s.chef_titre || "Le Chef d'établissement").toUpperCase(), x, y, { width: w, align: 'center' });
  doc.font(F.I).fontSize(8.5).fillColor(GREY).text('(signature et cachet)', x, doc.y + 1, { width: w, align: 'center' });
  if (s.chef_nom) doc.font(F.B).fontSize(11.5).fillColor(INK).text(s.chef_nom, x, y + 74, { width: w, align: 'center' });
  const items = String(d.ampliations || '').split(/\n+/).map((t) => t.trim()).filter(Boolean);
  if (items.length) {
    doc.font(F.I).fontSize(10.5).fillColor(INK).text('AMPLIATIONS :', L, y, { underline: true });
    let yy = doc.y + 3;
    items.forEach((it) => { doc.font(F.I).fontSize(10.5).text(it, L + 26, yy); yy = doc.y + 1; });
  }
  return y + 96;
}
/** Mention verticale dans la marge droite (établissement et millésime), comme sur les imprimés administratifs. */
function marginMark(doc, s) {
  const an = String(s.annee_scolaire || '');
  const label = `${s.nom || ''} ${an.slice(2, 4)}/${an.slice(7, 9)}`;
  const x = doc.page.width - 16, y = doc.page.height - 60;
  doc.save().rotate(-90, { origin: [x, y] }).font('Helvetica').fontSize(6.5).fillColor('#777777').text(label, x, y - 3, { lineBreak: false }).restore();
}
/** Lignes réglées : espace d'écriture manuscrite. */
function ruled(doc, x, y, w, n, step = 20) {
  for (let i = 1; i <= n; i++) doc.moveTo(x, y + i * step).lineTo(x + w, y + i * step).lineWidth(0.4).dash(1.2, { space: 2.2 }).strokeColor('#8A8A8A').stroke().undash();
  return y + n * step + 6;
}
/** « Animateur Pédagogique de SVT » → « d'Animateur Pédagogique de SVT » ; « Censeur » → « de Censeur ». */
const deQualite = (f) => (/^[aeiouyéèêâîôh]/i.test(f) ? `d'${f}` : `de ${f}`);
const agentLine = (a) => [a.grade, fonctionOf(a)].filter(Boolean).join(', ');
/** « LE PROVISEUR DU LYCÉE … » / « LE DIRECTEUR DE L'ÉCOLE … ». */
const chefDe = (s) => `${String(s.chef_titre || "Le Chef d'établissement").toUpperCase()} ${/^[aeiouyéèêâîôh]/i.test(s.nom || '') ? "DE L'" : 'DU '}${String(s.nom || '').toUpperCase()}`;

/** Identité et situation de l'agent, à la manière de l'imprimé officiel. */
function agentParagraphs(doc, y, a, verbeFinal) {
  y = rich(doc, y, [[`${civilite(a.sexe)} `, F.R], [a.full_name, F.B]], { indent: 0, gap: 10 });
  const qual = a.fonction || accord(a.sexe, 'Enseignant', 'Enseignante');
  const disc = a.specialite && !qual.toLowerCase().includes(a.specialite.toLowerCase()) ? a.specialite : '';
  const segs = [['grade : ', F.R], [a.grade || DOTS, F.B], ['      Matricule : ', F.R], [a.matricule || DOTS, F.B], [', ', F.R]];
  if (a.acte_affectation) segs.push([`${accord(a.sexe, 'nommé', 'nommée')}/${accord(a.sexe, 'affecté', 'affectée')} par `, F.R], [a.acte_affectation, F.B], [', ', F.R]);
  segs.push(...verbeFinal(qual, disc));
  return rich(doc, y, segs, { gap: 12 });
}

/* ---------------- Attestation de présence effective au poste ---------------- */
function presence(doc, d, s) {
  const a = d.data.agent, as = d.data.assiduite || {};
  let y = actTitle(doc, officialHeader(doc, s), DOC_TYPES.presence.titre, d.reference);
  y = rich(doc, y, [[chefDe(s), F.B], [' soussigné(e), ', F.R], [s.chef_nom || DOTS, F.B], [', atteste que :', F.R]], { gap: 12 });
  y = agentParagraphs(doc, y, a, (qual, disc) => [
    ['est à son poste de travail en qualité ', F.R], [deQualite(qual), F.B], ...(disc ? [[' de la discipline ', F.R], [disc, F.B]] : []),
    [', depuis le ', F.R], [a.date_prise_service ? longDate(a.date_prise_service) : DOTS, F.B], [', date effective de sa prise de service.', F.R]]);

  // amélioration du modèle : l'assiduité au poste, chiffrée
  const { L, W } = box(doc);
  y = ensureSpace(doc, y + 2, 190);
  doc.font(F.B).fontSize(11).fillColor(INK).text('ASSIDUITÉ AU POSTE', L, y, { characterSpacing: 0.8 });
  doc.moveTo(L, doc.y + 1).lineTo(L + W, doc.y + 1).lineWidth(0.5).strokeColor(RULE).stroke();
  y = doc.y + 8;
  y = rich(doc, y, [['Au titre de la période « ', F.R], [as.label || '', F.I], [' », du ', F.R], [frDate(as.from), F.B], [' au ', F.R], [frDate(as.to), F.B],
    [`, l'assiduité de ${accord(a.sexe, "l'intéressé", "l'intéressée")}, établie d'après l'emploi du temps et le registre de pointage de l'établissement, s'établit comme suit :`, F.R]],
  { size: 11.5, lineGap: 4.5, gap: 8 });
  const rows = (d.data.parSequence || []).map((x) => ({ p: seqLabel(x.seq, s), ...x }));
  rows.push({ p: rows.length ? 'Total de la période' : (as.label || 'Période'), ...as, total: true });
  y = actTable(doc, y, [
    { h: 'Période', w: 2.1, v: (r) => r.p, al: 'left' }, { h: 'Heures dues', w: 1, v: (r) => h1(r.dues) }, { h: 'Heures effectuées', w: 1.1, v: (r) => h1(r.faites) },
    { h: 'Absences justifiées (h)', w: 1.15, v: (r) => h1(r.abs_j) }, { h: 'Absences non justifiées (h)', w: 1.25, v: (r) => h1(r.abs_nj) },
    { h: 'Retards', w: 1, v: (r) => (r.retards ? `${r.retards} (${r.retard_minutes} min)` : '0') }, { h: "Taux d'assiduité", w: 1.1, v: (r) => pct(r.taux), b: true }], rows);
  // encadré du taux
  y = ensureSpace(doc, y + 4, 62);
  const t = as.taux ?? 0, col = t >= 90 ? C.primary : t >= 70 ? C.accent : C.red;
  doc.rect(L, y, W, 52).fillAndStroke('#FAFAF7', '#C9C9C2');
  doc.rect(L, y, 4, 52).fill(col);
  doc.font(F.B).fontSize(13).fillColor(INK).text("Taux d'assiduité : ", L + 16, y + 9, { continued: true }).fillColor(col).text(pct(as.taux), { continued: true })
    .font(F.I).fontSize(12).fillColor(INK).text(`  —  assiduité ${assiduiteLabel(as.taux).toLowerCase()}`);
  const gx = L + 16, gw = W - 32, gy = y + 30;
  doc.roundedRect(gx, gy, gw, 6, 3).fill('#E4E4DF');
  if (t > 0) doc.roundedRect(gx, gy, Math.max(6, (gw * Math.min(100, t)) / 100), 6, 3).fill(col);
  doc.font(F.I).fontSize(8.5).fillColor(GREY).text(`Taux = heures effectuées ÷ heures dues. Hors absences justifiées : ${pct(as.taux_hors_justifiees)}. Charge hebdomadaire : ${h1(as.hebdo)} h (${as.source}).`,
    gx, gy + 10, { width: gw, lineBreak: false, ellipsis: true });
  y += 66;
  if (d.faits) y = P(doc, y, d.faits, { font: F.I, size: 11, lineGap: 4 });
  y = rich(doc, y, [[`En foi de quoi la présente attestation est établie et délivrée à ${accord(a.sexe, "l'intéressé", "l'intéressée")} pour servir et valoir ce que de droit./-`, F.R]], { firstIndent: 36, gap: 14 });
  y = faitA(doc, y, s, d.date_doc);
  closing(doc, y, s, d);
}

/** Tableau sobre des actes : filets fins, en-tête grisé, ligne de total en gras. */
function actTable(doc, y, cols, rows) {
  const { L, W } = box(doc);
  const tot = cols.reduce((a, c) => a + c.w, 0); const cw = cols.map((c) => (c.w / tot) * W);
  const pad = 4;
  doc.font(F.B).fontSize(9);
  const hh = Math.max(...cols.map((c, i) => doc.heightOfString(c.h, { width: cw[i] - 2 * pad }))) + 2 * pad;
  y = ensureSpace(doc, y, hh + rows.length * 18 + 6);
  doc.rect(L, y, W, hh).fill('#EDEDE8');
  let x = L;
  cols.forEach((c, i) => { doc.font(F.B).fontSize(9).fillColor(INK).text(c.h, x + pad, y + pad, { width: cw[i] - 2 * pad, align: c.al || 'center' }); x += cw[i]; });
  const top = y; y += hh;
  rows.forEach((r) => {
    const rh = 18;
    if (r.total) doc.rect(L, y, W, rh).fill('#F6F4EC');
    x = L;
    cols.forEach((c, i) => { doc.font(r.total || c.b ? F.B : F.R).fontSize(10).fillColor(INK).text(String(c.v(r)), x + pad, y + 4.5, { width: cw[i] - 2 * pad, align: c.al || 'center', lineBreak: false }); x += cw[i]; });
    y += rh;
    doc.moveTo(L, y).lineTo(L + W, y).lineWidth(0.4).strokeColor('#9A9A94').stroke();
  });
  // cadre et séparateurs verticaux
  doc.rect(L, top, W, y - top).lineWidth(0.7).strokeColor(RULE).stroke();
  x = L; cw.slice(0, -1).forEach((w) => { x += w; doc.moveTo(x, top).lineTo(x, y).lineWidth(0.4).strokeColor('#9A9A94').stroke(); });
  return y + 8;
}

/* ---------------- Certificat de prise de service ---------------- */
function priseDeService(doc, d, s) {
  const a = d.data.agent;
  let y = actTitle(doc, officialHeader(doc, s), DOC_TYPES.prise_service.titre, d.reference);
  y = rich(doc, y, [[chefDe(s), F.B], [' soussigné(e), ', F.R], [s.chef_nom || DOTS, F.B], [', certifie que :', F.R]], { gap: 12 });
  y = agentParagraphs(doc, y, a, (qual, disc) => [
    ['a effectivement pris service dans l’établissement le ', F.R], [a.date_prise_service ? longDate(a.date_prise_service) : DOTS, F.B],
    [' en qualité ', F.R], [deQualite(qual), F.B], ...(disc ? [[' de la discipline ', F.R], [disc, F.B]] : []), ['.', F.R]]);
  if (d.faits) y = P(doc, y, d.faits, { font: F.I, size: 11, lineGap: 4 });
  y = rich(doc, y + 4, [[`En foi de quoi le présent certificat est établi et délivré à ${accord(a.sexe, "l'intéressé", "l'intéressée")} pour servir et valoir ce que de droit./-`, F.R]], { firstIndent: 36, gap: 18 });
  y = faitA(doc, y, s, d.date_doc);
  closing(doc, y, s, d);
}

/* ---------------- Courriers : rappel à l'ordre, lettre d'observation, demande d'explication ---------------- */
function letter(doc, d, s, refDoc) {
  const a = d.data.agent; const { L, W } = box(doc);
  let y = officialHeader(doc, s) + 4;
  doc.font(F.B).fontSize(10.5).fillColor(INK).text(`${d.reference}.`, L, y, { width: W * 0.58 });
  const yRef = doc.y;
  faitA(doc, y, s, d.date_doc);
  y = Math.max(yRef, y + 16) + 16;
  // destinataire
  const x = L + W * 0.47, w = W * 0.53;
  doc.font(F.B).fontSize(11.5).fillColor(INK).text(`${s.chef_titre || "Le Chef d'établissement"} ${/^[aeiouyéèêâîôh]/i.test(s.nom || '') ? "de l'" : 'du '}${s.nom}`, x, y, { width: w, align: 'center' });
  doc.font(F.I).fontSize(11).text('à', x, doc.y + 3, { width: w, align: 'center' });
  doc.font(F.B).fontSize(11.5).text(`${civilite(a.sexe)} ${a.full_name}`, x, doc.y + 3, { width: w, align: 'center' });
  doc.font(F.R).fontSize(10).fillColor(GREY).text([agentLine(a), a.matricule ? `Matricule ${a.matricule}` : ''].filter(Boolean).join(' — '), x, doc.y + 1, { width: w, align: 'center' });
  y = doc.y + 20;
  y = rich(doc, y, [['Objet : ', F.B], [d.objet || DOC_TYPES[d.type].titre, F.R]], { align: 'left', gap: 3, lineGap: 2 });
  if (refDoc) y = rich(doc, y, [['Réf. : ', F.B], [`${DOC_TYPES[refDoc.type].titre} ${refDoc.reference} du ${frDate(refDoc.date_doc)}`, F.R]], { align: 'left', gap: 3, lineGap: 2 });
  y += 12;
  const civ = civilite(a.sexe);
  const LG = { size: 11.5, lineGap: 3.5, gap: 8 };
  y = P(doc, y, `${civ},`, { ...LG, align: 'left' });
  if (d.type === 'rappel_ordre') {
    y = P(doc, y, "Il m'a été donné de constater les manquements suivants dans l'exercice de vos fonctions :", LG);
    y = bullets(doc, y, d.faits);
    y = P(doc, y, "Ces agissements sont contraires aux obligations professionnelles de l'enseignant, notamment l'assiduité, la ponctualité et le respect des instructions de la hiérarchie, telles que prévues par le Statut général de la Fonction publique et le règlement intérieur de l'établissement.", LG);
    y = P(doc, y, "Par la présente, je vous rappelle à l'ordre et vous invite à vous ressaisir sans délai. Je ne doute pas que vous prendrez les dispositions nécessaires pour que de tels faits ne se reproduisent plus.", LG);
  } else if (d.type === 'observation') {
    y = P(doc, y, 'Les faits suivants vous sont reprochés :', LG);
    y = bullets(doc, y, d.faits);
    if (refDoc?.type === 'demande_explication') y = P(doc, y, refDoc.reponse
      ? 'Les explications que vous avez fournies en réponse à la demande d’explication citée en référence ne justifient pas ces manquements.'
      : 'Vous n’avez pas répondu, dans le délai imparti, à la demande d’explication citée en référence.', LG);
    y = P(doc, y, 'Un tel comportement constitue un manquement à vos obligations professionnelles. En conséquence, je vous adresse la présente lettre d’observation, qui sera versée à votre dossier administratif.', LG);
    y = P(doc, y, 'Je vous exhorte à faire preuve désormais de plus de rigueur et de professionnalisme. Toute récidive vous exposerait à des sanctions disciplinaires plus sévères, conformément à la réglementation en vigueur.', LG);
  } else {
    y = P(doc, y, "Il m'a été donné de constater les faits suivants vous concernant :", LG);
    y = bullets(doc, y, d.faits);
    const ech = d.echeance ? ` (soit au plus tard le ${dt(d.echeance)})` : '';
    y = rich(doc, y, [['Je vous saurais gré de bien vouloir me fournir, ', F.R], ['par écrit', F.B], [', dans un délai de ', F.R], [`${d.delai_heures || 72} heures`, F.B],
      [` à compter de la réception de la présente${ech}, des explications sur ces faits. Votre réponse sera portée dans l'espace prévu à cet effet ou transmise depuis votre espace enseignant.`, F.R]], LG);
  }
  y = P(doc, y, `Recevez, ${civ}, l'assurance de ma considération distinguée.`, LG);
  y = closing(doc, y + 8, s, d);
  if (d.type === 'demande_explication') responseSection(doc, y, d, a);
}

/** Espace de réponse de l'intéressé(e) + suite réservée par le chef d'établissement. */
function responseSection(doc, y, d, a) {
  const { L, W } = box(doc);
  const bottom = () => doc.page.height - doc.page.margins.bottom - 24;
  const need = 70 + (d.reponse ? doc.heightOfString(d.reponse, { width: W - 20 }) : 12 * 20) + 60;
  if (y + Math.min(need, 420) > bottom()) { doc.addPage(); marginMark(doc, doc._settings); y = doc.page.margins.top; }
  const lines = d.reponse ? 0 : Math.max(10, Math.min(24, Math.floor((bottom() - y - 60 - 60 - 150) / 20)));
  doc.rect(L, y, W, 22).fill('#1F2937');
  doc.font(F.B).fontSize(11.5).fillColor('#fff').text(`RÉPONSE DE ${accord(a.sexe, "L'INTÉRESSÉ", "L'INTÉRESSÉE")}`, L, y + 5.5, { width: W, align: 'center', characterSpacing: 0.6 });
  y += 30;
  doc.font(F.R).fontSize(10).fillColor(INK).text(`Nom : ${a.full_name}${a.matricule ? `      Matricule : ${a.matricule}` : ''}`, L + 4, y, { width: W - 8 });
  y = doc.y + 3;
  doc.text(`Demande reçue le : ${d.ack_at ? dt(d.ack_at) : '…………………………………'}${d.reponse_at ? `      Réponse transmise le : ${dt(d.reponse_at)}` : ''}`, L + 4, y, { width: W - 8 });
  y = doc.y + 8;
  const top = y;
  if (d.reponse) {
    for (const p of String(d.reponse).split(/\n/)) { y = ensureSpace(doc, y, 16); doc.font(F.R).fontSize(11).fillColor(INK).text(p || ' ', L + 10, y, { width: W - 20, align: 'justify', lineGap: 2.5 }); y = doc.y + 2; }
    y += 6;
    if (doc.y > top) doc.rect(L, top - 4, W, Math.max(30, y - top + 4)).lineWidth(0.6).strokeColor('#9A9A94').stroke();
  } else y = ruled(doc, L + 6, y - 6, W - 12, lines);
  y = ensureSpace(doc, y + 6, 60);
  doc.font(F.I).fontSize(10.5).fillColor(INK).text('Fait à ……………………, le ………………', L, y, { width: W / 2, lineBreak: false });
  doc.font(F.B).text(`Signature de ${accord(a.sexe, "l'intéressé", "l'intéressée")}`, L + W / 2, y, { width: W / 2, align: 'center', underline: true });
  y += 52;
  y = ensureSpace(doc, y, 110);
  doc.rect(L, y, W, 20).fill('#EDEDE8');
  doc.font(F.B).fontSize(10.5).fillColor(INK).text("SUITE RÉSERVÉE PAR LE CHEF D'ÉTABLISSEMENT", L, y + 5, { width: W, align: 'center', characterSpacing: 0.4 });
  y += 26;
  if (d.suite) { doc.font(F.R).fontSize(11).text(d.suite, L + 8, y, { width: W - 16, align: 'justify' }); y = doc.y + 8; }
  else y = ruled(doc, L + 6, y - 6, W - 12, 4);
  return y;
}

/** Point d'entrée : un document administratif du registre. */
export function adminDocument(doc, d, refDoc) {
  const s = doc._settings;
  registerFonts(doc);
  doc._official = true; // pas de mention de génération en pied de page sur un acte administratif
  // marges d'un acte : 2 cm à gauche et à droite
  const margins = { top: 32, bottom: 40, left: 54, right: 54 };
  doc.page.margins = { ...margins }; doc.options.margins = { ...margins };
  marginMark(doc, s);
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
  if (parSequence.length) y = table(doc, y, [{ header: 'Séquence', width: 1, value: (r) => seqLabel(r.seq, doc._settings) }, { header: 'Dues', width: 1, align: 'center', value: (r) => h1(r.dues) },
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
