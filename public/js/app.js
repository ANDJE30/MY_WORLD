// Point d'entrée : authentification, mise en page adaptative, routeur par rôle.
import { h, raw, mount, $, $$, icon, toast, modal, initials, ROLE_LABEL, debounce } from './ui.js';
import { get, post, setHandlers } from './api.js';

export const state = { user: null, school: null, periods: [], current: 1, incidentTypes: [] };
const root = document.getElementById('root');
let routes = [];

/* ---------- Thème ---------- */
const applyTheme = (t) => { document.documentElement.dataset.theme = t; localStorage.setItem('theme', t); };
applyTheme(localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

/* ---------- Démarrage ---------- */
setHandlers({
  onAuthLost: () => { if (state.user) { state.user = null; toast('Votre session a expiré. Veuillez vous reconnecter.', 'warn'); renderLogin(); } },
  onMustChange: () => forcePasswordChange()
});

async function boot() {
  state.school = await get('/auth/public').catch(() => ({ nom: 'EduGest CM' }));
  document.title = `${state.school.nom_court || state.school.nom} — EduGest CM`;
  try { const { user } = await get('/auth/me'); state.user = user || null; } catch { state.user = null; }
  if (!state.user) return renderLogin();
  if (state.user.must_change) return forcePasswordChange();
  await startApp();
}

export const schoolLogo = (cls = '') => (state.school?.logo
  ? h`<div class="logo ${cls}"><img src="${state.school.logo}" alt="Logo"></div>`
  : h`<div class="logo ${cls}">${initials(state.school?.nom_court || state.school?.nom || 'EG')}</div>`);

/* ---------- Connexion ---------- */
function renderLogin() {
  const s = state.school || {};
  mount(root, h`<div class="login">
    <section class="login-hero">
      <div class="brand"><div class="logo">${icon('school')}</div><div><div>EduGest CM</div><div class="small" style="opacity:.7;font-weight:400">Plateforme de gestion scolaire</div></div></div>
      <div>
        <div class="flagbar"><span></span><span></span><span></span></div>
        <h1>Notes, discipline et emplois du temps, réunis dans un seul espace.</h1>
        <p>Conçue pour les établissements d'enseignement secondaire général et technique du Cameroun : séquences, trimestres, bulletins et fiches officielles en un clic.</p>
        <div class="hero-feats">
          <div class="hero-feat">${icon('edit')}<div><b>Saisie rapide des notes</b><br>Sur ordinateur, tablette ou smartphone</div></div>
          <div class="hero-feat">${icon('shield')}<div><b>Suivi disciplinaire</b><br>Absences, retards, sanctions, incidents</div></div>
          <div class="hero-feat">${icon('calendar')}<div><b>Emplois du temps</b><br>Génération automatique sans conflit</div></div>
          <div class="hero-feat">${icon('pdf')}<div><b>Documents officiels PDF</b><br>Bulletins, relevés, procès-verbaux</div></div>
        </div>
      </div>
      <div class="small hero-foot" style="opacity:.6">© ${new Date().getFullYear()} EduGest CM • Données chiffrées en transit • Accès sécurisé par rôle</div>
    </section>
    <section class="login-panel">
      <div class="login-card">
        <div class="school">${schoolLogo('lg')}<div><b>${s.nom || 'Établissement'}</b><div class="small muted">Année scolaire ${s.annee_scolaire || ''}</div></div></div>
        <h2>Connexion</h2>
        <p class="muted">Identifiez-vous pour accéder à votre espace.</p>
        <form id="loginForm" class="stack" novalidate>
          <div class="field"><label for="u">Identifiant</label><div class="input-icon">${icon('user', 'sm')}<input class="input" id="u" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required></div></div>
          <div class="field"><label for="p">Mot de passe</label><div class="input-icon rel">${icon('lock', 'sm')}<input class="input" id="p" name="password" type="password" autocomplete="current-password" required>
            <button type="button" class="btn btn-ghost btn-sm btn-icon pw-toggle" aria-label="Afficher le mot de passe">${icon('eye', 'sm')}</button></div></div>
          <div class="alert danger hidden" id="loginErr" role="alert"></div>
          <button class="btn btn-primary btn-block" style="min-height:46px" type="submit">${icon('arrowRight')} Se connecter</button>
        </form>
        <p class="small muted mt">Identifiants oubliés ? Contactez l'administrateur de votre établissement : il peut réinitialiser votre mot de passe.</p>
        ${s.demo ? h`<div class="demo-box"><b>Mode démonstration</b> — cliquez sur un profil pour remplir le formulaire :
          ${s.demo.map((d) => h`<button type="button" data-u="${d.u}" data-p="${d.p}"><span>${d.r}</span><code>${d.u} / ${d.p}</code></button>`)}</div>` : ''}
      </div>
    </section></div>`);
  const form = $('#loginForm'), err = $('#loginErr');
  $('.pw-toggle').onclick = () => { const p = $('#p'); p.type = p.type === 'password' ? 'text' : 'password'; };
  $$('.demo-box button').forEach((b) => (b.onclick = () => { $('#u').value = b.dataset.u; $('#p').value = b.dataset.p; }));
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', form);
    const username = $('#u').value.trim(), password = $('#p').value;
    if (!username || !password) { err.textContent = 'Saisissez votre identifiant et votre mot de passe.'; err.classList.remove('hidden'); return; }
    btn.disabled = true; err.classList.add('hidden');
    try {
      const { user } = await post('/auth/login', { username, password });
      state.user = user;
      if (user.must_change) return forcePasswordChange();
      await startApp();
    } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); btn.disabled = false; $('#p').select(); }
  };
  setTimeout(() => $('#u')?.focus(), 50);
}

/* ---------- Mot de passe ---------- */
function pwStrength(pw) {
  let s = 0; if (pw.length >= 8) s++; if (pw.length >= 12) s++; if (/\d/.test(pw) && /[a-z]/i.test(pw)) s++; if (/[^a-z0-9]/i.test(pw)) s++; if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  return Math.min(4, s);
}
export function passwordForm({ forced = false } = {}) {
  return modal({
    title: forced ? 'Choisissez votre mot de passe personnel' : 'Changer mon mot de passe', size: 'sm', dismissible: !forced,
    body: h`${forced ? h`<div class="alert info mb">${icon('info')}<div>Pour votre sécurité, remplacez le mot de passe fourni par l'administrateur par un mot de passe personnel.</div></div>` : ''}
      <form class="stack" novalidate>
        <div class="field"><label>Mot de passe actuel</label><input class="input" type="password" name="current" autocomplete="current-password"></div>
        <div class="field"><label>Nouveau mot de passe</label><input class="input" type="password" name="next" autocomplete="new-password">
          <div class="progress" data-strength><span style="width:0"></span></div><span class="hint">8 caractères minimum, avec au moins une lettre et un chiffre. Astuce : une courte phrase facile à retenir.</span></div>
        <div class="field"><label>Confirmer le nouveau mot de passe</label><input class="input" type="password" name="confirm" autocomplete="new-password"></div>
        <div class="alert danger hidden" data-err></div>
      </form>`,
    footer: h`${forced ? h`<button class="btn btn-ghost" data-logout>${icon('logout')} Déconnexion</button>` : h`<button class="btn btn-outline" data-close>Annuler</button>`}<button class="btn btn-primary" data-ok>${icon('check')} Valider</button>`,
    onOpen: ({ root: r, close }) => {
      const err = $('[data-err]', r), bar = $('[data-strength] span', r);
      $('[name=next]', r).oninput = (e) => { const s = pwStrength(e.target.value); bar.style.width = `${s * 25}%`; bar.parentElement.className = `progress ${s < 2 ? 'red' : s < 3 ? 'gold' : ''}`; };
      $('[data-logout]', r)?.addEventListener('click', logout);
      const submit = async (e) => {
        e?.preventDefault();
        const current = $('[name=current]', r).value, next = $('[name=next]', r).value, confirm = $('[name=confirm]', r).value;
        if (next !== confirm) { err.textContent = 'Les deux mots de passe ne correspondent pas.'; err.classList.remove('hidden'); return; }
        try { await post('/auth/password', { current, next }); toast('Mot de passe modifié avec succès'); close(true); }
        catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
      };
      $('[data-ok]', r).onclick = submit; $('form', r).onsubmit = submit;
    }
  });
}
async function forcePasswordChange() {
  if ($('.modal-root')) return;
  mount(root, h`<div class="splash"></div>`);
  const ok = await passwordForm({ forced: true });
  if (ok) { state.user.must_change = false; await startApp(); }
}
export async function logout() {
  try { await post('/auth/logout'); } catch { /* ignore */ }
  state.user = null; $$('.modal-root').forEach((m) => m.remove());
  location.hash = ''; renderLogin();
}

/* ---------- Application ---------- */
async function startApp() {
  const role = state.user.role;
  const [periods] = await Promise.all([get('/periods')]);
  state.periods = periods.periods; state.current = periods.current; state.incidentTypes = periods.incidentTypes;
  const mod = role === 'admin' ? await import('./admin.js') : role === 'teacher' ? await import('./teacher.js') : await import('./discipline.js');
  const shared = await import('./shared.js');
  routes = [...mod.routes, ...shared.commonRoutes(role)];
  renderShell();
  window.onhashchange = route;
  if (!location.hash || location.hash === '#/' || location.hash === '#') location.hash = '#/' + routes[0].path;
  else route();
}
export async function refreshPeriods() {
  const p = await get('/periods'); state.periods = p.periods; state.current = p.current; renderRibbon();
}

function renderShell() {
  const u = state.user, s = state.school;
  const groups = [...new Set(routes.filter((r) => r.nav !== false).map((r) => r.group || ''))];
  mount(root, h`<div class="app" id="app">
    <aside class="sidebar" aria-label="Navigation principale">
      <div class="sb-brand">${schoolLogo()}<div class="txt"><div class="t1">${s.nom_court || s.nom}</div><div class="t2">${s.annee_scolaire}</div></div></div>
      <nav class="sb-nav">${groups.map((g) => h`${g ? h`<div class="sb-group">${g}</div>` : ''}${routes.filter((r) => r.nav !== false && (r.group || '') === g)
        .map((r) => h`<a class="sb-link" href="#/${r.path}" data-path="${r.path}" title="${r.title}">${icon(r.icon)}<span>${r.title}</span></a>`)}`)}</nav>
      <div class="sb-foot"><div class="sb-user"><div class="avatar gold">${initials(u.full_name)}</div><div class="meta" style="min-width:0"><div class="n">${u.full_name}</div><div class="r">${ROLE_LABEL[u.role]}</div></div></div></div>
    </aside>
    <div class="scrim" data-scrim></div>
    <div class="main">
      <header class="topbar">
        <button class="btn btn-ghost btn-icon menu-btn" data-menu aria-label="Menu">${icon('menu')}</button>
        <div class="title"><div class="crumb" data-crumb></div><h1 data-title>EduGest CM</h1></div>
        <div class="spacer"></div>
        ${u.role === 'admin' ? h`<div class="search-box hide-mobile"><div class="input-icon">${icon('search', 'sm')}<input class="input" style="min-height:38px" placeholder="Rechercher élève, enseignant, classe…" data-search aria-label="Recherche globale"></div><div class="search-results hidden" data-results></div></div>` : ''}
        <div class="seq-ribbon" data-ribbon title="Calendrier des séquences"></div>
        <button class="btn btn-ghost btn-icon" data-theme-toggle aria-label="Changer de thème">${icon(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon')}</button>
        <div class="rel"><button class="btn btn-ghost btn-icon" data-usermenu aria-label="Mon compte"><div class="avatar" style="width:32px;height:32px;font-size:12px">${initials(u.full_name)}</div></button>
          <div class="menu hidden" data-menu-pop>
            <div style="padding:8px 10px"><b>${u.full_name}</b><div class="small muted">${ROLE_LABEL[u.role]} • ${u.username}</div></div><hr>
            <a href="#/profil">${icon('user')} Mon profil</a>
            <button data-pw>${icon('key')} Changer mon mot de passe</button>
            <a href="#/annonces">${icon('megaphone')} Annonces</a><hr>
            <button data-logout style="color:var(--red-600)">${icon('logout')} Se déconnecter</button>
          </div></div>
      </header>
      <main class="view" id="view" tabindex="-1"></main>
    </div>
    <nav class="bottombar" aria-label="Navigation rapide">${routes.filter((r) => r.mobile).slice(0, 4).map((r) => h`<a href="#/${r.path}" data-path="${r.path}">${icon(r.icon)}<span>${r.short || r.title}</span></a>`)}
      <a href="#" data-menu>${icon('menu')}<span>Menu</span></a></nav>
  </div>`);
  const app = $('#app');
  $$('[data-menu]').forEach((b) => (b.onclick = (e) => { e.preventDefault(); app.classList.toggle('nav-open'); }));
  $('[data-scrim]').onclick = () => app.classList.remove('nav-open');
  $('[data-theme-toggle]').onclick = (e) => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(t); mount(e.currentTarget, icon(t === 'dark' ? 'sun' : 'moon')); };
  const pop = $('[data-menu-pop]');
  $('[data-usermenu]').onclick = (e) => { e.stopPropagation(); pop.classList.toggle('hidden'); };
  document.addEventListener('click', (e) => { if (!e.target.closest('[data-menu-pop]')) pop.classList.add('hidden'); if (!e.target.closest('.search-box')) $('[data-results]')?.classList.add('hidden'); });
  $('[data-logout]').onclick = logout;
  $('[data-pw]').onclick = () => { pop.classList.add('hidden'); passwordForm(); };
  const search = $('[data-search]');
  if (search) {
    const res = $('[data-results]');
    search.oninput = debounce(async () => {
      const q = search.value.trim(); if (q.length < 2) { res.classList.add('hidden'); return; }
      const r = await get(`/search?q=${encodeURIComponent(q)}`).catch(() => null); if (!r) return;
      const none = !r.students.length && !r.users.length && !r.classes.length;
      mount(res, none ? h`<div class="small muted" style="padding:10px">Aucun résultat</div>` : h`
        ${r.students.length ? h`<div class="grp">Élèves</div>${r.students.map((s) => h`<a href="#/eleves?q=${encodeURIComponent(s.matricule)}">${s.nom} ${s.prenom} <span class="muted small">— ${s.classe || 'sans classe'} • ${s.matricule}</span></a>`)}` : ''}
        ${r.users.length ? h`<div class="grp">Personnel</div>${r.users.map((x) => h`<a href="#/${x.role === 'discipline' ? 'responsables' : x.role === 'teacher' ? 'enseignants' : 'profil'}?q=${encodeURIComponent(x.username)}">${x.full_name} <span class="muted small">— ${ROLE_LABEL[x.role]}</span></a>`)}` : ''}
        ${r.classes.length ? h`<div class="grp">Classes</div>${r.classes.map((c) => h`<a href="#/resultats?class=${c.id}">${c.name}</a>`)}` : ''}`);
      res.classList.remove('hidden');
    }, 250);
    res.onclick = () => { res.classList.add('hidden'); search.value = ''; };
  }
  renderRibbon();
}

function renderRibbon() {
  const el = $('[data-ribbon]'); if (!el) return;
  mount(el, h`<span class="lbl">Séquences</span>${state.periods.map((p) => h`<span class="seq-dot ${p.status === 'closed' ? 'closed' : ''} ${p.seq === state.current && p.status !== 'closed' ? 'current' : ''} ${p.seq % 2 === 1 && p.seq > 1 ? 'tri' : ''}"
    title="Séquence ${p.seq} : ${p.status === 'closed' ? 'clôturée' : p.seq === state.current ? 'en cours' : 'ouverte'} (${p.start_date} → ${p.end_date})">${p.status === 'closed' ? raw('&#10003;') : `S${p.seq}`}</span>`)}`);
}

export function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  return { path: path || '', params: Object.fromEntries(new URLSearchParams(qs || '')) };
}
export function go(path, params = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();
  const target = `#/${path}${qs ? '?' + qs : ''}`;
  if (location.hash === target) route(); else location.hash = target;
}
/** Met à jour la query string sans relancer le rendu. */
export function setParams(params) {
  const { path, params: cur } = parseHash();
  const qs = new URLSearchParams(Object.entries({ ...cur, ...params }).filter(([, v]) => v != null && v !== '')).toString();
  history.replaceState(null, '', `#/${path}${qs ? '?' + qs : ''}`);
}

let guard = null; // fonction retournant un message si des modifications non enregistrées existent
export const setLeaveGuard = (fn) => { guard = fn; };
window.addEventListener('beforeunload', (e) => { if (guard?.()) { e.preventDefault(); e.returnValue = ''; } });

let lastHash = location.hash;
async function route() {
  if (guard?.() && !confirm(guard())) { history.replaceState(null, '', lastHash); return; }
  guard = null; lastHash = location.hash;
  const { path, params } = parseHash();
  const r = routes.find((x) => x.path === path) || routes[0];
  $('#app')?.classList.remove('nav-open');
  $$('[data-path]').forEach((a) => a.classList.toggle('active', a.dataset.path === r.path));
  $('[data-title]').textContent = r.title;
  $('[data-crumb]').textContent = r.group || 'Accueil';
  document.title = `${r.title} — ${state.school.nom_court || state.school.nom}`;
  // conteneur neuf à chaque navigation : aucun écouteur d'une page précédente ne survit
  const prev = $('#view'); const view = prev.cloneNode(false); prev.replaceWith(view);
  mount(view, h`<div class="empty"><div class="spinner" style="margin:0 auto"></div></div>`);
  try { await r.render(view, params); }
  catch (ex) {
    if (ex.status === 401 || ex.status === 428) return;
    mount(view, h`<div class="card"><div class="empty">${icon('alert')}<h4>Impossible d'afficher cette page</h4><div class="small">${ex.message}</div>
      <div class="mt"><button class="btn btn-outline" data-reload>${icon('refresh')} Réessayer</button></div></div></div>`);
    $('[data-reload]', view)?.addEventListener('click', () => location.reload());
    console.error(ex);
  }
  view.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}
export const rerender = () => route();

// Service worker (PWA installable, coquille hors ligne)
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('/sw.js').catch(() => {});

boot().catch((e) => { mount(root, h`<div class="empty">${icon('alert')}<h4>Erreur de démarrage</h4><div>${e.message}</div></div>`); });
