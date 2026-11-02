// Chronogramme des dépôts : lecture du fichier importé (Word ou PDF) et repérage des échéances (document, date limite, destinataire).
// L'extraction est une proposition : l'administrateur la vérifie et la corrige avant enregistrement.
import { readDocx } from './docx.js';

/** Lignes de texte d'un PDF reconstituées par position, découpées en cellules d'après les espaces horizontaux. */
export async function readPdfRows(buf) {
  const { getDocumentProxy } = await import('unpdf');
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const rows = [];
  for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) rows.push(...pageRows((await (await pdf.getPage(i)).getTextContent()).items));
  return rows;
}

/**
 * Reconstitue les lignes d'un tableau à partir des fragments de texte positionnés d'une page PDF :
 * 1) fragments → lignes de texte → segments (texte contigu) ;
 * 2) colonnes = zones verticales occupées par les lignes à plusieurs cellules (les couloirs blancs séparent les colonnes) ;
 * 3) une ligne qui ne commence pas un nouvel enregistrement (pas de n° dans la 1re colonne, ou texte en minuscule,
 *    ou complément isolé d'une cellule déjà remplie) prolonge la ligne précédente (cellules sur plusieurs lignes).
 */
export function pageRows(raw) {
  const items = raw.filter((it) => it.str && it.str.trim())
    .map((it) => ({ x: it.transform[4], y: it.transform[5], w: it.width || 0, h: Math.abs(it.height || it.transform[3]) || 10, s: it.str }));
  items.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const it of items) { const l = lines.find((x) => Math.abs(x.y - it.y) < 3); if (l) l.items.push(it); else lines.push({ y: it.y, items: [it] }); }
  lines.sort((a, b) => b.y - a.y);
  for (const l of lines) {
    l.items.sort((a, b) => a.x - b.x);
    l.h = Math.max(...l.items.map((it) => it.h));
    l.segs = [];
    for (const it of l.items) {
      const sg = l.segs[l.segs.length - 1], gap = sg ? it.x - sg.x2 : Infinity;
      if (sg && gap < Math.max(4, it.h * 0.45)) { sg.t += (gap > 1 && !sg.t.endsWith(' ') && !it.s.startsWith(' ') ? ' ' : '') + it.s; sg.x2 = Math.max(sg.x2, it.x + it.w); }
      else l.segs.push({ x1: it.x, x2: it.x + it.w, t: it.s });
    }
    for (const sg of l.segs) sg.t = sg.t.replace(/\s+/g, ' ').trim();
  }
  const plain = () => lines.map((l) => l.segs.map((sg) => sg.t));
  const many = lines.filter((l) => l.segs.length >= 3);
  const multi = many.length >= 3 ? many : lines.filter((l) => l.segs.length >= 2);
  if (multi.length < 2) return plain();
  const cols = [];
  for (const [a, b] of multi.flatMap((l) => l.segs.map((sg) => [sg.x1, sg.x2])).sort((p, q) => p[0] - q[0])) {
    const c = cols[cols.length - 1]; if (c && a <= c[1] + 2) c[1] = Math.max(c[1], b); else cols.push([a, b]);
  }
  if (cols.length < 2) return plain();
  const colOf = (sg) => { const m = (sg.x1 + sg.x2) / 2; let best = 0, d = Infinity; cols.forEach(([a, b], j) => { const dd = m < a ? a - m : m > b ? m - b : 0; if (dd < d) { d = dd; best = j; } }); return best; };
  const wide = (sg) => cols.filter(([a, b]) => sg.x1 < b - 2 && sg.x2 > a + 2).length > 1;
  const isNum = (t) => /^(\d{1,3}|[ivxlc]{1,6})[.)°]?$/i.test(t);
  const firsts = multi.map((l) => l.segs.find((sg) => colOf(sg) === 0)).filter(Boolean);
  const numbered = firsts.length >= 3 && firsts.filter((sg) => isNum(sg.t)).length >= firsts.length * 0.6;
  const top = multi[0].y, bottom = multi[multi.length - 1].y;
  const out = []; let rec = null, lastY = null;
  for (const l of lines) {
    const cells = l.segs.map((sg) => ({ c: colOf(sg), t: sg.t }));
    const inTable = !l.segs.some(wide) && l.y <= top + 1 && l.y >= bottom - l.h * 6 && (lastY == null || lastY - l.y < l.h * 2.6);
    if (!inTable) { rec = null; out.push(l.segs.map((sg) => sg.t)); continue; }
    let cont = false;
    if (rec) {
      if (numbered) cont = !cells.some((x) => x.c === 0);
      else cont = cells.every((x) => /^[\p{Ll}(«"'’\-–—,;:&/]/u.test(x.t)) || (cells.length === 1 && cells[0].c > 0 && !!rec[cells[0].c]);
    }
    if (!cont) { rec = Array(cols.length).fill(''); out.push(rec); }
    for (const x of cells) rec[x.c] = rec[x.c] ? `${rec[x.c]} ${x.t}` : x.t;
    lastY = l.y;
  }
  return out.filter((r) => r.some(Boolean));
}

/** Contenu exploitable d'un fichier : lignes de tableau (cellules) et lignes de texte. */
export async function readChronogramme(buf, filename) {
  const isPdf = buf.subarray(0, 5).toString() === '%PDF-' || /\.pdf$/i.test(filename);
  if (isPdf) return { kind: 'pdf', rows: await readPdfRows(buf) };
  if (buf.subarray(0, 2).toString() !== 'PK') throw Object.assign(new Error('Format non pris en charge : importez un document Word (.docx) ou PDF. Un ancien fichier .doc doit d’abord être enregistré au format .docx.'), { status: 400 });
  const d = readDocx(buf);
  return { kind: 'docx', rows: [...d.tables.flat(), ...d.paragraphs.map((t) => [t])] };
}

/* ---------- Dates ---------- */
const MOIS = { janvier: 1, janv: 1, fevrier: 2, fevr: 2, fev: 2, mars: 3, avril: 4, avr: 4, mai: 5, juin: 6, juillet: 7, juil: 7, aout: 8,
  septembre: 9, sept: 9, sep: 9, octobre: 10, oct: 10, novembre: 11, nov: 11, decembre: 12, dec: 12 };
export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, "'");
const pad = (n) => String(n).padStart(2, '0');
const validIso = (y, m, d) => { const dt = new Date(Date.UTC(y, m - 1, d)); return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : null; };
/** Année d'une date sans millésime : septembre → décembre = 1re année scolaire, janvier → août = 2e. */
const inferYear = (m, y0) => (m >= 9 ? y0 : y0 + 1);
/** Toutes les dates d'un texte (jj/mm/aaaa, « 15 octobre 2026 », « 1er oct. »). */
export function findDates(text, y0) {
  const t = norm(text); const out = [];
  for (const m of t.matchAll(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/g)) {
    const d = +m[1], mo = +m[2]; if (mo < 1 || mo > 12) continue;
    let y = m[3] ? +m[3] : inferYear(mo, y0); if (y < 100) y += 2000;
    const iso = validIso(y, mo, d); if (iso) out.push(iso);
  }
  const moisRe = Object.keys(MOIS).sort((a, b) => b.length - a.length).join('|');
  for (const m of t.matchAll(new RegExp(`\\b(\\d{1,2}|1er)\\s*(${moisRe})\\.?(?:\\s+(\\d{4}))?\\b`, 'g'))) {
    const d = m[1] === '1er' ? 1 : +m[1], mo = MOIS[m[2]];
    const iso = validIso(m[3] ? +m[3] : inferYear(mo, y0), mo, d); if (iso) out.push(iso);
  }
  return [...new Set(out)].sort();
}

/* ---------- Modèles de document ---------- */
export const MODELES = {
  effectifs: 'État des effectifs par classe et par sexe',
  rapport_rentree: 'Rapport de rentrée scolaire',
  resultats: 'Statistiques des résultats scolaires',
  pv_conseils: 'Procès-verbaux des conseils de classe (synthèse)',
  couverture: 'Taux de couverture des programmes et digitalisation',
  assiduite_personnel: 'État de présence et d’assiduité du personnel enseignant',
  discipline: 'Rapport disciplinaire',
  rapport_trimestriel: 'Rapport trimestriel d’activités',
  rapport_annuel: 'Rapport de fin d’année scolaire',
  candidats: 'Liste des candidats aux examens officiels',
  generique: 'Document générique (en-tête officiel, sections à compléter)'
};
export function detectModele(titre) {
  const t = norm(titre);
  if (/candidat|examen/.test(t)) return 'candidats';
  if (/presence|absence|assiduite|pointage/.test(t) && /personnel|enseignant|agent/.test(t)) return 'assiduite_personnel';
  if (/progression|couverture|programme|digitalis/.test(t)) return 'couverture';
  if (/conseil(s)? de classe|proces[- ]verba|\bpv\b/.test(t)) return 'pv_conseils';
  if (/disciplin|incident|exclusion/.test(t)) return 'discipline';
  if (/effectif|fiche statistique|carte scolaire/.test(t)) return 'effectifs';
  if (/rentree/.test(t)) return 'rapport_rentree';
  if (/fin d'annee|fin de l'annee|annuel|bilan de l'annee/.test(t)) return 'rapport_annuel';
  if (/resultat|statistique|sequenti|evaluation|notes|taux de reussite/.test(t)) return 'resultats';
  if (/trimestr/.test(t)) return 'rapport_trimestriel';
  return 'generique';
}

/* ---------- Analyse ---------- */
const HEAD = {
  titre: /document|intitule|designation|nature|activite|piece|libelle|objet|rapport a|travaux/,
  date: /echeance|date|delai|periode|calendrier|limite|depot|chronogramme|quand/,
  dest: /destinataire|service|structure|adresse|autorite|niveau|transmis|instance/
};
const DEST_RE = /\b(delegu|ddes|dres|minesec|inspect|ipr|ipn|ani|drh|proviseur|censeur|ministre|sous[- ]prefet|prefet|apee|cabinet|division)/;
const MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const addDays = (iso, n) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * Propositions d'échéances à partir des lignes lues.
 * ctx = { y0 (1re année), periods: [{ seq, start_date, end_date }], term: 'séquence' | 'situation' }
 */
export function extractEcheances(rows, ctx) {
  const { y0, periods } = ctx; const term = ctx.term || 'séquence';
  let map = null; const out = [];
  for (const cells0 of rows) {
    const cells = cells0.map((c) => String(c || '').replace(/\s+/g, ' ').trim());
    const joined = cells.join(' | ');
    const n = norm(joined);
    // ligne d'en-tête d'un tableau : repérage des colonnes
    const heads = cells.map((c) => norm(c));
    if (!map && heads.filter((h) => HEAD.titre.test(h) || HEAD.date.test(h) || HEAD.dest.test(h)).length >= 2 && !findDates(joined, y0).length) {
      map = { titre: heads.findIndex((h) => HEAD.titre.test(h)), date: heads.findIndex((h) => HEAD.date.test(h) && !HEAD.titre.test(h)), dest: heads.findIndex((h) => HEAD.dest.test(h)) };
      continue;
    }
    // formule de signature (« Fait à Yaoundé, le … », « Bafoussam, le … ») : ce n'est pas une échéance
    if (/^(fait (a|le)\b|[a-z' -]{3,40}, le \d)/.test(n)) continue;
    const inDateCol = map && map.date >= 0 && cells[map.date] ? findDates(cells[map.date], y0) : [];
    const dates = inDateCol.length ? inDateCol : findDates(joined, y0);
    const monthly = /chaque mois|mensuel|tous les mois|fin de (chaque )?mois|du mois precedent/.test(n);
    const perSeq = /chaque (sequence|situation)|fin de (chaque |la )?(sequence|situation)|apres chaque (sequence|situation)|sequentiel/.test(n);
    const perTri = /chaque trimestre|fin de (chaque |du )?trimestre|trimestriel/.test(n);
    const yearEnd = /fin d'annee|fin de l'annee|fin d'exercice|annuel/.test(n);
    const rentree = /\brentree\b/.test(n);
    if (!dates.length && !monthly && !perSeq && !perTri && !yearEnd) continue;
    // intitulé : colonne repérée, sinon la cellule de texte la plus longue (hors dates et numéros)
    const textual = cells.map((c, i) => ({ c, i })).filter(({ c }) => c && !/^\d{1,3}[.)°]?$/.test(c) && findDates(c, y0).length === 0 && !DEST_RE.test(norm(c)));
    let titre = map && map.titre >= 0 && cells[map.titre] ? cells[map.titre] : (textual.sort((a, b) => b.c.length - a.c.length)[0]?.c || cells.join(' '));
    titre = titre.replace(/^\s*(\d{1,3}[.)°-]|[-•*–])\s*/, '').replace(/\s*[:;,]\s*$/, '').trim();
    if (cells.length === 1) titre = titre.replace(/\b(au plus tard|avant|le|du|au|d'ici)\b[^|]*$/i, '').replace(/\s*[-–:,]\s*$/, '').trim() || cells[0];
    if (!titre || titre.length < 4 || titre.length > 220) continue;
    let dest = map && map.dest >= 0 ? cells[map.dest] || '' : (cells.find((c) => DEST_RE.test(norm(c)) && c.length < 80) || '');
    if (dest === titre) dest = '';
    const delai = +(/dans les (\d{1,2}) jours/.exec(n)?.[1] || 0);
    const base = { titre, destinataire: dest.slice(0, 120), modele: detectModele(titre), source: joined.slice(0, 300) };
    if (dates.length) out.push({ ...base, date_limite: dates[dates.length - 1], periodicite: 'ponctuel' });
    else if (monthly) {
      const day = +(/\b(?:le|avant le|au plus tard le)\s+(\d{1,2})\s+(?:de chaque|du mois|de tous)/.exec(n)?.[1] || 0);
      // « le 5 de chaque mois » : dépôt au début du mois pour le mois écoulé ; sinon à la fin de chaque mois
      for (const m of day ? [10, 11, 12, 1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 1, 2, 3, 4, 5, 6]) {
        const y = m >= 9 ? y0 : y0 + 1; const d = day ? Math.min(day, lastDay(y, m)) : lastDay(y, m);
        const lm = day ? (m === 1 ? 12 : m - 1) : m; const ly = lm >= 9 ? y0 : y0 + 1;
        out.push({ ...base, titre: `${titre} — ${MONTHS_FR[lm - 1]} ${ly}`, date_limite: `${y}-${pad(m)}-${pad(d)}`, periodicite: 'mensuel' });
      }
    } else if (perSeq || perTri) {
      const list = perTri ? periods.filter((p) => p.seq % 2 === 0) : periods;
      const endsWithTerm = /(sequence|situation)$/.test(norm(titre));
      for (const p of list) if (p.end_date) out.push({ ...base, titre: perTri ? `${titre} — ${p.seq / 2 === 1 ? '1er' : `${p.seq / 2}e`} trimestre` : endsWithTerm ? `${titre} ${p.seq}` : `${titre} — ${term} ${p.seq}`,
        date_limite: addDays(p.end_date, delai || 7), periodicite: perTri ? 'trimestriel' : 'sequentiel' });
    } else if (yearEnd || rentree) {
      const p = rentree ? periods[0] : periods[periods.length - 1];
      if (p) out.push({ ...base, date_limite: rentree ? addDays(p.start_date, 30) : addDays(p.end_date, delai || 14), periodicite: 'annuel' });
    }
  }
  // dédoublonnage (même intitulé, même date)
  const seen = new Set();
  return out.filter((x) => { const k = `${norm(x.titre)}|${x.date_limite}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.date_limite.localeCompare(b.date_limite));
}
