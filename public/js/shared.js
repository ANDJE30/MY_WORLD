// Composants et pages communs aux trois profils.
import { h, raw, mount, $, $$, icon, toast, modal, fmtNum, fmtDate, fmtTs, parseNote, appreciation, noteClass, seqOptions, DAYS, colorFor,
  empty, formModal, confirmDialog, debounce, initials, ROLE_LABEL, withBusy } from './ui.js';
import { get, put, post, del, openPdf } from './api.js';
import { state, passwordForm, setLeaveGuard, setParams, schoolLogo, rerender } from './app.js';

export function commonRoutes(role) {
  const r = [{ path: 'profil', title: 'Mon profil', icon: 'user', group: 'Mon compte', render: profilePage }];
  if (role !== 'admin') r.unshift({ path: 'annonces', title: 'Annonces', icon: 'megaphone', group: 'Mon compte', render: announcementsPage });
  return r;
}

export const periodLabel = (seq) => {
  const p = state.periods.find((x) => x.seq === +seq);
  if (!p) return '';
  return p.status === 'closed' ? h`<span class="badge green">${icon('lock', 'sm')} Clôturée</span>`
    : +seq === state.current ? h`<span class="badge gold"><span class="dot"></span> En cours</span>` : h`<span class="badge">Ouverte</span>`;
};

/* ================= Profil ================= */
async function profilePage(view) {
  const { user } = await get('/auth/me');
  const fields = [
    { name: 'phone', label: 'Téléphone', type: 'tel', placeholder: '+237 6 XX XX XX XX' },
    { name: 'email', label: 'Adresse e-mail', type: 'email' }];
  mount(view, h`<div class="page-head"><div><h2>Mon profil</h2><p>Vos informations personnelles et la sécurité de votre compte.</p></div></div>
  <div class="grid g-3">
    <div class="card"><div class="card-b" style="text-align:center">
      <div class="avatar gold" style="width:84px;height:84px;font-size:28px;margin:6px auto 12px">${initials(user.full_name)}</div>
      <h3>${user.full_name}</h3><div class="muted">${ROLE_LABEL[user.role]}</div>
      <div class="mt chips" style="justify-content:center"><span class="chip">Identifiant : <b class="mono">${user.username}</b></span>${user.specialite ? h`<span class="chip">${user.specialite}</span>` : ''}</div>
      <div class="small muted mt">Dernière connexion : ${fmtTs(user.last_login)}</div>
    </div></div>
    <div class="card span-2"><div class="card-h"><h3>Coordonnées</h3></div><div class="card-b">
      <form class="form-grid" id="pf">${fields.map((f) => raw(fieldHtmlSafe(f, user[f.name])))}</form>
      <div class="row mt"><button class="btn btn-primary" id="savePf">${icon('save')} Enregistrer</button></div></div></div>
  </div>
  <div class="card"><div class="card-h"><h3>Sécurité</h3></div><div class="card-b row">
    <div style="flex:1;min-width:220px"><b>Mot de passe</b><div class="small muted">Changez régulièrement votre mot de passe et ne le communiquez à personne. Le changement déconnecte vos autres appareils.</div></div>
    <button class="btn btn-outline" id="chPw">${icon('key')} Changer mon mot de passe</button></div></div>`);
  $('#chPw').onclick = () => passwordForm();
  $('#savePf').onclick = (e) => withBusy(e.currentTarget, async () => {
    try { await put('/auth/profile', { phone: $('[name=phone]').value, email: $('[name=email]').value }); toast('Profil mis à jour'); } catch (ex) { toast(ex.message, 'err'); }
  });
}
// petit utilitaire local (évite une dépendance circulaire)
function fieldHtmlSafe(f, v) {
  const d = document.createElement('div');
  mount(d, h`<div class="field"><label>${f.label}</label><input class="input" type="${f.type}" name="${f.name}" value="${v || ''}" placeholder="${f.placeholder || ''}" maxlength="120"></div>`);
  return d.innerHTML;
}

/* ================= Annonces ================= */
export async function announcementsPage(view) {
  const list = await get('/announcements');
  mount(view, h`<div class="page-head"><div><h2>Annonces</h2><p>Communications de l'administration.</p></div></div>
    <div class="card">${list.length ? list.map((a) => h`<div class="annonce"><div class="row" style="justify-content:space-between"><h4>${a.title}</h4><span class="small muted">${fmtTs(a.created_at)}</span></div>
      <p>${a.body}</p><div class="small muted mt">${a.author || ''}</div></div>`) : empty('Aucune annonce', "L'administration n'a publié aucune annonce.", 'megaphone')}</div>`);
}
export const announcementsWidget = (list) => h`<div class="card"><div class="card-h"><h3>Annonces</h3><div class="actions"><a class="btn btn-ghost btn-sm" href="#/annonces">Tout voir</a></div></div>
  ${list.length ? list.slice(0, 3).map((a) => h`<div class="annonce"><h4>${a.title}</h4><p>${a.body.length > 220 ? a.body.slice(0, 220) + '…' : a.body}</p><div class="small muted">${fmtTs(a.created_at)}</div></div>`) : empty('Aucune annonce', '', 'megaphone')}</div>`;

/* ================= Emploi du temps ================= */
export function timetableHtml(data, { mode = 'class', editable = false } = {}) {
  const cellMap = {};
  for (const c of data.cells) cellMap[`${c.day}|${c.slot}`] = c;
  return h`<div class="table-wrap"><table class="tt"><thead><tr><th></th>${data.days.map((d) => h`<th>${DAYS[d]}</th>`)}</tr></thead><tbody>
    ${data.slots.map((s, i) => s.break
    ? h`<tr class="break"><td class="time">${s.start} – ${s.end}</td>${data.days.map(() => h`<td class="cell">${s.label || 'Pause'}</td>`)}</tr>`
    : h`<tr><td class="time">${s.start}<br>${s.end}</td>${data.days.map((d) => {
      const c = cellMap[`${d}|${i}`];
      if (!c) return h`<td class="cell ${editable ? 'editable' : ''}" data-day="${d}" data-slot="${i}">${editable ? h`<span class="muted small">+</span>` : ''}</td>`;
      return h`<td class="cell filled ${editable ? 'editable' : ''}" style="background:${colorFor(c.subject)}" data-day="${d}" data-slot="${i}" title="${c.subject} — ${c.teacher || ''} ${c.room ? '• ' + c.room : ''}">
        <span class="s">${mode === 'teacher' ? c.classe : c.code || c.subject}</span><span class="t">${mode === 'teacher' ? (c.code || c.subject) : (c.teacher || 'Sans enseignant')}${c.room ? ' • ' + c.room : ''}</span></td>`;
    })}</tr>`)}</tbody></table></div>`;
}
export async function timetablePage(view, { kind, id, title }) {
  const data = await get(kind === 'teacher' ? `/timetable/teacher/${id}` : `/timetable/class/${id}`);
  const hours = data.cells.length;
  mount(view, h`<div class="card"><div class="card-h"><h3>${title || data.title}</h3><span class="sub">${hours} heure(s) par semaine</span>
    <div class="actions"><button class="btn btn-outline btn-sm" data-pdf>${icon('pdf')} PDF</button></div></div>
    <div class="card-b">${data.cells.length ? timetableHtml(data, { mode: kind }) : empty('Emploi du temps non défini', "L'administration n'a pas encore établi cet emploi du temps.", 'calendar')}</div></div>`);
  $('[data-pdf]', view).onclick = () => openPdf(kind === 'teacher' ? `/timetable?teacher_id=${id}` : `/timetable?class_id=${id}`);
}

/* ================= Suivi des modifications + enregistrement auto ================= */
function createSaver({ key, save, onState }) {
  const dirty = new Map();
  let saving = false, timer = null, lastError = null;
  const persistDraft = () => { try { dirty.size ? localStorage.setItem(key, JSON.stringify([...dirty])) : localStorage.removeItem(key); } catch { /* stockage plein */ } };
  const flush = async () => {
    clearTimeout(timer);
    if (!dirty.size || saving) return true;
    saving = true; onState({ saving: true, count: dirty.size });
    const batch = new Map(dirty);
    try {
      await save([...batch.values()]);
      for (const [k, v] of batch) if (dirty.get(k) === v) dirty.delete(k);
      lastError = null; persistDraft();
      onState({ saved: true, count: dirty.size });
      return true;
    } catch (ex) { lastError = ex; onState({ error: ex.message, count: dirty.size }); return false; }
    finally { saving = false; }
  };
  return {
    set(k, v) { dirty.set(k, v); persistDraft(); onState({ count: dirty.size }); clearTimeout(timer); timer = setTimeout(flush, 2500); },
    flush, get size() { return dirty.size; }, get error() { return lastError; },
    draft() { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } },
    clearDraft() { localStorage.removeItem(key); dirty.clear(); onState({ count: 0 }); }
  };
}
function saveBar(el, s) {
  if (!el) return;
  el.classList.toggle('hidden', !s.count && !s.saved && !s.error && !s.saving);
  const msg = s.saving ? h`<span class="spinner" style="width:16px;height:16px;border-width:2px;border-color:rgba(255,255,255,.3);border-top-color:#fff"></span> Enregistrement en cours…`
    : s.error ? h`${icon('alert')} ${s.error} — vos saisies sont conservées sur cet appareil.`
      : s.count ? h`${icon('edit')} ${s.count} modification(s) non enregistrée(s) — enregistrement automatique…`
        : h`${icon('checkCircle')} Toutes les modifications sont enregistrées.`;
  mount($('.msg', el), msg);
  if (s.saved && !s.count) setTimeout(() => { if (!el.dataset.busy) el.classList.add('hidden'); }, 2500);
}

/* ================= Éditeur de notes (enseignant / administrateur) ================= */
export async function notesEditor(container, { cs, seq, onChangeSeq, assignments }) {
  const data = await get(`/notes/grid?cs=${cs}&seq=${seq}`);
  const locked = data.locked;
  const rows = data.students.map((s) => ({ ...s, cur: s.absent ? 'ABS' : s.value }));
  const key = `edugest:draft:notes:${cs}:${seq}`;
  const saver = createSaver({
    key, onState: (s) => saveBar($('[data-savebar]', container), s),
    save: async (entries) => { await put('/notes/grid', { cs, seq, entries }); data.validated_at = null; renderHead(); }
  });
  setLeaveGuard(() => (saver.size ? 'Des notes ne sont pas encore enregistrées. Quitter quand même ?' : null));

  const stats = () => {
    const vals = rows.map((r) => (r.cur === 'ABS' ? null : r.cur)).filter((v) => v != null && !Number.isNaN(v));
    const filled = rows.filter((r) => r.cur != null).length;
    return { filled, total: rows.length, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null, min: vals.length ? Math.min(...vals) : null,
      max: vals.length ? Math.max(...vals) : null, below: vals.filter((v) => v < 10).length, pass: vals.length ? (vals.filter((v) => v >= 10).length / vals.length) * 100 : null };
  };
  const renderHead = () => {
    const s = stats();
    mount($('[data-head]', container), h`
      <div class="entry-stats">
        <div>Saisies<br><b>${s.filled} / ${s.total}</b></div><div>Moyenne<br><b class="${noteClass(s.avg)}">${fmtNum(s.avg)}</b></div>
        <div>Min / Max<br><b>${fmtNum(s.min)} / ${fmtNum(s.max)}</b></div><div>Sous la moyenne<br><b>${s.below}</b></div><div>Réussite<br><b>${s.pass == null ? '—' : fmtNum(s.pass, 1) + ' %'}</b></div>
      </div>
      <div style="flex:1;min-width:160px">${raw(progressHtml(s.total ? (s.filled / s.total) * 100 : 0))}</div>
      ${locked ? h`<span class="badge red">${icon('lock', 'sm')} Verrouillée</span>` : data.validated_at ? h`<span class="badge green">${icon('check', 'sm')} Saisie validée</span>`
    : h`<button class="btn btn-gold btn-sm" data-validate ${s.filled < s.total ? raw('disabled title="Toutes les notes doivent être saisies"') : ''}>${icon('checkCircle')} Valider la saisie</button>`}
      ${data.validated_at && !locked ? h`<button class="btn btn-ghost btn-sm" data-unvalidate>Annuler la validation</button>` : ''}`);
    $('[data-validate]', container)?.addEventListener('click', async (e) => {
      if (!(await saver.flush())) return;
      const ok = await confirmDialog({ title: 'Valider la saisie', message: `Confirmez-vous que toutes les notes de ${data.cs.classe} en ${data.cs.subject} (séquence ${seq}) sont définitives ? L'administration pourra alors clôturer la séquence.`, okLabel: 'Valider' });
      if (!ok) return;
      try { await post('/notes/validate', { cs, seq }); data.validated_at = Date.now() / 1000; toast('Saisie validée. Merci !'); renderHead(); } catch (ex) { toast(ex.message, 'err'); }
    });
    $('[data-unvalidate]', container)?.addEventListener('click', async () => {
      try { await post('/notes/validate', { cs, seq, cancel: true }); data.validated_at = null; renderHead(); } catch (ex) { toast(ex.message, 'err'); }
    });
  };

  mount(container, h`
    <div class="card"><div class="card-h">
      <div><h3>${data.cs.classe} — ${data.cs.subject}</h3><div class="sub">Coefficient ${data.cs.coef} • ${data.cs.teacher || 'Sans enseignant'} • ${rows.length} élève(s)</div></div>
      <div class="actions">
        ${assignments ? h`<select class="select" style="min-height:36px;width:auto" data-cs>${assignments.map((a) => h`<option value="${a.id}" ${a.id === +cs ? raw('selected') : ''}>${a.classe} — ${a.subject}</option>`)}</select>` : ''}
        <select class="select" style="min-height:36px;width:auto" data-seq aria-label="Séquence">${seqOptions(seq)}</select>
        <button class="btn btn-outline btn-sm" data-pdf>${icon('pdf')} Relevé PDF</button>
      </div></div>
      <div class="card-b"><div class="entry-head" data-head></div>
        ${locked ? h`<div class="alert warn mt">${icon('lock')}<div>${locked}</div></div>` : h`<div class="small muted mt hide-mobile">
          Astuces : <span class="kbd">Entrée</span> ou <span class="kbd">↓</span> pour passer à l'élève suivant • tapez <span class="kbd">a</span> pour « absent » • collez une colonne depuis Excel pour remplir toute la liste • virgule ou point acceptés.</div>`}
      </div>
      <div class="table-wrap"><table class="t entry-table"><thead><tr><th class="hide-mobile center" style="width:50px">N°</th><th>Élève</th><th class="center">Note /20</th><th class="center">Absent</th><th class="hide-mobile">Appréciation</th></tr></thead>
      <tbody>${rows.map((r, i) => h`<tr data-i="${i}"><td class="hide-mobile center muted">${i + 1}</td>
        <td class="name-cell"><div class="strong">${r.nom} ${r.prenom}</div><div class="cell-sub">${r.matricule}${r.sexe ? ' • ' + r.sexe : ''}</div></td>
        <td class="center"><input class="input note-input ${noteClass(r.cur === 'ABS' ? null : r.cur)}" inputmode="decimal" enterkeyhint="next" autocomplete="off" aria-label="Note de ${r.nom} ${r.prenom}"
          value="${r.cur === 'ABS' || r.cur == null ? '' : String(r.cur).replace('.', ',')}" ${locked || r.cur === 'ABS' ? raw('disabled') : ''}></td>
        <td class="center"><label class="check" style="justify-content:center"><input type="checkbox" data-abs ${r.cur === 'ABS' ? raw('checked') : ''} ${locked ? raw('disabled') : ''} aria-label="Absent"></label></td>
        <td class="hide-mobile small" data-app>${r.cur === 'ABS' ? 'Absent' : appreciation(r.cur)}</td></tr>`)}</tbody></table></div>
      ${!rows.length ? empty('Aucun élève', "Aucun élève n'est inscrit dans cette classe.", 'users') : ''}
    </div>
    <div class="savebar hidden" data-savebar><div class="msg"></div><button class="btn btn-outline btn-sm" data-save>${icon('save')} Enregistrer maintenant</button></div>`);
  renderHead();

  const setRow = (i, cur, { fromInput = false } = {}) => {
    const r = rows[i]; r.cur = cur;
    const tr = $(`tr[data-i="${i}"]`, container), inp = $('.note-input', tr), abs = $('[data-abs]', tr);
    abs.checked = cur === 'ABS'; inp.disabled = cur === 'ABS';
    if (!fromInput) inp.value = cur == null || cur === 'ABS' ? '' : String(cur).replace('.', ',');
    inp.className = `input note-input ${noteClass(cur === 'ABS' ? null : cur)}`;
    $('[data-app]', tr).textContent = cur === 'ABS' ? 'Absent' : appreciation(cur);
    tr.classList.add('dirty');
    saver.set(r.id, { student_id: r.id, value: cur === 'ABS' ? null : cur, absent: cur === 'ABS' });
    renderHead();
  };
  const inputs = () => $$('.note-input', container);
  const focusNext = (inp, d) => { const all = inputs(); let k = all.indexOf(inp) + d; while (all[k] && all[k].disabled) k += d; all[k]?.focus(); all[k]?.select(); };
  container.addEventListener('input', (e) => {
    const inp = e.target.closest('.note-input'); if (!inp) return;
    const i = +inp.closest('tr').dataset.i;
    if (/^a/i.test(inp.value)) { setRow(i, 'ABS'); focusNext(inp, 1); return; }
    const v = parseNote(inp.value);
    const bad = Number.isNaN(v) || (v != null && (v < 0 || v > 20 || Math.round(v * 100) !== v * 100));
    inp.classList.toggle('invalid', bad);
    if (!bad) setRow(i, v, { fromInput: true });
  });
  container.addEventListener('change', (e) => {
    const cb = e.target.closest('[data-abs]'); if (!cb) return;
    const i = +cb.closest('tr').dataset.i; setRow(i, cb.checked ? 'ABS' : null);
    if (!cb.checked) $('.note-input', cb.closest('tr')).focus();
  });
  container.addEventListener('keydown', (e) => {
    const inp = e.target.closest('.note-input'); if (!inp) return;
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusNext(inp, 1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); focusNext(inp, -1); }
  });
  container.addEventListener('focusin', (e) => { const inp = e.target.closest('.note-input'); if (inp) inp.select(); });
  container.addEventListener('paste', (e) => {
    const inp = e.target.closest('.note-input'); if (!inp) return;
    const text = e.clipboardData.getData('text');
    const lines = text.split(/\r?\n/).map((x) => x.split('\t')[0].trim()).filter((x, k, a) => x !== '' || k < a.length - 1);
    if (lines.length < 2) return;
    e.preventDefault();
    let i = +inp.closest('tr').dataset.i, n = 0;
    for (const l of lines) {
      if (i >= rows.length) break;
      if (/^a(bs)?/i.test(l)) { setRow(i, 'ABS'); n++; } else { const v = parseNote(l); if (v != null && !Number.isNaN(v) && v >= 0 && v <= 20) { setRow(i, Math.round(v * 100) / 100); n++; } }
      i++;
    }
    toast(`${n} note(s) collée(s)`);
  });
  $('[data-save]', container).onclick = () => saver.flush();
  $('[data-seq]', container).onchange = async (e) => { if (await saver.flush()) onChangeSeq(+e.target.value, cs); else e.target.value = seq; };
  $('[data-cs]', container)?.addEventListener('change', async (e) => { if (await saver.flush()) onChangeSeq(seq, +e.target.value); else e.target.value = cs; });
  $('[data-pdf]', container).onclick = async () => { await saver.flush(); openPdf(`/releve?cs=${cs}&period=S${seq}`); };

  // Brouillon non synchronisé (coupure réseau précédente)
  const draft = saver.draft();
  if (draft?.length && !locked) {
    const ok = await confirmDialog({ title: 'Saisie non synchronisée', message: `${draft.length} note(s) saisie(s) précédemment sur cet appareil n'ont pas pu être envoyées. Voulez-vous les restaurer et les enregistrer ?`, okLabel: 'Restaurer' });
    if (ok) for (const [sid, v] of draft) { const i = rows.findIndex((r) => r.id === +sid); if (i >= 0) setRow(i, v.absent ? 'ABS' : v.value); }
    else saver.clearDraft();
  }
}
const progressHtml = (pct) => { const d = document.createElement('div'); mount(d, h`<div class="progress"><span style="width:${pct.toFixed(1)}%"></span></div>`); return d.innerHTML; };

/* ================= Fiche disciplinaire (responsable / administrateur) ================= */
const DFIELDS = [['abs_j', 'Abs. J (h)'], ['abs_nj', 'Abs. NJ (h)'], ['retards', 'Retards'], ['consignes', 'Consignes (h)']];
export async function disciplineEditor(container, { class_id, seq, classes, onChange }) {
  const data = await get(`/discipline/sheet?class_id=${class_id}&seq=${seq}`);
  const locked = data.locked;
  const rows = data.students;
  const saver = createSaver({
    key: `edugest:draft:disc:${class_id}:${seq}`, onState: (s) => saveBar($('[data-savebar]', container), s),
    save: async (entries) => { await put('/discipline/sheet', { class_id, seq, entries }); data.validated_at = null; renderHead(); }
  });
  setLeaveGuard(() => (saver.size ? 'Des données ne sont pas enregistrées. Quitter quand même ?' : null));
  const dis = locked ? raw('disabled') : '';
  const renderHead = () => {
    const sum = (k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    mount($('[data-head]', container), h`<div class="entry-stats">
      <div>Abs. justifiées<br><b>${sum('abs_j')} h</b></div><div>Abs. non justifiées<br><b class="${sum('abs_nj') ? 'low' : ''}">${sum('abs_nj')} h</b></div>
      <div>Retards<br><b>${sum('retards')}</b></div><div>Avertissements<br><b>${sum('avertissement')}</b></div><div>Blâmes<br><b>${sum('blame')}</b></div><div>Incidents<br><b>${sum('incidents')}</b></div></div>
      <div style="flex:1"></div>
      ${locked ? h`<span class="badge red">${icon('lock', 'sm')} Verrouillée</span>` : data.validated_at ? h`<span class="badge green">${icon('check', 'sm')} Fiche validée</span> <button class="btn btn-ghost btn-sm" data-unvalidate>Annuler la validation</button>`
    : h`<button class="btn btn-gold btn-sm" data-validate>${icon('checkCircle')} Valider la fiche</button>`}`);
    $('[data-validate]', container)?.addEventListener('click', async () => {
      if (!(await saver.flush())) return;
      const ok = await confirmDialog({ title: 'Valider la fiche disciplinaire', message: `Confirmez-vous que tous les faits disciplinaires de la classe ${data.classe.name} pour la séquence ${seq} ont été saisis ?`, okLabel: 'Valider' });
      if (!ok) return;
      try { await post('/discipline/validate', { class_id, seq }); data.validated_at = Date.now(); toast('Fiche validée'); renderHead(); } catch (ex) { toast(ex.message, 'err'); }
    });
    $('[data-unvalidate]', container)?.addEventListener('click', async () => { try { await post('/discipline/validate', { class_id, seq, cancel: true }); data.validated_at = null; renderHead(); } catch (ex) { toast(ex.message, 'err'); } });
  };
  mount(container, h`<div class="card"><div class="card-h">
      <div><h3>Classe de ${data.classe.name}</h3><div class="sub">${rows.length} élève(s) • Séquence ${seq}</div></div>
      <div class="actions">
        <select class="select" style="min-height:36px;width:auto" data-class aria-label="Classe">${classes.map((c) => h`<option value="${c.id}" ${c.id === +class_id ? raw('selected') : ''}>${c.name}</option>`)}</select>
        <select class="select" style="min-height:36px;width:auto" data-seq aria-label="Séquence">${seqOptions(seq)}</select>
        <button class="btn btn-outline btn-sm" data-incident ${dis}>${icon('flag')} Signaler un incident</button>
        <button class="btn btn-outline btn-sm" data-pdf>${icon('pdf')} Fiche PDF</button>
      </div></div>
      <div class="card-b"><div class="entry-head" data-head></div>${locked ? h`<div class="alert warn mt">${icon('lock')}<div>${locked}</div></div>` : ''}</div>
      <div class="table-wrap"><table class="t rt compact"><thead><tr><th>Élève</th>${DFIELDS.map(([, l]) => h`<th class="center">${l}</th>`)}<th class="center">Avert.</th><th class="center">Blâme</th><th class="center">Excl. (j)</th><th>Observation</th><th class="center">Inc.</th></tr></thead>
      <tbody>${rows.map((r, i) => h`<tr data-i="${i}">
        <td class="primary-cell"><div class="strong">${r.nom} ${r.prenom}</div><div class="cell-sub">${r.matricule}</div></td>
        ${DFIELDS.map(([k, l]) => h`<td class="center" data-label="${l}"><input class="input num-input" type="number" min="0" max="500" step="${k === 'retards' ? 1 : 0.5}" inputmode="decimal" data-k="${k}" value="${r[k] || 0}" ${dis}></td>`)}
        <td class="center" data-label="Avertissement conduite"><input type="checkbox" class="check" style="width:20px;height:20px;accent-color:var(--primary)" data-k="avertissement" ${r.avertissement ? raw('checked') : ''} ${dis}></td>
        <td class="center" data-label="Blâme conduite"><input type="checkbox" style="width:20px;height:20px;accent-color:var(--red-600)" data-k="blame" ${r.blame ? raw('checked') : ''} ${dis}></td>
        <td class="center" data-label="Exclusion (jours)"><input class="input num-input" type="number" min="0" max="60" step="1" inputmode="numeric" data-k="exclusion_jours" value="${r.exclusion_jours || 0}" ${dis}></td>
        <td data-label="Observation"><input class="input" style="min-width:160px;min-height:38px" maxlength="300" data-k="observation" value="${r.observation || ''}" placeholder="—" ${dis}></td>
        <td class="center" data-label="Incidents"><button class="btn btn-ghost btn-sm" data-hist="${r.id}" title="Historique de l'élève">${r.incidents ? h`<span class="badge red">${r.incidents}</span>` : '0'}</button></td></tr>`)}</tbody></table></div>
      ${!rows.length ? empty('Aucun élève', '', 'users') : ''}
    </div>
    <div class="savebar hidden" data-savebar><div class="msg"></div><button class="btn btn-outline btn-sm" data-save>${icon('save')} Enregistrer maintenant</button></div>`);
  renderHead();
  const collect = (r) => ({ student_id: r.id, abs_j: r.abs_j, abs_nj: r.abs_nj, retards: r.retards, consignes: r.consignes, avertissement: !!r.avertissement, blame: !!r.blame, exclusion_jours: r.exclusion_jours, observation: r.observation || '' });
  container.addEventListener('input', (e) => {
    const el = e.target.closest('[data-k]'); if (!el) return;
    const r = rows[+el.closest('tr').dataset.i], k = el.dataset.k;
    if (el.type === 'checkbox') r[k] = el.checked ? 1 : 0;
    else if (k === 'observation') r[k] = el.value;
    else { const v = el.value === '' ? 0 : Number(el.value); if (!Number.isFinite(v) || v < 0) { el.classList.add('invalid'); return; } el.classList.remove('invalid'); r[k] = v; }
    el.closest('tr').classList.add('dirty');
    saver.set(r.id, collect(r)); renderHead();
  });
  $('[data-save]', container).onclick = () => saver.flush();
  $('[data-seq]', container).onchange = async (e) => { if (await saver.flush()) onChange(class_id, +e.target.value); };
  $('[data-class]', container).onchange = async (e) => { if (await saver.flush()) onChange(+e.target.value, seq); };
  $('[data-pdf]', container).onclick = async () => { await saver.flush(); openPdf(`/discipline?class_id=${class_id}&period=S${seq}`); };
  $('[data-incident]', container).onclick = async () => { if (await incidentModal({ students: rows, seq })) { await saver.flush(); onChange(class_id, seq); } };
  container.addEventListener('click', (e) => { const b = e.target.closest('[data-hist]'); if (b) studentHistory(+b.dataset.hist); });
}

export async function incidentModal({ students, seq, student_id }) {
  return formModal({
    title: 'Signaler un fait disciplinaire', size: 'lg',
    fields: [
      { name: 'student_id', label: 'Élève', type: 'select', required: true, full: true, options: students.map((s) => [s.id, `${s.nom} ${s.prenom} (${s.matricule})`]) },
      { name: 'date', label: 'Date des faits', type: 'date', required: true, value: new Date().toISOString().slice(0, 10) },
      { name: 'seq', label: 'Séquence', type: 'select', required: true, placeholder: false, options: [1, 2, 3, 4, 5, 6].map((s) => [s, `Séquence ${s}`]) },
      { name: 'type', label: 'Nature du fait', type: 'select', required: true, options: state.incidentTypes.map((t) => [t, t]) },
      { name: 'gravite', label: 'Gravité', type: 'select', placeholder: false, options: [['mineure', 'Mineure'], ['moyenne', 'Moyenne'], ['grave', 'Grave'], ['très grave', 'Très grave']] },
      { name: 'sanction', label: 'Sanction prononcée', placeholder: 'ex. Consigne 2 h, convocation du parent…', full: true },
      { name: 'description', label: 'Description des faits', type: 'textarea', full: true, max: 1000 }],
    values: { seq, student_id },
    submitLabel: 'Enregistrer le fait',
    onSubmit: async (d) => { await post('/discipline/incidents', d); toast('Fait disciplinaire enregistré'); return true; }
  });
}
export async function studentHistory(id) {
  const d = await get(`/discipline/student/${id}`);
  const s = d.student;
  await modal({
    title: `${s.nom} ${s.prenom}`, size: 'lg',
    body: h`<div class="row mb"><span class="chip">Matricule ${s.matricule}</span>${s.parent_tel ? h`<span class="chip">Parent : ${s.parent_nom || ''} ${s.parent_tel}</span>` : ''}</div>
      <h4 class="mb">Synthèse par séquence</h4>
      ${d.records.length ? h`<div class="table-wrap"><table class="t"><thead><tr><th>Séq.</th><th class="center">Abs. J</th><th class="center">Abs. NJ</th><th class="center">Retards</th><th class="center">Consignes</th><th>Sanctions</th><th>Observation</th></tr></thead>
        <tbody>${d.records.map((r) => h`<tr><td>S${r.seq}</td><td class="center">${r.abs_j}</td><td class="center ${r.abs_nj ? 'low' : ''}">${r.abs_nj}</td><td class="center">${r.retards}</td><td class="center">${r.consignes}</td>
          <td>${[r.avertissement ? 'Avertissement' : '', r.blame ? 'Blâme' : '', r.exclusion_jours ? `Exclusion ${r.exclusion_jours} j` : ''].filter(Boolean).join(', ') || '—'}</td><td class="small">${r.observation || ''}</td></tr>`)}</tbody></table></div>` : h`<p class="muted">Aucune donnée.</p>`}
      <h4 class="mt mb">Incidents</h4>
      ${d.incidents.length ? h`<div class="list card">${d.incidents.map((i) => h`<div class="list-item"><div class="ico ${i.gravite === 'grave' || i.gravite === 'très grave' ? 'danger' : 'warn'}">${icon('flag')}</div>
        <div style="flex:1"><b>${i.type}</b> <span class="badge">${i.gravite}</span><div class="small">${i.description || ''}</div><div class="meta">${fmtDate(i.date)} • Séquence ${i.seq}${i.sanction ? ' • Sanction : ' + i.sanction : ''}</div></div>
        <button class="btn btn-ghost btn-sm btn-icon" data-del-inc="${i.id}" title="Supprimer">${icon('trash', 'sm')}</button></div>`)}</div>` : h`<p class="muted">Aucun incident enregistré.</p>`}`,
    footer: h`<button class="btn btn-outline" data-pdf>${icon('pdf')} Fiche individuelle PDF</button><button class="btn btn-primary" data-close>Fermer</button>`,
    onOpen: ({ root, close }) => {
      $('[data-pdf]', root).onclick = () => openPdf(`/discipline-eleve?student_id=${id}`);
      $$('[data-del-inc]', root).forEach((b) => (b.onclick = async () => {
        const ok = await confirmDialog({ title: 'Supprimer cet incident ?', message: 'Cette action est définitive.', danger: true, okLabel: 'Supprimer' });
        if (!ok) return;
        try { await del(`/discipline/incidents/${b.dataset.delInc}`); toast('Incident supprimé'); close(); studentHistory(id); } catch (ex) { toast(ex.message, 'err'); }
      }));
    }
  });
}

/* ================= Liste des incidents (page) ================= */
export async function incidentsPage(view, params, classes) {
  if (!classes.length) return mount(view, h`<div class="card">${empty('Aucune classe', "Aucune classe ne vous est encore attribuée.", 'shield')}</div>`);
  const cid = +params.class || classes[0].id;
  const seq = params.seq || '';
  const list = await get(`/discipline/incidents?class_id=${cid}${seq ? '&seq=' + seq : ''}`);
  mount(view, h`<div class="page-head"><div><h2>Registre des incidents</h2><p>Historique des faits disciplinaires signalés.</p></div>
    <div class="actions"><button class="btn btn-primary" data-new>${icon('plus')} Signaler un fait</button></div></div>
    <div class="toolbar"><select class="select" style="width:auto" data-class>${classes.map((c) => h`<option value="${c.id}" ${c.id === cid ? raw('selected') : ''}>${c.name}</option>`)}</select>
      <select class="select" style="width:auto" data-seq><option value="">Toutes les séquences</option>${seqOptions(seq)}</select></div>
    <div class="card">${list.length ? h`<div class="table-wrap"><table class="t rt"><thead><tr><th>Date</th><th>Élève</th><th>Fait</th><th>Gravité</th><th>Sanction</th><th>Signalé par</th></tr></thead>
      <tbody>${list.map((i) => h`<tr><td data-label="Date">${fmtDate(i.date)} <span class="muted small">S${i.seq}</span></td><td class="primary-cell"><a href="#" data-hist="${i.student_id}">${i.nom} ${i.prenom}</a></td>
        <td data-label="Fait">${i.type}${i.description ? h`<div class="cell-sub">${i.description}</div>` : ''}</td>
        <td data-label="Gravité"><span class="badge ${i.gravite === 'grave' || i.gravite === 'très grave' ? 'red' : i.gravite === 'moyenne' ? 'amber' : ''}">${i.gravite}</span></td>
        <td data-label="Sanction">${i.sanction || '—'}</td><td data-label="Signalé par" class="small">${i.officer || '—'}</td></tr>`)}</tbody></table></div>`
    : empty('Aucun incident', 'Aucun fait disciplinaire signalé pour cette sélection.', 'flag')}</div>`);
  $('[data-class]', view).onchange = (e) => { location.hash = `#/incidents?class=${e.target.value}&seq=${seq}`; };
  $('[data-seq]', view).onchange = (e) => { location.hash = `#/incidents?class=${cid}&seq=${e.target.value}`; };
  view.addEventListener('click', (e) => { const a = e.target.closest('[data-hist]'); if (a) { e.preventDefault(); studentHistory(+a.dataset.hist); } });
  $('[data-new]', view).onclick = async () => {
    const sheet = await get(`/discipline/sheet?class_id=${cid}&seq=${seq || state.current}`);
    if (await incidentModal({ students: sheet.students, seq: seq || state.current })) rerender();
  };
}

export { schoolLogo, setParams };
