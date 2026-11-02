// Messages aux parents : remise des bulletins, réunion des parents, informations — avec le nom de l'enfant dans chaque message.
import { h, raw, mount, $, $$, icon, toast, modal, fmtTs, kpi, empty, confirmDialog, withBusy, debounce, downloadCSV, terms } from './ui.js';
import { get, post } from './api.js';
import { rerender } from './app.js';

const STATUS = { a_envoyer: ['À envoyer', 'gold'], en_cours: ['En cours', 'blue'], envoye: ['Envoyé', 'green'], simule: ['Simulé', 'blue'], echec: ['Échec', 'red'] };
const waNum = (p) => String(p).replace(/\D/g, '');
const waLink = (m) => `https://wa.me/${waNum(m.phone)}?text=${encodeURIComponent(m.message)}`;
const smsLink = (m) => `sms:${m.phone}?&body=${encodeURIComponent(m.message)}`;
const csvRows = (msgs) => [['Téléphone', 'Parent', 'Enfant(s)', 'Classe(s)', 'Message'], ...msgs.map((m) => [m.phone, m.parent || '', m.enfants, m.classes, m.message])];

export async function messagesParents(view) {
  const [ref, hist] = await Promise.all([get('/admin/parents/modeles'), get('/admin/parents/campagnes')]);
  const gw = ref.passerelle;
  const today = new Date(); const inAWeek = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const st = { modele: 'bulletins', texte: ref.modeles.bulletins.texte, variables: { periode: ref.periodes[0], date: inAWeek, heure: '09:00', lieu: "dans l'enceinte de l'établissement", objet: '' },
    class_ids: [], regrouper: true, optimiser: true, canal: gw.configured ? 'sms' : 'manuel' };
  const totalEleves = ref.classes.reduce((a, c) => a + c.eleves, 0), avecTel = ref.classes.reduce((a, c) => a + c.avec_tel, 0);

  mount(view, h`<div class="page-head"><div><h2>Messages aux parents</h2><p>Informez les parents d'élèves par SMS ou WhatsApp : remise des bulletins, réunion des parents, informations utiles. Chaque message porte le nom de l'enfant.</p></div></div>
    <div class="grid g-4 mb">${kpi('users', totalEleves, 'Élèves', `${ref.classes.length} classe(s)`)}${kpi('send', avecTel, 'Élèves avec numéro du parent', `${totalEleves - avecTel} sans numéro`, 'gold')}
      ${kpi('megaphone', hist.length, 'Envois réalisés', hist[0] ? `dernier : ${fmtTs(hist[0].created_at)}` : 'aucun pour l’instant', 'blue')}
      <div class="card kpi"><div class="ico ${gw.configured ? '' : 'red'}">${icon(gw.configured ? 'checkCircle' : 'alert')}</div><div class="v" style="font-size:18px;margin-top:14px">${gw.configured ? 'SMS automatiques' : 'Envoi manuel'}</div>
        <div class="l">${gw.configured ? `Passerelle : ${gw.label}` : 'Passerelle SMS non configurée par AI721'}</div></div></div>
    <div class="grid g-3">
      <div class="card span-2"><div class="card-h"><h3>${icon('edit', 'sm')} Nouveau message</h3></div><div class="card-b stack" data-form></div></div>
      <div class="card"><div class="card-h"><h3>${icon('eye', 'sm')} Aperçu</h3></div><div class="card-b" data-preview></div></div>
    </div>
    <div class="card mt"><div class="card-h"><h3>Historique des envois</h3><span class="badge">${hist.length}</span></div>${histTable(hist)}</div>`);

  const form = $('[data-form]', view), prev = $('[data-preview]', view);
  const varField = (k, label, input) => h`<div class="field"><label for="pv_${k}">${label}</label>${input}</div>`;
  const drawForm = () => {
    const M = ref.modeles[st.modele];
    const need = new Set([...st.texte.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
    mount(form, h`<div class="form-grid">
        <div class="field"><label for="pv_m">Modèle</label><select class="select" id="pv_m" data-modele>${Object.entries(ref.modeles).map(([k, x]) => h`<option value="${k}" ${k === st.modele ? raw('selected') : ''}>${x.titre}</option>`)}</select></div>
        <div class="field"><label>Destinataires</label><div class="small muted" style="padding-top:8px">${st.class_ids.length ? `${st.class_ids.length} classe(s) choisie(s)` : 'Tous les parents de l’établissement'}</div></div>
        ${need.has('periode') ? varField('periode', 'Période', h`<select class="select" id="pv_periode" data-var="periode">${ref.periodes.map((p) => h`<option value="${p}" ${p === st.variables.periode ? raw('selected') : ''}>${terms(p)}</option>`)}</select>`) : ''}
        ${need.has('date') ? varField('date', 'Date', h`<input class="input" type="date" id="pv_date" data-var="date" value="${st.variables.date}">`) : ''}
        ${need.has('heure') ? varField('heure', 'Heure', h`<input class="input" type="time" id="pv_heure" data-var="heure" value="${st.variables.heure}">`) : ''}
        ${need.has('lieu') ? varField('lieu', 'Lieu', h`<input class="input" id="pv_lieu" data-var="lieu" maxlength="120" value="${st.variables.lieu}" placeholder="ex. dans l'enceinte de l'établissement">`) : ''}
        ${need.has('objet') ? h`<div class="field full"><label for="pv_objet">${st.modele === 'reunion' ? 'Ordre du jour' : 'Information à transmettre'}</label><input class="input" id="pv_objet" data-var="objet" maxlength="400" value="${st.variables.objet}"
          placeholder="${st.modele === 'reunion' ? 'ex. bilan du 1er trimestre et préparation des examens' : 'ex. Les cours reprendront le lundi 4 janvier 2027.'}"></div>` : ''}
        <div class="field full"><label for="pv_t">Texte du message</label><textarea class="textarea" id="pv_t" rows="4" maxlength="1000" data-texte>${st.texte}</textarea>
          <span class="hint">Champs remplacés pour chaque parent : ${Object.entries(ref.variables).map(([k, l]) => h`<button type="button" class="chip" style="cursor:pointer" data-ins="${k}" title="${l}">{${k}}</button> `)}</span></div>
        <div class="field full"><label>Classes</label><div class="chips" style="gap:6px">
          <label class="check chip" style="padding:6px 10px"><input type="checkbox" data-all ${st.class_ids.length ? '' : raw('checked')}> Toutes</label>
          ${ref.classes.map((c) => h`<label class="check chip" style="padding:6px 10px"><input type="checkbox" data-cls="${c.id}" ${st.class_ids.includes(c.id) ? raw('checked') : ''}> ${c.name} <span class="muted small">(${c.avec_tel}/${c.eleves})</span></label>`)}</div></div>
        <div class="field full"><label class="check"><input type="checkbox" data-regr ${st.regrouper ? raw('checked') : ''}> Un seul message par numéro : les frères et sœurs sont cités ensemble</label>
          <label class="check"><input type="checkbox" data-optim ${st.optimiser ? raw('checked') : ''}> Optimiser pour les SMS : ê, ô, ç, ï… deviennent e, o, c, i (160 caractères par SMS au lieu de 70)</label></div>
        <div class="field full"><label>Mode d'envoi</label><div class="seg" role="radiogroup">
          <button type="button" class="${st.canal === 'sms' ? 'on' : ''}" data-canal="sms" ${gw.configured ? '' : raw('disabled title="Passerelle SMS non configurée par AI721 TECH STUFF"')}>${icon('send', 'sm')} SMS automatiques</button>
          <button type="button" class="${st.canal === 'manuel' ? 'on' : ''}" data-canal="manuel">${icon('user', 'sm')} WhatsApp / SMS depuis mon téléphone</button></div>
          <span class="hint">${st.canal === 'sms' ? `Les SMS partent immédiatement par la passerelle de la plateforme (${gw.label}).` : 'La liste des messages s’affiche : un bouton WhatsApp ou SMS par parent ouvre le message prêt à envoyer. Vous pouvez aussi l’exporter (CSV) pour une plateforme d’envoi groupé.'}</span></div>
      </div>`);
  };
  const drawPreview = (p, err) => {
    if (err) return mount(prev, h`<div class="alert danger">${icon('alert')}<div class="small">${err}</div></div>`);
    mount(prev, h`<div class="stack" style="gap:10px">
      <div class="grid g-2" style="gap:8px"><div><div class="small muted">Destinataires</div><b style="font-size:22px">${p.destinataires}</b></div><div><div class="small muted">Élèves concernés</div><b style="font-size:22px">${p.eleves}</b></div>
        <div><div class="small muted">SMS facturés (estimation)</div><b>${p.sms}</b></div><div><div class="small muted">Sans numéro / invalides</div><b class="${p.sans_tel.length + p.invalides.length ? 'low' : ''}">${p.sans_tel.length} / ${p.invalides.length}</b></div></div>
      ${p.max_segments > 1 ? h`<div class="alert warn" style="padding:8px 10px">${icon('info')}<div class="small">Message long : jusqu'à ${p.max_segments} SMS par destinataire.${p.unicode.length ? ` Les caractères ${p.unicode.join(' ')} imposent l'encodage Unicode (70 caractères par SMS) : remplacez-les si possible.` : ''}</div></div>` : ''}
      ${p.exemples.map((m) => h`<div style="background:var(--surface-2);border-radius:12px 12px 12px 4px;padding:10px 12px"><div class="small muted">${m.phone} • ${m.enfants} (${m.classes})</div>
        <div class="small" style="margin-top:4px;white-space:pre-wrap">${m.message}</div><div class="small muted" style="text-align:right">${m.segments} SMS • ${m.encoding}</div></div>`)}
      ${p.sans_tel.length || p.invalides.length ? h`<details><summary class="small" style="cursor:pointer">Élèves sans numéro ou numéro invalide (${p.sans_tel.length + p.invalides.length})</summary>
        <div class="small mt" style="max-height:160px;overflow:auto">${[...p.sans_tel.map((x) => `${x.eleve} (${x.classe}) — aucun numéro`), ...p.invalides.map((x) => `${x.eleve} (${x.classe}) — « ${x.tel} »`)].map((t) => h`<div>${t}</div>`)}</div></details>` : ''}
      <div class="row" style="gap:8px"><button class="btn btn-primary" data-send ${p.destinataires ? '' : raw('disabled')}>${icon('send')} ${st.canal === 'sms' ? `Envoyer ${p.destinataires} SMS` : `Préparer ${p.destinataires} message(s)`}</button>
        <button class="btn btn-outline" data-csv ${p.destinataires ? '' : raw('disabled')}>${icon('download')} Export CSV</button></div></div>`);
  };
  const body = () => ({ modele: st.modele, texte: st.texte, variables: st.variables, class_ids: st.class_ids, regrouper: st.regrouper, optimiser: st.optimiser, canal: st.canal });
  let lastPreview = null;
  const refresh = debounce(async () => {
    try { lastPreview = await post('/admin/parents/apercu', body()); drawPreview(lastPreview); } catch (ex) { lastPreview = null; drawPreview(null, ex.message); }
  }, 350);
  drawForm(); refresh();

  form.addEventListener('change', (e) => {
    const t = e.target;
    if (t.matches('[data-modele]')) { st.modele = t.value; st.texte = ref.modeles[t.value].texte; drawForm(); }
    if (t.matches('[data-all]') && t.checked) { st.class_ids = []; drawForm(); }
    if (t.matches('[data-cls]')) { st.class_ids = $$('[data-cls]:checked', form).map((x) => +x.dataset.cls); drawForm(); }
    if (t.matches('[data-regr]')) st.regrouper = t.checked;
    if (t.matches('[data-optim]')) st.optimiser = t.checked;
    if (t.matches('[data-var]')) st.variables[t.dataset.var] = t.value;
    refresh();
  });
  form.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('[data-texte]')) st.texte = t.value;
    if (t.matches('[data-var]')) st.variables[t.dataset.var] = t.value;
    refresh();
  });
  form.addEventListener('click', (e) => {
    const c = e.target.closest('[data-canal]'), ins = e.target.closest('[data-ins]');
    if (c && !c.disabled) { st.canal = c.dataset.canal; drawForm(); refresh(); }
    if (ins) {
      const ta = $('[data-texte]', form); const pos = ta.selectionStart ?? ta.value.length;
      ta.value = `${ta.value.slice(0, pos)}{${ins.dataset.ins}}${ta.value.slice(ta.selectionEnd ?? pos)}`; st.texte = ta.value; drawForm(); refresh();
    }
  });
  prev.addEventListener('click', async (e) => {
    if (e.target.closest('[data-csv]')) {
      try { const p = await post('/admin/parents/apercu', { ...body(), complet: true }); downloadCSV(`messages_parents_${new Date().toISOString().slice(0, 10)}.csv`, csvRows(p.tous || [])); }
      catch (ex) { toast(ex.message, 'err'); }
    }
    const b = e.target.closest('[data-send]'); if (!b || !lastPreview) return;
    const ok = await confirmDialog({ title: st.canal === 'sms' ? `Envoyer ${lastPreview.destinataires} SMS ?` : `Préparer ${lastPreview.destinataires} message(s) ?`,
      message: st.canal === 'sms' ? `Les SMS partent immédiatement vers ${lastPreview.destinataires} numéro(s) de parents (environ ${lastPreview.sms} SMS).` : 'La liste des messages personnalisés sera créée : envoyez-les ensuite un par un par WhatsApp ou SMS.',
      okLabel: st.canal === 'sms' ? 'Envoyer' : 'Préparer' });
    if (!ok) return;
    await withBusy(b, async () => {
      try {
        const c = await post('/admin/parents/campagnes', body());
        toast(c.canal === 'sms' ? `${c.envoyes} SMS envoyé(s)${c.echecs ? `, ${c.echecs} échec(s)` : ''}${c.en_cours ? `, ${c.en_cours} en cours` : ''}` : `${c.total} message(s) prêts à envoyer`);
        await campaignView(c.id); rerender();
      } catch (ex) { toast(ex.message, 'err'); }
    });
  });

  view.addEventListener('click', async (e) => {
    const o = e.target.closest('[data-open]'); if (!o) return;
    await campaignView(+o.dataset.open); rerender();
  });
}

function histTable(list) {
  if (!list.length) return h`<div class="card-b">${empty('Aucun envoi', 'Les messages envoyés aux parents apparaîtront ici.', 'send')}</div>`;
  return h`<div class="table-wrap"><table class="t rt"><thead><tr><th>Date</th><th>Message</th><th>Mode</th><th class="num">Destinataires</th><th>État</th><th></th></tr></thead>
    <tbody>${list.map((c) => h`<tr><td data-label="Date" class="small">${fmtTs(c.created_at)}</td><td class="primary-cell">${c.titre}<div class="cell-sub">${c.auteur || ''}</div></td>
      <td data-label="Mode">${c.canal === 'sms' ? h`<span class="badge blue">${icon('send', 'sm')} SMS</span>` : h`<span class="badge">${icon('user', 'sm')} Manuel</span>`}</td>
      <td data-label="Destinataires" class="num">${c.total}</td>
      <td data-label="État"><div class="chips">${c.envoyes ? h`<span class="badge green">${c.envoyes} envoyé(s)</span>` : ''}${c.echecs ? h`<span class="badge red">${c.echecs} échec(s)</span>` : ''}
        ${c.en_cours ? h`<span class="badge blue">${c.en_cours} en cours</span>` : ''}${c.a_envoyer ? h`<span class="badge gold">${c.a_envoyer} à envoyer</span>` : ''}</div></td>
      <td class="actions-cell"><button class="btn btn-outline btn-sm" data-open="${c.id}">${icon('eye', 'sm')} Ouvrir</button></td></tr>`)}</tbody></table></div>`;
}

/** Détail d'un envoi : messages, statut, et envoi manuel (WhatsApp / SMS) parent par parent. */
async function campaignView(cid) {
  let c = await get(`/admin/parents/campagnes/${cid}`);
  await modal({ title: c.titre, size: 'lg',
    body: h`<div data-body></div>`,
    footer: h`<button class="btn btn-outline" data-csv>${icon('download')} Export CSV</button><button class="btn btn-outline hidden" data-retry>${icon('refresh')} Relancer les échecs</button><div style="flex:1"></div><button class="btn btn-primary" data-close>Fermer</button>`,
    onOpen: ({ root }) => {
      const draw = () => {
        const n = (s) => c.messages.filter((m) => m.status === s).length;
        $('[data-retry]', root).classList.toggle('hidden', !n('echec'));
        mount($('[data-body]', root), h`<div class="row mb" style="gap:8px;flex-wrap:wrap"><span class="badge">${c.total} destinataire(s)</span>${n('envoye') + n('simule') ? h`<span class="badge green">${n('envoye') + n('simule')} envoyé(s)${n('simule') ? ' (simulation)' : ''}</span>` : ''}
            ${n('a_envoyer') ? h`<span class="badge gold">${n('a_envoyer')} à envoyer</span>` : ''}${n('echec') ? h`<span class="badge red">${n('echec')} échec(s)</span>` : ''}${n('en_cours') ? h`<span class="badge blue">${n('en_cours')} en cours</span>` : ''}</div>
          ${c.canal === 'manuel' ? h`<div class="alert info mb">${icon('info')}<div class="small">Cliquez sur <b>WhatsApp</b> ou <b>SMS</b> : le message personnalisé s'ouvre, prêt à envoyer depuis votre téléphone. Le parent est alors marqué « Envoyé ».</div></div>` : ''}
          <div class="table-wrap" style="max-height:52vh;overflow:auto"><table class="t rt"><thead><tr><th>Parent</th><th>Message</th><th>État</th><th></th></tr></thead>
          <tbody>${c.messages.map((m) => h`<tr><td class="primary-cell">${m.phone}<div class="cell-sub">${m.parent || ''}${m.parent ? ' • ' : ''}${m.enfants} (${m.classes})</div></td>
            <td data-label="Message" class="small" style="max-width:380px;white-space:pre-wrap">${m.message}</td>
            <td data-label="État"><span class="badge ${STATUS[m.status][1]}">${STATUS[m.status][0]}</span>${m.error ? h`<div class="cell-sub">${m.error}</div>` : ''}</td>
            <td class="actions-cell"><a class="btn btn-outline btn-sm" href="${waLink(m)}" target="_blank" rel="noopener" data-sent="${m.id}" data-via="whatsapp">${icon('send', 'sm')} WhatsApp</a>
              <a class="btn btn-ghost btn-sm" href="${smsLink(m)}" data-sent="${m.id}" data-via="sms">SMS</a></td></tr>`)}</tbody></table></div>`);
      };
      draw();
      root.addEventListener('click', async (e) => {
        const a = e.target.closest('[data-sent]');
        if (a) { const m = c.messages.find((x) => x.id === +a.dataset.sent); if (m && !['envoye', 'simule'].includes(m.status)) { try { await post(`/admin/parents/messages/${m.id}/envoye`, { canal: a.dataset.via }); m.status = 'envoye'; draw(); } catch { /* le lien s'ouvre quand même */ } } }
        if (e.target.closest('[data-csv]')) downloadCSV(`${c.titre.replace(/\W+/g, '_')}_${c.id}.csv`, csvRows(c.messages));
        const rb = e.target.closest('[data-retry]');
        if (rb) await withBusy(rb, async () => { try { await post(`/admin/parents/campagnes/${c.id}/relancer`, {}); c = await get(`/admin/parents/campagnes/${c.id}`); draw(); toast('Échecs relancés'); } catch (ex) { toast(ex.message, 'err'); } });
      });
    } });
}
