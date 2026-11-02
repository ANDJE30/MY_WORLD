// Chronogramme des dépôts des documents périodiques : import (Word ou PDF), échéances, rappels, modèles Word, dépôts.
import { h, raw, mount, $, $$, icon, toast, modal, fmtDate, fmtTs, kpi, empty, formModal, confirmDialog, withBusy, terms } from './ui.js';
import { get, post, put, del, apiUrl } from './api.js';
import { go, rerender } from './app.js';

const ETAT = { depose: ['Déposé', 'green'], retard: ['En retard', 'red'], aujourdhui: ["Aujourd'hui", 'amber'], bientot: ['Bientôt', 'gold'], a_venir: ['À venir', ''] };
const PERIOD = { ponctuel: 'Ponctuel', mensuel: 'Mensuel', sequentiel: 'Chaque séquence', trimestriel: 'Chaque trimestre', annuel: 'Annuel' };
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const readFile = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
const etatLabel = (e) => (e.etat === 'depose' ? `Déposé le ${fmtDate(e.depose_at)}` : e.etat === 'retard' ? `En retard de ${-e.jours} j` : e.etat === 'aujourdhui' ? "À déposer aujourd'hui" : `Dans ${e.jours} j`);
const dl = (path) => apiUrl(`/admin/echeancier${path}`);

export async function chronogramme(view, params) {
  const d = await get('/admin/echeancier');
  const f = params.f || (d.stats.retard || d.stats.proches ? 'a_produire' : 'toutes');
  const shown = d.echeances.filter((e) => f === 'toutes' || (f === 'a_produire' ? e.etat !== 'depose' : f === 'retard' ? e.etat === 'retard' : e.etat === 'depose'));
  const urgent = d.echeances.filter((e) => ['retard', 'aujourdhui', 'bientot'].includes(e.etat));
  const groups = [];
  for (const e of shown) { const k = e.date_limite.slice(0, 7); let g = groups.find((x) => x.k === k); if (!g) groups.push(g = { k, items: [] }); g.items.push(e); }

  mount(view, h`<div class="page-head"><div><h2>Chronogramme des dépôts</h2><p>Documents périodiques à produire et à déposer auprès de la hiérarchie : la plateforme vous les rappelle et propose pour chacun un modèle Word pré-rempli, modifiable.</p></div>
    <div class="actions"><label class="btn btn-primary" style="cursor:pointer">${icon('upload')} Importer un chronogramme<input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" class="hidden" data-import></label>
      <button class="btn btn-outline" data-add>${icon('plus')} Échéance</button><div class="rel" style="display:inline-block"><button class="btn btn-outline" data-models>${icon('file')} Modèles Word ${icon('chevronDown', 'sm')}</button></div></div></div>
  <div class="grid g-4">${kpi('calendar', d.stats.total, 'Échéances de l’année', `${d.stats.a_venir} à venir`)}${kpi('checkCircle', d.stats.depose, 'Documents déposés', d.stats.total ? `${Math.round((d.stats.depose / d.stats.total) * 100)} % du chronogramme` : '', 'blue')}
    ${kpi('clock', d.stats.proches, 'À déposer prochainement', 'dans le délai de rappel', 'gold')}${kpi('alert', d.stats.retard, 'En retard', 'non déposés à la date limite', 'red')}</div>
  ${urgent.length ? h`<div class="card mt" style="border-left:4px solid var(--red-600)"><div class="card-h"><h3>${icon('bell', 'sm')} Rappels</h3><span class="sub">documents à produire en priorité</span></div><div class="list">
    ${urgent.map((e) => h`<div class="list-item rappel"><div class="ico ${e.etat === 'retard' ? 'danger' : 'warn'}">${icon(e.etat === 'retard' ? 'alert' : 'clock')}</div>
      <div class="rappel-t"><b>${e.titre}</b><div class="meta">${etatLabel(e)} • date limite ${fmtDate(e.date_limite)}${e.destinataire ? ` • ${e.destinataire}` : ''}</div></div>
      <a class="btn btn-outline btn-sm" href="${dl(`/echeances/${e.id}/modele`)}" download>${icon('file', 'sm')} Modèle Word</a><button class="btn btn-primary btn-sm" data-depot="${e.id}">${icon('check', 'sm')} Déposé</button></div>`)}</div></div>` : ''}
  <div class="grid g-3 mt">
    <div class="card span-2"><div class="card-h"><h3>Échéances</h3><div class="actions"><div class="seg">${[['a_produire', 'À produire'], ['retard', 'En retard'], ['depose', 'Déposées'], ['toutes', 'Toutes']]
      .map(([k, l]) => h`<button class="${f === k ? 'on' : ''}" data-f="${k}">${l}</button>`)}</div></div></div>
      ${groups.length ? groups.map((g) => h`<div class="card-b" style="padding-bottom:0"><div class="small muted" style="text-transform:uppercase;letter-spacing:.06em;font-weight:700">${MONTHS[+g.k.slice(5) - 1]} ${g.k.slice(0, 4)}</div></div>
        <div class="table-wrap"><table class="t rt"><tbody>${g.items.map((e) => h`<tr><td data-label="Date limite" style="white-space:nowrap"><b>${fmtDate(e.date_limite)}</b></td>
          <td class="primary-cell stacked">${e.titre}<div class="cell-sub">${[e.destinataire, PERIOD[e.periodicite] ? terms(PERIOD[e.periodicite]) : '', d.modeles[e.modele] ? `Modèle : ${d.modeles[e.modele]}` : ''].filter(Boolean).join(' • ')}</div></td>
          <td data-label="État"><div><span class="badge ${ETAT[e.etat][1]}">${ETAT[e.etat][0]}</span><div class="cell-sub">${etatLabel(e)}</div></div></td>
          <td class="actions-cell"><a class="btn btn-ghost btn-sm" href="${dl(`/echeances/${e.id}/modele`)}" download title="Modèle Word pré-rempli">${icon('file', 'sm')} Word</a>
            ${e.etat === 'depose' ? h`${e.a_fichier ? h`<a class="btn btn-ghost btn-sm btn-icon" href="${dl(`/echeances/${e.id}/depot`)}" target="_blank" rel="noopener" title="Document déposé">${icon('eye', 'sm')}</a>` : ''}<button class="btn btn-ghost btn-sm" data-undo="${e.id}">Annuler le dépôt</button>`
    : h`<button class="btn btn-outline btn-sm" data-depot="${e.id}">${icon('check', 'sm')} Déposé</button>`}
            <button class="btn btn-ghost btn-sm btn-icon" data-edit="${e.id}" title="Modifier">${icon('edit', 'sm')}</button><button class="btn btn-ghost btn-sm btn-icon" data-del="${e.id}" title="Supprimer">${icon('trash', 'sm')}</button></td></tr>`)}</tbody></table></div>`)
    : h`<div class="card-b">${empty(d.echeances.length ? 'Aucune échéance dans ce filtre' : 'Aucune échéance', d.echeances.length ? '' : 'Importez le chronogramme des dépôts reçu de la délégation (Word ou PDF), ou ajoutez les échéances une à une.', 'calendar')}</div>`}</div>
    <div class="stack">
      <div class="card"><div class="card-h"><h3>Chronogrammes importés</h3></div>${d.chronogrammes.length ? h`<div class="list">${d.chronogrammes.map((c) => h`<div class="list-item"><div class="ico info">${icon(/pdf/.test(c.mime) ? 'pdf' : 'file')}</div>
        <div style="flex:1;min-width:0"><b>${c.titre}</b><div class="meta">${c.nom_fichier} • ${Math.max(1, Math.round(c.taille / 1024))} Ko • ${fmtTs(c.uploaded_at)} • ${c.extraits} échéance(s)</div>
          <div class="row mt" style="gap:6px"><a class="btn btn-ghost btn-sm" href="${dl(`/chronogrammes/${c.id}/fichier`)}" target="_blank" rel="noopener">${icon('eye', 'sm')} Ouvrir</a>
          <button class="btn btn-ghost btn-sm" data-analyse="${c.id}">${icon('refresh', 'sm')} Relire</button><button class="btn btn-ghost btn-sm btn-icon" data-delc="${c.id}" title="Supprimer">${icon('trash', 'sm')}</button></div></div></div>`)}</div>`
    : h`<div class="card-b">${empty('Aucun fichier', 'Le chronogramme reçu (Word ou PDF) sera conservé ici.', 'upload')}</div>`}</div>
      <div class="card"><div class="card-b small muted">${icon('info', 'sm')} À l'import, la plateforme lit le document et propose les échéances qu'elle y trouve (intitulé, date limite, destinataire ; échéances mensuelles, par séquence ou par trimestre). Vérifiez-les avant de les enregistrer. Un document scanné ne peut pas être lu : saisissez alors les échéances.</div></div>
    </div>
  </div>`);

  $$('[data-f]', view).forEach((b) => (b.onclick = () => go('chronogramme', { f: b.dataset.f })));
  $('[data-import]', view).onchange = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast('Fichier trop volumineux (10 Mo au plus)', 'err');
    try {
      toast('Lecture du chronogramme…', 'ok', 2000);
      const res = await post('/admin/echeancier/chronogrammes', { titre: file.name.replace(/\.(pdf|docx)$/i, ''), nom_fichier: file.name, data: await readFile(file) });
      await review(res, d.modeles); rerender();
    } catch (ex) { toast(ex.message, 'err'); }
  };
  $('[data-add]', view).onclick = async () => { if (await echeanceForm(d.modeles)) rerender(); };
  $('[data-models]', view).onclick = (ev) => {
    $$('.menu.mod-menu').forEach((x) => x.remove());
    const menu = document.createElement('div'); menu.className = 'menu mod-menu';
    mount(menu, h`${Object.entries(d.modeles).map(([k, l]) => h`<a href="${dl(`/modeles/${k}`)}" download>${icon('file')} ${l}</a>`)}`);
    ev.currentTarget.parentElement.append(menu);
    const off = (x) => { if (!menu.contains(x.target)) { menu.remove(); document.removeEventListener('click', off); } };
    setTimeout(() => document.addEventListener('click', off));
  };
  view.addEventListener('click', async (ev) => {
    const t = ev.target.closest('[data-depot],[data-undo],[data-edit],[data-del],[data-analyse],[data-delc]'); if (!t) return;
    const e = d.echeances.find((x) => x.id === +(t.dataset.depot || t.dataset.undo || t.dataset.edit || t.dataset.del));
    try {
      if (t.dataset.depot && await depotForm(e)) rerender();
      if (t.dataset.undo && await confirmDialog({ title: 'Annuler le dépôt ?', message: `« ${e.titre} » redeviendra un document à produire.`, okLabel: 'Annuler le dépôt' })) { await post(`/admin/echeancier/echeances/${e.id}/annuler-depot`); rerender(); }
      if (t.dataset.edit && await echeanceForm(d.modeles, e)) rerender();
      if (t.dataset.del && await confirmDialog({ title: 'Supprimer cette échéance ?', message: e.titre, danger: true, okLabel: 'Supprimer' })) { await del(`/admin/echeancier/echeances/${e.id}`); rerender(); }
      if (t.dataset.analyse) { const res = await post(`/admin/echeancier/chronogrammes/${t.dataset.analyse}/analyser`); await review({ ...res, message: res.propositions.length ? null : 'Aucune date limite reconnue dans ce document.' }, d.modeles); rerender(); }
      if (t.dataset.delc) {
        const c = d.chronogrammes.find((x) => x.id === +t.dataset.delc);
        const ok = await confirmDialog({ title: 'Supprimer ce chronogramme ?', message: `Le fichier « ${c.nom_fichier} » sera supprimé.`, checkbox: 'Supprimer aussi ses échéances non déposées', danger: true, okLabel: 'Supprimer' });
        if (ok) { await del(`/admin/echeancier/chronogrammes/${c.id}${ok.checked ? '?garder=0' : ''}`); rerender(); }
      }
    } catch (ex) { toast(ex.message, 'err'); }
  });
}

/** Vérification des échéances repérées dans le chronogramme avant enregistrement. */
function review(res, modeles) {
  const items = res.propositions.map((x) => ({ ...x, on: true }));
  return modal({ title: `Échéances repérées — ${res.titre}`, size: 'lg',
    body: h`${res.message ? h`<div class="alert warn mb">${icon('info')}<div class="small">${res.message}</div></div>` : h`<p class="small muted" style="margin-top:0">${items.length} échéance(s) repérée(s) dans le document. Vérifiez les intitulés, dates et destinataires, décochez les lignes inutiles, puis enregistrez.</p>`}
      ${items.length ? h`<div class="table-wrap" style="max-height:56vh;overflow:auto"><table class="t"><thead><tr><th style="width:30px"></th><th>Document à produire</th><th style="width:150px">Date limite</th><th>Destinataire</th><th>Modèle Word</th></tr></thead>
      <tbody>${items.map((x, i) => h`<tr><td><input type="checkbox" data-on="${i}" checked aria-label="Retenir"></td>
        <td><input class="input" data-k="titre" data-i="${i}" value="${x.titre}" maxlength="220"><div class="cell-sub" title="${x.source}">${terms(PERIOD[x.periodicite] || '')}</div></td>
        <td><input class="input" type="date" data-k="date_limite" data-i="${i}" value="${x.date_limite}"></td>
        <td><input class="input" data-k="destinataire" data-i="${i}" value="${x.destinataire || ''}" maxlength="120"></td>
        <td><select class="select" data-k="modele" data-i="${i}">${Object.entries(modeles).map(([k, l]) => h`<option value="${k}" ${k === x.modele ? raw('selected') : ''}>${l}</option>`)}</select></td></tr>`)}</tbody></table></div>` : ''}
      <div class="alert danger mt hidden" data-err></div>`,
    footer: h`<button class="btn btn-outline" data-close>Fermer</button><button class="btn btn-outline" data-manual>${icon('plus')} Saisir une échéance</button>${items.length ? h`<button class="btn btn-primary" data-save>${icon('save')} Enregistrer les échéances</button>` : ''}`,
    onOpen: ({ root, close }) => {
      root.addEventListener('input', (e) => { const t = e.target; if (t.dataset.k) items[+t.dataset.i][t.dataset.k] = t.value; });
      root.addEventListener('change', (e) => { const t = e.target; if (t.dataset.on) items[+t.dataset.on].on = t.checked; if (t.dataset.k) items[+t.dataset.i][t.dataset.k] = t.value; });
      $('[data-manual]', root).onclick = async () => { if (await echeanceForm(modeles, null, res.id)) { close(true); } };
      $('[data-save]', root)?.addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
        const sel = items.filter((x) => x.on);
        if (!sel.length) { close(false); return; }
        try { await post('/admin/echeancier/echeances', { chronogramme_id: res.id, items: sel.map(({ on, ...x }) => x) }); toast(`${sel.length} échéance(s) enregistrée(s)`); close(true); }
        catch (ex) { const er = $('[data-err]', root); er.textContent = ex.message; er.classList.remove('hidden'); }
      }));
    } });
}

function echeanceForm(modeles, e = null, chronogrammeId = null) {
  const fields = [{ name: 'titre', label: 'Document à produire', required: true, full: true, maxlength: 220, placeholder: 'ex. Rapport trimestriel d’activités' },
    { name: 'date_limite', label: 'Date limite de dépôt', type: 'date', required: true }, { name: 'destinataire', label: 'Destinataire', placeholder: 'ex. DDES du Mfoundi' },
    { name: 'modele', label: 'Modèle Word proposé', type: 'select', placeholder: 'Choix automatique d’après l’intitulé', options: Object.entries(modeles) },
    { name: 'rappel_jours', label: 'Rappel (jours avant la date limite)', type: 'number', min: 0, max: 60, value: 7 },
    { name: 'observation', label: 'Observation', full: true, maxlength: 500 }];
  return formModal({ title: e ? 'Modifier l’échéance' : 'Nouvelle échéance', fields, values: e || {}, size: 'lg',
    onSubmit: (v) => (e ? put(`/admin/echeancier/echeances/${e.id}`, v) : post('/admin/echeancier/echeances', { ...v, ...(chronogrammeId ? { chronogramme_id: chronogrammeId } : {}) })) });
}

function depotForm(e) {
  return modal({ title: `Dépôt — ${e.titre}`,
    body: h`<div class="form-grid">
      <div class="field"><label for="dp_d">Date de dépôt</label><input class="input" type="date" id="dp_d" value="${new Date().toISOString().slice(0, 10)}" max="${new Date().toISOString().slice(0, 10)}"></div>
      <div class="field"><label for="dp_f">Document déposé (facultatif)</label><input class="input" type="file" id="dp_f" accept=".pdf,.docx"><span class="hint">Word ou PDF, 10 Mo au plus : il sera archivé avec l'échéance.</span></div>
      <div class="field full"><label for="dp_o">Observation</label><input class="input" id="dp_o" maxlength="500" placeholder="ex. Remis en main propre au secrétariat de la DDES, accusé de réception n° …"></div></div>
      <div class="alert danger mt hidden" data-err></div>`,
    footer: h`<button class="btn btn-outline" data-close>Annuler</button><button class="btn btn-primary" data-ok>${icon('check')} Enregistrer le dépôt</button>`,
    onOpen: ({ root, close }) => {
      $('[data-ok]', root).onclick = (ev) => withBusy(ev.currentTarget, async () => {
        try {
          const file = $('#dp_f', root).files[0];
          if (file && file.size > 10 * 1024 * 1024) throw new Error('Fichier trop volumineux (10 Mo au plus)');
          await post(`/admin/echeancier/echeances/${e.id}/depot`, { date: $('#dp_d', root).value, observation: $('#dp_o', root).value, ...(file ? { nom_fichier: file.name, data: await readFile(file) } : {}) });
          toast('Dépôt enregistré'); close(true);
        } catch (ex) { const er = $('[data-err]', root); er.textContent = ex.message; er.classList.remove('hidden'); }
      });
    } });
}

/** Rappel affiché une fois par session à l'ouverture du tableau de bord de l'administrateur. */
export async function rappelConnexion() {
  try {
    if (sessionStorage.getItem('schoolx:rappel-depots')) return;
    sessionStorage.setItem('schoolx:rappel-depots', '1');
    const list = await get('/admin/echeancier/rappels');
    const late = list.filter((e) => e.etat === 'retard').length, soon = list.length - late;
    if (list.length) toast(`Chronogramme : ${late ? `${late} document(s) en retard` : ''}${late && soon ? ', ' : ''}${soon ? `${soon} à déposer prochainement` : ''}. Voir « Chronogramme des dépôts ».`, late ? 'warn' : 'ok', 7000);
  } catch { /* rappel facultatif */ }
}
