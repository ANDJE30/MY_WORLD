// Génération des documents PDF officiels (PDFKit) — en-tête bilingue République du Cameroun.
import PDFDocument from 'pdfkit';
import { getSettings } from './db.js';
import { appreciation } from './calc.js';

const C = { primary: '#0B5D4B', accent: '#C8962E', dark: '#1F2937', muted: '#6B7280', zebra: '#F3F6F5', line: '#CBD5D1', red: '#B42318' };
const DAYS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const fmt = (v, d = 2) => (v == null || v === '' ? '—' : typeof v === 'number' ? v.toFixed(d).replace('.', ',') : String(v));
// entiers sans décimales (effectifs, compteurs), décimaux avec 2 chiffres
const fmtI = (v) => (typeof v === 'number' && Number.isInteger(v) ? String(v) : fmt(v));

function logoBuffer(s) {
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(s.logo || '');
  return m ? Buffer.from(m[2], 'base64') : null;
}

export function createDoc(res, { title, filename, landscape = false }) {
  const doc = new PDFDocument({ size: 'A4', layout: landscape ? 'landscape' : 'portrait', margin: 36, bufferPages: true,
    info: { Title: title, Author: 'EduGest CM', Creator: 'EduGest CM' } });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${String(filename || 'document').replace(/[^\w.-]+/g, '_')}.pdf"`);
  doc.pipe(res);
  doc._settings = getSettings();
  return doc;
}

/** En-tête officiel bilingue + titre du document. Retourne la position y suivante. */
export function header(doc, title, subtitle) {
  const s = doc._settings;
  const L = doc.page.margins.left, W = doc.page.width - L - doc.page.margins.right;
  const colW = Math.min(230, W * 0.38);
  let y = doc.page.margins.top;
  const block = (x, lines, align) => {
    let yy = y;
    lines.forEach(([t, bold, size]) => {
      if (!t) return;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size || 7.5).fillColor(C.dark);
      doc.text(t, x, yy, { width: colW, align });
      yy += doc.heightOfString(t, { width: colW }) + 0.5;
    });
    return yy;
  };
  const fr = [['RÉPUBLIQUE DU CAMEROUN', true, 8.5], ['Paix – Travail – Patrie', false, 7.5], ['*****'], [s.ministere, true],
    ['*****'], [s.delegation_regionale ? `DÉLÉGATION RÉGIONALE ${s.delegation_regionale}`.toUpperCase() : ''],
    [s.delegation_departementale ? `DÉLÉGATION DÉPARTEMENTALE ${s.delegation_departementale}`.toUpperCase() : ''],
    [String(s.nom || '').toUpperCase(), true, 8]];
  const en = [['REPUBLIC OF CAMEROON', true, 8.5], ['Peace – Work – Fatherland', false, 7.5], ['*****'], [s.ministere_en, true],
    ['*****'], [s.delegation_regionale ? `REGIONAL DELEGATION ${s.delegation_regionale}`.toUpperCase() : ''],
    [s.delegation_departementale ? `DIVISIONAL DELEGATION ${s.delegation_departementale}`.toUpperCase() : ''],
    [[s.bp ? `BP ${s.bp}` : '', s.tel ? `Tél. ${s.tel}` : ''].filter(Boolean).join(' – '), false, 7]];
  const y1 = block(L, fr, 'center');
  const y2 = block(L + W - colW, en, 'center');
  const logo = logoBuffer(s);
  const cx = L + W / 2;
  if (logo) { try { doc.image(logo, cx - 32, y, { fit: [64, 64], align: 'center' }); } catch { /* logo illisible */ } }
  else {
    doc.circle(cx, y + 30, 28).lineWidth(1.5).strokeColor(C.primary).stroke();
    doc.font('Helvetica-Bold').fontSize(14).fillColor(C.primary)
      .text((s.nom_court || s.nom || 'E').split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase(), cx - 28, y + 23, { width: 56, align: 'center' });
  }
  doc.font('Helvetica').fontSize(6.5).fillColor(C.muted);
  if (s.immatriculation) doc.text(`Matricule : ${s.immatriculation}`, cx - 70, y + 68, { width: 140, align: 'center' });
  if (s.devise) doc.font('Helvetica-Oblique').text(s.devise, cx - 80, y + 76, { width: 160, align: 'center' });
  y = Math.max(y1, y2, y + 88) + 6;
  doc.moveTo(L, y).lineTo(L + W, y).lineWidth(1.2).strokeColor(C.accent).stroke();
  y += 8;
  doc.font('Helvetica-Bold').fontSize(13).fillColor(C.primary).text(title.toUpperCase(), L, y, { width: W, align: 'center' });
  y = doc.y + 2;
  doc.font('Helvetica').fontSize(9).fillColor(C.muted).text(`Année scolaire ${s.annee_scolaire}${subtitle ? '  •  ' + subtitle : ''}`, L, y, { width: W, align: 'center' });
  doc.fillColor(C.dark);
  return doc.y + 10;
}

/** Ligne d'informations clé/valeur sur 2 à 4 colonnes. */
export function infoGrid(doc, y, pairs, cols = 3) {
  const L = doc.page.margins.left, W = doc.page.width - L - doc.page.margins.right, cw = W / cols;
  const rows = Math.ceil(pairs.length / cols);
  doc.roundedRect(L, y, W, rows * 16 + 8, 4).fillAndStroke('#F8FAF9', C.line);
  pairs.forEach(([k, v], i) => {
    const x = L + 8 + (i % cols) * cw, yy = y + 6 + Math.floor(i / cols) * 16;
    doc.font('Helvetica').fontSize(8).fillColor(C.muted).text(`${k} : `, x, yy, { continued: true })
      .font('Helvetica-Bold').fillColor(C.dark).text(fmtI(v), { width: cw - 12, lineBreak: false, ellipsis: true });
  });
  return y + rows * 16 + 16;
}

/** Tableau paginé avec en-tête répété, lignes zébrées et hauteur adaptative. */
export function table(doc, y, columns, rows, opts = {}) {
  const L = doc.page.margins.left, W = doc.page.width - L - doc.page.margins.right;
  const totalW = columns.reduce((a, c) => a + (c.width || 1), 0);
  const cols = columns.map((c) => ({ ...c, w: ((c.width || 1) / totalW) * W }));
  const fs = opts.fontSize || 8, pad = 3;
  const bottom = () => doc.page.height - doc.page.margins.bottom - 24;
  const drawHeader = () => {
    doc.font('Helvetica-Bold').fontSize(fs);
    const h = Math.max(...cols.map((c) => doc.heightOfString(c.header, { width: c.w - 2 * pad }))) + 2 * pad + 2;
    doc.rect(L, y, W, h).fill(opts.headerColor || C.primary);
    let x = L;
    cols.forEach((c) => { doc.fillColor('#fff').text(c.header, x + pad, y + pad + 1, { width: c.w - 2 * pad, align: c.align || 'left' }); x += c.w; });
    y += h;
  };
  drawHeader();
  rows.forEach((row, i) => {
    const cells = cols.map((c) => (c.value ? c.value(row, i) : row[c.key]));
    doc.font('Helvetica').fontSize(fs);
    const h = Math.max(...cells.map((v, j) => doc.heightOfString(fmt(v, cols[j].decimals ?? 2), { width: cols[j].w - 2 * pad }))) + 2 * pad;
    if (y + h > bottom()) { doc.addPage(); y = doc.page.margins.top; drawHeader(); }
    if (row._highlight) doc.rect(L, y, W, h).fill('#FDF6E7'); else if (i % 2) doc.rect(L, y, W, h).fill(C.zebra);
    let x = L;
    cells.forEach((v, j) => {
      const c = cols[j];
      const red = c.redBelow != null && typeof v === 'number' && v < c.redBelow;
      doc.font(c.bold || row._bold ? 'Helvetica-Bold' : 'Helvetica').fillColor(red ? C.red : C.dark)
        .text(fmt(v, c.decimals ?? 2), x + pad, y + pad, { width: c.w - 2 * pad, align: c.align || 'left' });
      x += c.w;
    });
    doc.moveTo(L, y + h).lineTo(L + W, y + h).lineWidth(0.3).strokeColor(C.line).stroke();
    y += h;
  });
  doc.rect(L, opts.startY ?? y, 0, 0);
  return y + 8;
}

export function ensureSpace(doc, y, needed) {
  if (y + needed > doc.page.height - doc.page.margins.bottom - 24) { doc.addPage(); return doc.page.margins.top; }
  return y;
}

export function signatures(doc, y, labels) {
  y = ensureSpace(doc, y, 70);
  const L = doc.page.margins.left, W = doc.page.width - L - doc.page.margins.right, cw = W / labels.length;
  const s = doc._settings;
  doc.font('Helvetica').fontSize(8).fillColor(C.muted)
    .text(`Fait à ${s.ville || '................'}, le ${new Date().toLocaleDateString('fr-FR')}`, L, y, { width: W, align: 'right' });
  y += 14;
  labels.forEach((l, i) => doc.font('Helvetica-Bold').fontSize(9).fillColor(C.dark).text(l, L + i * cw, y, { width: cw, align: 'center', underline: true }));
  return y + 60;
}

/** Pied de page sur toutes les pages : établissement, date, pagination. */
export function finalize(doc) {
  const range = doc.bufferedPageRange();
  const s = doc._settings;
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const L = doc.page.margins.left, W = doc.page.width - L - doc.page.margins.right, y = doc.page.height - 26;
    const old = doc.page.margins.bottom; doc.page.margins.bottom = 0;
    doc.moveTo(L, y - 4).lineTo(L + W, y - 4).lineWidth(0.4).strokeColor(C.line).stroke();
    doc.font('Helvetica').fontSize(7).fillColor(C.muted)
      .text(`${s.nom} — Document généré par EduGest CM le ${new Date().toLocaleString('fr-FR')}`, L, y, { width: W * 0.75, lineBreak: false })
      .text(`Page ${i - range.start + 1} / ${range.count}`, L + W * 0.75, y, { width: W * 0.25, align: 'right', lineBreak: false });
    doc.page.margins.bottom = old;
  }
  doc.end();
}

/* ======================= Documents ======================= */

export function releveNotes(doc, { classe, subject, teacher, coef, period, rows, stats }) {
  let y = header(doc, 'Relevé de notes', period.label);
  y = infoGrid(doc, y, [['Classe', classe.name], ['Discipline', subject], ['Coefficient', coef], ['Enseignant', teacher],
    ['Effectif', rows.length], ['Période', period.label]], 3);
  const seqCols = period.type === 'S' ? [] : period.seqs.map((s) => ({ header: `Séq. ${s}`, width: 1, align: 'center', value: (r) => r.bySeq[s] }));
  y = table(doc, y, [
    { header: 'N°', width: 0.5, align: 'center', decimals: 0, value: (_r, i) => i + 1 },
    { header: 'Matricule', width: 1.3, key: 'matricule' },
    { header: 'Noms et prénoms', width: 3.6, value: (r) => `${r.nom} ${r.prenom}` },
    { header: 'Sexe', width: 0.6, align: 'center', key: 'sexe' },
    ...seqCols,
    { header: period.type === 'S' ? 'Note /20' : 'Moy. /20', width: 1, align: 'center', bold: true, redBelow: 10, value: (r) => r.avg },
    { header: 'Rang', width: 0.7, align: 'center', key: 'rang', decimals: 0 },
    { header: 'Appréciation', width: 1.6, value: (r) => (r.avg === 'ABS' ? 'Absent' : appreciation(r.avg)) }
  ], rows);
  y = ensureSpace(doc, y, 40);
  y = infoGrid(doc, y, [['Moyenne de la classe', stats.avg], ['Note la plus haute', stats.max], ['Note la plus basse', stats.min],
    ['Notes ≥ 10', stats.admis], ['Taux de réussite', stats.reussite == null ? null : `${fmt(stats.reussite)} %`], ['Absents', stats.absents]], 3);
  signatures(doc, y, ["L'Enseignant", 'Le Censeur']);
}

export function progressionDoc(doc, { teacher, items }) {
  let y = header(doc, 'Fiche de progression annuelle', teacher);
  for (const it of items) {
    y = ensureSpace(doc, y, 160);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.primary).text(`${it.classe} — ${it.subject}`, doc.page.margins.left, y);
    y = doc.y + 4;
    const tp = it.rows.reduce((a, r) => a + r.planned, 0), td = it.rows.reduce((a, r) => a + r.done, 0);
    y = table(doc, y, [
      { header: 'Séquence', width: 1.2, value: (r) => `Séquence ${r.seq}` },
      { header: 'Leçons prévues', width: 1, align: 'center', key: 'planned', decimals: 0 },
      { header: 'Leçons faites', width: 1, align: 'center', key: 'done', decimals: 0 },
      { header: 'Taux de couverture', width: 1.2, align: 'center', value: (r) => (r.planned ? `${fmt((r.done / r.planned) * 100, 1)} %` : '—') },
      { header: 'Observations', width: 3, key: 'comment' }
    ], [...it.rows, { seq: 'Total', planned: tp, done: td, comment: '', _bold: true, _highlight: true }]
      .map((r) => (r.seq === 'Total' ? { ...r, seq: '' } : r)));
  }
  signatures(doc, y, ["L'Enseignant", "L'Animateur pédagogique", 'Le Censeur']);
}

export function ficheDiscipline(doc, { classe, period, rows, incidents, officer }) {
  let y = header(doc, 'Fiche des faits disciplinaires', period.label);
  y = infoGrid(doc, y, [['Classe', classe.name], ['Effectif', rows.length], ['Responsable', officer || '—']], 3);
  y = table(doc, y, [
    { header: 'N°', width: 0.45, align: 'center', decimals: 0, value: (_r, i) => i + 1 },
    { header: 'Noms et prénoms', width: 3, value: (r) => `${r.nom} ${r.prenom}` },
    { header: 'Abs. J (h)', width: 0.8, align: 'center', key: 'abs_j', decimals: 0 },
    { header: 'Abs. NJ (h)', width: 0.8, align: 'center', key: 'abs_nj', decimals: 0 },
    { header: 'Retards', width: 0.75, align: 'center', key: 'retards', decimals: 0 },
    { header: 'Consignes (h)', width: 0.85, align: 'center', key: 'consignes', decimals: 0 },
    { header: 'Avert.', width: 0.6, align: 'center', value: (r) => (r.avertissement ? 'Oui' : '') },
    { header: 'Blâme', width: 0.6, align: 'center', value: (r) => (r.blame ? 'Oui' : '') },
    { header: 'Excl. (j)', width: 0.65, align: 'center', key: 'exclusion_jours', decimals: 0 },
    { header: 'Observations', width: 2.2, key: 'observation' }
  ], rows, { fontSize: 7.5 });
  const sum = (k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  y = ensureSpace(doc, y, 40);
  y = infoGrid(doc, y, [['Total abs. justifiées', `${sum('abs_j')} h`], ['Total abs. non justifiées', `${sum('abs_nj')} h`],
    ['Total retards', sum('retards')], ['Avertissements', sum('avertissement')], ['Blâmes', sum('blame')], ['Jours d\'exclusion', sum('exclusion_jours')]], 3);
  if (incidents.length) {
    y = ensureSpace(doc, y, 80);
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.primary).text('Registre des incidents', doc.page.margins.left, y);
    y = table(doc, doc.y + 4, [
      { header: 'Date', width: 0.9, key: 'date' }, { header: 'Élève', width: 2, value: (r) => `${r.nom} ${r.prenom}` },
      { header: 'Fait', width: 1.6, key: 'type' }, { header: 'Gravité', width: 0.8, key: 'gravite' },
      { header: 'Sanction', width: 1.5, key: 'sanction' }, { header: 'Description', width: 2.6, key: 'description' }
    ], incidents, { fontSize: 7.5, headerColor: C.accent });
  }
  signatures(doc, y, ['Le Surveillant Général', doc._settings.chef_titre || 'Le Chef d\'établissement']);
}

export function ficheEleveDiscipline(doc, { student, classe, records, incidents }) {
  let y = header(doc, 'Fiche disciplinaire individuelle');
  y = infoGrid(doc, y, [['Élève', `${student.nom} ${student.prenom}`], ['Matricule', student.matricule], ['Classe', classe?.name],
    ['Sexe', student.sexe], ['Né(e) le', student.date_naissance], ['Parent / Tuteur', [student.parent_nom, student.parent_tel].filter(Boolean).join(' – ')]], 3);
  y = table(doc, y, [
    { header: 'Séquence', width: 1, value: (r) => `Séquence ${r.seq}` },
    { header: 'Abs. J (h)', width: 0.8, align: 'center', key: 'abs_j', decimals: 0 },
    { header: 'Abs. NJ (h)', width: 0.8, align: 'center', key: 'abs_nj', decimals: 0 },
    { header: 'Retards', width: 0.7, align: 'center', key: 'retards', decimals: 0 },
    { header: 'Consignes', width: 0.8, align: 'center', key: 'consignes', decimals: 0 },
    { header: 'Avert.', width: 0.6, align: 'center', value: (r) => (r.avertissement ? 'Oui' : '') },
    { header: 'Blâme', width: 0.6, align: 'center', value: (r) => (r.blame ? 'Oui' : '') },
    { header: 'Excl. (j)', width: 0.7, align: 'center', key: 'exclusion_jours', decimals: 0 },
    { header: 'Observations', width: 2.5, key: 'observation' }
  ], records);
  if (incidents.length) {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(C.primary).text('Incidents', doc.page.margins.left, y);
    y = table(doc, doc.y + 4, [
      { header: 'Date', width: 1, key: 'date' }, { header: 'Séq.', width: 0.5, align: 'center', key: 'seq', decimals: 0 },
      { header: 'Fait', width: 1.8, key: 'type' }, { header: 'Gravité', width: 0.9, key: 'gravite' },
      { header: 'Sanction', width: 1.6, key: 'sanction' }, { header: 'Description', width: 3, key: 'description' }
    ], incidents, { headerColor: C.accent });
  }
  signatures(doc, y, ['Le Surveillant Général', 'Le Parent']);
}

export function bulletin(doc, r, ctx) {
  const { classe, period, stats, subjectStats } = ctx;
  const st = r.student;
  let y = header(doc, `Bulletin de notes — ${period.label}`);
  y = infoGrid(doc, y, [['Nom(s) et prénom(s)', `${st.nom} ${st.prenom}`], ['Matricule', st.matricule], ['Classe', classe.name],
    ['Sexe', st.sexe], ['Né(e) le', [st.date_naissance, st.lieu_naissance].filter(Boolean).join(' à ')], ['Redoublant', st.redoublant ? 'Oui' : 'Non'],
    ['Effectif', stats.effectif], ['Professeur principal', classe.titulaire], ['Parent / Tuteur', st.parent_tel || st.parent_nom]], 3);
  const seqCols = period.type === 'T' ? period.seqs.map((s) => ({ header: `S${s}`, width: 0.55, align: 'center', value: (l) => l.bySeq?.[s] })) : [];
  const lines = [];
  const groups = [...new Set(r.lines.map((l) => l.groupe))].sort();
  for (const g of groups) {
    const gl = r.lines.filter((l) => l.groupe === g);
    lines.push(...gl);
    const sc = gl.filter((l) => l.avg != null);
    const tc = sc.reduce((a, l) => a + l.coef, 0), tp = sc.reduce((a, l) => a + l.total, 0);
    lines.push({ subject: `Groupe ${g}`, _bold: true, _highlight: true, coef: tc || null, total: tp || null, avg: tc ? tp / tc : null, appreciation: '' });
  }
  y = table(doc, y, [
    { header: 'Discipline', width: 2.4, value: (l) => (l._bold ? l.subject : `${l.subject}${l.teacher ? '\n' + l.teacher : ''}`) },
    ...seqCols,
    { header: 'Moy. /20', width: 0.75, align: 'center', bold: true, redBelow: 10, key: 'avg' },
    { header: 'Coef', width: 0.5, align: 'center', key: 'coef', decimals: 0 },
    { header: 'Total', width: 0.7, align: 'center', key: 'total' },
    { header: 'Rang', width: 0.5, align: 'center', key: 'rang', decimals: 0 },
    { header: 'Moy. cl.', width: 0.65, align: 'center', value: (l) => subjectStats.find((s) => s.cs_id === l.cs_id)?.avg },
    { header: 'Appréciation', width: 1.3, key: 'appreciation' }
  ], lines, { fontSize: 7.5 });
  y = ensureSpace(doc, y, 150);
  const L = doc.page.margins.left, W = doc.page.width - L - doc.page.margins.right;
  // Bloc résultats
  const box = (x, w, title, pairs) => {
    doc.roundedRect(x, y, w, 96, 4).lineWidth(0.6).strokeColor(C.line).stroke();
    doc.rect(x, y, w, 16).fill(C.primary);
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#fff').text(title, x + 6, y + 4, { width: w - 12 });
    pairs.forEach(([k, v], i) => {
      doc.font('Helvetica').fontSize(8).fillColor(C.muted).text(k, x + 6, y + 22 + i * 12, { width: w * 0.6 });
      doc.font('Helvetica-Bold').fillColor(C.dark).text(fmtI(v), x + w * 0.6, y + 22 + i * 12, { width: w * 0.4 - 6, align: 'right' });
    });
  };
  const d = r.discipline;
  box(L, W / 3 - 6, 'RÉSULTATS', [['Total des points', r.total_points], ['Total des coefficients', r.total_coef],
    ['Moyenne générale', r.general == null ? null : `${fmt(r.general)} / 20`], ['Rang', r.rang ? `${r.rang}${r.rang === 1 ? 'er' : 'e'}${r.exaequo ? ' ex æquo' : ''} / ${stats.classes}` : null],
    ['Appréciation', r.appreciation]]);
  box(L + W / 3 + 3, W / 3 - 6, 'PROFIL DE LA CLASSE', [['Moyenne de la classe', stats.moyenne], ['Plus forte moyenne', stats.max],
    ['Plus faible moyenne', stats.min], ['Taux de réussite', stats.reussite == null ? null : `${fmt(stats.reussite)} %`], ['Élèves classés', stats.classes]]);
  box(L + (2 * W) / 3 + 6, W / 3 - 6, 'DISCIPLINE', [['Absences justifiées', `${d.abs_j || 0} h`], ['Absences non justifiées', `${d.abs_nj || 0} h`],
    ['Retards', d.retards || 0], ['Consignes', `${d.consignes || 0} h`], ['Sanctions', [d.avertissement ? 'Avert.' : '', d.blame ? 'Blâme' : '', d.exclusion_jours ? `Excl. ${d.exclusion_jours} j` : ''].filter(Boolean).join(', ') || 'Néant']]);
  y += 104;
  doc.roundedRect(L, y, W, 26, 4).fill('#FDF6E7');
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.dark).text(`Décision du conseil de classe : ${r.decision}`, L + 8, y + 9, { width: W - 16 });
  y += 36;
  signatures(doc, y, ['Le Professeur principal', 'Le Parent', doc._settings.chef_titre || "Le Chef d'établissement"]);
}

export function pvClasse(doc, ctx) {
  const { classe, period, subjects, results, stats } = ctx;
  let y = header(doc, `Procès-verbal — ${classe.name}`, period.label);
  const short = (s) => (s.code || s.subject.slice(0, 6));
  y = table(doc, y, [
    { header: 'Rg', width: 0.5, align: 'center', key: 'rang', decimals: 0 },
    { header: 'Noms et prénoms', width: 3.2, value: (r) => `${r.student.nom} ${r.student.prenom}` },
    ...subjects.map((cs) => ({ header: `${short(cs)}\n(${cs.coef})`, width: 0.75, align: 'center', redBelow: 10, value: (r) => r.lines.find((l) => l.cs_id === cs.id)?.avg })),
    { header: 'Moy.', width: 0.8, align: 'center', bold: true, redBelow: 10, key: 'general' },
    { header: 'Décision', width: 2.4, key: 'decision' }
  ], results, { fontSize: 6.5 });
  y = ensureSpace(doc, y, 40);
  y = infoGrid(doc, y, [['Effectif', stats.effectif], ['Classés', stats.classes], ['Admis (≥ seuil)', stats.admis],
    ['Moyenne de la classe', stats.moyenne], ['Écart-type', stats.ecart_type], ['Taux de réussite', stats.reussite == null ? null : `${fmt(stats.reussite)} %`]], 6);
  signatures(doc, y, ['Le Professeur principal', 'Le Censeur', doc._settings.chef_titre || "Le Chef d'établissement"]);
}

export function emploiDuTemps(doc, { title, subtitle, grid, slots, days }) {
  let y = header(doc, title, subtitle);
  y = table(doc, y, [
    { header: 'Horaire', width: 1, bold: true, value: (r) => `${r.slot.start} – ${r.slot.end}` },
    ...days.map((d) => ({ header: DAYS[d], width: 1.6, align: 'center', value: (r) => (r.slot.break ? (r.slot.label || 'Pause') : (grid[d]?.[r.idx] || '')) }))
  ], slots.map((slot, idx) => ({ slot, idx, _highlight: slot.break })), { fontSize: 7.5 });
  signatures(doc, y, ['Le Censeur', doc._settings.chef_titre || "Le Chef d'établissement"]);
}

export function credentialsSheet(doc, items, url) {
  let y = header(doc, 'Fiches des identifiants de connexion', 'Document confidentiel');
  const L = doc.page.margins.left, W = doc.page.width - L - doc.page.margins.right;
  const cw = W / 2 - 6, ch = 108;
  items.forEach((it, i) => {
    if (i % 2 === 0 && i > 0) y += ch + 10;
    if (y + ch > doc.page.height - doc.page.margins.bottom - 30) { doc.addPage(); y = doc.page.margins.top; }
    const x = L + (i % 2) * (cw + 12);
    doc.roundedRect(x, y, cw, ch, 6).dash(3, { space: 3 }).lineWidth(0.8).strokeColor(C.muted).stroke().undash();
    doc.rect(x, y, cw, 20).fill(C.primary);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#fff').text(it.role === 'teacher' ? 'ENSEIGNANT' : it.role === 'discipline' ? 'RESPONSABLE DISCIPLINAIRE' : 'ADMINISTRATEUR', x + 8, y + 6);
    doc.fillColor(C.dark).font('Helvetica-Bold').fontSize(10).text(it.full_name, x + 8, y + 26, { width: cw - 16 });
    doc.font('Helvetica').fontSize(9).fillColor(C.muted).text('Identifiant :', x + 8, y + 46).text('Mot de passe :', x + 8, y + 62);
    doc.font('Courier-Bold').fontSize(11).fillColor(C.dark).text(it.username, x + 85, y + 45).text(it.password, x + 85, y + 61);
    doc.font('Helvetica').fontSize(7).fillColor(C.muted).text(`Connexion : ${url}\nChangez votre mot de passe dès la première connexion. Ne partagez jamais ces identifiants.`, x + 8, y + 80, { width: cw - 16 });
  });
}

export function listeClasse(doc, { classe, students }) {
  let y = header(doc, `Liste de classe — ${classe.name}`);
  y = infoGrid(doc, y, [['Effectif', students.length], ['Garçons', students.filter((s) => s.sexe === 'M').length], ['Filles', students.filter((s) => s.sexe === 'F').length]], 3);
  table(doc, y, [
    { header: 'N°', width: 0.5, align: 'center', decimals: 0, value: (_r, i) => i + 1 }, { header: 'Matricule', width: 1.3, key: 'matricule' },
    { header: 'Noms et prénoms', width: 3.5, value: (r) => `${r.nom} ${r.prenom}` }, { header: 'Sexe', width: 0.6, align: 'center', key: 'sexe' },
    { header: 'Date de naissance', width: 1.3, key: 'date_naissance' }, { header: 'Lieu', width: 1.4, key: 'lieu_naissance' },
    { header: 'Red.', width: 0.6, align: 'center', value: (r) => (r.redoublant ? 'R' : '') }, { header: 'Contact parent', width: 1.5, key: 'parent_tel' }
  ], students);
}
