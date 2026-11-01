// Console du super administrateur AI721 TECH STUFF.
import { h, raw, mount, $, $$, icon, toast, modal, kpi, empty, formModal, confirmDialog, fieldHtml, readForm, copyText, withBusy,
  fmtTs, fmtDate, barsV, debounce, downloadCSV } from './ui.js';
import { get, post, put, del, openPdf } from './api.js';
import { state, go, rerender } from './app.js';

export const routes = [
  { path: 'dashboard', title: 'Tableau de bord', short: 'Accueil', icon: 'home', group: 'Pilotage', mobile: true, render: dashboard },
  { path: 'etablissements', title: 'Établissements', short: 'Écoles', icon: 'building', group: 'Pilotage', mobile: true, render: etablissements },
  { path: 'etablissement', title: "Fiche de l'établissement", icon: 'building', group: 'Pilotage', nav: false, render: fiche },
  { path: 'abonnements', title: 'Abonnements & paiements', short: 'Paiements', icon: 'database', group: 'Pilotage', mobile: true, render: abonnements },
  { path: 'parametres', title: "Paramètres de l'entreprise", icon: 'settings', group: 'Administration', render: parametres },
  { path: 'journal', title: "Journal d'audit", icon: 'history', group: 'Administration', render: journal }
];

const money = (n) => `${Number(n || 0).toLocaleString('fr-FR')} ${state.school?.devise || 'FCFA'}`;
const STATUS_TONE = { actif: 'green', expire_bientot: 'amber', expire: 'red', impaye: 'amber', suspendu: 'red', aucun: 'red', a_venir: 'blue' };
const statusBadge = (t) => h`<span class="badge ${STATUS_TONE[t.status_code] || ''}"><span class="dot"></span>${t.status_label}</span>`;
const schoolYear = (offset = 0) => { const d = new Date(); const y = (d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1) + offset; return `${y}-${y + 1}`; };
const MODES = ['Espèces', 'Mobile Money', 'Orange Money', 'Virement', 'Chèque', 'Autre'];
const REGIONS = ['Adamaoua', 'Centre', 'Est', 'Extrême-Nord', 'Littoral', 'Nord', 'Nord-Ouest', 'Ouest', 'Sud', 'Sud-Ouest'];
const TYPES = ["Lycée d'enseignement général", 'Lycée technique', 'Lycée bilingue', 'Lycée classique et moderne', "Collège d'enseignement secondaire (CES)",
  "Collège d'enseignement technique (CETIC)", 'Collège privé laïc', 'Collège privé confessionnel', 'Lycée polyvalent'];

/* ---------- Coffre : identifiants de l'administrateur d'un établissement ---------- */
async function showAccess(t, creds) {
  const c = creds || await post(`/tenants/${t.id}/reveal`);
  const L = c.links;
  const msg = `Bonjour${t.contact_nom ? ' ' + t.contact_nom : ''},\nVoici vos accès à la plateforme EduGest CM pour « ${t.name} »${t.annee ? ` (abonnement ${t.annee}, valable jusqu'au ${fmtDate(t.valid_to)})` : ''} :\n`
    + `• Adresse administrateur : ${L.admin}\n• Identifiant : ${c.username}\n• Mot de passe : ${c.password || '(à régénérer)'}\n\nLiens à transmettre à votre personnel :\n• Enseignants : ${L.teacher}\n• Vie scolaire : ${L.discipline}\n\n${state.school.societe}${state.school.tel ? ' — ' + state.school.tel : ''}`;
  const phone = String(t.contact_tel || '').replace(/\D/g, '');
  const wa = `https://wa.me/${phone.length === 9 ? '237' + phone : phone}?text=${encodeURIComponent(msg)}`;
  await modal({
    title: `Accès — ${t.name}`, size: 'lg',
    body: h`${c.password ? '' : h`<div class="alert warn mb">${icon('alert')}<div>${c.changed_by_user ? "L'administrateur a choisi son propre mot de passe : il n'est pas conservé. Générez-en un nouveau en cas d'oubli." : 'Aucun mot de passe conservé : générez-en un nouveau.'}</div></div>`}
      <div class="grid g-2" style="gap:10px">
        <div class="cred"><span><span class="small muted">Identifiant administrateur</span><br>${c.username || '—'}</span><button class="btn btn-ghost btn-sm btn-icon" data-copy="${c.username || ''}">${icon('copy', 'sm')}</button></div>
        <div class="cred"><span><span class="small muted">Mot de passe</span><br><span class="secret">${c.password || '—'}</span></span>${c.password ? h`<button class="btn btn-ghost btn-sm btn-icon" data-copy="${c.password}">${icon('copy', 'sm')}</button>` : ''}</div>
      </div>
      <h4 class="mt mb">Liens de la plateforme</h4>
      <div class="stack" style="gap:8px">${[['Administration (à remettre au chef d’établissement)', L.admin], ['Enseignants', L.teacher], ['Vie scolaire (discipline)', L.discipline], ["Page d'accueil de l'établissement", L.portal]]
    .map(([k, v]) => h`<div class="cred" style="font-size:13px"><span><span class="small muted">${k}</span><br>${v}</span><button class="btn btn-ghost btn-sm btn-icon" data-copy="${v}">${icon('copy', 'sm')}</button></div>`)}</div>`,
    footer: h`<button class="btn btn-danger-soft" data-reset>${icon('refresh')} Nouveau mot de passe</button><div style="flex:1"></div>
      <button class="btn btn-outline" data-msg>${icon('copy')} Copier le message</button>
      <a class="btn btn-outline" href="${wa}" target="_blank" rel="noopener">${icon('send')} WhatsApp</a>
      <button class="btn btn-primary" data-pdf>${icon('pdf')} Fiche d'accès PDF</button>`,
    onOpen: ({ root, close }) => {
      $$('[data-copy]', root).forEach((b) => (b.onclick = () => copyText(b.dataset.copy)));
      $('[data-msg]', root).onclick = () => copyText(msg);
      $('[data-pdf]', root).onclick = () => openPdf(`/pdf/acces/${t.id}`);
      $('[data-reset]', root).onclick = async () => {
        if (!(await confirmDialog({ title: 'Générer un nouveau mot de passe ?', message: `L'ancien mot de passe de l'administrateur de « ${t.name} » ne fonctionnera plus et ses sessions seront fermées.`, okLabel: 'Générer' }))) return;
        const n = await post(`/tenants/${t.id}/reset-admin`); close(); toast('Nouveau mot de passe généré'); showAccess(t, n);
      };
    }
  });
}

/* ---------- Formulaires ---------- */
const subFields = (ps, opts = {}) => [
  { name: 'annee', label: 'Année scolaire (1er septembre → 31 août)', type: 'select', placeholder: false, required: true, options: [schoolYear(-1), schoolYear(), schoolYear(1)].map((y) => [y, y]) },
  { name: 'montant', label: `Montant (${ps.devise})`, type: 'number', min: 0, step: 500, required: true },
  { name: 'paid', label: 'Paiement reçu', type: 'checkbox' },
  { name: 'mode', label: 'Mode de paiement', type: 'select', options: MODES.map((m) => [m, m]) },
  { name: 'reference', label: 'Référence de la transaction', placeholder: 'ex. MOMO-458712' },
  ...(opts.regenerate ? [{ name: 'regenerate', label: "Générer de nouveaux identifiants pour l'administrateur", type: 'checkbox', full: true }] : [])];

async function newTenant() {
  const ps = await get('/settings');
  const fields = [
    { name: 'name', label: "Nom de l'établissement", required: true, full: true, placeholder: 'ex. Lycée Bilingue de Kribi' },
    { name: 'sigle', label: 'Sigle', placeholder: 'ex. LBK' }, { name: 'code', label: 'Code (adresse /e/code)', required: true, hint: 'Lettres minuscules, chiffres, tirets' },
    { name: 'type', label: 'Type', type: 'select', options: TYPES.map((x) => [x, x]) },
    { name: 'statut', label: 'Statut', type: 'select', options: [['Public', 'Public'], ['Privé laïc', 'Privé laïc'], ['Privé confessionnel', 'Privé confessionnel']] },
    { name: 'region', label: 'Région', type: 'select', options: REGIONS.map((x) => [x, x]) }, { name: 'ville', label: 'Ville' },
    { name: 'contact_nom', label: "Chef d'établissement / contact" }, { name: 'contact_tel', label: 'Téléphone (WhatsApp)', type: 'tel' },
    { name: 'contact_email', label: 'E-mail', type: 'email', full: true },
    ...subFields(ps), { name: 'notes', label: 'Notes internes', type: 'textarea', full: true, max: 500 }];
  const r = await formModal({
    title: 'Nouvel établissement abonné', size: 'lg', submitLabel: 'Créer et générer les accès', fields,
    values: { annee: schoolYear(), montant: ps.tarif, paid: true, statut: 'Public' },
    intro: h`<div class="alert info mb">${icon('info')}<div class="small">Une base de données dédiée est créée, ainsi que le compte de l'administrateur de l'établissement (identifiant et mot de passe faciles à retenir, conservés dans votre coffre). Les accès sont valables pour l'année scolaire choisie : du 1er septembre au 31 août.</div></div>`,
    onReady: ({ root }) => {
      const code = $('[name=code]', root); let touched = false;
      code.addEventListener('input', () => { touched = true; });
      const suggest = debounce(async () => {
        if (touched) return;
        const n = $('[name=name]', root).value, s = $('[name=sigle]', root).value;
        if (n || s) code.value = (await get(`/code-suggestion?name=${encodeURIComponent(n)}&sigle=${encodeURIComponent(s)}`)).code;
      }, 300);
      $('[name=name]', root).addEventListener('input', suggest); $('[name=sigle]', root).addEventListener('input', suggest);
    },
    onSubmit: (d) => post('/tenants', d)
  });
  if (r?.tenant) { toast('Établissement créé'); await showAccess(r.tenant, { username: r.username, password: r.password, links: r.links }); go('etablissement', { id: r.tenant.id }); }
}
async function renew(t) {
  const ps = await get('/settings');
  const next = t.annee && t.annee >= schoolYear() ? `${+t.annee.slice(0, 4) + 1}-${+t.annee.slice(0, 4) + 2}` : schoolYear();
  const r = await formModal({ title: `Renouveler l'abonnement — ${t.name}`, size: 'lg', submitLabel: 'Enregistrer', fields: subFields(ps, { regenerate: true }),
    values: { annee: next, montant: t.montant || ps.tarif, paid: true }, onSubmit: (d) => post(`/tenants/${t.id}/subscriptions`, d) });
  if (r) { toast('Abonnement enregistré'); if (r.credentials) await showAccess(t, r.credentials); rerender(); }
}
async function editSub(sub) {
  const ps = await get('/settings');
  const fields = [{ name: 'montant', label: `Montant (${ps.devise})`, type: 'number', min: 0, step: 500, required: true }, { name: 'paid', label: 'Paiement reçu', type: 'checkbox' },
    { name: 'paid_at', label: 'Date de paiement', type: 'date' }, { name: 'mode', label: 'Mode', type: 'select', options: MODES.map((m) => [m, m]) },
    { name: 'reference', label: 'Référence' }, { name: 'note', label: 'Note', type: 'textarea', full: true, max: 300 }];
  if (await formModal({ title: `Abonnement ${sub.annee}`, fields, values: { ...sub, paid: !!sub.paid }, onSubmit: (d) => put(`/subscriptions/${sub.id}`, d) })) { toast('Abonnement mis à jour'); rerender(); }
}

/* ---------- Tableau de bord ---------- */
async function dashboard(view) {
  const d = await get('/dashboard'); const k = d.kpis;
  const urgent = d.tenants.filter((t) => ['expire_bientot', 'expire', 'impaye', 'suspendu'].includes(t.status_code));
  mount(view, h`<div class="page-head"><div><h2>Tableau de bord</h2><p>Plateforme EduGest CM — année scolaire ${d.year}.</p></div>
    <div class="actions"><button class="btn btn-outline" data-pdf>${icon('pdf')} Liste PDF</button><button class="btn btn-primary" data-new>${icon('plus')} Nouvel établissement</button></div></div>
  <div class="grid g-4">
    ${kpi('building', k.total, 'Établissements abonnés', `${k.actifs} actif(s) • ${k.inactifs} inactif(s)`)}
    ${kpi('users', k.eleves.toLocaleString('fr-FR'), 'Élèves gérés', `${k.enseignants} enseignants`, 'blue')}
    ${kpi('database', money(k.recettes_annee), `Recettes ${d.year}`, `Attendu : ${money(k.attendu_annee)}`, 'gold')}
    ${kpi('alert', k.impayes + k.expirent_bientot, 'À relancer', `${k.impayes} impayé(s) • ${k.expirent_bientot} échéance(s) proche(s)`, 'red')}
  </div>
  <div class="grid g-3 mt">
    <div class="card span-2"><div class="card-h"><h3>Établissements</h3><div class="actions"><a class="btn btn-ghost btn-sm" href="#/etablissements">Tout voir ${icon('arrowRight', 'sm')}</a></div></div>
      <div class="table-wrap"><table class="t rt"><thead><tr><th>Établissement</th><th>Abonnement</th><th>Statut</th><th class="num">Élèves</th><th>Dernière activité</th><th></th></tr></thead>
      <tbody>${d.tenants.map((t) => h`<tr><td class="primary-cell"><a href="#/etablissement?id=${t.id}">${t.name}</a><div class="cell-sub">${t.code} • ${t.ville || '—'}</div></td>
        <td data-label="Abonnement">${t.annee || '—'}<div class="cell-sub">${t.valid_to ? "jusqu'au " + fmtDate(t.valid_to) : ''}</div></td><td data-label="Statut">${statusBadge(t)}</td>
        <td class="num" data-label="Élèves">${t.eleves ?? '—'}</td><td data-label="Activité" class="small">${t.derniere_connexion ? fmtTs(t.derniere_connexion) : 'Jamais'}</td>
        <td class="actions-cell"><button class="btn btn-ghost btn-sm btn-icon" data-acc="${t.id}" title="Accès et liens">${icon('key', 'sm')}</button></td></tr>`)}</tbody></table></div>
      ${!d.tenants.length ? empty('Aucun établissement', 'Créez le premier établissement abonné.', 'building') : ''}</div>
    <div class="stack">
      <div class="card"><div class="card-h"><h3>Échéances & relances</h3><span class="badge ${urgent.length ? 'amber' : 'green'}">${urgent.length}</span></div>
        ${urgent.length ? h`<div class="list">${urgent.map((t) => h`<a class="list-item" href="#/etablissement?id=${t.id}" style="color:inherit;text-decoration:none"><div class="ico ${t.status_code === 'expire_bientot' || t.status_code === 'impaye' ? 'warn' : 'danger'}">${icon('alert')}</div>
          <div><b class="small">${t.name}</b><div class="meta">${t.message}</div></div></a>`)}</div>` : empty('Rien à signaler', 'Tous les abonnements sont à jour.', 'checkCircle')}</div>
      <div class="card"><div class="card-h"><h3>Recettes par année</h3></div><div class="card-b">${barsV(d.years.map((y) => ({ label: y.annee, value: y.recettes / 1000 })), { max: Math.max(1, ...d.years.map((y) => y.recettes / 1000)), seuil: 0 })}
        <div class="small muted mt">En milliers de ${state.school.devise || 'FCFA'}</div></div></div>
    </div>
  </div>
  <div class="grid g-2 mt">
    <div class="card"><div class="card-h"><h3>Répartition par région</h3></div><div class="list">${d.regions.map((r) => h`<div class="list-item"><div class="ico info">${icon('flag')}</div><div style="flex:1">${r.region}</div><b>${r.n}</b></div>`)}</div></div>
    <div class="card"><div class="card-h"><h3>Activité récente</h3><div class="actions"><a class="btn btn-ghost btn-sm" href="#/journal">Journal</a></div></div>
      <div class="list">${d.activity.map((a) => h`<div class="list-item"><div class="ico">${icon('history')}</div><div style="min-width:0"><div class="small"><b>${a.username || 'Système'}</b> — ${a.action.replace(/_/g, ' ').toLowerCase()}</div><div class="meta">${a.detail || ''} • ${fmtTs(a.at)}</div></div></div>`)}</div></div>
  </div>`);
  $('[data-new]', view).onclick = newTenant;
  $('[data-pdf]', view).onclick = () => openPdf('/pdf/etablissements');
  $$('[data-acc]', view).forEach((b) => (b.onclick = () => showAccess(d.tenants.find((t) => t.id === +b.dataset.acc))));
}

/* ---------- Établissements ---------- */
async function etablissements(view, params) {
  const list = await get('/tenants');
  const q = (params.q || '').toLowerCase(), f = params.f || '';
  const shown = list.filter((t) => (!q || `${t.name} ${t.code} ${t.ville} ${t.contact_nom}`.toLowerCase().includes(q)) && (!f || (f === 'actif' ? t.valid : !t.valid)));
  mount(view, h`<div class="page-head"><div><h2>Établissements</h2><p>${list.length} établissement(s) — accès valables du 1er septembre au 31 août.</p></div>
    <div class="actions"><button class="btn btn-outline" data-csv>${icon('download')} Export</button><button class="btn btn-primary" data-new>${icon('plus')} Nouvel établissement</button></div></div>
  <div class="toolbar"><div class="grow input-icon">${icon('search', 'sm')}<input class="input" placeholder="Rechercher (nom, code, ville, contact)…" value="${params.q || ''}" data-q></div>
    <div class="seg">${[['', 'Tous'], ['actif', 'Actifs'], ['inactif', 'Inactifs']].map(([k, l]) => h`<button class="${f === k ? 'on' : ''}" data-f="${k}">${l}</button>`)}</div></div>
  <div class="grid g-auto">${shown.map((t) => h`<div class="card cls-card"><div class="top"><div class="tag">${(t.sigle || t.code).slice(0, 4).toUpperCase()}</div>
      <div style="min-width:0;flex:1"><h4><a href="#/etablissement?id=${t.id}">${t.name}</a></h4><div class="sub">/e/${t.code} • ${t.ville || '—'}${t.region ? ' (' + t.region + ')' : ''}</div></div></div>
    <div class="row">${statusBadge(t)}<span class="chip">${t.annee || 'Sans abonnement'}${t.montant != null ? ' • ' + money(t.montant) : ''}</span></div>
    <div class="chips"><span class="chip">${icon('users', 'sm')} ${t.eleves ?? 0} élèves</span><span class="chip">${t.enseignants ?? 0} enseignants</span><span class="chip">${t.classes ?? 0} classes</span></div>
    <div class="small muted">${t.contact_nom || ''}${t.contact_tel ? ' • ' + t.contact_tel : ''}</div>
    <div class="foot"><button class="btn btn-primary btn-sm" data-acc="${t.id}">${icon('key', 'sm')} Accès</button><button class="btn btn-outline btn-sm" data-renew="${t.id}">${icon('refresh', 'sm')} Renouveler</button>
      <a class="btn btn-ghost btn-sm" href="#/etablissement?id=${t.id}">${icon('eye', 'sm')} Fiche</a></div></div>`)}</div>
  ${!shown.length ? h`<div class="card">${empty('Aucun établissement', list.length ? 'Aucun résultat pour ce filtre.' : 'Créez le premier établissement abonné.', 'building')}</div>` : ''}`);
  $('[data-new]', view).onclick = newTenant;
  $('[data-q]', view).oninput = debounce((e) => go('etablissements', { q: e.target.value, f }), 300);
  $$('[data-f]', view).forEach((b) => (b.onclick = () => go('etablissements', { q: params.q, f: b.dataset.f })));
  $$('[data-acc]', view).forEach((b) => (b.onclick = () => showAccess(list.find((t) => t.id === +b.dataset.acc))));
  $$('[data-renew]', view).forEach((b) => (b.onclick = () => renew(list.find((t) => t.id === +b.dataset.renew))));
  $('[data-csv]', view).onclick = () => downloadCSV('etablissements.csv', [['Code', 'Établissement', 'Ville', 'Région', 'Contact', 'Téléphone', 'Abonnement', 'Valable jusqu’au', 'Montant', 'Statut', 'Élèves', 'Enseignants'],
    ...list.map((t) => [t.code, t.name, t.ville, t.region, t.contact_nom, t.contact_tel, t.annee, t.valid_to, t.montant, t.status_label, t.eleves, t.enseignants])]);
}

/* ---------- Fiche d'un établissement ---------- */
async function fiche(view, params) {
  const t = await get(`/tenants/${+params.id}`);
  mount(view, h`<div class="toolbar"><a class="btn btn-ghost btn-sm" href="#/etablissements">← Établissements</a></div>
  <div class="page-head"><div><h2>${t.name}</h2><p>${statusBadge(t)} <span class="muted">${t.message}</span></p></div>
    <div class="actions"><button class="btn btn-outline" data-edit>${icon('edit')} Modifier</button><button class="btn btn-outline" data-toggle>${icon(t.status === 'active' ? 'lock' : 'unlock')} ${t.status === 'active' ? 'Suspendre' : 'Réactiver'}</button>
      <button class="btn btn-primary" data-acc>${icon('key')} Accès & liens</button></div></div>
  <div class="grid g-4">
    ${kpi('users', t.eleves ?? 0, 'Élèves')}${kpi('teacher', t.enseignants ?? 0, 'Enseignants', `${t.responsables ?? 0} resp. disciplinaire(s)`, 'blue')}
    ${kpi('layers', t.classes ?? 0, 'Classes', `Année ${t.annee_scolaire || '—'}`, 'gold')}${kpi('lock', `${t.sequences_cloturees ?? 0}/6`, 'Séquences clôturées', t.derniere_connexion ? 'Activité : ' + fmtTs(t.derniere_connexion) : 'Aucune connexion')}
  </div>
  <div class="grid g-2 mt">
    <div class="card"><div class="card-h"><h3>Informations</h3></div><div class="card-b"><div class="stack small" style="gap:6px">
      ${[['Code', `${t.code} (adresse /e/${t.code})`], ['Sigle', t.sigle], ['Type', t.type], ['Statut', t.statut], ['Région / ville', [t.region, t.ville].filter(Boolean).join(' — ')],
    ['Contact', t.contact_nom], ['Téléphone', t.contact_tel], ['E-mail', t.contact_email], ['Administrateur', t.admin_username], ['Créé le', fmtTs(t.created_at)], ['Notes', t.notes]]
    .map(([k, v]) => h`<div class="row" style="justify-content:space-between;flex-wrap:nowrap"><span class="muted">${k}</span><b style="text-align:right">${v || '—'}</b></div>`)}</div></div></div>
    <div class="card"><div class="card-h"><h3>Liens de la plateforme</h3></div><div class="card-b stack" style="gap:8px">
      ${[['Administration', t.links.admin], ['Enseignants', t.links.teacher], ['Vie scolaire', t.links.discipline]].map(([k, v]) => h`<div class="cred" style="font-size:13px"><span><span class="small muted">${k}</span><br>${v}</span><button class="btn btn-ghost btn-sm btn-icon" data-copy="${v}">${icon('copy', 'sm')}</button></div>`)}
      <div class="row"><button class="btn btn-outline btn-sm" data-fpdf>${icon('pdf', 'sm')} Fiche d'accès PDF</button><a class="btn btn-ghost btn-sm" href="${t.links.portal}" target="_blank" rel="noopener">${icon('eye', 'sm')} Ouvrir le portail</a></div></div></div>
  </div>
  <div class="card mt"><div class="card-h"><h3>Abonnements</h3><span class="sub">Chaque abonnement couvre une année scolaire : du 1er septembre au 31 août.</span><div class="actions"><button class="btn btn-primary btn-sm" data-renew>${icon('plus', 'sm')} Nouvel abonnement / renouvellement</button></div></div>
    <div class="table-wrap"><table class="t rt"><thead><tr><th>Année</th><th>Validité</th><th class="num">Montant</th><th>Paiement</th><th>Référence</th><th></th></tr></thead>
    <tbody>${t.subscriptions.map((s) => h`<tr><td class="primary-cell">${s.annee}</td><td data-label="Validité">${fmtDate(s.valid_from)} → ${fmtDate(s.valid_to)}</td><td class="num" data-label="Montant">${money(s.montant)}</td>
      <td data-label="Paiement">${s.paid ? h`<span class="badge green">Payé le ${fmtDate(s.paid_at)}</span>` : h`<span class="badge amber">En attente</span>`}${s.mode ? h`<div class="cell-sub">${s.mode}</div>` : ''}</td>
      <td data-label="Référence" class="small">${s.reference || '—'}</td>
      <td class="actions-cell"><button class="btn btn-ghost btn-sm" data-sub="${s.id}">${icon('edit', 'sm')}</button><button class="btn btn-ghost btn-sm" data-recu="${s.id}">${icon('pdf', 'sm')} Reçu</button><button class="btn btn-ghost btn-sm btn-icon" data-dsub="${s.id}">${icon('trash', 'sm')}</button></td></tr>`)}</tbody></table></div>
    ${!t.subscriptions.length ? empty('Aucun abonnement', '', 'database') : ''}</div>
  <div class="card mt"><div class="card-h"><h3 style="color:var(--red-600)">Zone sensible</h3></div><div class="card-b row"><div style="flex:1" class="small muted">La suppression retire l'établissement de la plateforme. Ses données sont déplacées dans le dossier « supprimes » du serveur (récupérables par l'équipe technique).</div>
    <button class="btn btn-danger-soft" data-del>${icon('trash')} Supprimer l'établissement</button></div></div>`);
  $$('[data-copy]', view).forEach((b) => (b.onclick = () => copyText(b.dataset.copy)));
  $('[data-acc]', view).onclick = () => showAccess(t);
  $('[data-fpdf]', view).onclick = () => openPdf(`/pdf/acces/${t.id}`);
  $('[data-renew]', view).onclick = () => renew(t);
  $$('[data-recu]', view).forEach((b) => (b.onclick = () => openPdf(`/pdf/recu/${b.dataset.recu}`)));
  $$('[data-sub]', view).forEach((b) => (b.onclick = () => editSub(t.subscriptions.find((s) => s.id === +b.dataset.sub))));
  $$('[data-dsub]', view).forEach((b) => (b.onclick = async () => {
    const c = await confirmDialog({ title: 'Supprimer cet abonnement ?', message: "S'il couvre la période actuelle, l'établissement perdra immédiatement l'accès.", requirePassword: true, danger: true, okLabel: 'Supprimer' });
    if (c) { try { await del(`/subscriptions/${b.dataset.dsub}`, { password: c.password }); toast('Abonnement supprimé'); rerender(); } catch (ex) { toast(ex.message, 'err'); } }
  }));
  $('[data-toggle]', view).onclick = async () => {
    const sus = t.status === 'active';
    if (!(await confirmDialog({ title: sus ? 'Suspendre cet établissement ?' : 'Réactiver cet établissement ?', message: sus ? 'Tous ses utilisateurs seront déconnectés et ne pourront plus se connecter.' : "L'accès sera rétabli si l'abonnement est valide et payé.", danger: sus, okLabel: sus ? 'Suspendre' : 'Réactiver' }))) return;
    await post(`/tenants/${t.id}/toggle`); toast(sus ? 'Établissement suspendu' : 'Établissement réactivé'); rerender();
  };
  $('[data-edit]', view).onclick = async () => {
    const fields = [{ name: 'name', label: 'Nom', required: true, full: true }, { name: 'sigle', label: 'Sigle' }, { name: 'type', label: 'Type', type: 'select', options: TYPES.map((x) => [x, x]) },
      { name: 'statut', label: 'Statut', type: 'select', options: [['Public', 'Public'], ['Privé laïc', 'Privé laïc'], ['Privé confessionnel', 'Privé confessionnel']] },
      { name: 'region', label: 'Région', type: 'select', options: REGIONS.map((x) => [x, x]) }, { name: 'ville', label: 'Ville' },
      { name: 'contact_nom', label: 'Contact' }, { name: 'contact_tel', label: 'Téléphone', type: 'tel' }, { name: 'contact_email', label: 'E-mail', type: 'email', full: true },
      { name: 'notes', label: 'Notes internes', type: 'textarea', full: true, max: 500 }];
    if (await formModal({ title: "Modifier l'établissement", size: 'lg', fields, values: t, onSubmit: (d) => put(`/tenants/${t.id}`, d) })) { toast('Modifications enregistrées'); rerender(); }
  };
  $('[data-del]', view).onclick = async () => {
    const c = await confirmDialog({ title: `Supprimer « ${t.name} » ?`, message: "L'établissement ne sera plus accessible. Ses données seront archivées sur le serveur.", requirePassword: true, danger: true, okLabel: 'Supprimer' });
    if (c) { try { await del(`/tenants/${t.id}`, { password: c.password }); toast('Établissement supprimé'); go('etablissements'); } catch (ex) { toast(ex.message, 'err'); } }
  };
}

/* ---------- Abonnements & paiements ---------- */
async function abonnements(view, params) {
  const annee = params.annee || schoolYear();
  const list = await get(`/subscriptions?annee=${annee}`);
  const paid = list.filter((s) => s.paid), due = list.filter((s) => !s.paid);
  mount(view, h`<div class="page-head"><div><h2>Abonnements & paiements</h2><p>Année scolaire ${annee} (du 1er septembre au 31 août).</p></div>
    <div class="actions"><select class="select" style="width:auto" data-annee>${[schoolYear(-2), schoolYear(-1), schoolYear(), schoolYear(1)].map((y) => h`<option ${y === annee ? raw('selected') : ''}>${y}</option>`)}</select>
    <button class="btn btn-outline" data-csv>${icon('download')} Export</button></div></div>
  <div class="grid g-3">${kpi('database', money(paid.reduce((a, s) => a + s.montant, 0)), 'Encaissé', `${paid.length} abonnement(s) payé(s)`)}
    ${kpi('clock', money(due.reduce((a, s) => a + s.montant, 0)), 'En attente', `${due.length} abonnement(s)`, 'gold')}
    ${kpi('building', list.length, 'Abonnements', annee, 'blue')}</div>
  <div class="card mt"><div class="table-wrap"><table class="t rt"><thead><tr><th>Établissement</th><th class="num">Montant</th><th>Paiement</th><th>Mode / référence</th><th></th></tr></thead>
    <tbody>${list.map((s) => h`<tr><td class="primary-cell"><a href="#/etablissement?id=${s.tenant_id}">${s.name}</a><div class="cell-sub">${s.code} • ${s.ville || ''}</div></td>
      <td class="num" data-label="Montant">${money(s.montant)}</td>
      <td data-label="Paiement">${s.paid ? h`<span class="badge green">Payé le ${fmtDate(s.paid_at)}</span>` : h`<span class="badge amber">En attente</span>`}</td>
      <td data-label="Mode" class="small">${[s.mode, s.reference].filter(Boolean).join(' — ') || '—'}</td>
      <td class="actions-cell">${!s.paid ? h`<button class="btn btn-primary btn-sm" data-pay="${s.id}">${icon('check', 'sm')} Encaisser</button>` : ''}<button class="btn btn-ghost btn-sm" data-recu="${s.id}">${icon('pdf', 'sm')} Reçu</button></td></tr>`)}</tbody></table></div>
    ${!list.length ? empty('Aucun abonnement', `Aucun abonnement pour ${annee}.`, 'database') : ''}</div>`);
  $('[data-annee]', view).onchange = (e) => go('abonnements', { annee: e.target.value });
  $$('[data-recu]', view).forEach((b) => (b.onclick = () => openPdf(`/pdf/recu/${b.dataset.recu}`)));
  $$('[data-pay]', view).forEach((b) => (b.onclick = () => editSub({ ...list.find((s) => s.id === +b.dataset.pay), paid: 1, paid_at: new Date().toISOString().slice(0, 10) })));
  $('[data-csv]', view).onclick = () => downloadCSV(`abonnements_${annee}.csv`, [['Établissement', 'Code', 'Année', 'Montant', 'Payé', 'Date', 'Mode', 'Référence'],
    ...list.map((s) => [s.name, s.code, s.annee, s.montant, s.paid ? 'oui' : 'non', s.paid_at, s.mode, s.reference])]);
}

/* ---------- Paramètres de l'entreprise ---------- */
async function parametres(view) {
  const s = await get('/settings');
  const F = [{ name: 'societe', label: 'Raison sociale', required: true, full: true }, { name: 'slogan', label: 'Slogan', full: true },
    { name: 'adresse', label: 'Adresse' }, { name: 'tel', label: 'Téléphone', type: 'tel' }, { name: 'email', label: 'E-mail', type: 'email' }, { name: 'site', label: 'Site web' },
    { name: 'rccm', label: 'RCCM' }, { name: 'niu', label: 'NIU (numéro contribuable)' },
    { name: 'tarif', label: 'Tarif annuel par défaut', type: 'number', min: 0, step: 500 }, { name: 'devise', label: 'Devise' }];
  mount(view, h`<div class="page-head"><div><h2>Paramètres de l'entreprise</h2><p>Ces informations figurent sur les fiches d'accès, les reçus et les pages de connexion.</p></div></div>
    <div class="card"><div class="card-b"><form class="form-grid" data-form>${F.map((f) => fieldHtml(f, s[f.name]))}</form>
    <div class="row mt" style="justify-content:flex-end"><button class="btn btn-primary" data-save>${icon('save')} Enregistrer</button></div></div></div>`);
  $('[data-save]', view).onclick = (e) => withBusy(e.currentTarget, async () => {
    try { const ns = await put('/settings', readForm($('[data-form]', view), F)); Object.assign(state.school, ns); toast('Paramètres enregistrés'); } catch (ex) { toast(ex.message, 'err'); }
  });
}

/* ---------- Journal ---------- */
async function journal(view, params) {
  const list = await get(`/audit${params.q ? '?q=' + encodeURIComponent(params.q) : ''}`);
  mount(view, h`<div class="page-head"><div><h2>Journal d'audit de la plateforme</h2><p>Créations, paiements, consultations du coffre, réinitialisations, suspensions.</p></div></div>
  <div class="toolbar"><div class="grow input-icon">${icon('search', 'sm')}<input class="input" placeholder="Filtrer…" value="${params.q || ''}" data-q></div></div>
  <div class="card"><div class="table-wrap"><table class="t rt"><thead><tr><th>Date</th><th>Utilisateur</th><th>Action</th><th>Détail</th><th>IP</th></tr></thead>
    <tbody>${list.map((a) => h`<tr><td data-label="Date" class="small">${fmtTs(a.at)}</td><td class="primary-cell">${a.username || '—'}</td>
      <td data-label="Action"><span class="badge ${/SUPPRIM|SUSPEND|ECHEC/.test(a.action) ? 'red' : /COFFRE|REINITIAL/.test(a.action) ? 'amber' : /CREE|PAIEMENT/.test(a.action) ? 'green' : ''}">${a.action.replace(/_/g, ' ')}</span></td>
      <td data-label="Détail" class="small">${a.detail || ''}</td><td data-label="IP" class="small mono">${a.ip || ''}</td></tr>`)}</tbody></table></div></div>`);
  $('[data-q]', view).oninput = debounce((e) => go('journal', { q: e.target.value }), 400);
}
