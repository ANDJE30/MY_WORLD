// Dossier administratif des enseignants : assiduité, pointage, documents administratifs (administration)
// et « Mes documents » (enseignant : lecture, accusé de réception, réponse à une demande d'explication).
import { h, raw, mount, $, $$, icon, toast, modal, fmtNum, fmtDate, fmtTs, kpi, progressBar, empty, formModal, confirmDialog, withBusy, initials, debounce, fonctionsOf } from './ui.js';
import { get, post, put, del, openPdf } from './api.js';
import { state, go, rerender } from './app.js';

/* ---------- Référentiels et petits composants ---------- */
const TYPE_UI = {
  presence: { icon: 'clock', tone: 'green' }, prise_service: { icon: 'checkCircle', tone: 'green' },
  rappel_ordre: { icon: 'bell', tone: 'amber' }, observation: { icon: 'alert', tone: 'red' }, demande_explication: { icon: 'edit', tone: 'blue' }
};
const TYPE_ORDER = ['presence', 'prise_service', 'rappel_ordre', 'observation', 'demande_explication'];
const MOTIFS = ['Absences répétées et non justifiées à ses cours.', 'Retards répétés aux premières heures de cours.', 'Abandon de poste pendant les heures de service.',
  "Non-respect de l'emploi du temps officiel.", 'Retard dans la saisie et la validation des notes de la séquence.', "Retard dans l'exécution de la progression annuelle.",
  'Non-tenue du cahier de textes.', "Absence non justifiée à une réunion pédagogique (conseil d'enseignement, conseil de classe).",
  "Retard dans le dépôt des épreuves d'évaluation.", 'Comportement inapproprié envers un élève, un collègue ou un parent.',
  "Refus d'exécuter une instruction de la hiérarchie.", 'Tenue vestimentaire non conforme à la dignité de la fonction.'];
let REF = null;
const refs = async () => (REF ||= await get('/rh/referentiels'));
const todayIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const shiftDay = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const pct = (v) => (v == null ? '—' : `${fmtNum(v, 1)} %`);
const hrs = (v) => (v == null ? '—' : fmtNum(v, Number.isInteger(v) ? 0 : 1));
const tone = (t) => (t == null ? '' : t >= 90 ? 'green' : t >= 70 ? 'amber' : 'red');
const tauxCell = (t) => h`<div style="min-width:110px"><div class="row small" style="justify-content:space-between"><b class="${t != null && t < 70 ? 'low' : ''}">${pct(t)}</b></div>${progressBar(t ?? 0, t != null && t < 70 ? 'red' : t != null && t < 90 ? 'gold' : '')}</div>`;

/** Périodes de calcul de l'assiduité : année, trimestres, séquences et mois de l'année scolaire. */
function periodChoices() {
  const y = +String(state.school.annee_scolaire).slice(0, 4);
  const months = [];
  for (let i = 0; i < 11; i++) {
    const m = ((8 + i) % 12) + 1, yy = m >= 9 ? y : y + 1;
    months.push([`M${yy}-${String(m).padStart(2, '0')}`, new Date(Date.UTC(yy, m - 1, 15)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase())]);
  }
  return [['A', "Année (cumul à ce jour)"], ['T1', 'Trimestre 1'], ['T2', 'Trimestre 2'], ['T3', 'Trimestre 3'],
    ...[1, 2, 3, 4, 5, 6].map((s) => [`S${s}`, `Séquence ${s}`]), ...months];
}
const periodSelect = (sel, attrs = 'data-period') => h`<select class="select" style="width:auto" ${raw(attrs)} aria-label="Période">${periodChoices().map(([v, l]) => h`<option value="${v}" ${v === sel ? raw('selected') : ''}>${l}</option>`)}</select>`;

export function docStatus(d, forTeacher = false) {
  if (d.status === 'annule') return h`<span class="badge red">Annulé</span>`;
  if (d.status === 'clos') return h`<span class="badge">${icon('lock', 'sm')} Clos</span>`;
  if (d.status === 'repondu') return h`<span class="badge blue">${icon('check', 'sm')} Réponse ${forTeacher ? 'transmise' : 'reçue'}</span>${d.hors_delai ? h` <span class="badge amber">hors délai</span>` : ''}`;
  if (d.en_retard) return h`<span class="badge red">${icon('clock', 'sm')} Délai dépassé</span>`;
  if (d.type === 'demande_explication') return d.ack_at ? h`<span class="badge amber">${icon('clock', 'sm')} Réponse attendue</span>` : h`<span class="badge gold">${forTeacher ? 'Non lu' : 'Non remis'}</span>`;
  return d.ack_at ? h`<span class="badge green">${icon('check', 'sm')} ${forTeacher ? 'Lu' : 'Remis'}</span>` : h`<span class="badge gold">${forTeacher ? 'Non lu' : 'Non remis'}</span>`;
}
const typeBadge = (d) => h`<span class="badge ${TYPE_UI[d.type].tone}">${icon(TYPE_UI[d.type].icon, 'sm')} ${d.type_court}</span>`;
const docSub = (d) => [d.ack_at ? `${d.type === 'demande_explication' || !d.reponse_at ? 'Remis' : 'Reçu'} le ${fmtTs(d.ack_at)}` : '',
  d.type === 'demande_explication' && d.echeance && d.status === 'emis' ? `réponse avant le ${fmtTs(d.echeance)}` : '', d.reponse_at ? `réponse le ${fmtTs(d.reponse_at)}` : ''].filter(Boolean).join(' • ');

/* ========================= Assiduité & pointage ========================= */
export async function assiduite(view, params) {
  const tab = params.tab || 'tableau';
  const T = (k, l, ic) => h`<button class="${tab === k ? 'on' : ''}" data-tab="${k}">${icon(ic, 'sm')} ${l}</button>`;
  mount(view, h`<div class="page-head"><div><h2>Assiduité du personnel enseignant</h2><p>Heures dues d'après l'emploi du temps, pointage journalier, absences et retards, taux d'assiduité.</p></div>
    <div class="actions"><button class="btn btn-outline" data-add-abs>${icon('plus')} Absence / retard</button><a class="btn btn-primary" href="#/assiduite?tab=pointage">${icon('checkCircle')} Pointage du jour</a></div></div>
    <div class="tabs">${T('tableau', "Taux d'assiduité", 'chart')}${T('pointage', 'Pointage journalier', 'checkCircle')}${T('absences', 'Absences & retards', 'clock')}${T('feries', 'Jours non ouvrés', 'calendar')}</div>
    <div data-body></div>`);
  $$('[data-tab]', view).forEach((b) => (b.onclick = () => go('assiduite', { tab: b.dataset.tab })));
  $('[data-add-abs]', view).onclick = async () => { if (await absenceForm()) rerender(); };
  const body = $('[data-body]', view);
  if (tab === 'pointage') return pointage(body, params);
  if (tab === 'absences') return absences(body, params);
  if (tab === 'feries') return feries(body);
  return tableau(body, params);
}

async function tableau(body, params) {
  const period = params.period || 'A';
  const d = await get(`/rh/enseignants?period=${period}`);
  const tot = d.rows.reduce((a, r) => ({ dues: a.dues + r.assiduite.dues, faites: a.faites + r.assiduite.faites, nj: a.nj + r.assiduite.abs_nj, j: a.j + r.assiduite.abs_j, ret: a.ret + r.assiduite.retards }), { dues: 0, faites: 0, nj: 0, j: 0, ret: 0 });
  const tg = tot.dues ? Math.round((tot.faites / tot.dues) * 1000) / 10 : null;
  const q = (params.q || '').toLowerCase();
  const rows = d.rows.filter((r) => !q || `${r.full_name} ${r.specialite || ''} ${r.grade || ''}`.toLowerCase().includes(q));
  mount(body, h`<div class="toolbar">${periodSelect(period)}<div class="grow input-icon">${icon('search', 'sm')}<input class="input" placeholder="Rechercher un enseignant…" value="${params.q || ''}" data-q></div>
      <button class="btn btn-outline" data-pdf>${icon('pdf')} État d'assiduité (PDF)</button></div>
    <p class="small muted" style="margin-top:-6px">${d.range.label} : du ${fmtDate(d.range.from)} au ${fmtDate(d.range.to < todayIso() ? d.range.to : todayIso())} — ${d.jours} jour(s) de classe décomptés (hors week-ends, vacances et jours non ouvrés).</p>
    <div class="grid g-4">
      ${kpi('chart', pct(tg), "Taux d'assiduité global", `${hrs(Math.round(tot.faites))} h effectuées / ${hrs(Math.round(tot.dues))} h dues`, tg != null && tg < 90 ? 'red' : '')}
      ${kpi('clock', hrs(Math.round(tot.nj * 10) / 10), 'Heures d’absence non justifiées', `${hrs(Math.round(tot.j * 10) / 10)} h justifiées`, 'red')}
      ${kpi('bell', tot.ret, 'Retards', 'tous enseignants confondus', 'gold')}
      ${kpi('teacher', d.rows.filter((r) => r.assiduite.taux != null && r.assiduite.taux < 80).length, 'Enseignants sous 80 %', `${d.rows.length} enseignant(s)`, 'blue')}
    </div>
    <div class="card mt">${rows.length ? h`<div class="table-wrap"><table class="t rt"><thead><tr><th>Enseignant</th><th class="num">Heures dues</th><th class="num">Effectuées</th><th class="num">Abs. justifiées</th><th class="num">Abs. non justifiées</th><th class="num">Retards</th><th>Taux d'assiduité</th><th>Documents</th><th></th></tr></thead>
      <tbody>${rows.map((r) => { const a = r.assiduite; return h`<tr>
        <td class="primary-cell" style="min-width:210px"><a href="#/dossier?id=${r.id}" style="color:inherit;text-decoration:none"><div class="row" style="gap:10px;flex-wrap:nowrap"><div class="avatar hide-mobile" style="width:34px;height:34px">${initials(r.full_name)}</div>
          <div><div class="strong">${r.full_name}</div><div class="cell-sub">${[r.grade, r.specialite].filter(Boolean).join(' • ')}</div></div></div></a></td>
        <td data-label="Heures dues" class="num">${hrs(a.dues)}</td><td data-label="Effectuées" class="num">${hrs(a.faites)}</td>
        <td data-label="Abs. justifiées" class="num">${hrs(a.abs_j)}</td><td data-label="Abs. non justifiées" class="num ${a.abs_nj ? 'low' : ''}">${hrs(a.abs_nj)}</td>
        <td data-label="Retards" class="num">${a.retards}${a.retards ? h`<div class="cell-sub">${a.retard_minutes} min</div>` : ''}</td>
        <td data-label="Taux">${tauxCell(a.taux)}<div class="cell-sub">${a.appreciation}</div></td>
        <td data-label="Documents"><div class="chips">${Object.entries(r.documents).map(([k, n]) => h`<span class="chip" title="${REF?.types?.[k]?.titre || k}">${({ presence: 'APE', prise_service: 'CPS', rappel_ordre: 'RO', observation: 'LO', demande_explication: 'DE' })[k]} ×${n}</span>`)}
          ${r.de_attente ? h`<span class="badge amber">${r.de_attente} réponse(s) attendue(s)</span>` : ''}</div></td>
        <td class="actions-cell"><a class="btn btn-outline btn-sm" href="#/dossier?id=${r.id}&period=${period}">${icon('user', 'sm')} Dossier</a></td></tr>`; })}</tbody></table></div>`
    : empty('Aucun enseignant', 'Créez les comptes enseignants et leurs emplois du temps.', 'teacher')}</div>`);
  $('[data-period]', body).onchange = (e) => go('assiduite', { tab: 'tableau', period: e.target.value, q: params.q });
  $('[data-q]', body).oninput = debounce((e) => go('assiduite', { tab: 'tableau', period, q: e.target.value }), 300);
  $('[data-pdf]', body).onclick = () => openPdf(`/assiduite?period=${period}`);
}

/* ---------- Pointage journalier ---------- */
async function pointage(body, params) {
  const date = params.date || todayIso();
  const d = await get(`/rh/pointage?date=${date}`);
  const rows = d.rows.map((r) => ({ ...r }));
  const bySlot = [...new Set(rows.map((r) => r.slot))];
  const future = date > todayIso();
  const notice = d.ferie ? `Jour non ouvré : ${d.ferie}.` : !d.actif ? "Aucun cours n'est prévu ce jour de la semaine." : !d.seq ? 'Cette date est en dehors des séquences (vacances) : elle n’est pas décomptée.' : '';
  const statusSeg = (r, i) => h`<div class="seg" role="radiogroup" aria-label="Présence">${[['present', 'Présent'], ['absence', 'Absent'], ['retard', 'Retard']]
    .map(([k, l]) => h`<button type="button" class="${r.status === k ? 'on' : ''}" data-st="${i}:${k}">${l}</button>`)}</div>`;
  let filter = '';
  const match = (r) => !filter || `${r.teacher} ${r.classe} ${r.subject}`.toLowerCase().includes(filter);
  const draw = () => mount($('[data-grid]', body), rows.length ? h`<div class="table-wrap"><table class="t rt pointage"><thead><tr><th>Classe</th><th>Enseignant</th><th>Présence</th><th>Retard (min)</th><th>Justifié</th><th>Motif</th></tr></thead>
      <tbody>${bySlot.map((sl) => { const its = rows.map((r, i) => [r, i]).filter(([r]) => r.slot === sl && match(r)); if (!its.length) return '';
    return h`<tr class="slot-h"><td colspan="6">${icon('clock', 'sm')} ${its[0][0].start} – ${its[0][0].end}<span class="muted"> • ${its.length} cours</span></td></tr>${its.map(([r, i]) => h`<tr class="${r.status !== 'present' ? 'sel' : ''}">
        <td data-label="Classe"><b>${r.classe}</b><div class="cell-sub">${r.subject}${r.room ? ' • ' + r.room : ''}</div></td>
        <td class="primary-cell">${r.teacher}</td>
        <td data-label="Présence">${statusSeg(r, i)}</td>
        <td data-label="Retard (min)" class="opt">${r.status === 'retard' ? h`<input class="input num-input" type="number" min="1" max="600" style="width:80px" value="${r.minutes || 10}" data-min="${i}">` : h`<span class="muted">—</span>`}</td>
        <td data-label="Justifié" class="opt">${r.status !== 'present' ? h`<label class="switch"><input type="checkbox" data-just="${i}" ${r.justified ? raw('checked') : ''}><span></span></label>` : h`<span class="muted">—</span>`}</td>
        <td data-label="Motif" class="opt">${r.status !== 'present' ? h`<input class="input" style="min-width:160px" maxlength="200" placeholder="Motif (facultatif)" value="${r.motif}" data-motif="${i}">` : ''}</td></tr>`)}`; })}</tbody></table></div>`
    : empty('Aucun cours ce jour', notice || "Aucun cours n'est programmé à l'emploi du temps pour cette journée.", 'calendar'));
  const nAbs = () => rows.filter((r) => r.status === 'absence').length, nRet = () => rows.filter((r) => r.status === 'retard').length;
  mount(body, h`<div class="toolbar"><button class="btn btn-outline btn-icon" data-prev aria-label="Jour précédent">‹</button><input class="input" type="date" style="width:auto" value="${date}" max="${todayIso()}" data-date aria-label="Date">
      <button class="btn btn-outline btn-icon" data-next aria-label="Jour suivant" ${date >= todayIso() ? raw('disabled') : ''}>›</button><button class="btn btn-ghost" data-today>Aujourd'hui</button>
      <div class="grow"></div><span class="small muted" data-count></span><button class="btn btn-outline" data-allp ${!rows.length ? raw('disabled') : ''}>${icon('check')} Tous présents</button>
      <button class="btn btn-primary" data-save ${!rows.length || future ? raw('disabled') : ''}>${icon('save')} Enregistrer le pointage</button></div>
    <div class="alert info mb">${icon('info')}<div class="small"><b>${new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</b>${d.seq ? ` — séquence ${d.seq}` : ''}. ${notice}
      Chaque cours inscrit à l'emploi du temps est présumé assuré : marquez seulement les absences et les retards.</div></div>
    ${d.dayRecords.length ? h`<div class="card mb"><div class="card-h"><h3>Absences saisies pour la journée entière</h3></div><div class="list">${d.dayRecords.map((x) => h`<div class="list-item"><div class="ico warn">${icon('clock')}</div>
      <div><b>${x.teacher}</b> — ${x.kind === 'absence' ? `absence de ${hrs(x.hours)} h` : `retard de ${x.minutes} min`} ${x.justified ? '(justifiée)' : '(non justifiée)'}<div class="meta">${x.motif || ''}</div></div></div>`)}</div></div>` : ''}
    ${rows.length ? h`<div class="toolbar"><div class="grow input-icon">${icon('search', 'sm')}<input class="input" placeholder="Filtrer par enseignant, classe ou matière…" data-filter aria-label="Filtrer"></div></div>` : ''}
    <div class="card" data-grid></div>`);
  const count = () => { $('[data-count]', body).textContent = `${rows.length} cours • ${nAbs()} absence(s) • ${nRet()} retard(s)`; };
  draw(); count();
  $('[data-filter]', body)?.addEventListener('input', debounce((e) => { filter = e.target.value.trim().toLowerCase(); draw(); }, 200));
  $('[data-date]', body).onchange = (e) => e.target.value && go('assiduite', { tab: 'pointage', date: e.target.value });
  $('[data-prev]', body).onclick = () => go('assiduite', { tab: 'pointage', date: shiftDay(date, -1) });
  $('[data-next]', body).onclick = () => go('assiduite', { tab: 'pointage', date: shiftDay(date, 1) });
  $('[data-today]', body).onclick = () => go('assiduite', { tab: 'pointage' });
  $('[data-allp]', body).onclick = () => { rows.forEach((r) => { r.status = 'present'; }); draw(); count(); };
  body.addEventListener('click', (e) => {
    const b = e.target.closest('[data-st]'); if (!b) return;
    const [i, st] = b.dataset.st.split(':'); rows[+i].status = st; if (st === 'retard' && !rows[+i].minutes) rows[+i].minutes = 10;
    draw(); count();
  });
  body.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.min) rows[+t.dataset.min].minutes = +t.value;
    if (t.dataset.motif) rows[+t.dataset.motif].motif = t.value;
  });
  body.addEventListener('change', (e) => { if (e.target.dataset.just) rows[+e.target.dataset.just].justified = e.target.checked; });
  $('[data-save]', body).onclick = (e) => withBusy(e.currentTarget, async () => {
    try {
      const r = await put('/rh/pointage', { date, entries: rows.map((x) => ({ teacher_id: x.teacher_id, slot: x.slot, status: x.status, minutes: x.minutes, justified: x.justified, motif: x.motif })) });
      toast(`Pointage enregistré : ${r.enregistrements} absence(s) ou retard(s)`);
    } catch (ex) { toast(ex.message, 'err'); }
  });
}

/* ---------- Absences et retards ---------- */
async function teachersList() { return (await get('/rh/enseignants?period=A')).rows.map((r) => [r.id, r.full_name]); }
export async function absenceForm(values = {}) {
  const teachers = await teachersList();
  const fields = [
    { name: 'teacher_id', label: 'Enseignant', type: 'select', options: teachers, required: true, full: true },
    { name: 'kind', label: 'Nature', type: 'select', options: [['absence', 'Absence'], ['retard', 'Retard']], placeholder: false },
    { name: 'justified', label: 'Absence ou retard justifié(e)', type: 'checkbox' },
    { name: 'date', label: 'Date (ou début de la période)', type: 'date', required: true, value: todayIso() },
    { name: 'date_fin', label: "Fin de la période d'absence", type: 'date', hint: 'Absence de plusieurs jours : toutes les heures prévues à l’emploi du temps sont décomptées.' },
    { name: 'hours', label: "Heures de cours manquées", type: 'number', min: 0.5, max: 16, step: 0.5, hint: 'Laissez vide pour décompter toutes les heures prévues ce jour-là.' },
    { name: 'minutes', label: 'Durée du retard (minutes)', type: 'number', min: 1, max: 600 },
    { name: 'motif', label: 'Motif / pièce justificative', full: true, placeholder: 'ex. Maladie (certificat médical), convocation officielle…' }];
  return formModal({ title: 'Absence ou retard d’un enseignant', fields, values, size: 'lg', submitLabel: 'Enregistrer',
    onReady: ({ root }) => {
      const upd = () => { const ret = $('[name=kind]', root).value === 'retard';
        $('[name=minutes]', root).closest('.field').classList.toggle('hidden', !ret);
        ['hours', 'date_fin'].forEach((n) => $(`[name=${n}]`, root).closest('.field').classList.toggle('hidden', ret)); };
      $('[name=kind]', root).onchange = upd; upd();
    },
    onSubmit: (d) => post('/rh/absences', d).then((r) => { toast(`${r.enregistrements} enregistrement(s) ajouté(s)`); return r; }) });
}

async function absences(body, params) {
  const period = params.period || 'A';
  const [d, teachers] = await Promise.all([get(`/rh/absences?period=${period}${params.teacher ? '&teacher_id=' + params.teacher : ''}`), teachersList()]);
  mount(body, h`<div class="toolbar">${periodSelect(period)}<select class="select" style="width:auto" data-teacher aria-label="Enseignant"><option value="">Tous les enseignants</option>${teachers.map(([v, l]) => h`<option value="${v}" ${+params.teacher === v ? raw('selected') : ''}>${l}</option>`)}</select>
      <div class="grow"></div><span class="small muted">${d.rows.length} enregistrement(s)</span></div>
    <div class="card">${d.rows.length ? h`<div class="table-wrap"><table class="t rt"><thead><tr><th>Date</th><th>Enseignant</th><th>Nature</th><th>Classe / créneau</th><th>Justifiée</th><th>Motif</th><th></th></tr></thead>
      <tbody>${d.rows.map((x) => h`<tr><td data-label="Date">${fmtDate(x.date)}</td><td class="primary-cell">${x.teacher}</td>
        <td data-label="Nature">${x.kind === 'absence' ? h`<span class="badge red">Absence • ${hrs(x.hours)} h</span>` : h`<span class="badge amber">Retard • ${x.minutes} min</span>`}</td>
        <td data-label="Classe">${[x.classe, x.creneau].filter(Boolean).join(' — ') || 'Journée'}</td>
        <td data-label="Justifiée"><label class="switch"><input type="checkbox" data-just="${x.id}" ${x.justified ? raw('checked') : ''}><span></span></label></td>
        <td data-label="Motif" class="small">${x.motif || '—'}</td>
        <td class="actions-cell"><button class="btn btn-ghost btn-sm btn-icon" data-edit="${x.id}" title="Modifier le motif">${icon('edit', 'sm')}</button><button class="btn btn-ghost btn-sm btn-icon" data-del="${x.id}" title="Supprimer">${icon('trash', 'sm')}</button></td></tr>`)}</tbody></table></div>`
    : empty('Aucune absence ni aucun retard', 'Rien n’a été enregistré sur cette période.', 'checkCircle')}</div>`);
  $('[data-period]', body).onchange = (e) => go('assiduite', { tab: 'absences', period: e.target.value, teacher: params.teacher });
  $('[data-teacher]', body).onchange = (e) => go('assiduite', { tab: 'absences', period, teacher: e.target.value });
  body.addEventListener('change', async (e) => {
    const j = e.target.closest('[data-just]'); if (!j) return;
    const x = d.rows.find((r) => r.id === +j.dataset.just);
    try { await put(`/rh/absences/${x.id}`, { justified: j.checked, motif: x.motif }); x.justified = j.checked; toast(j.checked ? 'Marquée justifiée' : 'Marquée non justifiée'); }
    catch (ex) { toast(ex.message, 'err'); j.checked = !j.checked; }
  });
  body.addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]'), dl = e.target.closest('[data-del]');
    try {
      if (ed) { const x = d.rows.find((r) => r.id === +ed.dataset.edit);
        if (await formModal({ title: `${x.kind === 'absence' ? 'Absence' : 'Retard'} du ${fmtDate(x.date)} — ${x.teacher}`, values: x,
          fields: [{ name: 'justified', label: 'Justifié(e)', type: 'checkbox' }, { name: 'motif', label: 'Motif / pièce justificative', full: true }],
          onSubmit: (v) => put(`/rh/absences/${x.id}`, v) })) rerender(); }
      if (dl && await confirmDialog({ title: 'Supprimer cet enregistrement ?', message: 'Les heures correspondantes seront de nouveau comptées comme effectuées.', danger: true, okLabel: 'Supprimer' })) { await del(`/rh/absences/${dl.dataset.del}`); rerender(); }
    } catch (ex) { toast(ex.message, 'err'); }
  });
}

async function feries(body) {
  const list = await get('/rh/jours-feries');
  mount(body, h`<div class="grid g-3"><div class="card span-2"><div class="card-h"><h3>Jours non ouvrés</h3><span class="sub">${list.length} jour(s)</span></div>
      ${list.length ? h`<div class="list">${list.map((x) => h`<div class="list-item"><div class="ico info">${icon('calendar')}</div><div style="flex:1"><b>${fmtDate(x.date)}</b> — ${x.label}</div>
        <button class="btn btn-ghost btn-sm btn-icon" data-del="${x.date}" aria-label="Retirer">${icon('trash', 'sm')}</button></div>`)}</div>` : empty('Aucun jour non ouvré', '', 'calendar')}</div>
    <div class="card"><div class="card-h"><h3>Ajouter un jour</h3></div><div class="card-b"><form class="stack" data-form>
      <div class="field"><label for="jf_d">Date</label><input class="input" type="date" id="jf_d" name="date" required></div>
      <div class="field"><label for="jf_l">Libellé</label><input class="input" id="jf_l" name="label" maxlength="80" placeholder="ex. Vendredi saint, Fête du Mouton…" required></div>
      <button class="btn btn-primary">${icon('plus')} Ajouter</button></form>
      <p class="small muted mt">Les fêtes légales à date fixe sont ajoutées automatiquement chaque année. Ajoutez les fêtes mobiles (Vendredi saint, Ascension, Djouldé Soumaé, Fête du Mouton) et les journées pédagogiques banalisées : elles ne sont pas comptées dans les heures dues.</p></div></div></div>`);
  $('[data-form]', body).onsubmit = async (e) => {
    e.preventDefault(); const f = new FormData(e.target);
    try { await post('/rh/jours-feries', { date: f.get('date'), label: f.get('label') }); toast('Jour ajouté'); rerender(); } catch (ex) { toast(ex.message, 'err'); }
  };
  $$('[data-del]', body).forEach((b) => (b.onclick = async () => { try { await del(`/rh/jours-feries/${b.dataset.del}`); rerender(); } catch (ex) { toast(ex.message, 'err'); } }));
}

/* ========================= Dossier d'un enseignant ========================= */
export async function hrForm(agent) {
  const R = await refs();
  const FN = fonctionsOf(state.school);
  const fields = [
    { name: 'matricule', label: 'Matricule' }, { name: 'grade', label: 'Grade / corps', type: 'select', options: R.grades.map((g) => [g, g]) },
    { name: 'statut_agent', label: 'Statut', type: 'select', options: R.statuts.map((g) => [g, g]) }, { name: 'diplome', label: 'Diplôme professionnel', placeholder: 'ex. DIPES II, DIPET I, CAPIEMP…' },
    { name: 'fonction', label: 'Fonction', full: true, placeholder: `Par défaut : Enseignant(e)${agent.specialite ? ' de ' + agent.specialite : ''}`,
      hint: `Choisissez une proposition ou saisissez librement (ex. ${FN.ap_titre} de ${agent.specialite || 'Mathématiques'}, ${FN.censeur_titre}, Chef de travaux…).`,
      suggestions: [`${agent.sexe === 'F' ? 'Enseignante' : 'Enseignant'}${agent.specialite ? ' de ' + agent.specialite : ''}`, `${FN.ap_titre}${agent.specialite ? ' de ' + agent.specialite : ''}`,
        FN.censeur_titre, FN.sg_titre, 'Chef de travaux', 'Professeur principal'] },
    { name: 'date_naissance', label: 'Date de naissance', type: 'date' }, { name: 'lieu_naissance', label: 'Lieu de naissance' },
    { name: 'date_prise_service', label: 'Date de prise de service', type: 'date', hint: "Date d'arrivée dans l'établissement" },
    { name: 'acte_affectation', label: "Acte d'affectation", full: true, placeholder: 'ex. la décision n° 0123/MINESEC/CAB du 12/08/2026', maxlength: 250 }];
  if (!R.grades.includes(agent.grade) && agent.grade) fields[1].options.push([agent.grade, agent.grade]);
  return formModal({ title: `Dossier administratif — ${agent.full_name}`, fields, values: agent, size: 'lg', onSubmit: (d) => put(`/rh/enseignants/${agent.id}`, d) });
}

export async function dossier(view, params) {
  const tid = +params.id;
  if (!tid) return go('assiduite');
  const period = params.period || 'A';
  const [d] = await Promise.all([get(`/rh/enseignants/${tid}?period=${period}`), refs()]);
  const a = d.agent, s = d.summary;
  const info = [['Matricule', a.matricule], ['Grade', a.grade], ['Statut', a.statut_agent], ['Diplôme', a.diplome], ['Fonction', a.fonction || `Enseignant${a.sexe === 'F' ? 'e' : ''}${a.specialite ? ' de ' + a.specialite : ''}`],
    ['Né(e) le', a.date_naissance ? `${fmtDate(a.date_naissance)}${a.lieu_naissance ? ' à ' + a.lieu_naissance : ''}` : ''], ['Prise de service', a.date_prise_service ? fmtDate(a.date_prise_service) : ''],
    ["Acte d'affectation", a.acte_affectation], ['Classes', a.classes.join(', ')], ['Téléphone', a.phone]];
  mount(view, h`<div class="page-head"><div class="row" style="gap:14px;flex-wrap:nowrap"><div class="avatar" style="width:52px;height:52px;font-size:18px">${initials(a.full_name)}</div>
      <div><h2>${a.full_name}</h2><p>${[a.grade, a.specialite, a.matricule ? 'Mle ' + a.matricule : ''].filter(Boolean).join(' • ')}</p></div></div>
    <div class="actions"><a class="btn btn-ghost" href="#/assiduite">${icon('arrowRight')} Assiduité</a><button class="btn btn-outline" data-hr>${icon('edit')} Dossier</button>
      <div class="rel" style="display:inline-block"><button class="btn btn-primary" data-new>${icon('file')} Émettre un document ${icon('chevronDown', 'sm')}</button></div></div></div>
  <div class="grid g-3">
    <div class="card"><div class="card-h"><h3>Situation administrative</h3></div><div class="list">${info.map(([k, v]) => h`<div class="list-item" style="padding:9px 16px"><div style="flex:1;min-width:0"><div class="meta">${k}</div><div class="small ${v ? '' : 'muted'}">${v || 'Non renseigné'}</div></div></div>`)}</div></div>
    <div class="card span-2"><div class="card-h"><h3>Assiduité</h3><span class="sub">du ${fmtDate(s.from)} au ${fmtDate(s.to)}</span><div class="actions">${periodSelect(period)}<button class="btn btn-outline btn-sm" data-pdf-att>${icon('pdf', 'sm')} Relevé</button></div></div>
      <div class="card-b"><div class="row" style="gap:24px;align-items:center;flex-wrap:wrap">
        <div class="ring" style="--p:${s.taux ?? 0}"><b>${s.taux == null ? '—' : fmtNum(s.taux, 1)}${s.taux == null ? '' : raw('<small style="font-size:13px">%</small>')}</b></div>
        <div class="grid g-3" style="flex:1;min-width:240px;gap:10px">${[['Heures dues', hrs(s.dues)], ['Effectuées', hrs(s.faites)], ['Appréciation', s.appreciation], ['Abs. justifiées', `${hrs(s.abs_j)} h`], ['Abs. non justifiées', `${hrs(s.abs_nj)} h`], ['Retards', `${s.retards} (${s.retard_minutes} min)`]]
    .map(([k, v]) => h`<div><div class="meta small muted">${k}</div><b>${v}</b></div>`)}</div></div>
        <p class="small muted">Charge hebdomadaire : ${hrs(d.load.week)} h (${d.load.source}). Taux hors absences justifiées : ${pct(s.taux_hors_justifiees)}.</p>
        ${d.parSequence.length ? h`<div class="table-wrap mt"><table class="t"><thead><tr><th>Séquence</th><th class="num">Dues</th><th class="num">Effectuées</th><th class="num">Abs. J</th><th class="num">Abs. NJ</th><th class="num">Retards</th><th>Taux</th></tr></thead>
          <tbody>${d.parSequence.map((x) => h`<tr><td>Séquence ${x.seq}</td><td class="num">${hrs(x.dues)}</td><td class="num">${hrs(x.faites)}</td><td class="num">${hrs(x.abs_j)}</td><td class="num">${hrs(x.abs_nj)}</td><td class="num">${x.retards}</td><td>${tauxCell(x.taux)}</td></tr>`)}</tbody></table></div>` : ''}
      </div>
      <div class="card-h" style="border-top:1px solid var(--border)"><h3>Absences et retards</h3><span class="badge">${s.records.length}</span><div class="actions"><button class="btn btn-ghost btn-sm" data-add-abs>${icon('plus', 'sm')} Ajouter</button></div></div>
      ${s.records.length ? h`<div class="list" style="max-height:280px;overflow:auto">${s.records.slice().reverse().map((x) => h`<div class="list-item"><div class="ico ${x.kind === 'absence' ? 'danger' : 'warn'}">${icon(x.kind === 'absence' ? 'x' : 'clock')}</div>
        <div style="flex:1"><b>${fmtDate(x.date)}</b> — ${x.kind === 'absence' ? `absence ${hrs(x.hours)} h` : `retard ${x.minutes} min`} ${x.justified ? h`<span class="badge green">justifié</span>` : h`<span class="badge red">non justifié</span>`}
          <div class="meta">${[x.classe, x.creneau].filter(Boolean).join(' — ') || 'Journée'}${x.motif ? ' • ' + x.motif : ''}</div></div></div>`)}</div>` : h`<div class="card-b">${empty('Aucune absence', 'Aucune absence ni aucun retard sur la période.', 'checkCircle')}</div>`}
    </div>
  </div>
  <div class="card mt"><div class="card-h"><h3>Documents administratifs</h3><span class="badge">${d.documents.length}</span></div>${docTable(d.documents, { showTeacher: false })}</div>`);
  $('[data-period]', view).onchange = (e) => go('dossier', { id: tid, period: e.target.value });
  $('[data-pdf-att]', view).onclick = () => openPdf(`/assiduite-enseignant?teacher_id=${tid}&period=${period}`);
  $('[data-hr]', view).onclick = async () => { if (await hrForm(a)) { toast('Dossier mis à jour'); rerender(); } };
  $('[data-add-abs]', view).onclick = async () => { if (await absenceForm({ teacher_id: tid })) rerender(); };
  $('[data-new]', view).onclick = (e) => typeMenu(e.currentTarget, (type) => newDocument({ teacherId: tid, type }));
  bindDocTable(view, d.documents);
}

function typeMenu(anchor, onPick) {
  $$('.menu.doc-menu').forEach((x) => x.remove());
  const menu = document.createElement('div'); menu.className = 'menu doc-menu'; menu.style.right = '0';
  mount(menu, h`${TYPE_ORDER.map((k) => h`<button data-t="${k}">${icon(TYPE_UI[k].icon)} ${REF.types[k].titre}</button>`)}`);
  anchor.parentElement.append(menu);
  const off = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', off); } };
  setTimeout(() => document.addEventListener('click', off));
  menu.onclick = (ev) => { const t = ev.target.closest('[data-t]')?.dataset.t; if (t) { menu.remove(); onPick(t); } };
}

/* ========================= Registre des documents administratifs ========================= */
function docTable(rows, { showTeacher = true } = {}) {
  if (!rows.length) return h`<div class="card-b">${empty('Aucun document', 'Les documents émis apparaîtront ici.', 'file')}</div>`;
  return h`<div class="table-wrap"><table class="t rt"><thead><tr><th>Référence</th><th>Date</th><th>Document</th>${showTeacher ? h`<th>Enseignant</th>` : ''}<th>Objet</th><th>Statut</th><th></th></tr></thead>
    <tbody>${rows.map((d) => h`<tr class="${d.status === 'annule' ? 'muted' : ''}"><td class="primary-cell"><span class="mono small" style="white-space:nowrap">${d.reference}</span></td><td data-label="Date" style="white-space:nowrap">${fmtDate(d.date_doc)}</td>
      <td data-label="Document">${typeBadge(d)}</td>${showTeacher ? h`<td data-label="Enseignant"><a href="#/dossier?id=${d.user_id}">${d.agent}</a></td>` : ''}
      <td data-label="Objet" class="small" style="max-width:300px"><div class="clamp2">${(d.faits || d.objet || '').split('\n')[0]}</div></td>
      <td data-label="Statut">${docStatus(d)}<div class="cell-sub">${docSub(d)}</div></td>
      <td class="actions-cell"><button class="btn btn-ghost btn-sm btn-icon" data-pdf="${d.id}" title="PDF">${icon('pdf', 'sm')}</button><button class="btn btn-outline btn-sm" data-view="${d.id}">${icon('eye', 'sm')} Ouvrir</button></td></tr>`)}</tbody></table></div>`;
}
function bindDocTable(view, rows) {
  view.addEventListener('click', async (e) => {
    const p = e.target.closest('[data-pdf]'), v = e.target.closest('[data-view]');
    if (p) openPdf(`/document/${p.dataset.pdf}`);
    if (v) { const changed = await docView(+v.dataset.view); if (changed) rerender(); }
  });
}

export async function documentsRh(view, params) {
  const qs = new URLSearchParams(Object.entries({ type: params.type, status: params.status, teacher_id: params.teacher, annee: params.annee }).filter(([, x]) => x)).toString();
  const [d, R, teachers] = await Promise.all([get(`/rh/documents${qs ? '?' + qs : ''}`), refs(), teachersList()]);
  const all = params.type || params.status || params.teacher ? null : d.rows;
  const count = (k) => d.rows.filter((x) => x.type === k && x.status !== 'annule').length;
  const sel = (name, opts, cur, label) => h`<select class="select" style="width:auto" data-f="${name}" aria-label="${label}"><option value="">${label}</option>${opts.map(([v, l]) => h`<option value="${v}" ${String(cur || '') === String(v) ? raw('selected') : ''}>${l}</option>`)}</select>`;
  mount(view, h`<div class="page-head"><div><h2>Documents administratifs</h2><p>Attestations de présence effective, certificats de prise de service, rappels à l'ordre, lettres d'observation et demandes d'explication du personnel enseignant.</p></div>
    <div class="actions"><button class="btn btn-outline" data-reg>${icon('printer')} Registre (PDF)</button><div class="rel" style="display:inline-block"><button class="btn btn-primary" data-new>${icon('plus')} Nouveau document ${icon('chevronDown', 'sm')}</button></div></div></div>
  ${all ? h`<div class="grid g-auto mb" style="--min:180px">${TYPE_ORDER.map((k) => h`<button class="card kpi" style="text-align:left;cursor:pointer;border:1px solid var(--border)" data-ftype="${k}"><div class="ico ${TYPE_UI[k].tone === 'green' ? '' : TYPE_UI[k].tone === 'amber' ? 'gold' : TYPE_UI[k].tone}">${icon(TYPE_UI[k].icon)}</div><div class="v">${count(k)}</div><div class="l">${R.types[k].court}</div></button>`)}</div>` : ''}
  <div class="toolbar">${sel('type', TYPE_ORDER.map((k) => [k, R.types[k].titre]), params.type, 'Tous les types')}${sel('status', Object.entries(R.status), params.status, 'Tous les statuts')}
    ${sel('teacher', teachers, params.teacher, 'Tous les enseignants')}${sel('annee', d.annees.map((y) => [y, y]).concat([['toutes', 'Toutes les années']]), params.annee || '', `Année ${d.annee === 'toutes' ? '' : d.annee}`)}
    ${qs ? h`<button class="btn btn-ghost" data-reset>${icon('x', 'sm')} Effacer les filtres</button>` : ''}</div>
  <div class="card">${docTable(d.rows)}</div>`);
  $$('[data-f]', view).forEach((s) => (s.onchange = () => go('documents-rh', { ...params, [s.dataset.f]: s.value })));
  $$('[data-ftype]', view).forEach((b) => (b.onclick = () => go('documents-rh', { type: b.dataset.ftype })));
  $('[data-reset]', view)?.addEventListener('click', () => go('documents-rh'));
  $('[data-reg]', view).onclick = () => openPdf(`/registre-documents${params.annee && params.annee !== 'toutes' ? '?annee=' + params.annee : ''}`);
  $('[data-new]', view).onclick = (e) => typeMenu(e.currentTarget, (type) => newDocument({ type, teacherId: +params.teacher || null }));
  bindDocTable(view, d.rows);
}

/** Fiche d'un document : contenu, réponse, suite réservée et actions. Retourne true si le document a changé. */
async function docView(docId) {
  const d = await get(`/rh/documents/${docId}`);
  const DE = d.type === 'demande_explication';
  let changed = false;
  const result = await modal({
    title: `${d.type_label} — ${d.reference}`, size: 'lg',
    body: h`<div class="row mb" style="gap:8px">${typeBadge(d)} ${docStatus(d)}</div>
      <div class="grid g-2" style="gap:10px">${[['Enseignant', d.data.agent?.full_name], ['Date du document', fmtDate(d.date_doc)], ['Remise / réception', d.ack_at ? fmtTs(d.ack_at) : 'Non enregistrée'],
        DE ? ['Délai de réponse', `${d.delai_heures} h${d.echeance ? ' — jusqu’au ' + fmtTs(d.echeance) : ' (à compter de la remise)'}`] : ['Objet', d.objet || d.type_label]]
    .map(([k, v]) => h`<div><div class="small muted">${k}</div><b>${v || '—'}</b></div>`)}</div>
      ${d.type === 'presence' ? h`<div class="alert info mt">${icon('chart')}<div>Période : <b>${d.data.assiduite.label}</b> (du ${fmtDate(d.data.assiduite.from)} au ${fmtDate(d.data.assiduite.to)}) — taux d'assiduité <b>${pct(d.data.assiduite.taux)}</b>, ${hrs(d.data.assiduite.faites)} h effectuées sur ${hrs(d.data.assiduite.dues)} h dues.</div></div>` : ''}
      ${d.faits ? h`<h4 class="mt">${DOC_FACTS_LABEL[d.type]}</h4><div class="card"><div class="card-b small" style="white-space:pre-wrap">${d.faits}</div></div>` : ''}
      ${DE ? h`<h4 class="mt">Réponse de l'intéressé(e)</h4>${d.reponse ? h`<div class="card" style="border-left:4px solid var(--blue-600)"><div class="card-b small" style="white-space:pre-wrap">${d.reponse}</div>
        <div class="card-b small muted" style="padding-top:0">Transmise le ${fmtTs(d.reponse_at)}${d.hors_delai ? ' — hors délai' : ''}</div></div>` : h`<p class="small muted">Aucune réponse en ligne pour l'instant. L'enseignant peut répondre depuis son espace, ou par écrit dans l'espace prévu sur le document.</p>`}` : ''}
      ${d.suite ? h`<h4 class="mt">${d.status === 'annule' ? 'Annulation' : 'Suite réservée'}</h4><div class="card"><div class="card-b small" style="white-space:pre-wrap">${d.suite}</div></div>` : ''}`,
    footer: h`${d.status !== 'annule' ? h`<button class="btn btn-ghost" data-act="cancel" style="color:var(--red-600)">${icon('trash', 'sm')} Annuler</button>` : ''}<div style="flex:1"></div>
      ${d.status === 'emis' && !d.ack_at ? h`<button class="btn btn-outline" data-act="edit">${icon('edit', 'sm')} Modifier</button><button class="btn btn-outline" data-act="remise">${icon('check', 'sm')} Remis en main propre</button>` : ''}
      ${DE && d.status !== 'annule' ? h`<button class="btn btn-outline" data-act="lo">${icon('alert', 'sm')} Lettre d'observation</button>` : ''}
      ${d.status !== 'annule' && d.status !== 'clos' && d.type !== 'presence' && d.type !== 'prise_service' ? h`<button class="btn btn-outline" data-act="suite">${icon('lock', 'sm')} Suite réservée</button>` : ''}
      <button class="btn btn-primary" data-act="pdf">${icon('pdf', 'sm')} PDF</button>`,
    onOpen: ({ root, close }) => {
      root.addEventListener('click', async (e) => {
        const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
        try {
          if (act === 'pdf') openPdf(`/document/${d.id}`);
          if (act === 'remise') {
            const r = await formModal({ title: 'Remise du document en main propre', fields: [{ name: 'date', label: 'Date de remise', type: 'date', value: todayIso(), required: true, hint: DE ? 'Le délai de réponse court à partir de cette date.' : '' }],
              onSubmit: (v) => post(`/rh/documents/${d.id}/remise`, v) });
            if (r) { toast('Remise enregistrée'); close('changed'); }
          }
          if (act === 'edit') { if (await editDocument(d)) close('changed'); }
          if (act === 'suite') {
            const r = await formModal({ title: 'Suite réservée par le chef d’établissement', intro: h`<p class="small muted">Le dossier sera clos. La suite figure sur le document PDF et est visible par l'enseignant.</p>`,
              fields: [{ name: 'suite', label: 'Décision / suite réservée', type: 'textarea', required: true, full: true, max: 2000, placeholder: DE ? 'ex. Explications jugées satisfaisantes : dossier classé sans suite.' : 'ex. Engagement de l’intéressé(e) à se conformer ; dossier classé.' }],
              onSubmit: (v) => post(`/rh/documents/${d.id}/suite`, v) });
            if (r) { toast('Dossier clos'); close('changed'); }
          }
          if (act === 'lo') { close('changed'); await newDocument({ teacherId: d.user_id, type: 'observation', refDoc: d }); }
          if (act === 'cancel') {
            const r = await formModal({ title: 'Annuler ce document ?', intro: h`<div class="alert danger mb">${icon('alert')}<div class="small">Le document reste au registre avec la mention « Annulé » (sa référence n'est pas réattribuée).</div></div>`,
              fields: [{ name: 'motif', label: "Motif de l'annulation", required: true, full: true }], submitLabel: 'Annuler le document', onSubmit: (v) => post(`/rh/documents/${d.id}/annuler`, v) });
            if (r) { toast('Document annulé'); close('changed'); }
          }
        } catch (ex) { toast(ex.message, 'err'); }
      });
    }
  });
  changed = result === 'changed';
  return changed;
}
const DOC_FACTS_LABEL = { presence: 'Mention complémentaire', prise_service: 'Mention complémentaire', rappel_ordre: 'Manquements constatés', observation: 'Faits reprochés', demande_explication: 'Faits reprochés' };

function editDocument(d) {
  const L = REF.types[d.type].lettre;
  return formModal({ title: `Modifier ${d.reference}`, size: 'lg', values: d,
    fields: [{ name: 'date_doc', label: 'Date du document', type: 'date', required: true },
      ...(L ? [{ name: 'objet', label: 'Objet' }] : [{ name: '_', label: ' ', type: 'hidden' }]),
      { name: 'faits', label: DOC_FACTS_LABEL[d.type], type: 'textarea', full: true, max: 4000, required: L },
      ...(d.type === 'demande_explication' ? [{ name: 'delai_heures', label: 'Délai de réponse (heures)', type: 'number', min: 24, max: 720 }] : []),
      { name: 'ampliations', label: 'Ampliations (une par ligne)', type: 'textarea', full: true, max: 500 }].filter((f) => f.type !== 'hidden'),
    onSubmit: (v) => put(`/rh/documents/${d.id}`, v) });
}

/** Émission d'un document : choix de l'enseignant et du type, contenu adapté, aperçu de l'assiduité, faits proposés. */
export async function newDocument({ teacherId = null, type = 'presence', refDoc = null } = {}) {
  const R = await refs();
  const teachers = await teachersList();
  let cur = { teacher: teacherId || teachers[0]?.[0], type };
  if (!cur.teacher) return toast("Aucun enseignant : créez d'abord les comptes.", 'err');
  let created = null;
  await modal({
    title: 'Émettre un document administratif', size: 'lg',
    body: h`<div class="form-grid">
        <div class="field"><label for="nd_t">Enseignant</label><select class="select" id="nd_t" data-teacher>${teachers.map(([v, l]) => h`<option value="${v}" ${v === cur.teacher ? raw('selected') : ''}>${l}</option>`)}</select></div>
        <div class="field"><label for="nd_ty">Document</label><select class="select" id="nd_ty" data-type>${TYPE_ORDER.map((k) => h`<option value="${k}" ${k === cur.type ? raw('selected') : ''}>${R.types[k].titre}</option>`)}</select></div></div>
      <div data-zone class="mt"></div><div class="alert danger mt hidden" data-err></div>`,
    footer: h`<button class="btn btn-outline" data-close>Fermer</button><button class="btn btn-primary" data-submit>${icon('check')} Émettre le document</button>`,
    onOpen: ({ root, close }) => {
      const zone = $('[data-zone]', root), err = $('[data-err]', root);
      const draw = async () => {
        err.classList.add('hidden');
        const t = cur.type, L = R.types[t].lettre;
        mount(zone, h`<div class="empty"><div class="spinner" style="margin:0 auto"></div></div>`);
        const [dos, faits] = await Promise.all([get(`/rh/enseignants/${cur.teacher}?period=${cur.period || 'A'}`), L ? get(`/rh/documents/faits?teacher_id=${cur.teacher}&period=A`) : null]);
        const a = dos.agent;
        const deList = dos.documents.filter((x) => x.type === 'demande_explication' && x.status !== 'annule');
        mount(zone, h`<div class="form-grid">
          <div class="field"><label for="nd_date">Date du document</label><input class="input" type="date" id="nd_date" name="date_doc" value="${todayIso()}"></div>
          ${t === 'presence' ? h`<div class="field"><label for="nd_p">Période couverte</label>${periodSelect(cur.period || 'A', 'id="nd_p" name="period"')}</div>
            <div class="field full"><div class="alert ${dos.summary.taux != null && dos.summary.taux < 80 ? 'warn' : 'info'}">${icon('chart')}<div>Taux d'assiduité calculé : <b>${pct(dos.summary.taux)}</b> (${dos.summary.appreciation}) — ${hrs(dos.summary.faites)} h effectuées sur ${hrs(dos.summary.dues)} h dues,
              ${hrs(dos.summary.abs_j)} h d'absence justifiée, ${hrs(dos.summary.abs_nj)} h non justifiée, ${dos.summary.retards} retard(s).${dos.summary.dues ? '' : ' Aucune heure due sur cette période : vérifiez l’emploi du temps.'}</div></div></div>` : ''}
          ${t === 'prise_service' ? h`<div class="field full"><div class="alert ${a.date_prise_service ? 'info' : 'danger'}">${icon(a.date_prise_service ? 'info' : 'alert')}<div>${a.date_prise_service
            ? h`Prise de service le <b>${fmtDate(a.date_prise_service)}</b>${a.acte_affectation ? h` — affectation par ${a.acte_affectation}` : ''}. Grade : ${a.grade || 'non renseigné'}, matricule : ${a.matricule || 'non renseigné'}.`
            : 'La date de prise de service n’est pas renseignée.'} <button type="button" class="btn btn-outline btn-sm" data-hr>${icon('edit', 'sm')} Compléter le dossier</button></div></div></div>` : ''}
          ${L ? h`<div class="field ${t === 'demande_explication' || t === 'observation' ? '' : 'full'}"><label for="nd_o">Objet</label><input class="input" id="nd_o" name="objet" maxlength="200" value="${R.types[t].titre}"></div>` : ''}
          ${t === 'demande_explication' ? h`<div class="field"><label for="nd_dl">Délai de réponse</label><select class="select" id="nd_dl" name="delai_heures">${[24, 48, 72, 96, 120, 168].map((x) => h`<option value="${x}" ${x === 72 ? raw('selected') : ''}>${x} heures</option>`)}</select></div>` : ''}
          ${t === 'observation' ? h`<div class="field"><label for="nd_ref">En référence à</label><select class="select" id="nd_ref" name="ref_doc_id"><option value="">— Aucune demande d'explication —</option>${deList.map((x) => h`<option value="${x.id}" ${refDoc?.id === x.id ? raw('selected') : ''}>${x.reference} du ${fmtDate(x.date_doc)}</option>`)}</select></div>` : ''}
          <div class="field full"><label for="nd_f">${DOC_FACTS_LABEL[t]}${L ? ' *' : ' (facultatif)'}</label><textarea class="textarea" id="nd_f" name="faits" maxlength="4000" rows="${L ? 6 : 2}" placeholder="${L ? 'Un fait par ligne : date, classe, nature du manquement…' : 'ex. Mention relative à un intérim ou à une fonction particulière'}">${refDoc && t === 'observation' ? refDoc.faits || '' : ''}</textarea>
            ${L ? h`<span class="hint">Cliquez sur une proposition pour l'ajouter.</span>` : ''}</div>
          ${L ? h`<div class="field full"><label>Faits constatés dans la plateforme</label><div class="chips" style="gap:6px">${faits.facts.length ? faits.facts.map((f, i) => h`<button type="button" class="chip" style="cursor:pointer;text-align:left" data-fact="${i}"><b>${f.cat} :</b> ${f.text}</button>`) : h`<span class="small muted">Aucun manquement relevé automatiquement (assiduité, notes, progression).</span>`}</div></div>
            <div class="field full"><label>Motifs usuels</label><div class="chips" style="gap:6px">${MOTIFS.map((m, i) => h`<button type="button" class="chip" style="cursor:pointer" data-motif="${i}">+ ${m}</button>`)}</div></div>` : ''}
          <details class="field full"><summary class="small" style="cursor:pointer">Ampliations</summary><textarea class="textarea mt" name="ampliations" maxlength="500" rows="3">${R.ampliations[t].join('\n')}</textarea></details>
        </div>`);
        const fa = $('[name=faits]', zone);
        const add = (txt) => { fa.value = (fa.value.trim() ? fa.value.trim() + '\n' : '') + txt; fa.focus(); };
        $$('[data-fact]', zone).forEach((b) => (b.onclick = () => add(faits.facts[+b.dataset.fact].text)));
        $$('[data-motif]', zone).forEach((b) => (b.onclick = () => add(MOTIFS[+b.dataset.motif])));
        $('[name=period]', zone)?.addEventListener('change', (e) => { cur.period = e.target.value; draw(); });
        $('[data-hr]', zone)?.addEventListener('click', async () => { if (await hrForm(a)) draw(); });
      };
      $('[data-teacher]', root).onchange = (e) => { cur.teacher = +e.target.value; draw(); };
      $('[data-type]', root).onchange = (e) => { cur.type = e.target.value; refDoc = null; draw(); };
      $('[data-submit]', root).onclick = (e) => withBusy(e.currentTarget, async () => {
        const v = Object.fromEntries($$('[name]', zone).map((x) => [x.name, x.value]));
        try {
          created = await post('/rh/documents', { ...v, teacher_id: cur.teacher, type: cur.type });
          close(true);
        } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
      });
      draw().catch((ex) => { err.textContent = ex.message; err.classList.remove('hidden'); });
    }
  });
  if (!created) return null;
  // ouverture du PDF depuis un clic (évite le blocage des fenêtres surgissantes)
  await modal({ title: 'Document émis', size: 'sm',
    body: h`<div class="empty" style="padding:8px">${icon('checkCircle')}<h4>${R.types[cur.type].titre}</h4><div class="mono small">${created.reference}</div>
      <p class="small muted">Imprimez-le pour signature et cachet, puis remettez-le à l'intéressé(e). Il le retrouve aussi dans son espace enseignant.</p></div>`,
    footer: h`<button class="btn btn-outline" data-close>Fermer</button><button class="btn btn-primary" data-open>${icon('pdf')} Ouvrir le PDF</button>`,
    onOpen: ({ root, close }) => { $('[data-open]', root).onclick = () => { openPdf(`/document/${created.id}`); close(); }; } });
  rerender();
  return created;
}

/* ========================= Espace enseignant : mes documents & mon assiduité ========================= */
export async function mesDocuments(view, params) {
  const period = params.period || 'A';
  const [d, att] = await Promise.all([get('/mes-documents'), get(`/mon-assiduite?period=${period}`)]);
  const s = att.summary;
  mount(view, h`<div class="page-head"><div><h2>Mes documents administratifs</h2><p>Documents émis à votre nom par le chef d'établissement, et votre assiduité.</p></div></div>
    ${d.a_repondre ? h`<div class="alert warn mb">${icon('alert')}<div><b>${d.a_repondre} demande(s) d'explication</b> attend(ent) votre réponse écrite. Répondez dans le délai indiqué.</div></div>` : ''}
    <div class="grid g-3">
      <div class="span-2 stack">${d.rows.length ? d.rows.map((x) => h`<div class="card"><div class="card-b">
        <div class="row" style="justify-content:space-between;gap:10px"><div class="row" style="gap:10px;flex-wrap:nowrap"><div class="doc-ico ${TYPE_UI[x.type].tone}">${icon(TYPE_UI[x.type].icon)}</div>
          <div><b>${x.type_label}</b><div class="small muted mono">${x.reference} • ${fmtDate(x.date_doc)}</div></div></div>${docStatus(x, true)}</div>
        ${x.faits ? h`<div class="small mt" style="white-space:pre-wrap;border-left:3px solid var(--border);padding-left:10px">${x.faits}</div>` : ''}
        ${x.type === 'demande_explication' && x.echeance && x.status === 'emis' ? h`<div class="small mt ${x.en_retard ? 'low' : ''}">${icon('clock', 'sm')} Réponse attendue avant le <b>${fmtTs(x.echeance)}</b>${x.en_retard ? ' — délai dépassé' : ''}</div>` : ''}
        ${x.reponse ? h`<details class="mt"><summary class="small" style="cursor:pointer">Ma réponse (transmise le ${fmtTs(x.reponse_at)})</summary><div class="small mt" style="white-space:pre-wrap">${x.reponse}</div></details>` : ''}
        ${x.suite && x.status === 'clos' ? h`<div class="alert info mt">${icon('info')}<div class="small"><b>Suite réservée :</b> ${x.suite}</div></div>` : ''}
        <div class="row mt" style="gap:8px"><button class="btn btn-outline btn-sm" data-pdf="${x.id}">${icon('pdf', 'sm')} Lire le document</button>
          ${!x.ack_at ? h`<button class="btn btn-outline btn-sm" data-ack="${x.id}">${icon('check', 'sm')} Accuser réception</button>` : h`<span class="small muted">Reçu le ${fmtTs(x.ack_at)}</span>`}
          ${x.type === 'demande_explication' && x.status === 'emis' ? h`<button class="btn btn-primary btn-sm" data-rep="${x.id}">${icon('edit', 'sm')} Répondre</button>` : ''}</div>
      </div></div>`) : h`<div class="card">${empty('Aucun document', "Aucun document administratif n'a été émis à votre nom.", 'file')}</div>`}</div>
      <div class="card"><div class="card-h"><h3>Mon assiduité</h3><div class="actions">${periodSelect(period)}</div></div>
        <div class="card-b"><div class="row" style="gap:18px;align-items:center"><div class="ring" style="--p:${s.taux ?? 0}"><b>${s.taux == null ? '—' : fmtNum(s.taux, 1)}${s.taux == null ? '' : raw('<small style="font-size:13px">%</small>')}</b></div>
          <div class="stack small" style="gap:4px"><div>Heures dues : <b>${hrs(s.dues)}</b></div><div>Effectuées : <b>${hrs(s.faites)}</b></div><div>Absences : <b>${hrs(s.abs_j + s.abs_nj)} h</b> (${hrs(s.abs_nj)} h non justifiées)</div><div>Retards : <b>${s.retards}</b></div><div>Appréciation : <b>${s.appreciation}</b></div></div></div>
          <p class="small muted">Du ${fmtDate(s.from)} au ${fmtDate(s.to)}, d'après votre emploi du temps (${hrs(att.load.week)} h par semaine) et le pointage de l'établissement.</p>
          <button class="btn btn-outline btn-sm btn-block" data-att>${icon('pdf', 'sm')} Mon relevé d'assiduité</button></div>
        ${s.records.length ? h`<div class="list" style="max-height:300px;overflow:auto">${s.records.slice().reverse().map((x) => h`<div class="list-item"><div class="ico ${x.kind === 'absence' ? 'danger' : 'warn'}">${icon(x.kind === 'absence' ? 'x' : 'clock')}</div>
          <div><b>${fmtDate(x.date)}</b> — ${x.kind === 'absence' ? `absence ${hrs(x.hours)} h` : `retard ${x.minutes} min`}<div class="meta">${[x.classe, x.creneau].filter(Boolean).join(' — ') || 'Journée'} • ${x.justified ? 'justifié' : 'non justifié'}</div></div></div>`)}</div>` : ''}
      </div>
    </div>`);
  $('[data-period]', view).onchange = (e) => go('documents', { period: e.target.value });
  $('[data-att]', view).onclick = () => openPdf(`/assiduite-enseignant?period=${period}`);
  view.addEventListener('click', async (e) => {
    const p = e.target.closest('[data-pdf]'), a = e.target.closest('[data-ack]'), r = e.target.closest('[data-rep]');
    try {
      if (p) { openPdf(`/document/${p.dataset.pdf}`); setTimeout(rerender, 1500); }
      if (a) { await post(`/mes-documents/${a.dataset.ack}/accuse`); toast('Accusé de réception enregistré'); rerender(); }
      if (r) { if (await reponseForm(d.rows.find((x) => x.id === +r.dataset.rep))) rerender(); }
    } catch (ex) { toast(ex.message, 'err'); }
  });
}

function reponseForm(x) {
  return modal({
    title: `Réponse à la demande d'explication ${x.reference}`, size: 'lg',
    body: h`<div class="card mb"><div class="card-b small"><b>Faits reprochés :</b><div style="white-space:pre-wrap;margin-top:4px">${x.faits}</div></div></div>
      <div class="field"><label for="rep">Votre réponse écrite</label><textarea class="textarea" id="rep" rows="12" maxlength="6000" placeholder="Monsieur le Proviseur, …"></textarea>
      <span class="hint" data-n>0 / 6000 caractères</span></div>
      <div class="alert info mt">${icon('info')}<div class="small">Votre réponse est transmise au chef d'établissement et figure dans l'espace « Réponse de l'intéressé(e) » du document. <b>Une fois transmise, elle ne peut plus être modifiée.</b></div></div>
      <div class="alert danger mt hidden" data-err></div>`,
    footer: h`<button class="btn btn-outline" data-close>Annuler</button><button class="btn btn-primary" data-send>${icon('send')} Transmettre ma réponse</button>`,
    onOpen: ({ root, close }) => {
      const ta = $('#rep', root), err = $('[data-err]', root);
      // brouillon conservé localement en cas de coupure
      const key = `schoolx:draft:reponse:${x.id}`;
      try { ta.value = localStorage.getItem(key) || ''; } catch { /* stockage indisponible */ }
      const n = () => { $('[data-n]', root).textContent = `${ta.value.length} / 6000 caractères`; try { localStorage.setItem(key, ta.value); } catch { /* ignoré */ } };
      ta.oninput = n; n();
      $('[data-send]', root).onclick = async (e) => {
        if (ta.value.trim().length < 20) { err.textContent = 'Votre réponse est trop courte (20 caractères au moins).'; err.classList.remove('hidden'); return; }
        if (!(await confirmDialog({ title: 'Transmettre votre réponse ?', message: 'Elle sera définitive et ne pourra plus être modifiée.', okLabel: 'Transmettre' }))) return;
        await withBusy(e.currentTarget, async () => {
          try { await put(`/mes-documents/${x.id}/reponse`, { reponse: ta.value }); try { localStorage.removeItem(key); } catch { /* ignoré */ } toast('Réponse transmise au chef d’établissement'); close(true); }
          catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
        });
      };
    }
  });
}

/** Bandeau du tableau de bord enseignant : documents non lus / réponses attendues. */
export async function teacherDocsBanner() {
  try {
    const d = await get('/mes-documents');
    if (!d.a_repondre && !d.non_lus) return '';
    return h`<a class="alert ${d.a_repondre ? 'warn' : 'info'} mb" href="#/documents" style="text-decoration:none;color:inherit">${icon(d.a_repondre ? 'alert' : 'file')}<div>
      ${d.non_lus ? h`<b>${d.non_lus} document(s) administratif(s) non lu(s).</b> ` : ''}${d.a_repondre ? h`<b>${d.a_repondre} demande(s) d'explication</b> attend(ent) votre réponse.` : ''} Ouvrir mes documents ›</div></a>`;
  } catch { return ''; }
}

