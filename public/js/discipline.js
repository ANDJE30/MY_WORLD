// Espace du responsable disciplinaire (surveillant général).
import { h, raw, mount, $, $$, icon, kpi, empty, periodOptions, progressBar } from './ui.js';
import { get, openPdf } from './api.js';
import { state, go } from './app.js';
import { disciplineEditor, incidentsPage, announcementsWidget, periodLabel, timetablePage, studentHistory, periodParam } from './shared.js';

export const routes = [
  { path: 'accueil', title: 'Tableau de bord', short: 'Accueil', icon: 'home', group: 'Vie scolaire', mobile: true, render: home },
  { path: 'saisie', title: 'Saisie des faits', short: 'Saisie', icon: 'edit', group: 'Vie scolaire', mobile: true, render: saisie },
  { path: 'incidents', title: 'Registre des incidents', short: 'Incidents', icon: 'flag', group: 'Vie scolaire', mobile: true, render: async (v, p) => incidentsPage(v, p, (await get('/discipline/classes')).classes) },
  { path: 'fiches', title: 'Fiches PDF', icon: 'pdf', group: 'Vie scolaire', render: fiches },
  { path: 'edt', title: 'Emplois du temps', icon: 'calendar', group: 'Vie scolaire', render: edt }
];

async function home(view) {
  const [{ classes, seq }, ann] = await Promise.all([get('/discipline/classes'), get('/announcements')]);
  const eff = classes.reduce((a, c) => a + c.effectif, 0);
  const val = classes.filter((c) => c.validated.includes(seq)).length;
  mount(view, h`<div class="page-head"><div><h2>Vie scolaire</h2><p>Séquence ${seq} ${periodLabel(seq)} — suivi disciplinaire de vos classes.</p></div>
    <div class="actions"><a class="btn btn-primary" href="#/saisie">${icon('edit')} Saisir les faits</a></div></div>
  <div class="grid g-4">
    ${kpi('layers', classes.length, 'Classes suivies', `${eff} élèves`)}
    ${kpi('checkCircle', `${val} / ${classes.length}`, 'Fiches validées', `Séquence ${seq}`, 'gold')}
    ${kpi('clock', `${classes.reduce((a, c) => a + c.abs_nj, 0)} h`, 'Absences non justifiées', `Séquence ${seq}`, 'red')}
    ${kpi('flag', classes.reduce((a, c) => a + c.incidents, 0), 'Incidents signalés', `Séquence ${seq}`, 'blue')}
  </div>
  <div class="grid g-3 mt"><div class="span-2"><div class="card"><div class="card-h"><h3>Mes classes</h3></div><div class="card-b">
    ${classes.length ? h`<div class="grid g-2">${classes.map((c) => h`<div class="card cls-card"><div class="top"><div class="tag">${c.name.split(' ')[0]}</div><div><h4>${c.name}</h4><div class="sub">${c.effectif} élèves • ${c.incidents} incident(s) • ${c.abs_nj} h d'abs. NJ</div></div></div>
      <div class="row">${c.validated.includes(seq) ? h`<span class="badge green">${icon('check', 'sm')} Fiche S${seq} validée</span>` : h`<span class="badge amber">Fiche S${seq} à compléter</span>`}</div>
      <div class="foot"><a class="btn btn-primary btn-sm" href="#/saisie?class=${c.id}&seq=${seq}">${icon('edit', 'sm')} Saisir</a><button class="btn btn-outline btn-sm" data-pdf="${c.id}">${icon('pdf', 'sm')} Fiche PDF</button>
      <a class="btn btn-ghost btn-sm" href="#/incidents?class=${c.id}">${icon('flag', 'sm')} Incidents</a></div></div>`)}</div>`
    : empty('Aucune classe', "L'administrateur ne vous a encore attribué aucune classe.", 'layers')}</div></div></div>
    <div>${announcementsWidget(ann)}</div></div>`);
  $$('[data-pdf]', view).forEach((b) => (b.onclick = () => openPdf(`/discipline?class_id=${b.dataset.pdf}&period=S${seq}`)));
}

async function saisie(view, params) {
  const { classes, seq: cur } = await get('/discipline/classes');
  if (!classes.length) return mount(view, h`<div class="card">${empty('Aucune classe', "Aucune classe ne vous est attribuée. Contactez l'administrateur.", 'layers')}</div>`);
  const cid = +params.class || classes[0].id, period = periodParam(params, cur);
  mount(view, h`<div data-ed></div>`);
  await disciplineEditor($('[data-ed]', view), { class_id: cid, period, classes, onChange: (c, p) => go('saisie', { class: c, period: p }) });
}

async function fiches(view) {
  const { classes, seq } = await get('/discipline/classes');
  mount(view, h`<div class="page-head"><div><h2>Fiches des faits disciplinaires</h2><p>Exportez les fiches officielles au format PDF.</p></div></div>
    <div class="toolbar"><label class="label">Période :</label><select class="select" style="width:auto" data-period>${periodOptions(`S${seq}`)}</select></div>
    <div class="card">${classes.length ? h`<div class="table-wrap"><table class="t rt"><thead><tr><th>Classe</th><th class="center">Élèves</th><th>État S${seq}</th><th></th></tr></thead>
    <tbody>${classes.map((c) => h`<tr><td class="primary-cell">${c.name}</td><td class="center" data-label="Élèves">${c.effectif}</td>
      <td data-label="État">${c.validated.includes(seq) ? h`<span class="badge green">Validée</span>` : h`<span class="badge amber">En cours</span>`}</td>
      <td class="actions-cell"><button class="btn btn-primary btn-sm" data-pdf="${c.id}">${icon('pdf', 'sm')} Fiche de classe</button> <button class="btn btn-ghost btn-sm" data-list="${c.id}">${icon('users', 'sm')} Fiches individuelles</button></td></tr>`)}</tbody></table></div>`
    : empty('Aucune classe', '', 'layers')}</div>
    <div data-students class="mt"></div>`);
  $$('[data-pdf]', view).forEach((b) => (b.onclick = () => openPdf(`/discipline?class_id=${b.dataset.pdf}&period=${$('[data-period]', view).value}`)));
  $$('[data-list]', view).forEach((b) => (b.onclick = async () => {
    const s = await get(`/discipline/sheet?class_id=${b.dataset.list}&seq=${seq}`);
    mount($('[data-students]', view), h`<div class="card"><div class="card-h"><h3>${s.classe.name} — fiches individuelles</h3></div><div class="table-wrap"><table class="t rt"><tbody>
      ${s.students.map((x) => h`<tr><td class="primary-cell">${x.nom} ${x.prenom}</td><td data-label="Matricule">${x.matricule}</td>
      <td class="actions-cell"><button class="btn btn-ghost btn-sm" data-hist="${x.id}">${icon('eye', 'sm')} Historique</button> <button class="btn btn-outline btn-sm" data-ind="${x.id}">${icon('pdf', 'sm')} PDF</button></td></tr>`)}</tbody></table></div></div>`);
    $$('[data-ind]', view).forEach((x) => (x.onclick = () => openPdf(`/discipline-eleve?student_id=${x.dataset.ind}`)));
    $$('[data-hist]', view).forEach((x) => (x.onclick = () => studentHistory(+x.dataset.hist)));
    $('[data-students]', view).scrollIntoView({ behavior: 'smooth' });
  }));
}

async function edt(view, params) {
  const { classes } = await get('/discipline/classes');
  if (!classes.length) return mount(view, h`<div class="card">${empty('Aucune classe', '', 'calendar')}</div>`);
  const cid = +params.class || classes[0].id;
  mount(view, h`<div class="toolbar"><select class="select" style="width:auto" data-class>${classes.map((c) => h`<option value="${c.id}" ${c.id === cid ? raw('selected') : ''}>${c.name}</option>`)}</select></div><div data-tt></div>`);
  $('[data-class]', view).onchange = (e) => go('edt', { class: e.target.value });
  await timetablePage($('[data-tt]', view), { kind: 'class', id: cid });
}
export { state, progressBar };
