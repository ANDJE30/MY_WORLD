// Site de présentation de la plateforme (AI721 TECH STUFF) : accès à un établissement par son code.
import { h, mount, $, icon } from './ui.js';
import { get } from './api.js';

export async function renderLanding(root) {
  const p = await get('/auth/public').catch(() => ({ societe: 'AI721 TECH STUFF' }));
  document.title = `EduGest CM — ${p.societe}`;
  const feats = [['edit', 'Notes par séquence et par trimestre', 'Saisie rapide sur smartphone, collage depuis Excel, enregistrement automatique et brouillon hors ligne.'],
    ['shield', 'Discipline', 'Absences, retards, consignes, avertissements, blâmes, exclusions et registre des incidents.'],
    ['calendar', 'Emplois du temps', 'Génération automatique sans conflit d’enseignant ni de salle.'],
    ['lock', 'Clôtures', 'Séquences, trimestres et année scolaire, avec rapport statistique et sauvegarde archivés.'],
    ['pdf', 'Documents officiels', 'Bulletins, procès-verbaux, relevés, fiches disciplinaires et statistiques en PDF.'],
    ['key', 'Accès sécurisés', 'Quatre interfaces distinctes, coffre des accès chiffré, journal d’audit, sauvegardes automatiques.']];
  const roles = [['shield', 'Console AI721', 'Abonnements, paiements, comptes des établissements'], ['building', 'Administration', 'Paramètres, personnel, clôtures, bulletins'],
    ['teacher', 'Enseignants', 'Notes, progression, relevés PDF'], ['flag', 'Vie scolaire', 'Discipline, incidents, fiches PDF']];
  mount(root, h`<div class="landing">
    <nav class="lp-nav"><div class="logo co">AI</div><b>${p.societe}</b><div class="sp"></div><a href="#acces">Accéder à mon établissement</a></nav>
    <header class="lp-hero">
      <div class="portal-badge">${icon('school', 'sm')} EduGest CM</div>
      <h1>La gestion scolaire des lycées et collèges du Cameroun, en ligne.</h1>
      <p>Notes, discipline, emplois du temps, bulletins et statistiques pour l'enseignement secondaire général et technique : 6 séquences, 3 trimestres, documents officiels en un clic. Abonnement annuel de septembre à août.</p>
      <form class="lp-access" id="acces"><input class="input" name="code" placeholder="Code de votre établissement (ex. lpey)" autocapitalize="none" spellcheck="false" aria-label="Code de l'établissement">
        <button class="btn btn-gold" type="submit">${icon('arrowRight')} Accéder</button></form>
      <div class="small" style="color:#a5b4fc;margin-top:8px" data-err></div>
    </header>
    <section class="lp-sec"><h2>Quatre espaces, quatre accès distincts</h2><p class="muted">Chaque profil dispose de sa propre adresse et de sa propre page de connexion.</p>
      <div class="lp-roles mt">${roles.map(([ic, t, d], i) => h`<div class="lp-role r${i}">${icon(ic, 'lg')}<b>${t}</b><span class="small" style="opacity:.85">${d}</span></div>`)}</div></section>
    <section class="lp-sec" style="padding-top:0"><h2>Tout ce dont votre établissement a besoin</h2>
      <div class="grid g-3 mt">${feats.map(([ic, t, d]) => h`<div class="card lp-feat"><div class="ico">${icon(ic)}</div><h4>${t}</h4><div class="small muted">${d}</div></div>`)}</div></section>
    ${p.demo ? h`<section class="lp-sec lp-demo" style="padding-top:0"><h2>Démonstration</h2><p class="muted">Établissement fictif pré-rempli : choisissez un espace.</p>
      <div class="grid g-2 mt"><div>
        <a class="portal-card" data-p="admin" href="/e/lpey/admin"><div class="pc-ico">${icon('building', 'lg')}</div><div><b>Administration</b><div class="small muted">admin / Admin@2026</div></div>${icon('arrowRight')}</a>
        <a class="portal-card" data-p="teacher" href="/e/lpey/enseignant"><div class="pc-ico">${icon('teacher', 'lg')}</div><div><b>Enseignant</b><div class="small muted">mbargajp / Prof@2026</div></div>${icon('arrowRight')}</a>
        <a class="portal-card" data-p="discipline" href="/e/lpey/discipline"><div class="pc-ico">${icon('shield', 'lg')}</div><div><b>Vie scolaire</b><div class="small muted">sg.nguemap / Disc@2026</div></div>${icon('arrowRight')}</a></div>
        <div><a class="portal-card" href="/console" style="border-color:#4338ca"><div class="pc-ico" style="background:linear-gradient(135deg,#4f46e5,#1e1b4b)">${icon('key', 'lg')}</div>
          <div><b>Console AI721 (super administrateur)</b><div class="small muted">${p.demo.superadmin.u} / ${p.demo.superadmin.p}</div></div>${icon('arrowRight')}</a></div></div></section>` : ''}
    <footer class="lp-foot"><b style="color:#fff">${p.societe}</b> — ${p.slogan || ''}<br>${[p.adresse, p.tel, p.email].filter(Boolean).join(' • ')}<br><span style="opacity:.7">EduGest CM © ${new Date().getFullYear()}</span></footer>
  </div>`);
  $('#acces').onsubmit = (e) => {
    e.preventDefault();
    const code = $('[name=code]').value.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,29}$/.test(code)) { $('[data-err]').textContent = 'Code invalide : il figure sur le lien transmis par votre établissement (ex. lpey).'; return; }
    location.href = `/e/${code}`;
  };
}
