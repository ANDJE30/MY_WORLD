// Espace administrateur.
import { h, raw, mount, $, $$, icon, toast, modal, fmtNum, fmtDate, fmtTs, kpi, progressBar, empty, formModal, confirmDialog, seqOptions, periodOptions,
  barsH, barsV, parseCSV, downloadCSV, readFileText, copyText, withBusy, ROLE_LABEL, DAYS, initials, noteClass, debounce, fieldHtml, readForm, colorFor } from './ui.js';
import { get, post, put, del, openPdf, postPdf } from './api.js';
import { state, go, refreshPeriods, setParams, rerender } from './app.js';
import { notesEditor, disciplineEditor, incidentsPage, timetableHtml, periodLabel, studentHistory } from './shared.js';

export const routes = [
  { path: 'dashboard', title: 'Tableau de bord', short: 'Accueil', icon: 'home', group: 'Pilotage', mobile: true, render: dashboard },
  { path: 'calendrier', title: 'Calendrier & clôtures', short: 'Clôtures', icon: 'lock', group: 'Pilotage', mobile: true, render: calendrier },
  { path: 'suivi', title: 'Suivi des saisies', short: 'Saisies', icon: 'progress', group: 'Pilotage', render: suivi },
  { path: 'resultats', title: 'Résultats & bulletins', short: 'Bulletins', icon: 'trophy', group: 'Pilotage', mobile: true, render: resultats },
  { path: 'statistiques', title: 'Statistiques', icon: 'chart', group: 'Pilotage', render: statistiques },
  { path: 'eleves', title: 'Élèves', icon: 'users', group: 'Scolarité', render: eleves },
  { path: 'classes', title: 'Classes', icon: 'layers', group: 'Scolarité', render: classesPage },
  { path: 'matieres', title: 'Matières', icon: 'book', group: 'Scolarité', render: matieres },
  { path: 'attributions', title: 'Attributions', icon: 'swap', group: 'Scolarité', render: attributions },
  { path: 'edt', title: 'Emplois du temps', icon: 'calendar', group: 'Scolarité', render: edt },
  { path: 'enseignants', title: 'Enseignants', icon: 'teacher', group: 'Personnel', render: (v, p) => staff(v, p, 'teacher') },
  { path: 'responsables', title: 'Resp. disciplinaires', icon: 'shield', group: 'Personnel', render: (v, p) => staff(v, p, 'discipline') },
  { path: 'discipline', title: 'Discipline', icon: 'flag', group: 'Vie scolaire', render: disciplineAdmin },
  { path: 'incidents', title: 'Registre des incidents', icon: 'clipboard', group: 'Vie scolaire', render: async (v, p) => incidentsPage(v, p, await get('/classes/mine')) },
  { path: 'annonces', title: 'Annonces', icon: 'megaphone', group: 'Communication', render: annonces },
  { path: 'etablissement', title: 'Établissement', icon: 'building', group: 'Administration', render: etablissement },
  { path: 'audit', title: "Journal d'audit", icon: 'history', group: 'Administration', render: audit },
  { path: 'sauvegarde', title: 'Sauvegarde & année', icon: 'database', group: 'Administration', render: sauvegarde }
];

const classesCache = { list: null };
const getClasses = async (force) => (classesCache.list && !force ? classesCache.list : (classesCache.list = await get('/admin/classes')));
const classSelect = (classes, sel, attrs = '') => h`<select class="select" style="width:auto" ${raw(attrs)}>${classes.map((c) => h`<option value="${c.id}" ${c.id === +sel ? raw('selected') : ''}>${c.name}</option>`)}</select>`;

/* ========================= Tableau de bord ========================= */
async function dashboard(view) {
  const d = await get('/admin/dashboard');
  const c = d.counts, comp = d.completeness;
  const pct = comp.percent;
  mount(view, h`<div class="page-head"><div><h2>Tableau de bord</h2><p>Vue d'ensemble de l'établissement — année ${state.school.annee_scolaire}.</p></div>
    <div class="actions"><a class="btn btn-outline" href="#/resultats">${icon('trophy')} Bulletins</a><a class="btn btn-primary" href="#/calendrier">${icon('lock')} Clôturer une séquence</a></div></div>
  <div class="grid g-4">
    ${kpi('users', c.eleves, 'Élèves inscrits', `${c.garcons} garçons • ${c.filles} filles`)}
    ${kpi('layers', c.classes, 'Classes', `${c.matieres} matières enseignées`, 'gold')}
    ${kpi('teacher', c.enseignants, 'Enseignants', `${c.responsables} responsable(s) disciplinaire(s)`, 'blue')}
    ${kpi('flag', c.incidents, 'Incidents', `Séquence ${d.seq}`, 'red')}
  </div>
  <div class="grid g-3 mt">
    <div class="card"><div class="card-h"><h3>Saisie — séquence ${d.seq}</h3>${periodLabel(d.seq)}</div>
      <div class="card-b" style="display:flex;gap:20px;align-items:center;flex-wrap:wrap">
        <div class="ring" style="--p:${pct}"><b>${pct}%</b></div>
        <div class="stack" style="flex:1;min-width:150px">
          <div><div class="small row" style="justify-content:space-between"><span>Notes validées</span><b>${comp.notesDone}/${comp.notesTotal}</b></div>${progressBar(comp.notesTotal ? (comp.notesDone / comp.notesTotal) * 100 : 0)}</div>
          <div><div class="small row" style="justify-content:space-between"><span>Fiches de discipline</span><b>${comp.discDone}/${comp.discTotal}</b></div>${progressBar(comp.discTotal ? (comp.discDone / comp.discTotal) * 100 : 0, 'gold')}</div>
          <a class="btn btn-outline btn-sm" href="#/suivi?seq=${d.seq}">${icon('eye', 'sm')} Détail par enseignant</a>
        </div></div></div>
    <div class="card span-2"><div class="card-h"><h3>Moyennes par classe</h3><span class="sub">Séquence ${d.refSeq}${d.refSeq !== d.seq ? ' (dernière clôturée)' : ''}</span>
      <div class="actions"><a class="btn btn-ghost btn-sm" href="#/statistiques">Statistiques ${icon('arrowRight', 'sm')}</a></div></div>
      <div class="card-b">${barsV(d.perf.map((p) => ({ label: p.classe, value: p.moyenne })))}
      <div class="legend mt"><span><i style="background:var(--primary)"></i>Moyenne ≥ 10</span><span><i style="background:var(--red-600)"></i>Moyenne &lt; 10</span></div></div></div>
  </div>
  <div class="grid g-3 mt">
    <div class="card"><div class="card-h"><h3>Calendrier</h3></div><div class="list">${d.periods.map((p) => h`<div class="list-item"><div class="ico ${p.status === 'closed' ? '' : p.seq === d.seq ? 'warn' : 'info'}">${icon(p.status === 'closed' ? 'lock' : 'calendar')}</div>
      <div style="flex:1"><b>Séquence ${p.seq}</b> <span class="small muted">(T${Math.ceil(p.seq / 2)})</span><div class="meta">${fmtDate(p.start_date)} → ${fmtDate(p.end_date)}</div></div>${periodLabel(p.seq)}</div>`)}</div></div>
    <div class="card"><div class="card-h"><h3>Points d'attention</h3><span class="badge ${d.alerts.length ? 'amber' : 'green'}">${d.alerts.length}</span></div>
      ${d.alerts.length ? h`<div class="list">${d.alerts.map((a) => h`<a class="list-item" href="${a.link}" style="color:inherit;text-decoration:none"><div class="ico ${a.level}">${icon(a.level === 'info' ? 'info' : 'alert')}</div><div class="small">${a.text}</div></a>`)}</div>`
    : empty('Tout est en ordre', 'Aucune anomalie détectée.', 'checkCircle')}</div>
    <div class="card"><div class="card-h"><h3>Activité récente</h3><div class="actions"><a class="btn btn-ghost btn-sm" href="#/audit">Journal</a></div></div>
      <div class="list">${d.activity.map((a) => h`<div class="list-item"><div class="avatar" style="width:30px;height:30px;font-size:11px">${initials(a.username || '?')}</div>
        <div style="min-width:0"><div class="small"><b>${a.username || 'Système'}</b> — ${a.action.replace(/_/g, ' ').toLowerCase()}</div><div class="meta" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.detail || ''} • ${fmtTs(a.at)}</div></div></div>`)}</div></div>
  </div>`);
}

/* ========================= Établissement ========================= */
async function etablissement(view, params) {
  const s = await get('/admin/settings');
  const tab = params.tab || 'identite';
  const T = (k, l) => h`<button class="${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`;
  const F = {
    identite: [
      { name: 'nom', label: "Nom de l'établissement", required: true, full: true },
      { name: 'nom_court', label: 'Sigle / nom court', placeholder: 'ex. LBY' },
      { name: 'immatriculation', label: 'Matricule / code établissement' },
      { name: 'type', label: "Type d'établissement", type: 'select', placeholder: false, options: ["Lycée d'enseignement général", 'Lycée technique', 'Lycée bilingue', 'Lycée classique et moderne', "Collège d'enseignement secondaire (CES)",
        "Collège d'enseignement technique (CETIC)", 'Collège privé laïc', 'Collège privé confessionnel', 'Lycée polyvalent'].map((x) => [x, x]) },
      { name: 'statut', label: 'Statut', type: 'select', placeholder: false, options: [['Public', 'Public'], ['Privé laïc', 'Privé laïc'], ['Privé confessionnel', 'Privé confessionnel']] },
      { name: 'sous_systeme', label: 'Sous-système', type: 'select', placeholder: false, options: [['Francophone', 'Francophone'], ['Anglophone', 'Anglophone'], ['Bilingue', 'Bilingue']] },
      { name: 'devise', label: "Devise de l'établissement" },
      { name: 'arrete_creation', label: "Acte de création / d'ouverture", full: true },
      { name: 'bp', label: 'Boîte postale' }, { name: 'tel', label: 'Téléphone', type: 'tel' },
      { name: 'email', label: 'E-mail', type: 'email' }, { name: 'site', label: 'Site web' }],
    officiel: [
      { name: 'region', label: 'Région', type: 'select', options: ['Adamaoua', 'Centre', 'Est', 'Extrême-Nord', 'Littoral', 'Nord', 'Nord-Ouest', 'Ouest', 'Sud', 'Sud-Ouest'].map((x) => [x, x]) },
      { name: 'departement', label: 'Département' }, { name: 'ville', label: 'Ville / localité' },
      { name: 'delegation_regionale', label: 'Délégation régionale (suffixe)', placeholder: 'ex. du Centre' },
      { name: 'delegation_departementale', label: 'Délégation départementale (suffixe)', placeholder: 'ex. du Mfoundi' },
      { name: 'ministere', label: 'Ministère (français)', full: true }, { name: 'ministere_en', label: 'Ministère (anglais)', full: true },
      { name: 'chef_titre', label: 'Titre du chef d’établissement', type: 'select', placeholder: false, options: [['Le Proviseur', 'Le Proviseur'], ['Le Directeur', 'Le Directeur'], ['Le Principal', 'Le Principal'], ['The Principal', 'The Principal']] },
      { name: 'chef_nom', label: "Nom du chef d'établissement" }, { name: 'censeur_nom', label: 'Censeur' }, { name: 'surveillant_general', label: 'Surveillant général' }],
    pedagogie: [
      { name: 'annee_scolaire', label: 'Année scolaire', required: true, placeholder: '2026-2027' },
      { name: 'seuil_reussite', label: 'Moyenne de réussite (/20)', type: 'number', min: 0, max: 20, step: 0.5 },
      { name: 'strict_calendar', label: 'Respect strict du calendrier : la saisie d’une séquence n’ouvre qu’à sa date de début', type: 'checkbox', full: true }]
  };
  const days = [1, 2, 3, 4, 5, 6];
  mount(view, h`<div class="page-head"><div><h2>Paramètres de l'établissement</h2><p>Ces informations apparaissent sur tous les documents officiels (bulletins, relevés, fiches).</p></div></div>
    <div class="tabs">${T('identite', 'Identité')}${T('officiel', 'En-tête officiel')}${T('logo', 'Logo')}${T('pedagogie', 'Pédagogie')}${T('horaires', 'Horaires & jours')}</div>
    <div class="card"><div class="card-b">${tab === 'logo' ? h`
      <div class="row" style="gap:24px;align-items:flex-start">
        <div class="logo" style="width:140px;height:140px;border-radius:20px;font-size:40px" data-preview>${s.logo ? h`<img src="${s.logo}" alt="Logo">` : initials(s.nom_court || s.nom)}</div>
        <div class="stack" style="flex:1;min-width:240px">
          <div class="dropzone" data-drop>${icon('upload', 'lg')}<div><b>Cliquez ou déposez votre logo ici</b></div><div class="small muted">PNG ou JPEG, 500 Ko maximum. Fond blanc ou transparent recommandé.</div></div>
          <input type="file" accept="image/png,image/jpeg" class="hidden" data-file>
          <div class="row"><button class="btn btn-primary" data-save-logo disabled>${icon('save')} Enregistrer le logo</button>${s.logo ? h`<button class="btn btn-danger-soft" data-rm-logo>${icon('trash')} Supprimer</button>` : ''}</div>
        </div></div>`
    : tab === 'horaires' ? h`
      <h4 class="mb">Jours de cours</h4><div class="chips mb" style="gap:8px">${days.map((d) => h`<label class="check chip" style="padding:6px 12px"><input type="checkbox" data-day value="${d}" ${s.jours_actifs.includes(d) ? raw('checked') : ''}> ${DAYS[d]}</label>`)}</div>
      <h4 class="mb mt">Créneaux horaires</h4>
      <div class="table-wrap"><table class="t"><thead><tr><th>#</th><th>Début</th><th>Fin</th><th>Pause ?</th><th>Libellé (pause)</th><th></th></tr></thead><tbody data-slots>
        ${s.time_slots.map((t, i) => slotRow(t, i))}</tbody></table></div>
      <div class="row mt"><button class="btn btn-outline btn-sm" data-add-slot>${icon('plus', 'sm')} Ajouter un créneau</button><div style="flex:1"></div><button class="btn btn-primary" data-save-h>${icon('save')} Enregistrer</button></div>
      <div class="alert info mt">${icon('info')}<div>La modification des créneaux n'efface pas les emplois du temps existants. Vérifiez-les après un changement important.</div></div>`
      : h`<form class="form-grid" data-form>${F[tab].map((f) => fieldHtml(f, s[f.name]))}</form>
      <div class="row mt" style="justify-content:flex-end"><button class="btn btn-primary" data-save>${icon('save')} Enregistrer</button></div>`}
    </div></div>`);
  $$('[data-tab]', view).forEach((b) => (b.onclick = () => go('etablissement', { tab: b.dataset.tab })));
  const save = async (btn, payload) => withBusy(btn, async () => {
    try { const ns = await put('/admin/settings', payload); Object.assign(state.school, { nom: ns.nom, nom_court: ns.nom_court, logo: ns.logo, annee_scolaire: ns.annee_scolaire }); toast('Paramètres enregistrés'); }
    catch (ex) { toast(ex.message, 'err'); }
  });
  $('[data-save]', view)?.addEventListener('click', (e) => { const d = readForm($('[data-form]', view), F[tab]); save(e.currentTarget, d); });
  if (tab === 'logo') {
    let data = null;
    const file = $('[data-file]', view), drop = $('[data-drop]', view);
    const load = (f) => {
      if (!f) return; if (!/image\/(png|jpeg)/.test(f.type)) return toast('Format non supporté (PNG ou JPEG)', 'err');
      if (f.size > 500 * 1024) return toast('Image trop lourde (500 Ko max)', 'err');
      const r = new FileReader(); r.onload = () => { data = r.result; mount($('[data-preview]', view), h`<img src="${data}" alt="Aperçu">`); $('[data-save-logo]', view).disabled = false; }; r.readAsDataURL(f);
    };
    drop.onclick = () => file.click(); file.onchange = () => load(file.files[0]);
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); load(e.dataTransfer.files[0]); };
    $('[data-save-logo]', view).onclick = (e) => save(e.currentTarget, { logo: data });
    $('[data-rm-logo]', view)?.addEventListener('click', async (e) => { await save(e.currentTarget, { logo: '' }); rerender(); });
  }
  if (tab === 'horaires') {
    $('[data-add-slot]', view).onclick = () => { const tb = $('[data-slots]', view); const i = tb.children.length; tb.insertAdjacentHTML('beforeend', slotRow({ start: '15:10', end: '16:00' }, i).s); };
    view.onclick = (e) => { const b = e.target.closest('[data-rm-slot]'); if (b) b.closest('tr').remove(); };
    $('[data-save-h]', view).onclick = (e) => {
      const time_slots = $$('[data-slots] tr', view).map((tr) => ({ start: $('[data-k=start]', tr).value, end: $('[data-k=end]', tr).value, break: $('[data-k=break]', tr).checked, label: $('[data-k=label]', tr).value }));
      const jours_actifs = $$('[data-day]:checked', view).map((x) => +x.value);
      save(e.currentTarget, { time_slots, jours_actifs });
    };
  }
}
const slotRow = (t, i) => h`<tr><td class="muted">${i + 1}</td><td><input class="input" type="time" data-k="start" value="${t.start}" style="width:120px"></td><td><input class="input" type="time" data-k="end" value="${t.end}" style="width:120px"></td>
  <td><input type="checkbox" data-k="break" ${t.break ? raw('checked') : ''} style="width:18px;height:18px"></td><td><input class="input" data-k="label" value="${t.label || ''}" placeholder="Récréation" maxlength="40"></td>
  <td><button class="btn btn-ghost btn-sm btn-icon" data-rm-slot title="Supprimer">${icon('trash', 'sm')}</button></td></tr>`;

/* ========================= Calendrier & clôtures ========================= */
async function calendrier(view) {
  await refreshPeriods();
  const ps = state.periods;
  const today = new Date().toISOString().slice(0, 10);
  const triClosed = (t) => ps.filter((p) => Math.ceil(p.seq / 2) === t).every((p) => p.status === 'closed');
  mount(view, h`<div class="page-head"><div><h2>Calendrier & clôtures</h2><p>Définissez les dates des 6 séquences et clôturez-les lorsque toutes les saisies sont terminées. Une séquence clôturée est verrouillée en écriture.</p></div></div>
  <div class="alert info mb">${icon('info')}<div>Règles de clôture : ordre chronologique, date de fin atteinte, toutes les notes saisies et validées par les enseignants, toutes les fiches disciplinaires validées. Une clôture anticipée ou incomplète est possible en la forçant (confirmation par mot de passe, tracée dans le journal d'audit).</div></div>
  <div class="timeline">${[1, 2, 3].map((t) => h`<div class="tri"><div class="tri-h">${icon('calendar')}<h3>Trimestre ${t}</h3><div style="flex:1"></div>
      ${triClosed(t) ? h`<span class="badge green">${icon('lock', 'sm')} Clôturé</span>` : h`<button class="btn btn-outline btn-sm" data-close-tri="${t}">${icon('lock', 'sm')} Clôturer le trimestre</button>`}</div>
    ${ps.filter((p) => Math.ceil(p.seq / 2) === t).map((p) => {
    const ended = p.end_date && p.end_date < today;
    return h`<div class="seq-card"><div class="row1"><h4>Séquence ${p.seq}</h4>${periodLabel(p.seq)}${p.forced ? h`<span class="badge amber" title="Clôture forcée">forcée</span>` : ''}</div>
        <div class="dates">${icon('clock', 'sm')} ${fmtDate(p.start_date)} → ${fmtDate(p.end_date)} ${p.status === 'open' && ended ? h`<span class="badge red">échue</span>` : ''}</div>
        ${p.status === 'closed' ? h`<div class="small muted mt">Clôturée le ${fmtTs(p.closed_at)} par ${p.closed_by}</div>` : ''}
        <div class="acts">${p.status === 'open' ? h`<button class="btn btn-ghost btn-sm" data-dates="${p.seq}">${icon('edit', 'sm')} Dates</button><button class="btn btn-outline btn-sm" data-check="${p.seq}">${icon('eye', 'sm')} État des saisies</button>
          <button class="btn btn-primary btn-sm" data-close="${p.seq}">${icon('lock', 'sm')} Clôturer</button>` : h`<button class="btn btn-ghost btn-sm" data-reopen="${p.seq}">${icon('unlock', 'sm')} Rouvrir</button><a class="btn btn-outline btn-sm" href="#/resultats?period=S${p.seq}">${icon('trophy', 'sm')} Résultats</a>`}</div></div>`;
  })}</div>`)}</div>`);
  const closeFlow = async (seq, tri) => {
    const comp = tri ? null : await get(`/admin/periods/${seq}/check`);
    const s = comp?.summary;
    const ok = await confirmDialog({
      title: tri ? `Clôturer le trimestre ${tri}` : `Clôturer la séquence ${seq}`,
      message: tri ? `Les séquences ${tri * 2 - 1} et ${tri * 2} seront clôturées et verrouillées.` : s.ready ? 'Toutes les saisies sont complètes et validées. La séquence sera verrouillée.'
        : `Attention : saisie incomplète (${s.notesDone}/${s.notesTotal} matières validées, ${s.discDone}/${s.discTotal} fiches disciplinaires). Vous pouvez forcer la clôture.`,
      checkbox: 'Forcer la clôture (même si les conditions ne sont pas remplies)', requirePassword: false, okLabel: 'Clôturer'
    });
    if (!ok) return;
    let password;
    if (ok.checked) { const c = await confirmDialog({ title: 'Clôture forcée', message: 'Cette action sera enregistrée dans le journal d\'audit.', requirePassword: true, okLabel: 'Forcer la clôture', danger: true }); if (!c) return; password = c.password; }
    try {
      await post(tri ? `/admin/trimestres/${tri}/close` : `/admin/periods/${seq}/close`, { force: ok.checked, password });
      toast(tri ? `Trimestre ${tri} clôturé` : `Séquence ${seq} clôturée`); rerender();
    } catch (ex) { toast(ex.message, 'err', 7000); }
  };
  $$('[data-close]', view).forEach((b) => (b.onclick = () => closeFlow(+b.dataset.close)));
  $$('[data-close-tri]', view).forEach((b) => (b.onclick = () => closeFlow(null, +b.dataset.closeTri)));
  $$('[data-reopen]', view).forEach((b) => (b.onclick = async () => {
    const c = await confirmDialog({ title: `Rouvrir la séquence ${b.dataset.reopen}`, message: 'Les enseignants et responsables pourront de nouveau modifier les données. Les bulletins déjà imprimés pourraient devenir obsolètes.', requirePassword: true, okLabel: 'Rouvrir', danger: true });
    if (!c) return;
    try { await post(`/admin/periods/${b.dataset.reopen}/reopen`, { password: c.password }); toast('Séquence rouverte'); rerender(); } catch (ex) { toast(ex.message, 'err'); }
  }));
  $$('[data-dates]', view).forEach((b) => (b.onclick = async () => {
    const p = ps.find((x) => x.seq === +b.dataset.dates);
    if (await formModal({ title: `Dates de la séquence ${p.seq}`, size: 'sm', fields: [{ name: 'start_date', label: 'Début', type: 'date', required: true }, { name: 'end_date', label: 'Fin', type: 'date', required: true }],
      values: p, onSubmit: (d) => put(`/admin/periods/${p.seq}`, d) })) { toast('Dates enregistrées'); rerender(); }
  }));
  $$('[data-check]', view).forEach((b) => (b.onclick = () => go('suivi', { seq: b.dataset.check })));
}

/* ========================= Suivi des saisies ========================= */
async function suivi(view, params) {
  const seq = +params.seq || state.current;
  if (params.cs) {
    mount(view, h`<div class="toolbar"><a class="btn btn-ghost btn-sm" href="#/suivi?seq=${seq}">${icon('arrowRight', 'sm')} Retour au suivi</a></div><div data-ed></div>`);
    return notesEditor($('[data-ed]', view), { cs: +params.cs, seq, onChangeSeq: (s, c) => go('suivi', { cs: c, seq: s }) });
  }
  const c = await get(`/admin/periods/${seq}/check`);
  const filter = params.f || 'all';
  const notes = c.notes.filter((n) => filter === 'all' || (filter === 'todo' ? !(n.validated_at && n.saisies >= n.effectif) : n.validated_at));
  mount(view, h`<div class="page-head"><div><h2>Suivi des saisies</h2><p>Avancement des enseignants et des responsables disciplinaires — séquence ${seq}.</p></div>
    <div class="actions"><select class="select" style="width:auto" data-seq>${seqOptions(seq)}</select>
    <button class="btn btn-outline" data-csv>${icon('download')} Exporter (CSV)</button></div></div>
  <div class="grid g-3">
    ${kpi('edit', `${c.summary.notesDone}/${c.summary.notesTotal}`, 'Matières validées', 'Notes complètes et validées')}
    ${kpi('shield', `${c.summary.discDone}/${c.summary.discTotal}`, 'Fiches disciplinaires validées', '', 'gold')}
    <div class="card kpi"><div class="ico ${c.summary.ready ? '' : 'red'}">${icon(c.summary.ready ? 'checkCircle' : 'alert')}</div><div class="v">${c.summary.percent} %</div><div class="l">${c.summary.ready ? 'Prête à être clôturée' : 'Clôture non recommandée'}</div>${progressBar(c.summary.percent)}</div>
  </div>
  <div class="card mt"><div class="card-h"><h3>Notes par classe et matière</h3><div class="actions"><div class="seg">${[['all', 'Toutes'], ['todo', 'À compléter'], ['done', 'Validées']].map(([k, l]) => h`<button class="${filter === k ? 'on' : ''}" data-f="${k}">${l}</button>`)}</div></div></div>
    <div class="table-wrap"><table class="t rt"><thead><tr><th>Classe</th><th>Matière</th><th>Enseignant</th><th>Saisie</th><th>État</th><th></th></tr></thead>
    <tbody>${notes.map((n) => {
    const pct = n.effectif ? Math.min(100, (n.saisies / n.effectif) * 100) : 0;
    return h`<tr><td class="primary-cell">${n.classe}</td><td data-label="Matière">${n.subject}</td><td data-label="Enseignant">${n.teacher || h`<span class="badge red">Non attribuée</span>`}</td>
      <td data-label="Saisie" style="min-width:150px"><div class="small">${n.saisies}/${n.effectif}</div>${progressBar(pct, pct < 100 ? 'gold' : '')}</td>
      <td data-label="État">${n.validated_at ? h`<span class="badge green">${icon('check', 'sm')} Validée</span>` : pct >= 100 ? h`<span class="badge blue">Complète</span>` : h`<span class="badge amber">En cours</span>`}</td>
      <td class="actions-cell"><a class="btn btn-ghost btn-sm" href="#/suivi?cs=${n.id}&seq=${seq}">${icon('eye', 'sm')} Ouvrir</a></td></tr>`;
  })}</tbody></table></div>${!notes.length ? empty('Rien à afficher', '', 'checkCircle') : ''}</div>
  <div class="card"><div class="card-h"><h3>Fiches disciplinaires</h3></div><div class="table-wrap"><table class="t rt"><thead><tr><th>Classe</th><th>Responsable(s)</th><th>État</th><th></th></tr></thead>
    <tbody>${c.discipline.map((d) => h`<tr><td class="primary-cell">${d.classe}</td><td data-label="Responsable">${d.officers || h`<span class="badge red">Aucun</span>`}</td>
    <td data-label="État">${d.validated_at ? h`<span class="badge green">Validée</span>` : h`<span class="badge amber">En cours</span>`}</td>
    <td class="actions-cell"><a class="btn btn-ghost btn-sm" href="#/discipline?class=${d.class_id}&seq=${seq}">${icon('eye', 'sm')} Ouvrir</a></td></tr>`)}</tbody></table></div></div>`);
  $('[data-seq]', view).onchange = (e) => go('suivi', { seq: e.target.value });
  $$('[data-f]', view).forEach((b) => (b.onclick = () => go('suivi', { seq, f: b.dataset.f })));
  $('[data-csv]', view).onclick = () => downloadCSV(`suivi_S${seq}.csv`, [['Classe', 'Matière', 'Enseignant', 'Saisies', 'Effectif', 'Validée'],
    ...c.notes.map((n) => [n.classe, n.subject, n.teacher || '', n.saisies, n.effectif, n.validated_at ? 'Oui' : 'Non'])]);
}

/* ========================= Résultats & bulletins ========================= */
async function resultats(view, params) {
  const classes = await getClasses(true);
  if (!classes.length) return mount(view, h`<div class="card">${empty('Aucune classe', 'Créez des classes pour consulter les résultats.', 'layers', h`<a class="btn btn-primary" href="#/classes">Créer une classe</a>`)}</div>`);
  const cid = +params.class || classes[0].id, period = params.period || `S${state.periods.filter((p) => p.status === 'closed').pop()?.seq || state.current}`;
  const r = await get(`/admin/results?class_id=${cid}&period=${period}`);
  const st = r.stats;
  mount(view, h`<div class="page-head"><div><h2>Résultats & bulletins</h2><p>Classements, moyennes et documents officiels du conseil de classe.</p></div>
    <div class="actions"><button class="btn btn-outline" data-pv>${icon('file')} Procès-verbal</button><button class="btn btn-primary" data-bull>${icon('printer')} Bulletins de la classe</button></div></div>
  <div class="toolbar">${classSelect(classes, cid, 'data-class')}<select class="select" style="width:auto" data-period>${periodOptions(period)}</select>
    <div class="grow"></div><button class="btn btn-ghost" data-csv>${icon('download')} Export CSV</button></div>
  <div class="grid g-4">
    ${kpi('target', fmtNum(st.moyenne), 'Moyenne de la classe', `Écart-type ${fmtNum(st.ecart_type)}`)}
    ${kpi('checkCircle', st.reussite == null ? '—' : `${fmtNum(st.reussite, 1)} %`, 'Taux de réussite', `${st.admis} / ${st.classes} élèves ≥ ${r.seuil}`, 'gold')}
    ${kpi('trophy', fmtNum(st.max), 'Plus forte moyenne', `Plus faible : ${fmtNum(st.min)}`, 'blue')}
    ${kpi('users', st.effectif, 'Effectif', `${st.garcons} G • ${st.filles} F`)}
  </div>
  <div class="grid g-3 mt">
    <div class="card span-2"><div class="card-h"><h3>Classement — ${r.classe.name}</h3><span class="sub">${r.period.label}</span></div>
      <div class="table-wrap"><table class="t rt"><thead><tr><th class="center">Rang</th><th>Élève</th><th class="num">Moyenne</th><th>Appréciation</th><th>Décision</th><th class="center">Abs. NJ</th><th></th></tr></thead>
      <tbody>${r.results.map((x) => h`<tr><td class="center" data-label="Rang"><b>${x.rang ?? '—'}</b>${x.exaequo ? h`<span class="small muted"> ex</span>` : ''}</td>
        <td class="primary-cell">${x.student.nom} ${x.student.prenom}<div class="cell-sub">${x.student.matricule}</div></td>
        <td class="num ${noteClass(x.general)}" data-label="Moyenne">${fmtNum(x.general)}</td><td data-label="Appréciation">${x.appreciation}</td>
        <td data-label="Décision" class="small">${x.decision}</td><td class="center" data-label="Abs. NJ">${x.discipline.abs_nj || 0}</td>
        <td class="actions-cell"><button class="btn btn-ghost btn-sm" data-one="${x.student.id}" title="Bulletin individuel">${icon('pdf', 'sm')} Bulletin</button></td></tr>`)}</tbody></table></div>
      ${!r.results.length ? empty('Aucun élève', '', 'users') : ''}</div>
    <div class="card"><div class="card-h"><h3>Par matière</h3></div><div class="card-b">${barsH(r.subjectStats.map((s) => ({ label: s.subject, value: s.avg })))}</div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Matière</th><th class="num">Moy.</th><th class="num">Réussite</th></tr></thead><tbody>
      ${r.subjectStats.map((s) => h`<tr><td class="small">${s.subject}<div class="cell-sub">${s.teacher || '—'}</div></td><td class="num ${noteClass(s.avg)}">${fmtNum(s.avg)}</td><td class="num">${s.reussite == null ? '—' : fmtNum(s.reussite, 0) + ' %'}</td></tr>`)}</tbody></table></div></div>
  </div>`);
  $('[data-class]', view).onchange = (e) => go('resultats', { class: e.target.value, period });
  $('[data-period]', view).onchange = (e) => go('resultats', { class: cid, period: e.target.value });
  $('[data-bull]', view).onclick = () => openPdf(`/bulletins?class_id=${cid}&period=${period}`);
  $('[data-pv]', view).onclick = () => openPdf(`/pv?class_id=${cid}&period=${period}`);
  $$('[data-one]', view).forEach((b) => (b.onclick = () => openPdf(`/bulletins?class_id=${cid}&period=${period}&student_id=${b.dataset.one}`)));
  $('[data-csv]', view).onclick = () => downloadCSV(`resultats_${r.classe.name}_${period}.csv`, [['Rang', 'Matricule', 'Nom', 'Prénom', ...r.subjects.map((s) => s.subject), 'Moyenne', 'Décision'],
    ...r.results.map((x) => [x.rang, x.student.matricule, x.student.nom, x.student.prenom, ...x.lines.map((l) => (l.avg == null ? '' : String(l.avg).replace('.', ','))), x.general == null ? '' : String(x.general).replace('.', ','), x.decision])]);
}

/* ========================= Statistiques ========================= */
async function statistiques(view, params) {
  const period = params.period || `S${state.periods.filter((p) => p.status === 'closed').pop()?.seq || state.current}`;
  const s = await get(`/admin/stats?period=${period}`);
  mount(view, h`<div class="page-head"><div><h2>Statistiques</h2><p>Indicateurs de performance de l'établissement.</p></div>
    <div class="actions"><select class="select" style="width:auto" data-period>${periodOptions(period)}</select></div></div>
  <div class="grid g-4">
    ${kpi('target', fmtNum(s.global.moyenne), 'Moyenne générale', `${s.global.n} élèves classés`)}
    ${kpi('checkCircle', s.global.reussite == null ? '—' : `${fmtNum(s.global.reussite, 1)} %`, "Taux de réussite de l'établissement", '', 'gold')}
    ${kpi('user', s.global.garcons.reussite == null ? '—' : `${fmtNum(s.global.garcons.reussite, 1)} %`, 'Réussite des garçons', `${s.global.garcons.n} classés`, 'blue')}
    ${kpi('user', s.global.filles.reussite == null ? '—' : `${fmtNum(s.global.filles.reussite, 1)} %`, 'Réussite des filles', `${s.global.filles.n} classées`, 'red')}
  </div>
  <div class="grid g-2 mt">
    <div class="card"><div class="card-h"><h3>Taux de réussite par classe</h3></div><div class="card-b">${barsH(s.classes.map((c) => ({ label: c.classe, value: c.reussite })), { max: 100, seuil: 50, fmt: (v) => (v == null ? '—' : fmtNum(v, 0) + ' %') })}</div></div>
    <div class="card"><div class="card-h"><h3>Moyenne par matière (établissement)</h3></div><div class="card-b">${barsH(s.subjects.map((x) => ({ label: x.subject, value: x.moyenne })))}</div></div>
  </div>
  <div class="card mt"><div class="card-h"><h3>Par type de matière</h3><span class="sub">Littéraires, scientifiques…</span></div>
    <div class="table-wrap"><table class="t"><thead><tr><th>Type</th><th class="num">Moyenne</th><th class="num">Taux de réussite</th><th class="num">Notes</th><th style="width:40%"></th></tr></thead>
    <tbody>${s.types.map((t) => h`<tr><td><b>${t.type}</b></td><td class="num ${noteClass(t.moyenne)}">${fmtNum(t.moyenne)}</td><td class="num">${t.reussite == null ? '—' : fmtNum(t.reussite, 1) + ' %'}</td><td class="num">${t.n}</td>
      <td>${progressBar(t.reussite || 0, (t.reussite ?? 0) < 50 ? 'red' : '')}</td></tr>`)}</tbody></table></div></div>
  <div class="grid g-2 mt">
    <div class="card"><div class="card-h"><h3>${icon('trophy')} Tableau d'honneur — top 10</h3></div><div class="table-wrap"><table class="t"><thead><tr><th>#</th><th>Élève</th><th>Classe</th><th class="num">Moyenne</th></tr></thead>
      <tbody>${s.top.map((t, i) => h`<tr><td><b>${i + 1}</b></td><td>${t.nom}</td><td>${t.classe}</td><td class="num good">${fmtNum(t.general)}</td></tr>`)}</tbody></table></div>${!s.top.length ? empty('Aucune donnée', '', 'trophy') : ''}</div>
    <div class="card"><div class="card-h"><h3>Synthèse par classe</h3></div><div class="table-wrap"><table class="t"><thead><tr><th>Classe</th><th class="num">Eff.</th><th class="num">Moy.</th><th class="num">Max</th><th class="num">Min</th><th class="num">Réussite</th></tr></thead>
      <tbody>${s.classes.map((c) => h`<tr><td><a href="#/resultats?class=${c.id}&period=${period}">${c.classe}</a></td><td class="num">${c.effectif}</td><td class="num ${noteClass(c.moyenne)}">${fmtNum(c.moyenne)}</td><td class="num">${fmtNum(c.max)}</td><td class="num">${fmtNum(c.min)}</td><td class="num">${c.reussite == null ? '—' : fmtNum(c.reussite, 1) + ' %'}</td></tr>`)}</tbody></table></div></div>
  </div>
  <div class="card mt"><div class="card-h"><h3>Discipline par classe (année)</h3></div><div class="table-wrap"><table class="t"><thead><tr><th>Classe</th><th class="num">Abs. justifiées (h)</th><th class="num">Abs. non justifiées (h)</th><th class="num">Retards</th><th class="num">Incidents</th></tr></thead>
    <tbody>${s.discipline.map((d) => h`<tr><td>${d.classe}</td><td class="num">${d.abs_j}</td><td class="num ${d.abs_nj > 50 ? 'low' : ''}">${d.abs_nj}</td><td class="num">${d.retards}</td><td class="num">${d.incidents}</td></tr>`)}</tbody></table></div></div>`);
  $('[data-period]', view).onchange = (e) => go('statistiques', { period: e.target.value });
}

/* ========================= Élèves ========================= */
const STUDENT_FIELDS = (classes) => [
  { name: 'nom', label: 'Nom(s)', required: true }, { name: 'prenom', label: 'Prénom(s)' },
  { name: 'matricule', label: 'Matricule', hint: 'Laissez vide pour une génération automatique' },
  { name: 'sexe', label: 'Sexe', type: 'select', options: [['M', 'Masculin'], ['F', 'Féminin']] },
  { name: 'date_naissance', label: 'Date de naissance', type: 'date' }, { name: 'lieu_naissance', label: 'Lieu de naissance' },
  { name: 'class_id', label: 'Classe', type: 'select', options: classes.map((c) => [c.id, c.name]) },
  { name: 'redoublant', label: 'Redoublant(e)', type: 'checkbox' },
  { name: 'parent_nom', label: 'Parent / tuteur' }, { name: 'parent_tel', label: 'Téléphone du parent', type: 'tel' }];

async function eleves(view, params) {
  const classes = await getClasses(true);
  const cid = params.class || '';
  const q = params.q || '';
  const list = await get(`/admin/students?${cid ? 'class_id=' + cid + '&' : ''}${q ? 'q=' + encodeURIComponent(q) : ''}`);
  const sel = new Set();
  mount(view, h`<div class="page-head"><div><h2>Élèves</h2><p>${list.length} élève(s) affiché(s).</p></div>
    <div class="actions"><button class="btn btn-outline" data-import>${icon('upload')} Importer (CSV/Excel)</button><button class="btn btn-primary" data-add>${icon('plus')} Nouvel élève</button></div></div>
  <div class="toolbar"><select class="select" style="width:auto" data-class><option value="">Toutes les classes</option><option value="none" ${cid === 'none' ? raw('selected') : ''}>Sans classe</option>${classes.map((c) => h`<option value="${c.id}" ${String(c.id) === cid ? raw('selected') : ''}>${c.name} (${c.effectif})</option>`)}</select>
    <div class="grow input-icon">${icon('search', 'sm')}<input class="input" placeholder="Rechercher par nom ou matricule…" value="${q}" data-q></div>
    <button class="btn btn-ghost" data-csv>${icon('download')} Export</button>${cid && cid !== 'none' ? h`<button class="btn btn-ghost" data-liste>${icon('pdf')} Liste PDF</button>` : ''}</div>
  <div class="card"><div class="card-h hidden" data-bulk><b data-nsel></b><div class="actions"><button class="btn btn-outline btn-sm" data-transfer>${icon('swap', 'sm')} Changer de classe</button><button class="btn btn-danger-soft btn-sm" data-bdel>${icon('trash', 'sm')} Supprimer</button></div></div>
    ${list.length ? h`<div class="table-wrap"><table class="t rt"><thead><tr><th style="width:36px"><input type="checkbox" data-all aria-label="Tout sélectionner"></th><th>Élève</th><th>Matricule</th><th>Classe</th><th class="center">Sexe</th><th>Naissance</th><th>Parent</th><th></th></tr></thead>
    <tbody>${list.map((s) => h`<tr data-id="${s.id}"><td class="check-cell"><input type="checkbox" data-sel="${s.id}" aria-label="Sélectionner"></td>
      <td class="primary-cell">${s.nom} ${s.prenom} ${s.redoublant ? h`<span class="badge amber">R</span>` : ''}</td><td data-label="Matricule" class="mono small">${s.matricule}</td>
      <td data-label="Classe">${s.classe || h`<span class="badge">—</span>`}</td><td class="center" data-label="Sexe">${s.sexe || '—'}</td>
      <td data-label="Naissance" class="small">${s.date_naissance ? fmtDate(s.date_naissance) : '—'}${s.lieu_naissance ? ' à ' + s.lieu_naissance : ''}</td>
      <td data-label="Parent" class="small">${s.parent_nom || ''}${s.parent_tel ? h`<div class="cell-sub">${s.parent_tel}</div>` : ''}</td>
      <td class="actions-cell"><button class="btn btn-ghost btn-sm btn-icon" data-hist="${s.id}" title="Discipline">${icon('shield', 'sm')}</button><button class="btn btn-ghost btn-sm btn-icon" data-edit="${s.id}" title="Modifier">${icon('edit', 'sm')}</button><button class="btn btn-ghost btn-sm btn-icon" data-del="${s.id}" title="Supprimer">${icon('trash', 'sm')}</button></td></tr>`)}</tbody></table></div>`
    : empty('Aucun élève', 'Ajoutez des élèves un par un ou importez une liste depuis Excel (CSV).', 'users', h`<button class="btn btn-primary" data-import2>${icon('upload')} Importer une liste</button>`)}</div>`);
  const reload = () => go('eleves', { class: cid, q: $('[data-q]', view)?.value || '' });
  $('[data-class]', view).onchange = (e) => go('eleves', { class: e.target.value, q });
  $('[data-q]', view).oninput = debounce((e) => go('eleves', { class: cid, q: e.target.value }), 400);
  const add = async (s) => {
    const f = STUDENT_FIELDS(classes);
    if (await formModal({ title: s ? 'Modifier un élève' : 'Nouvel élève', fields: f, values: s || { class_id: cid !== 'none' ? cid : '' }, size: 'lg',
      onSubmit: (d) => (s ? put(`/admin/students/${s.id}`, { ...d, matricule: d.matricule || s.matricule }) : post('/admin/students', d)) })) { toast(s ? 'Élève modifié' : 'Élève ajouté'); reload(); }
  };
  $('[data-add]', view).onclick = () => add();
  $('[data-import]', view).onclick = () => importStudents(classes, cid).then((x) => x && reload());
  $('[data-import2]', view)?.addEventListener('click', () => importStudents(classes, cid).then((x) => x && reload()));
  $('[data-liste]', view)?.addEventListener('click', () => openPdf(`/liste?class_id=${cid}`));
  $('[data-csv]', view).onclick = () => downloadCSV('eleves.csv', [['matricule', 'nom', 'prenom', 'sexe', 'date_naissance', 'lieu_naissance', 'classe', 'redoublant', 'parent_nom', 'parent_tel'],
    ...list.map((s) => [s.matricule, s.nom, s.prenom, s.sexe, s.date_naissance, s.lieu_naissance, s.classe, s.redoublant ? 'oui' : 'non', s.parent_nom, s.parent_tel])]);
  const updBulk = () => { $('[data-bulk]', view).classList.toggle('hidden', !sel.size); $('[data-nsel]', view).textContent = `${sel.size} élève(s) sélectionné(s)`; };
  view.addEventListener('change', (e) => {
    if (e.target.matches('[data-sel]')) { e.target.checked ? sel.add(+e.target.dataset.sel) : sel.delete(+e.target.dataset.sel); e.target.closest('tr').classList.toggle('sel', e.target.checked); updBulk(); }
    if (e.target.matches('[data-all]')) { $$('[data-sel]', view).forEach((c) => { c.checked = e.target.checked; c.closest('tr').classList.toggle('sel', c.checked); e.target.checked ? sel.add(+c.dataset.sel) : sel.delete(+c.dataset.sel); }); updBulk(); }
  });
  view.addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]'), dl = e.target.closest('[data-del]'), hi = e.target.closest('[data-hist]');
    if (ed) add(list.find((s) => s.id === +ed.dataset.edit));
    if (hi) studentHistory(+hi.dataset.hist);
    if (dl) {
      const s = list.find((x) => x.id === +dl.dataset.del);
      if (await confirmDialog({ title: 'Supprimer cet élève ?', message: `${s.nom} ${s.prenom} et toutes ses notes et données disciplinaires seront définitivement supprimés.`, danger: true, okLabel: 'Supprimer' })) {
        try { await del(`/admin/students/${s.id}`); toast('Élève supprimé'); reload(); } catch (ex) { toast(ex.message, 'err'); }
      }
    }
  });
  $('[data-transfer]', view).onclick = async () => {
    const r = await formModal({ title: `Changer de classe (${sel.size} élève(s))`, size: 'sm', fields: [{ name: 'class_id', label: 'Nouvelle classe', type: 'select', placeholder: '— Aucune classe —', options: classes.map((c) => [c.id, c.name]) }],
      onSubmit: (d) => post('/admin/students/bulk', { action: 'transfer', ids: [...sel], class_id: d.class_id || null }) });
    if (r) { toast('Élèves transférés'); reload(); }
  };
  $('[data-bdel]', view).onclick = async () => {
    if (await confirmDialog({ title: `Supprimer ${sel.size} élève(s) ?`, message: 'Toutes leurs notes et données disciplinaires seront perdues.', danger: true, okLabel: 'Supprimer' })) {
      try { await post('/admin/students/bulk', { action: 'delete', ids: [...sel] }); toast('Élèves supprimés'); reload(); } catch (ex) { toast(ex.message, 'err'); }
    }
  };
}

async function importStudents(classes, cid) {
  let rows = [];
  return modal({
    title: 'Importer des élèves', size: 'lg',
    body: h`<ol class="small" style="margin-top:0;padding-left:18px"><li>Téléchargez le modèle et remplissez-le dans Excel (une ligne par élève).</li><li>Enregistrez-le au format <b>CSV (séparateur point-virgule)</b>.</li><li>Déposez le fichier ci-dessous, vérifiez l'aperçu puis importez.</li></ol>
      <div class="row mb"><button class="btn btn-outline btn-sm" data-tpl>${icon('download', 'sm')} Télécharger le modèle</button></div>
      <div class="field mb"><label>Classe par défaut (si la colonne « classe » est vide)</label><select class="select" data-defclass><option value="">— Aucune —</option>${classes.map((c) => h`<option value="${c.id}" ${String(c.id) === cid ? raw('selected') : ''}>${c.name}</option>`)}</select></div>
      <div class="dropzone" data-drop>${icon('upload', 'lg')}<div><b>Cliquez ou déposez votre fichier CSV</b></div><div class="small muted">Colonnes : matricule, nom, prenom, sexe, date_naissance, lieu_naissance, classe, redoublant, parent_nom, parent_tel</div></div>
      <input type="file" accept=".csv,text/csv,.txt" class="hidden" data-file><div data-preview class="mt"></div><div data-result class="mt"></div>`,
    footer: h`<button class="btn btn-outline" data-close>Fermer</button><button class="btn btn-primary" data-go disabled>${icon('upload')} Importer</button>`,
    onOpen: ({ root, close }) => {
      $('[data-tpl]', root).onclick = () => downloadCSV('modele_import_eleves.csv', [['matricule', 'nom', 'prenom', 'sexe', 'date_naissance', 'lieu_naissance', 'classe', 'redoublant', 'parent_nom', 'parent_tel'],
        ['', 'MBALLA', 'Junior Arnaud', 'M', '15/03/2012', 'Yaoundé', classes[0]?.name || '6e A', 'non', 'MBALLA Pierre', '+237 699 00 00 00']]);
      const file = $('[data-file]', root), drop = $('[data-drop]', root);
      const load = async (f) => {
        if (!f) return;
        rows = parseCSV(await readFileText(f)).map((r) => ({ ...r, redoublant: /^(o|oui|y|yes|1|r)/i.test(r.redoublant || '') }));
        mount($('[data-preview]', root), rows.length ? h`<div class="alert ok">${icon('checkCircle')}<div><b>${rows.length}</b> ligne(s) détectée(s). Aperçu :</div></div>
          <div class="table-wrap mt"><table class="t"><thead><tr><th>Nom</th><th>Prénom</th><th>Sexe</th><th>Naissance</th><th>Classe</th></tr></thead><tbody>${rows.slice(0, 6).map((r) => h`<tr><td>${r.nom}</td><td>${r.prenom}</td><td>${r.sexe}</td><td>${r.date_naissance}</td><td>${r.classe}</td></tr>`)}</tbody></table></div>`
          : h`<div class="alert danger">${icon('alert')}<div>Fichier vide ou illisible.</div></div>`);
        $('[data-go]', root).disabled = !rows.length;
      };
      drop.onclick = () => file.click(); file.onchange = () => load(file.files[0]);
      drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
      drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); load(e.dataTransfer.files[0]); };
      $('[data-go]', root).onclick = (e) => withBusy(e.currentTarget, async () => {
        try {
          const r = await post('/admin/students/import', { rows, class_id: $('[data-defclass]', root).value || null });
          mount($('[data-result]', root), h`<div class="alert ${r.errors.length ? 'warn' : 'ok'}">${icon(r.errors.length ? 'alert' : 'checkCircle')}<div><b>${r.created}</b> créé(s), <b>${r.updated}</b> mis à jour, <b>${r.errors.length}</b> erreur(s).
            ${r.errors.length ? h`<ul class="small">${r.errors.slice(0, 15).map((x) => h`<li>${x}</li>`)}</ul>` : ''}</div></div>`);
          if (!r.errors.length) { toast(`${r.created + r.updated} élève(s) importé(s)`); setTimeout(() => close(true), 900); }
        } catch (ex) { toast(ex.message, 'err'); }
      });
    }
  });
}

/* ========================= Classes ========================= */
async function classesPage(view) {
  const [classes, teachers] = await Promise.all([getClasses(true), get('/admin/users?role=teacher')]);
  const levels = ['6e', '5e', '4e', '3e', '2nde', '1ère', 'Terminale', 'Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Lower Sixth', 'Upper Sixth', '1ère année', '2e année', '3e année', '4e année'];
  const fields = (isNew) => [
    { name: 'name', label: 'Nom de la classe', required: true, placeholder: 'ex. 2nde C1, Tle F3, Form 4 Sc' },
    { name: 'level', label: 'Niveau', type: 'select', options: levels.map((l) => [l, l]) },
    { name: 'serie', label: 'Série / spécialité', placeholder: 'ex. C, D, A4, F3, G2, STT…' },
    { name: 'cycle', label: 'Cycle', type: 'select', options: [['Premier cycle', 'Premier cycle'], ['Second cycle', 'Second cycle']] },
    { name: 'room', label: 'Salle' },
    { name: 'titulaire_id', label: 'Professeur principal', type: 'select', options: teachers.map((t) => [t.id, t.full_name]) },
    ...(isNew && classes.length ? [{ name: 'copy_from', label: 'Copier les matières et coefficients de', type: 'select', full: true, options: classes.map((c) => [c.id, c.name]), hint: 'Gain de temps pour les classes parallèles' }] : [])];
  mount(view, h`<div class="page-head"><div><h2>Classes</h2><p>${classes.length} classe(s) • ${classes.reduce((a, c) => a + c.effectif, 0)} élèves.</p></div>
    <div class="actions"><button class="btn btn-primary" data-add>${icon('plus')} Nouvelle classe</button></div></div>
  ${classes.length ? h`<div class="grid g-auto">${classes.map((c) => h`<div class="card cls-card"><div class="top"><div class="tag">${c.name.split(' ')[0]}</div><div style="min-width:0;flex:1"><h4>${c.name}</h4><div class="sub">${[c.level, c.serie && 'Série ' + c.serie, c.cycle].filter(Boolean).join(' • ')}</div></div>
      <button class="btn btn-ghost btn-sm btn-icon" data-edit="${c.id}" title="Modifier">${icon('edit', 'sm')}</button></div>
    <div class="chips"><span class="chip">${icon('users', 'sm')} ${c.effectif} élèves (${c.filles} F)</span><span class="chip">${c.matieres} matières • Σ coef ${c.total_coef}</span>${c.room ? h`<span class="chip">Salle ${c.room}</span>` : ''}</div>
    <div class="small"><span class="muted">Prof. principal :</span> ${c.titulaire || '—'}<br><span class="muted">Discipline :</span> ${c.responsables || h`<span class="badge red">non attribuée</span>`}</div>
    <div class="foot"><a class="btn btn-outline btn-sm" href="#/eleves?class=${c.id}">${icon('users', 'sm')} Élèves</a><a class="btn btn-outline btn-sm" href="#/attributions?class=${c.id}">${icon('book', 'sm')} Matières</a>
      <a class="btn btn-ghost btn-sm" href="#/edt?class=${c.id}">${icon('calendar', 'sm')} EDT</a><button class="btn btn-ghost btn-sm btn-icon" data-del="${c.id}" title="Supprimer">${icon('trash', 'sm')}</button></div></div>`)}</div>`
    : h`<div class="card">${empty('Aucune classe', 'Commencez par créer vos classes (6e, 5e, … Terminale).', 'layers')}</div>`}`);
  $('[data-add]', view).onclick = async () => { if (await formModal({ title: 'Nouvelle classe', fields: fields(true), onSubmit: (d) => post('/admin/classes', d) })) { toast('Classe créée'); rerender(); } };
  view.addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]'), dl = e.target.closest('[data-del]');
    if (ed) { const c = classes.find((x) => x.id === +ed.dataset.edit); if (await formModal({ title: `Modifier ${c.name}`, fields: fields(false), values: c, onSubmit: (d) => put(`/admin/classes/${c.id}`, d) })) { toast('Classe modifiée'); rerender(); } }
    if (dl) {
      const c = classes.find((x) => x.id === +dl.dataset.del);
      if (await confirmDialog({ title: `Supprimer ${c.name} ?`, message: 'Les matières attribuées, notes et emplois du temps de cette classe seront supprimés. La classe doit être vide.', danger: true, okLabel: 'Supprimer' })) {
        try { await del(`/admin/classes/${c.id}`); toast('Classe supprimée'); rerender(); } catch (ex) { toast(ex.message, 'err'); }
      }
    }
  });
}

/* ========================= Matières ========================= */
const TYPE_TONES = ['blue', 'green', 'gold', 'amber', 'red'];
const typeBadge = (types, id, name) => { const i = types.findIndex((t) => t.id === id); return h`<span class="badge ${i < 0 ? '' : TYPE_TONES[i % TYPE_TONES.length]}">${name || '—'}</span>`; };

/** Création rapide d'un groupe ou d'un type depuis le formulaire d'une matière. */
async function quickCreate(kind) {
  const isGroup = kind === 'groups';
  return formModal({
    title: isGroup ? 'Nouveau groupe' : 'Nouveau type de matière', size: 'sm', submitLabel: 'Créer',
    fields: [{ name: 'name', label: 'Libellé', required: true, full: true, maxlength: 60, placeholder: isGroup ? 'ex. Groupe 4 — Enseignements professionnels' : 'ex. Matière technique' },
      ...(isGroup ? [{ name: 'ordre', label: 'Position sur le bulletin', type: 'number', min: 1, max: 99, value: 4, required: true, full: true }] : [])],
    onSubmit: (d) => post(`/admin/subject-${kind}`, d)
  });
}

async function matieres(view, params) {
  const tab = ['groupes', 'types'].includes(params.tab) ? params.tab : 'matieres';
  const [list, groups, types] = await Promise.all([get('/admin/subjects'), get('/admin/subject-groups'), get('/admin/subject-types')]);
  const head = h`<div class="page-head"><div><h2>Matières</h2><p>Catalogue des disciplines, de leurs groupes (regroupement sur le bulletin) et de leurs types (littéraire, scientifique…). Les coefficients se définissent par classe dans « Attributions ».</p></div>
    <div class="actions">${tab === 'matieres' ? h`<button class="btn btn-outline" data-presets>${icon('wand')} Ajouter le programme officiel</button><button class="btn btn-primary" data-add>${icon('plus')} Nouvelle matière</button>`
    : h`<button class="btn btn-primary" data-add>${icon('plus')} ${tab === 'groupes' ? 'Nouveau groupe' : 'Nouveau type'}</button>`}</div></div>
    <div class="tabs">${[['matieres', `Matières (${list.length})`], ['groupes', `Groupes (${groups.length})`], ['types', `Types de matière (${types.length})`]]
    .map(([k, l]) => h`<button class="${tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`)}</div>`;

  /* ----- onglets Groupes / Types ----- */
  if (tab !== 'matieres') {
    const isG = tab === 'groupes', rows = isG ? groups : types, kind = isG ? 'groups' : 'types';
    mount(view, h`${head}
      <div class="alert info mb">${icon('info')}<div>${isG ? "Le groupe détermine le regroupement des matières et l'ordre des sous-totaux sur le bulletin (Groupe 1, puis Groupe 2…). Modifiez la position pour changer l'ordre."
      : 'Le type qualifie la nature de la matière (littéraire, scientifique, technique…). Il est indépendant du groupe et alimente les statistiques par type.'}</div></div>
      <div class="card"><div class="table-wrap"><table class="t rt"><thead><tr>${isG ? h`<th class="center" style="width:90px">Position</th>` : ''}<th>Libellé</th><th class="center">Matières</th><th></th></tr></thead>
      <tbody>${rows.map((x) => h`<tr>${isG ? h`<td class="center" data-label="Position"><b>${x.ordre}</b></td>` : ''}<td class="primary-cell">${isG ? x.name : typeBadge(types, x.id, x.name)}</td>
        <td class="center" data-label="Matières">${x.subjects}</td>
        <td class="actions-cell"><button class="btn btn-ghost btn-sm btn-icon" data-edit-x="${x.id}" title="Modifier">${icon('edit', 'sm')}</button><button class="btn btn-ghost btn-sm btn-icon" data-del-x="${x.id}" title="Supprimer" ${x.subjects ? raw('disabled') : ''}>${icon('trash', 'sm')}</button></td></tr>`)}</tbody></table></div></div>`);
    $$('[data-tab]', view).forEach((b) => (b.onclick = () => go('matieres', { tab: b.dataset.tab })));
    const fieldsX = [{ name: 'name', label: 'Libellé', required: true, full: true, maxlength: 60 }, ...(isG ? [{ name: 'ordre', label: 'Position sur le bulletin', type: 'number', min: 1, max: 99, required: true, full: true }] : [])];
    $('[data-add]', view).onclick = async () => { if (await quickCreate(kind)) { toast(isG ? 'Groupe créé' : 'Type créé'); rerender(); } };
    view.addEventListener('click', async (e) => {
      const ed = e.target.closest('[data-edit-x]'), dl = e.target.closest('[data-del-x]');
      if (ed) {
        const x = rows.find((r) => r.id === +ed.dataset.editX);
        if (await formModal({ title: isG ? 'Modifier le groupe' : 'Modifier le type', size: 'sm', fields: fieldsX, values: x, onSubmit: (d) => put(`/admin/subject-${kind}/${x.id}`, d) })) { toast('Modification enregistrée'); rerender(); }
      }
      if (dl && !dl.disabled && await confirmDialog({ title: isG ? 'Supprimer ce groupe ?' : 'Supprimer ce type ?', message: 'Cette action est définitive.', danger: true, okLabel: 'Supprimer' })) {
        try { await del(`/admin/subject-${kind}/${dl.dataset.delX}`); toast('Supprimé'); rerender(); } catch (ex) { toast(ex.message, 'err'); }
      }
    });
    return;
  }

  /* ----- onglet Matières ----- */
  const NEW = '__new__';
  const fields = [{ name: 'name', label: 'Intitulé', required: true, full: true }, { name: 'code', label: 'Abréviation', placeholder: 'ex. MATH' },
    { name: 'group_id', label: 'Groupe (bulletin)', type: 'select', required: true, options: [...groups.map((g) => [g.id, `${g.name} (position ${g.ordre})`]), [NEW, '➕ Nouveau groupe…']] },
    { name: 'type_id', label: 'Type de matière', type: 'select', required: true, full: true, options: [...types.map((t) => [t.id, t.name]), [NEW, '➕ Nouveau type…']] }];
  // « ➕ Nouveau… » dans une liste : création immédiate puis sélection
  const onReady = ({ root }) => ['group_id', 'type_id'].forEach((name) => {
    const sel = $(`[name="${name}"]`, root); let prev = sel.value;
    sel.addEventListener('change', async () => {
      if (sel.value !== NEW) { prev = sel.value; return; }
      const created = await quickCreate(name === 'group_id' ? 'groups' : 'types');
      if (created?.id) {
        const opt = document.createElement('option'); opt.value = created.id;
        opt.textContent = name === 'group_id' ? `${created.name} (position ${created.ordre})` : created.name;
        sel.insertBefore(opt, sel.querySelector(`option[value="${NEW}"]`)); sel.value = prev = String(created.id);
        toast(name === 'group_id' ? 'Groupe créé' : 'Type créé');
      } else sel.value = prev;
    });
  });
  const typeFilter = params.type || '';
  const shown = list.filter((s) => !typeFilter || String(s.type_id) === typeFilter);
  const findType = (label) => types.find((t) => t.name.toLowerCase() === label.toLowerCase())
    || types.find((t) => t.name.toLowerCase().includes(label.toLowerCase().includes('littér') ? 'littér' : label.toLowerCase().includes('scien') ? 'scien' : '§')) || types[0];
  const findGroup = (ordre) => groups.find((g) => g.ordre === ordre) || groups[0];
  const L = 'Matière littéraire', S = 'Matière scientifique', A = 'Autre matière';
  const PRESETS = [['Français', 'FRA', 1, L], ['Anglais', 'ANG', 1, L], ['Histoire-Géographie', 'HG', 1, L], ['Éducation à la citoyenneté', 'ECM', 1, L], ['Langues et cultures nationales', 'LCN', 1, L],
    ['Espagnol', 'ESP', 1, L], ['Allemand', 'ALL', 1, L], ['Philosophie', 'PHI', 1, L], ['Littérature', 'LIT', 1, L], ['Mathématiques', 'MATH', 2, S], ['Physique-Chimie', 'PCT', 2, S],
    ['Sciences de la vie et de la Terre', 'SVT', 2, S], ['Informatique', 'INFO', 2, S], ['Technologie', 'TECH', 2, S], ['Éducation physique et sportive', 'EPS', 3, A],
    ['Travail manuel', 'TM', 3, A], ['Économie', 'ECO', 1, L], ['Comptabilité', 'CPTA', 2, S], ['Dessin technique', 'DT', 2, S], ['Électrotechnique', 'ELEC', 2, S], ['Construction mécanique', 'CM', 2, S]];
  mount(view, h`${head}
  <div class="toolbar"><select class="select" style="width:auto" data-type-filter><option value="">Tous les types</option>${types.map((t) => h`<option value="${t.id}" ${String(t.id) === typeFilter ? raw('selected') : ''}>${t.name}</option>`)}</select>
    <span class="muted small">${shown.length} matière(s)</span></div>
  <div class="card">${shown.length ? h`<div class="table-wrap"><table class="t rt"><thead><tr><th>Matière</th><th>Code</th><th>Groupe</th><th>Type</th><th class="center">Classes</th><th></th></tr></thead>
    <tbody>${shown.map((s) => h`<tr><td class="primary-cell">${s.name}</td><td data-label="Code" class="mono">${s.code || '—'}</td>
    <td data-label="Groupe"><span class="chip">${s.group_name || '—'}</span></td><td data-label="Type">${typeBadge(types, s.type_id, s.type_name)}</td>
    <td class="center" data-label="Classes">${s.classes}</td><td class="actions-cell"><button class="btn btn-ghost btn-sm btn-icon" data-edit="${s.id}" title="Modifier">${icon('edit', 'sm')}</button><button class="btn btn-ghost btn-sm btn-icon" data-del="${s.id}" title="Supprimer">${icon('trash', 'sm')}</button></td></tr>`)}</tbody></table></div>`
    : empty('Aucune matière', 'Ajoutez les matières une à une ou importez le programme officiel en un clic.', 'book')}</div>`);
  $$('[data-tab]', view).forEach((b) => (b.onclick = () => go('matieres', { tab: b.dataset.tab })));
  $('[data-type-filter]', view).onchange = (e) => go('matieres', { type: e.target.value });
  $('[data-add]', view).onclick = async () => {
    if (await formModal({ title: 'Nouvelle matière', fields, values: { group_id: groups[0]?.id, type_id: types[0]?.id }, onReady, onSubmit: (d) => post('/admin/subjects', d) })) { toast('Matière ajoutée'); rerender(); }
  };
  $('[data-presets]', view).onclick = async () => {
    const existing = new Set(list.map((s) => s.name.toLowerCase()));
    const todo = PRESETS.filter(([n]) => !existing.has(n.toLowerCase()));
    const r = await formModal({ title: 'Programme officiel', size: 'lg', intro: h`<p class="small muted" style="margin-top:0">Cochez les matières à ajouter. Groupe et type proposés par défaut : vous pourrez les modifier ensuite.</p>`,
      fields: [{ name: 'pick', label: 'Matières', type: 'multiselect', full: true, options: todo.map(([n, , g, t]) => [n, `${n} — ${findGroup(g).name}, ${findType(t).name}`]) }], values: { pick: todo.slice(0, 12).map(([n]) => n) },
      onSubmit: async (d) => { for (const n of d.pick) { const p = todo.find((x) => x[0] === n); await post('/admin/subjects', { name: p[0], code: p[1], group_id: findGroup(p[2]).id, type_id: findType(p[3]).id }); } return d.pick.length; } });
    if (r) { toast(`${r} matière(s) ajoutée(s)`); rerender(); }
  };
  view.addEventListener('click', async (e) => {
    const ed = e.target.closest('[data-edit]'), dl = e.target.closest('[data-del]');
    if (ed) { const s = list.find((x) => x.id === +ed.dataset.edit); if (await formModal({ title: 'Modifier la matière', fields, values: s, onReady, onSubmit: (d) => put(`/admin/subjects/${s.id}`, d) })) { toast('Matière modifiée'); rerender(); } }
    if (dl && await confirmDialog({ title: 'Supprimer cette matière ?', message: 'Elle sera retirée de toutes les classes. Impossible si des notes existent.', danger: true, okLabel: 'Supprimer' })) {
      try { await del(`/admin/subjects/${dl.dataset.del}`); toast('Matière supprimée'); rerender(); } catch (ex) { toast(ex.message, 'err'); }
    }
  });
}

/* ========================= Attributions ========================= */
async function attributions(view, params) {
  const [classes, subjects, teachers] = await Promise.all([getClasses(true), get('/admin/subjects'), get('/admin/users?role=teacher')]);
  if (!classes.length || !subjects.length) return mount(view, h`<div class="card">${empty('Préalables manquants', 'Créez d\'abord des classes et des matières.', 'swap', h`<a class="btn btn-primary" href="#/${!classes.length ? 'classes' : 'matieres'}">Commencer</a>`)}</div>`);
  const cid = +params.class || classes[0].id;
  const list = await get(`/admin/class-subjects?class_id=${cid}`);
  const cls = classes.find((c) => c.id === cid);
  const tOpts = (sel) => h`<option value="">— Non attribuée —</option>${teachers.map((t) => h`<option value="${t.id}" ${t.id === sel ? raw('selected') : ''}>${t.full_name}${t.specialite ? ' (' + t.specialite + ')' : ''}</option>`)}`;
  mount(view, h`<div class="page-head"><div><h2>Attributions</h2><p>Matières, coefficients, volumes horaires et enseignants de chaque classe.</p></div>
    <div class="actions"><button class="btn btn-outline" data-copy>${icon('copy')} Copier d'une autre classe</button><button class="btn btn-primary" data-add>${icon('plus')} Ajouter une matière</button></div></div>
  <div class="toolbar">${classSelect(classes, cid, 'data-class')}<span class="muted small">${list.length} matière(s) • Σ coefficients ${list.reduce((a, x) => a + x.coef, 0)} • ${list.reduce((a, x) => a + x.hours_week, 0)} h/semaine</span></div>
  <div class="card">${list.length ? h`<div class="table-wrap"><table class="t rt"><thead><tr><th>Matière</th><th class="center">Coefficient</th><th class="center">Heures / sem.</th><th>Enseignant</th><th></th></tr></thead>
    <tbody>${list.map((a) => h`<tr data-id="${a.id}"><td class="primary-cell">${a.subject} <span class="chip">${a.group_name || '—'}</span> <span class="badge">${a.type_name || '—'}</span></td>
      <td class="center" data-label="Coefficient"><input class="input num-input" type="number" min="0.5" max="10" step="0.5" data-k="coef" value="${a.coef}"></td>
      <td class="center" data-label="Heures / sem."><input class="input num-input" type="number" min="0" max="20" step="1" data-k="hours_week" value="${a.hours_week}"></td>
      <td data-label="Enseignant"><select class="select" data-k="teacher_id" style="min-width:200px">${tOpts(a.teacher_id)}</select></td>
      <td class="actions-cell"><button class="btn btn-ghost btn-sm btn-icon" data-del="${a.id}" title="Retirer">${icon('trash', 'sm')}</button></td></tr>`)}</tbody></table></div>
    <div class="card-b small muted">${icon('info', 'sm')} Les modifications sont enregistrées automatiquement.</div>`
    : empty(`Aucune matière en ${cls.name}`, 'Ajoutez les matières enseignées dans cette classe ou copiez-les d’une classe similaire.', 'book')}</div>`);
  $('[data-class]', view).onchange = (e) => go('attributions', { class: e.target.value });
  view.addEventListener('change', async (e) => {
    const el = e.target.closest('[data-k]'); if (!el) return;
    const tr = el.closest('tr'); const id = +tr.dataset.id;
    const body = { coef: $('[data-k=coef]', tr).value, hours_week: $('[data-k=hours_week]', tr).value, teacher_id: $('[data-k=teacher_id]', tr).value || null };
    try { await put(`/admin/class-subjects/${id}`, body); toast('Attribution enregistrée'); } catch (ex) { toast(ex.message, 'err'); }
  });
  view.addEventListener('click', async (e) => {
    const dl = e.target.closest('[data-del]'); if (!dl) return;
    try { await del(`/admin/class-subjects/${dl.dataset.del}`); toast('Matière retirée'); rerender(); }
    catch (ex) {
      if (await confirmDialog({ title: 'Notes existantes', message: `${ex.message}`, danger: true, okLabel: 'Supprimer définitivement' })) { await del(`/admin/class-subjects/${dl.dataset.del}?force=1`); toast('Matière retirée'); rerender(); }
    }
  });
  $('[data-add]', view).onclick = async () => {
    const used = new Set(list.map((x) => x.subject_id));
    const r = await formModal({ title: 'Ajouter une matière', fields: [
      { name: 'subject_id', label: 'Matière', type: 'select', required: true, options: subjects.filter((s) => !used.has(s.id)).map((s) => [s.id, s.name]) },
      { name: 'teacher_id', label: 'Enseignant', type: 'select', options: teachers.map((t) => [t.id, t.full_name]) },
      { name: 'coef', label: 'Coefficient', type: 'number', min: 0.5, max: 10, step: 0.5, value: 2, required: true },
      { name: 'hours_week', label: 'Heures par semaine', type: 'number', min: 0, max: 20, value: 2 },
      { name: 'class_ids', label: 'Appliquer aussi aux classes', type: 'multiselect', full: true, options: classes.filter((c) => c.id !== cid).map((c) => [c.id, c.name]), hint: 'Optionnel : même matière, coefficient et enseignant pour d’autres classes' }],
    onSubmit: (d) => post('/admin/class-subjects', { ...d, class_ids: [cid, ...d.class_ids] }) });
    if (r) { toast('Matière ajoutée'); rerender(); }
  };
  $('[data-copy]', view).onclick = async () => {
    const r = await formModal({ title: `Copier les matières vers ${cls.name}`, size: 'sm', fields: [{ name: 'from', label: 'Classe source', type: 'select', required: true, options: classes.filter((c) => c.id !== cid).map((c) => [c.id, c.name]) }],
      onSubmit: (d) => post(`/admin/classes/${cid}/copy-subjects`, d) });
    if (r) { toast(`${r.copied} matière(s) copiée(s) (sans les enseignants)`); rerender(); }
  };
}

/* ========================= Emplois du temps ========================= */
async function edt(view, params) {
  const classes = await getClasses(true);
  if (!classes.length) return mount(view, h`<div class="card">${empty('Aucune classe', '', 'calendar')}</div>`);
  const mode = params.mode || 'class';
  if (mode === 'teacher') {
    const teachers = await get('/admin/users?role=teacher');
    const tid = +params.teacher || teachers[0]?.id;
    const data = tid ? await get(`/timetable/teacher/${tid}`) : null;
    mount(view, h`${edtHead('teacher')}<div class="toolbar"><select class="select" style="width:auto" data-t>${teachers.map((t) => h`<option value="${t.id}" ${t.id === tid ? raw('selected') : ''}>${t.full_name}</option>`)}</select>
      <div class="grow"></div><button class="btn btn-outline" data-pdf>${icon('pdf')} PDF</button></div>
      <div class="card"><div class="card-b">${data ? timetableHtml(data, { mode: 'teacher' }) : empty('Aucun enseignant', '', 'teacher')}</div></div>`);
    $('[data-t]', view).onchange = (e) => go('edt', { mode: 'teacher', teacher: e.target.value });
    $('[data-pdf]', view).onclick = () => openPdf(`/timetable?teacher_id=${tid}`);
    bindModeSeg(view); return;
  }
  const cid = +params.class || classes[0].id;
  const d = await get(`/admin/timetable/${cid}`);
  const busyMap = {}; for (const b of d.busy) (busyMap[`${b.teacher_id}|${b.day}|${b.slot}`] = b.classe);
  const total = d.subjects.reduce((a, s) => a + s.hours_week, 0), placed = d.cells.length;
  mount(view, h`${edtHead('class')}
    <div class="toolbar">${classSelect(classes, cid, 'data-class')}<div class="grow"></div>
      <button class="btn btn-outline" data-gen>${icon('wand')} Générer automatiquement</button><button class="btn btn-outline" data-pdf>${icon('pdf')} PDF</button></div>
    <div class="stack">
      <div class="card"><div class="card-h"><h3>${classes.find((c) => c.id === cid).name}</h3><span class="sub">${placed} / ${total} heures placées • cliquez sur une case pour la modifier</span></div><div class="card-b">${timetableHtml(d, { editable: true })}</div></div>
      <div class="card"><div class="card-h"><h3>Volume horaire hebdomadaire</h3></div><div class="card-b"><div class="grid g-auto" style="gap:4px 18px">${d.subjects.map((s) => h`<div class="list-item" style="padding:8px 0;border:0"><div class="ico" style="background:${colorFor(s.subject)}"></div>
        <div style="flex:1;min-width:0"><b class="small">${s.subject}</b><div class="meta">${s.teacher || 'Sans enseignant'}</div>${progressBar(s.hours_week ? (s.placed / s.hours_week) * 100 : 100, s.placed < s.hours_week ? 'gold' : '')}</div>
        <span class="badge ${s.placed === s.hours_week ? 'green' : s.placed > s.hours_week ? 'red' : 'amber'}">${s.placed}/${s.hours_week} h</span></div>`)}</div></div></div>
    </div>`);
  bindModeSeg(view);
  $('[data-class]', view).onchange = (e) => go('edt', { class: e.target.value });
  $('[data-pdf]', view).onclick = () => openPdf(`/timetable?class_id=${cid}`);
  $('[data-gen]', view).onclick = async (e) => {
    if (placed && !(await confirmDialog({ title: 'Générer automatiquement', message: "L'emploi du temps actuel de cette classe sera remplacé. Les cours des autres classes sont pris en compte pour éviter les conflits d'enseignants.", okLabel: 'Générer' }))) return;
    await withBusy(e.currentTarget, async () => {
      const r = await post(`/admin/timetable/${cid}/generate`);
      toast(r.missing.length ? `${r.placed} heure(s) placée(s) ; ${r.missing.reduce((a, m) => a + m.missing, 0)} heure(s) n'ont pas pu être placées (conflits)` : `Emploi du temps généré : ${r.placed} heure(s) placée(s)`, r.missing.length ? 'warn' : 'ok', 6000);
      rerender();
    });
  };
  view.addEventListener('click', async (e) => {
    const td = e.target.closest('td.cell.editable'); if (!td) return;
    const day = +td.dataset.day, slot = +td.dataset.slot;
    const cur = d.cells.find((c) => c.day === day && c.slot === slot);
    const opts = d.subjects.map((s) => {
      const conflict = s.teacher_id && busyMap[`${s.teacher_id}|${day}|${slot}`];
      return [s.id, `${s.subject}${s.teacher ? ' — ' + s.teacher : ''}${conflict ? ' ⚠ occupé en ' + conflict : ''}`];
    });
    const r = await modal({
      title: `${DAYS[day]} ${d.slots[slot].start} – ${d.slots[slot].end}`, size: 'sm',
      body: h`<div class="stack">${fieldHtml({ name: 'cs', label: 'Matière', type: 'select', options: opts }, cur?.class_subject_id)}${fieldHtml({ name: 'room', label: 'Salle (optionnel)' }, cur?.room || classes.find((c) => c.id === cid).room)}<div class="alert danger hidden" data-err></div></div>`,
      footer: h`${cur ? h`<button class="btn btn-danger-soft" data-clear>${icon('trash')} Vider</button>` : ''}<div style="flex:1"></div><button class="btn btn-outline" data-close>Annuler</button><button class="btn btn-primary" data-ok>${icon('check')} Enregistrer</button>`,
      onOpen: ({ root, close }) => {
        $('[data-ok]', root).onclick = async () => {
          const cs = $('[name=cs]', root).value; if (!cs) return;
          try { await put('/admin/timetable', { class_id: cid, day, slot, class_subject_id: cs, room: $('[name=room]', root).value }); close(true); }
          catch (ex) { const er = $('[data-err]', root); er.textContent = ex.message; er.classList.remove('hidden'); }
        };
        $('[data-clear]', root)?.addEventListener('click', async () => { await del(`/admin/timetable?class_id=${cid}&day=${day}&slot=${slot}`); close(true); });
      }
    });
    if (r) rerender();
  });
}
const edtHead = (mode) => h`<div class="page-head"><div><h2>Emplois du temps</h2><p>Conception assistée avec détection des conflits d'enseignants et de salles.</p></div>
  <div class="actions"><div class="seg"><button class="${mode === 'class' ? 'on' : ''}" data-mode="class">Par classe</button><button class="${mode === 'teacher' ? 'on' : ''}" data-mode="teacher">Par enseignant</button></div></div></div>`;
const bindModeSeg = (view) => $$('[data-mode]', view).forEach((b) => (b.onclick = () => go('edt', { mode: b.dataset.mode })));

/* ========================= Personnel (enseignants / responsables) ========================= */
const sessionCreds = []; // identifiants générés pendant la session (en mémoire uniquement)
async function showCredentials(items, { record = true } = {}) {
  if (record) sessionCreds.push(...items);
  await modal({
    title: items.length > 1 ? `${items.length} comptes générés` : 'Identifiants du compte', size: items.length > 1 ? 'lg' : '',
    body: h`<div class="alert warn mb">${icon('alert')}<div>Notez ou imprimez ces identifiants <b>maintenant</b> : pour des raisons de sécurité, le mot de passe n'est jamais stocké en clair et ne pourra plus être affiché. L'utilisateur devra le changer à sa première connexion.</div></div>
      <div class="stack">${items.map((c) => h`<div class="card"><div class="card-b"><div class="row" style="justify-content:space-between"><b>${c.full_name}</b><span class="badge">${ROLE_LABEL[c.role]}</span></div>
        <div class="grid g-2 mt" style="gap:8px"><div class="cred"><span><span class="small muted">Identifiant</span><br>${c.username}</span><button class="btn btn-ghost btn-sm btn-icon" data-copy="${c.username}">${icon('copy', 'sm')}</button></div>
        <div class="cred"><span><span class="small muted">Mot de passe</span><br>${c.password}</span><button class="btn btn-ghost btn-sm btn-icon" data-copy="${c.password}">${icon('copy', 'sm')}</button></div></div></div></div>`)}</div>`,
    footer: h`<button class="btn btn-outline" data-copyall>${icon('copy')} Tout copier</button><button class="btn btn-primary" data-print>${icon('printer')} Imprimer les fiches (PDF)</button>`,
    onOpen: ({ root }) => {
      $$('[data-copy]', root).forEach((b) => (b.onclick = () => copyText(b.dataset.copy)));
      $('[data-copyall]', root).onclick = () => copyText(items.map((c) => `${c.full_name} — identifiant : ${c.username} — mot de passe : ${c.password}`).join('\n'));
      $('[data-print]', root).onclick = (e) => withBusy(e.currentTarget, () => postPdf('/credentials', { items }, 'identifiants.pdf').catch((ex) => toast(ex.message, 'err')));
    }
  });
}

async function staff(view, params, role) {
  const [list, classes] = await Promise.all([get(`/admin/users?role=${role}`), role === 'discipline' ? getClasses(true) : Promise.resolve([])]);
  const T = role === 'teacher';
  const q = (params.q || '').toLowerCase();
  const shown = list.filter((u) => !q || `${u.full_name} ${u.username} ${u.specialite || ''}`.toLowerCase().includes(q));
  const fields = [
    { name: 'full_name', label: 'Nom complet', required: true, placeholder: 'NOM Prénom(s)', full: true, hint: "L'identifiant est généré automatiquement à partir du nom (ex. MBARGA Jean Paul → mbargajp)" },
    { name: 'sexe', label: 'Sexe', type: 'select', options: [['M', 'Masculin'], ['F', 'Féminin']] },
    { name: 'matricule', label: 'Matricule' },
    { name: 'specialite', label: T ? 'Spécialité / discipline' : 'Fonction', placeholder: T ? 'ex. Mathématiques' : 'ex. Surveillant général' },
    { name: 'phone', label: 'Téléphone', type: 'tel' }, { name: 'email', label: 'E-mail', type: 'email', full: !T },
    ...(T ? [] : [{ name: 'class_ids', label: 'Classes à charge', type: 'multiselect', full: true, options: classes.map((c) => [c.id, c.name]) }])];
  const sel = new Set();
  mount(view, h`<div class="page-head"><div><h2>${T ? 'Enseignants' : 'Responsables disciplinaires'}</h2><p>${list.length} compte(s). ${T ? 'Les classes et matières s’attribuent dans « Attributions ».' : 'Chaque responsable saisit les faits disciplinaires de ses classes.'}</p></div>
    <div class="actions">${sessionCreds.length ? h`<button class="btn btn-ghost" data-recent>${icon('key')} Identifiants récents (${sessionCreds.length})</button>` : ''}
      <button class="btn btn-outline" data-import>${icon('upload')} Importer</button><button class="btn btn-primary" data-add>${icon('plus')} ${T ? 'Nouvel enseignant' : 'Nouveau responsable'}</button></div></div>
  <div class="toolbar"><div class="grow input-icon">${icon('search', 'sm')}<input class="input" placeholder="Rechercher…" value="${params.q || ''}" data-q></div></div>
  <div class="card"><div class="card-h hidden" data-bulk><b data-nsel></b><div class="actions"><button class="btn btn-outline btn-sm" data-breset>${icon('key', 'sm')} Réinitialiser les mots de passe et imprimer</button></div></div>
  ${shown.length ? h`<div class="table-wrap"><table class="t rt"><thead><tr><th style="width:36px"><input type="checkbox" data-all></th><th>Nom</th><th>Identifiant</th><th>${T ? 'Classes & matières' : 'Classes à charge'}</th><th>Statut</th><th>Dernière connexion</th><th></th></tr></thead>
    <tbody>${shown.map((u) => h`<tr><td class="check-cell"><input type="checkbox" data-sel="${u.id}"></td>
      <td class="primary-cell"><div class="row" style="gap:10px;flex-wrap:nowrap"><div class="avatar hide-mobile" style="width:34px;height:34px">${initials(u.full_name)}</div><div><div class="strong">${u.full_name}</div><div class="cell-sub">${u.specialite || ''}${u.phone ? ' • ' + u.phone : ''}</div></div></div></td>
      <td data-label="Identifiant" class="mono">${u.username}</td>
      <td data-label="${T ? 'Attributions' : 'Classes'}"><div class="chips">${T ? (u.assignments.length ? u.assignments.map((a) => h`<span class="chip">${a.classe} · ${a.subject}</span>`) : h`<span class="badge amber">Aucune</span>`)
    : (u.classes.length ? u.classes.map((c) => h`<span class="chip">${c.name}</span>`) : h`<span class="badge amber">Aucune</span>`)}</div></td>
      <td data-label="Statut">${!u.active ? h`<span class="badge red">Désactivé</span>` : u.locked ? h`<span class="badge red">${icon('lock', 'sm')} Verrouillé</span>` : u.must_change ? h`<span class="badge amber">1re connexion</span>` : h`<span class="badge green">Actif</span>`}</td>
      <td data-label="Connexion" class="small">${u.last_login ? fmtTs(u.last_login) : 'Jamais'}</td>
      <td class="actions-cell"><div class="rel" style="display:inline-block"><button class="btn btn-ghost btn-sm btn-icon" data-more="${u.id}" aria-label="Actions">${icon('menu', 'sm')}</button></div></td></tr>`)}</tbody></table></div>`
    : empty(list.length ? 'Aucun résultat' : 'Aucun compte', list.length ? '' : 'Créez les comptes un par un ou importez une liste.', T ? 'teacher' : 'shield')}</div>`);
  $('[data-q]', view).oninput = debounce((e) => go(T ? 'enseignants' : 'responsables', { q: e.target.value }), 300);
  $('[data-add]', view).onclick = async () => {
    const r = await formModal({ title: T ? 'Nouvel enseignant' : 'Nouveau responsable disciplinaire', fields, size: 'lg', submitLabel: 'Créer le compte', onSubmit: (d) => post('/admin/users', { ...d, role }) });
    if (r) { await showCredentials([r]); rerender(); }
  };
  $('[data-recent]', view)?.addEventListener('click', () => showCredentials([...sessionCreds], { record: false }));
  $('[data-import]', view).onclick = () => importStaff(role).then((x) => x && rerender());
  const updBulk = () => { $('[data-bulk]', view).classList.toggle('hidden', !sel.size); $('[data-nsel]', view).textContent = `${sel.size} compte(s) sélectionné(s)`; };
  view.addEventListener('change', (e) => {
    if (e.target.matches('[data-sel]')) { e.target.checked ? sel.add(+e.target.dataset.sel) : sel.delete(+e.target.dataset.sel); updBulk(); }
    if (e.target.matches('[data-all]')) { $$('[data-sel]', view).forEach((c) => { c.checked = e.target.checked; e.target.checked ? sel.add(+c.dataset.sel) : sel.delete(+c.dataset.sel); }); updBulk(); }
  });
  $('[data-breset]', view).onclick = async () => {
    if (!(await confirmDialog({ title: `Réinitialiser ${sel.size} mot(s) de passe ?`, message: 'De nouveaux mots de passe faciles à retenir seront générés. Les anciens ne fonctionneront plus.', okLabel: 'Réinitialiser' }))) return;
    const out = []; for (const id of sel) out.push(await post(`/admin/users/${id}/reset`));
    await showCredentials(out); rerender();
  };
  view.addEventListener('click', async (e) => {
    const m = e.target.closest('[data-more]'); if (!m) return;
    e.stopPropagation();
    $$('.menu.staff-menu').forEach((x) => x.remove());
    const u = list.find((x) => x.id === +m.dataset.more);
    const menu = document.createElement('div'); menu.className = 'menu staff-menu';
    mount(menu, h`<button data-a="edit">${icon('edit')} Modifier</button><button data-a="reset">${icon('key')} Réinitialiser le mot de passe</button>
      <button data-a="toggle">${icon(u.active ? 'lock' : 'unlock')} ${u.active ? 'Désactiver' : 'Réactiver'}${u.locked ? ' / déverrouiller' : ''}</button>
      ${T ? h`<button data-a="edt">${icon('calendar')} Emploi du temps</button><button data-a="prog">${icon('target')} Fiche de progression</button>` : ''}<hr>
      <button data-a="del" style="color:var(--red-600)">${icon('trash')} Supprimer</button>`);
    m.parentElement.append(menu);
    const off = (ev) => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', off); } };
    setTimeout(() => document.addEventListener('click', off));
    menu.onclick = async (ev) => {
      const a = ev.target.closest('[data-a]')?.dataset.a; if (!a) return; menu.remove();
      try {
        if (a === 'edit') { if (await formModal({ title: `Modifier ${u.full_name}`, fields, size: 'lg', values: { ...u, class_ids: (u.classes || []).map((c) => c.id) }, onSubmit: (d) => put(`/admin/users/${u.id}`, d) })) { toast('Compte modifié'); rerender(); } }
        if (a === 'reset' && await confirmDialog({ title: 'Réinitialiser le mot de passe ?', message: `Un nouveau mot de passe sera généré pour ${u.full_name}. Ses sessions ouvertes seront fermées.`, okLabel: 'Réinitialiser' })) { await showCredentials([await post(`/admin/users/${u.id}/reset`)]); rerender(); }
        if (a === 'toggle') { await post(`/admin/users/${u.id}/toggle`); toast(u.active ? 'Compte désactivé' : 'Compte réactivé'); rerender(); }
        if (a === 'edt') go('edt', { mode: 'teacher', teacher: u.id });
        if (a === 'prog') openPdf(`/progression?teacher_id=${u.id}`);
        if (a === 'del' && await confirmDialog({ title: 'Supprimer ce compte ?', message: `${u.full_name} ne pourra plus se connecter. ${T ? 'Ses attributions deviendront « non attribuées » ; les notes saisies sont conservées.' : ''}`, danger: true, okLabel: 'Supprimer' })) { await del(`/admin/users/${u.id}`); toast('Compte supprimé'); rerender(); }
      } catch (ex) { toast(ex.message, 'err'); }
    };
  });
}

async function importStaff(role) {
  let rows = [];
  return modal({
    title: `Importer des ${role === 'teacher' ? 'enseignants' : 'responsables'}`, size: 'lg',
    body: h`<p class="small" style="margin-top:0">Fichier CSV (séparateur « ; ») avec les colonnes : <span class="mono">nom ; prenom ; sexe ; matricule ; specialite ; phone ; email</span>. Un compte (identifiant + mot de passe facile à retenir) sera généré pour chaque ligne.</p>
      <div class="row mb"><button class="btn btn-outline btn-sm" data-tpl>${icon('download', 'sm')} Modèle</button></div>
      <div class="dropzone" data-drop>${icon('upload', 'lg')}<div><b>Cliquez ou déposez le fichier CSV</b></div></div><input type="file" accept=".csv,text/csv" class="hidden" data-file><div data-preview class="mt"></div>`,
    footer: h`<button class="btn btn-outline" data-close>Annuler</button><button class="btn btn-primary" data-go disabled>${icon('upload')} Importer et générer les comptes</button>`,
    onOpen: ({ root, close }) => {
      $('[data-tpl]', root).onclick = () => downloadCSV(`modele_${role}.csv`, [['nom', 'prenom', 'sexe', 'matricule', 'specialite', 'phone', 'email'], ['MBARGA', 'Jean Paul', 'M', 'MAT-0001', role === 'teacher' ? 'Mathématiques' : 'Surveillant général', '+237 699 00 00 00', '']]);
      const file = $('[data-file]', root), drop = $('[data-drop]', root);
      const load = async (f) => {
        rows = parseCSV(await readFileText(f)).map((r) => ({ ...r, full_name: [r.nom, r.prenom].filter(Boolean).join(' ') || r.full_name || r.nom_complet }));
        mount($('[data-preview]', root), h`<div class="alert ${rows.length ? 'ok' : 'danger'}">${icon(rows.length ? 'checkCircle' : 'alert')}<div>${rows.length} ligne(s) : ${rows.slice(0, 5).map((r) => r.full_name).join(', ')}${rows.length > 5 ? '…' : ''}</div></div>`);
        $('[data-go]', root).disabled = !rows.length;
      };
      drop.onclick = () => file.click(); file.onchange = () => file.files[0] && load(file.files[0]);
      drop.ondragover = (e) => e.preventDefault(); drop.ondrop = (e) => { e.preventDefault(); load(e.dataTransfer.files[0]); };
      $('[data-go]', root).onclick = (e) => withBusy(e.currentTarget, async () => {
        try {
          const r = await post('/admin/users/import', { role, rows });
          close(true);
          if (r.errors.length) toast(`${r.errors.length} erreur(s) : ${r.errors.slice(0, 3).join(' ; ')}`, 'warn', 8000);
          if (r.created.length) await showCredentials(r.created);
        } catch (ex) { toast(ex.message, 'err'); }
      });
    }
  });
}

/* ========================= Discipline (vue admin) ========================= */
async function disciplineAdmin(view, params) {
  const classes = await get('/classes/mine');
  if (!classes.length) return mount(view, h`<div class="card">${empty('Aucune classe', '', 'shield')}</div>`);
  const cid = +params.class || classes[0].id, seq = +params.seq || state.current;
  mount(view, h`<div data-ed></div>`);
  await disciplineEditor($('[data-ed]', view), { class_id: cid, seq, classes, onChange: (c, s) => go('discipline', { class: c, seq: s }) });
}

/* ========================= Annonces ========================= */
async function annonces(view) {
  const list = await get('/announcements');
  const AUD = { all: 'Tout le personnel', teacher: 'Enseignants', discipline: 'Responsables disciplinaires' };
  mount(view, h`<div class="page-head"><div><h2>Annonces</h2><p>Diffusez des informations aux enseignants et aux responsables disciplinaires (visibles sur leur tableau de bord).</p></div>
    <div class="actions"><button class="btn btn-primary" data-add>${icon('send')} Nouvelle annonce</button></div></div>
  <div class="card">${list.length ? list.map((a) => h`<div class="annonce"><div class="row" style="justify-content:space-between"><h4>${a.title}</h4><div class="row"><span class="badge blue">${AUD[a.audience]}</span><span class="small muted">${fmtTs(a.created_at)}</span>
    <button class="btn btn-ghost btn-sm btn-icon" data-del="${a.id}">${icon('trash', 'sm')}</button></div></div><p>${a.body}</p></div>`) : empty('Aucune annonce', '', 'megaphone')}</div>`);
  $('[data-add]', view).onclick = async () => {
    if (await formModal({ title: 'Nouvelle annonce', size: 'lg', fields: [{ name: 'title', label: 'Titre', required: true, full: true, maxlength: 120 },
      { name: 'audience', label: 'Destinataires', type: 'select', placeholder: false, options: Object.entries(AUD) }, { name: 'body', label: 'Message', type: 'textarea', required: true, full: true }],
    submitLabel: 'Publier', onSubmit: (d) => post('/admin/announcements', d) })) { toast('Annonce publiée'); rerender(); }
  };
  $$('[data-del]', view).forEach((b) => (b.onclick = async () => { if (await confirmDialog({ title: 'Supprimer cette annonce ?', message: '', danger: true, okLabel: 'Supprimer' })) { await del(`/admin/announcements/${b.dataset.del}`); rerender(); } }));
}

/* ========================= Journal d'audit ========================= */
async function audit(view, params) {
  const list = await get(`/admin/audit${params.q ? '?q=' + encodeURIComponent(params.q) : ''}`);
  mount(view, h`<div class="page-head"><div><h2>Journal d'audit</h2><p>Traçabilité complète des actions sensibles (500 dernières).</p></div>
    <div class="actions"><button class="btn btn-outline" data-csv>${icon('download')} Exporter</button></div></div>
  <div class="toolbar"><div class="grow input-icon">${icon('search', 'sm')}<input class="input" placeholder="Filtrer (utilisateur, action, détail)…" value="${params.q || ''}" data-q></div></div>
  <div class="card"><div class="table-wrap"><table class="t rt"><thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Détail</th><th>Adresse IP</th></tr></thead>
    <tbody>${list.map((a) => h`<tr><td data-label="Date" class="small" style="white-space:nowrap">${fmtTs(a.at)}</td><td class="primary-cell">${a.username || '—'}</td>
      <td data-label="Action"><span class="badge ${/ECHEC|SUPPRIM|FORC|RESTAUR/.test(a.action) ? 'red' : /CLOTUR|VALID/.test(a.action) ? 'green' : ''}">${a.action.replace(/_/g, ' ')}</span></td>
      <td data-label="Détail" class="small">${a.detail || ''}</td><td data-label="IP" class="small mono">${a.ip || ''}</td></tr>`)}</tbody></table></div>${!list.length ? empty('Aucune entrée', '', 'history') : ''}</div>`);
  $('[data-q]', view).oninput = debounce((e) => go('audit', { q: e.target.value }), 400);
  $('[data-csv]', view).onclick = () => downloadCSV('journal_audit.csv', [['Date', 'Utilisateur', 'Action', 'Détail', 'IP'], ...list.map((a) => [new Date(a.at * 1000).toISOString(), a.username, a.action, a.detail, a.ip])]);
}

/* ========================= Sauvegarde & nouvelle année ========================= */
async function sauvegarde(view) {
  const y = +String(state.school.annee_scolaire).slice(0, 4) || new Date().getFullYear();
  mount(view, h`<div class="page-head"><div><h2>Sauvegarde & année scolaire</h2><p>Protégez vos données et préparez la rentrée.</p></div></div>
  <div class="grid g-3">
    <div class="card"><div class="card-h"><h3>${icon('download')} Sauvegarder</h3></div><div class="card-b stack"><p class="small muted" style="margin:0">Téléchargez une copie complète de toutes les données (paramètres, élèves, personnels, notes, discipline, emplois du temps). Conservez-la en lieu sûr (clé USB, Drive…). Recommandé : chaque semaine et avant chaque clôture.</p>
      <a class="btn btn-primary" href="/api/admin/backup" download>${icon('download')} Télécharger la sauvegarde</a></div></div>
    <div class="card"><div class="card-h"><h3>${icon('upload')} Restaurer</h3></div><div class="card-b stack"><p class="small muted" style="margin:0">Remplace <b>toutes</b> les données actuelles par celles d'une sauvegarde. Tous les utilisateurs seront déconnectés.</p>
      <input type="file" accept=".json,application/json" class="hidden" data-file><button class="btn btn-danger-soft" data-restore>${icon('upload')} Choisir un fichier…</button></div></div>
    <div class="card"><div class="card-h"><h3>${icon('refresh')} Nouvelle année scolaire</h3></div><div class="card-b stack"><p class="small muted" style="margin:0">Efface les notes, progressions et données disciplinaires, rouvre les 6 séquences avec un nouveau calendrier. Les élèves, classes, matières, personnels et emplois du temps sont conservés. <b>Faites une sauvegarde avant !</b></p>
      <div class="field"><label>Nouvelle année</label><input class="input" data-year value="${y + 1}-${y + 2}" pattern="\\d{4}-\\d{4}"></div><button class="btn btn-outline" data-newyear>${icon('refresh')} Démarrer la nouvelle année</button></div></div>
  </div>
  <div class="card mt"><div class="card-h"><h3>${icon('shield')} Sécurité de la plateforme</h3></div><div class="card-b"><div class="grid g-2 small">
    <div class="stack" style="gap:6px"><div>${icon('check', 'sm')} Mots de passe hachés (scrypt + sel), jamais stockés en clair</div><div>${icon('check', 'sm')} Verrouillage du compte après 5 échecs (15 min)</div><div>${icon('check', 'sm')} Sessions HttpOnly / SameSite=Strict, expiration après inactivité</div><div>${icon('check', 'sm')} Protection CSRF, XSS (CSP stricte) et injections SQL</div></div>
    <div class="stack" style="gap:6px"><div>${icon('check', 'sm')} Contrôle d'accès par rôle et par classe</div><div>${icon('check', 'sm')} Verrouillage des séquences clôturées</div><div>${icon('check', 'sm')} Journal d'audit de toutes les actions sensibles</div><div>${icon('check', 'sm')} Changement de mot de passe obligatoire à la 1re connexion</div></div></div></div></div>`);
  const file = $('[data-file]', view);
  $('[data-restore]', view).onclick = () => file.click();
  file.onchange = async () => {
    const f = file.files[0]; if (!f) return;
    let dump; try { dump = JSON.parse(await readFileText(f)); } catch { return toast('Fichier illisible', 'err'); }
    const c = await confirmDialog({ title: 'Restaurer la sauvegarde ?', message: `Sauvegarde du ${dump.created_at ? new Date(dump.created_at).toLocaleString('fr-FR') : '?'}. TOUTES les données actuelles seront remplacées.`, requirePassword: true, danger: true, okLabel: 'Restaurer' });
    if (!c) return;
    try { await post('/admin/restore', { dump, password: c.password }); toast('Restauration terminée. Reconnectez-vous.'); setTimeout(() => location.reload(), 1500); } catch (ex) { toast(ex.message, 'err'); }
  };
  $('[data-newyear]', view).onclick = async () => {
    const annee = $('[data-year]', view).value.trim();
    const c = await confirmDialog({ title: `Démarrer l'année ${annee} ?`, message: 'Toutes les notes et données disciplinaires de l’année en cours seront définitivement effacées. Avez-vous téléchargé une sauvegarde ?', requirePassword: true, danger: true, okLabel: 'Démarrer' });
    if (!c) return;
    try { await post('/admin/new-year', { annee_scolaire: annee, password: c.password }); state.school.annee_scolaire = annee; toast(`Année ${annee} démarrée`); await refreshPeriods(); go('calendrier'); } catch (ex) { toast(ex.message, 'err'); }
  };
}
export { setParams };
