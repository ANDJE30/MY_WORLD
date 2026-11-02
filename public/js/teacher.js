// Espace enseignant.
import { h, raw, mount, $, $$, icon, toast, fmtNum, kpi, progressBar, empty, seqOptions, periodOptions, DAYS, withBusy } from './ui.js';
import { get, put, openPdf } from './api.js';
import { state, go, setLeaveGuard } from './app.js';
import { notesEditor, timetablePage, timetableHtml, announcementsWidget, periodLabel, periodParam } from './shared.js';
import { mesDocuments, teacherDocsBanner } from './rh.js';

export const routes = [
  { path: 'accueil', title: 'Tableau de bord', short: 'Accueil', icon: 'home', group: 'Mon espace', mobile: true, render: home },
  { path: 'saisie', title: 'Saisie des notes', short: 'Notes', icon: 'edit', group: 'Mon espace', mobile: true, render: saisie },
  { path: 'progression', title: 'Progression annuelle', short: 'Progression', icon: 'target', group: 'Mon espace', mobile: true, render: progression },
  { path: 'releves', title: 'Relevés & exports PDF', short: 'PDF', icon: 'pdf', group: 'Mon espace', render: releves },
  { path: 'documents', title: 'Mes documents & assiduité', short: 'Documents', icon: 'file', group: 'Mon espace', render: mesDocuments },
  { path: 'edt', title: 'Mon emploi du temps', short: 'EDT', icon: 'calendar', group: 'Mon espace', mobile: true, render: (v) => timetablePage(v, { kind: 'teacher', id: state.user.id, title: 'Mon emploi du temps' }) }
];

const loadAssignments = () => get('/teacher/assignments');

async function home(view) {
  const [{ assignments, seq }, ann, tt, banner] = await Promise.all([loadAssignments(), get('/announcements'), get(`/timetable/teacher/${state.user.id}`), teacherDocsBanner()]);
  const eleves = assignments.reduce((a, x) => a + x.effectif, 0);
  const done = assignments.reduce((a, x) => a + Math.min(x.effectif, x.saisies[seq] || 0), 0);
  const validated = assignments.filter((a) => a.validated.includes(seq)).length;
  const pl = assignments.reduce((a, x) => a + x.planned, 0), dn = assignments.reduce((a, x) => a + x.done, 0);
  const today = new Date().getDay() || 7;
  const todays = tt.cells.filter((c) => c.day === today).sort((a, b) => a.slot - b.slot);
  const hour = new Date().getHours();
  mount(view, h`<div class="page-head"><div><h2>${hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'}, ${state.user.full_name.split(' ').slice(-1)[0]} 👋</h2>
    <p>Séquence ${seq} ${periodLabel(seq)} — voici l'état de vos saisies.</p></div>
    <div class="actions"><button class="btn btn-primary" data-go-saisie>${icon('edit')} Saisir des notes</button></div></div>
  ${banner}
  <div class="grid g-4">
    ${kpi('layers', assignments.length, 'Classes / matières', `${eleves} élèves au total`)}
    ${kpi('edit', `${eleves ? Math.round((done / eleves) * 100) : 0} %`, `Notes saisies — S${seq}`, `${done} / ${eleves} notes`, 'gold')}
    ${kpi('checkCircle', `${validated} / ${assignments.length}`, 'Saisies validées', `Séquence ${seq}`, 'blue')}
    ${kpi('target', pl ? `${Math.round((dn / pl) * 100)} %` : '—', 'Couverture du programme', `${dn} leçons faites / ${pl} prévues`)}
  </div>
  <div class="grid g-3 mt">
    <div class="span-2">
      <div class="card"><div class="card-h"><h3>Mes classes</h3><span class="sub">Saisie de la séquence ${seq}</span></div>
      <div class="card-b"><div class="grid g-2">${assignments.length ? assignments.map((a) => {
    const n = Math.min(a.effectif, a.saisies[seq] || 0); const pct = a.effectif ? (n / a.effectif) * 100 : 0;
    return h`<div class="card cls-card"><div class="top"><div class="tag">${a.classe.split(' ')[0]}</div><div style="min-width:0"><h4>${a.classe} — ${a.subject}</h4><div class="sub">Coef. ${a.coef} • ${a.effectif} élèves • ${a.hours_week} h/sem.</div></div></div>
        <div><div class="row small" style="justify-content:space-between"><span>${n} / ${a.effectif} notes</span>${a.validated.includes(seq) ? h`<span class="badge green">${icon('check', 'sm')} Validée</span>` : h`<span class="badge">${Math.round(pct)} %</span>`}</div>${progressBar(pct)}</div>
        <div class="foot"><a class="btn btn-primary btn-sm" href="#/saisie?cs=${a.id}&period=S${seq}">${icon('edit', 'sm')} Saisir</a><a class="btn btn-outline btn-sm" href="#/saisie?cs=${a.id}&period=T${Math.ceil(seq / 2)}">${icon('layers', 'sm')} Trimestre</a><button class="btn btn-outline btn-sm" data-releve="${a.id}">${icon('pdf', 'sm')} Relevé</button>
        <a class="btn btn-ghost btn-sm" href="#/progression?cs=${a.id}">${icon('target', 'sm')} Progression</a></div></div>`;
  }) : empty('Aucune attribution', "L'administrateur ne vous a encore attribué aucune classe.", 'layers')}</div></div></div>
    </div>
    <div class="stack">
      <div class="card"><div class="card-h"><h3>Mes cours aujourd'hui</h3><span class="sub">${DAYS[today]}</span></div>
        ${todays.length ? h`<div class="list">${todays.map((c) => h`<div class="list-item"><div class="ico info">${icon('clock')}</div><div><b>${tt.slots[c.slot].start} – ${tt.slots[c.slot].end}</b><div class="small">${c.classe} • ${c.subject}${c.room ? ' • Salle ' + c.room : ''}</div></div></div>`)}</div>`
    : empty('Pas de cours', "Aucun cours prévu aujourd'hui.", 'calendar')}</div>
      ${announcementsWidget(ann)}
    </div>
  </div>`);
  $('[data-go-saisie]', view).onclick = () => go('saisie', assignments[0] ? { cs: assignments[0].id, period: `S${seq}` } : {});
  $$('[data-releve]', view).forEach((b) => (b.onclick = () => openPdf(`/releve?cs=${b.dataset.releve}&period=S${seq}`)));
}

async function saisie(view, params) {
  const { assignments, seq: cur } = await loadAssignments();
  if (!assignments.length) return mount(view, h`<div class="card">${empty('Aucune attribution', "Aucune classe ne vous est attribuée. Contactez l'administrateur.", 'layers')}</div>`);
  const cs = +params.cs || assignments[0].id, period = periodParam(params, cur);
  mount(view, h`<div data-ed></div>`);
  await notesEditor($('[data-ed]', view), { cs, period, assignments, onChange: (p, c) => go('saisie', { cs: c, period: p }) });
}

async function progression(view, params) {
  const { assignments } = await loadAssignments();
  if (!assignments.length) return mount(view, h`<div class="card">${empty('Aucune attribution', '', 'layers')}</div>`);
  const cs = +params.cs || assignments[0].id;
  const data = await get(`/progression?cs=${cs}`);
  const rows = data.rows;
  const render = () => {
    const tp = rows.reduce((a, r) => a + (+r.planned || 0), 0), td = rows.reduce((a, r) => a + (+r.done || 0), 0);
    mount(view, h`<div class="page-head"><div><h2>Progression annuelle</h2><p>Nombre de leçons prévues et effectivement faites, par séquence.</p></div>
      <div class="actions"><button class="btn btn-outline" data-pdf>${icon('pdf')} Fiche de progression PDF</button></div></div>
    <div class="toolbar"><select class="select" style="width:auto" data-cs>${assignments.map((a) => h`<option value="${a.id}" ${a.id === cs ? raw('selected') : ''}>${a.classe} — ${a.subject}</option>`)}</select></div>
    <div class="grid g-3">
      ${raw(kpi('book', tp, 'Leçons prévues (année)').s)}${raw(kpi('checkCircle', td, 'Leçons faites', '', 'gold').s)}
      <div class="card kpi"><div class="ico blue">${icon('target')}</div><div class="v">${tp ? Math.round((td / tp) * 100) : 0} %</div><div class="l">Taux de couverture</div>${progressBar(tp ? (td / tp) * 100 : 0)}</div>
    </div>
    <div class="card mt"><div class="table-wrap"><table class="t rt"><thead><tr><th>Séquence</th><th class="center">Leçons prévues</th><th class="center">Leçons faites</th><th>Couverture</th><th>Observations</th></tr></thead>
      <tbody>${rows.map((r, i) => {
    const lock = r.status === 'closed' ? raw('disabled') : '';
    const pct = +r.planned ? Math.min(100, (+r.done / +r.planned) * 100) : 0;
    return h`<tr data-i="${i}"><td class="primary-cell"><b>Séquence ${r.seq}</b> ${periodLabel(r.seq)}</td>
          <td class="center" data-label="Prévues"><input class="input num-input" type="number" min="0" max="500" inputmode="numeric" data-k="planned" value="${r.planned}" ${lock}></td>
          <td class="center" data-label="Faites"><input class="input num-input" type="number" min="0" max="500" inputmode="numeric" data-k="done" value="${r.done}" ${lock}></td>
          <td data-label="Couverture" style="min-width:140px"><div class="small">${fmtNum(pct, 0)} %</div>${progressBar(pct, pct < 60 ? 'red' : pct < 85 ? 'gold' : '')}</td>
          <td data-label="Observations"><input class="input" style="min-width:180px;min-height:38px" maxlength="300" data-k="comment" value="${r.comment || ''}" placeholder="Retards, difficultés…" ${lock}></td></tr>`;
  })}</tbody></table></div>
      <div class="card-b row" style="justify-content:flex-end"><button class="btn btn-primary" data-save>${icon('save')} Enregistrer la progression</button></div></div>`);
    $('[data-cs]', view).onchange = (e) => go('progression', { cs: e.target.value });
    $('[data-pdf]', view).onclick = () => openPdf('/progression');
    $('[data-save]', view).onclick = (e) => withBusy(e.currentTarget, async () => {
      try { await put('/progression', { cs, rows }); dirty = false; toast('Progression enregistrée'); render(); } catch (ex) { toast(ex.message, 'err'); }
    });
    view.oninput = (e) => {
      const el = e.target.closest('[data-k]'); if (!el) return;
      const r = rows[+el.closest('tr').dataset.i]; r[el.dataset.k] = el.dataset.k === 'comment' ? el.value : Math.max(0, parseInt(el.value || '0', 10) || 0);
      dirty = true;
      if (el.dataset.k === 'done' && +r.done > +r.planned) el.classList.add('invalid'); else el.classList.remove('invalid');
    };
  };
  let dirty = false;
  setLeaveGuard(() => (dirty ? 'La progression n\'est pas enregistrée. Quitter quand même ?' : null));
  render();
}

async function releves(view) {
  const { assignments, seq } = await loadAssignments();
  mount(view, h`<div class="page-head"><div><h2>Relevés & exports PDF</h2><p>Téléchargez vos relevés de notes officiels, prêts à imprimer.</p></div>
    <div class="actions"><button class="btn btn-outline" data-prog>${icon('target')} Fiche de progression</button><button class="btn btn-outline" data-edt>${icon('calendar')} Mon emploi du temps</button></div></div>
    <div class="toolbar"><label class="label">Période :</label><select class="select" style="width:auto" data-period>${periodOptions(`S${seq}`)}</select></div>
    <div class="card">${assignments.length ? h`<div class="table-wrap"><table class="t rt"><thead><tr><th>Classe</th><th>Matière</th><th class="center">Coef.</th><th class="center">Élèves</th><th></th></tr></thead>
      <tbody>${assignments.map((a) => h`<tr><td class="primary-cell">${a.classe}</td><td data-label="Matière">${a.subject}</td><td class="center" data-label="Coef.">${a.coef}</td><td class="center" data-label="Élèves">${a.effectif}</td>
      <td class="actions-cell"><button class="btn btn-primary btn-sm" data-releve="${a.id}">${icon('pdf', 'sm')} Relevé de notes</button> <button class="btn btn-ghost btn-sm" data-liste="${a.class_id}">${icon('list', 'sm')} Liste de classe</button></td></tr>`)}</tbody></table></div>`
    : empty('Aucune attribution', '', 'layers')}</div>`);
  const period = () => $('[data-period]', view).value;
  $$('[data-releve]', view).forEach((b) => (b.onclick = () => openPdf(`/releve?cs=${b.dataset.releve}&period=${period()}`)));
  $$('[data-liste]', view).forEach((b) => (b.onclick = () => openPdf(`/liste?class_id=${b.dataset.liste}`)));
  $('[data-prog]', view).onclick = () => openPdf('/progression');
  $('[data-edt]', view).onclick = () => openPdf('/timetable');
}
export { timetableHtml, seqOptions, setLeaveGuard };
