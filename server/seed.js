// Jeu de données de démonstration (établissement FICTIF). Usage : npm run seed  (réinitialise la base)
import { db, tx, saveSettings, DEFAULT_SETTINGS, ensureTaxonomy, periodPlan } from './db.js';
import { hashPassword, genPassword } from './security.js';
import { seal } from './vault.js';
import { generateTimetable } from './routes/admin.js';
import { pdb, createTenant, inTenant, inPlatform, getTenantByCode, schoolYearOf, yearBounds } from './platform.js';

export const DEMO_ACCOUNTS = [
  { role: 'admin', username: 'admin', password: 'Admin@2026', label: 'Administrateur' },
  { role: 'teacher', username: 'mbargajp', password: 'Prof@2026', label: 'Enseignant (Mathématiques)' },
  { role: 'discipline', username: 'sg.nguemap', password: 'Disc@2026', label: 'Responsable disciplinaire' }
];

function rng(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

export function seedDemo() {
  const rand = rng(20262027);
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const today = new Date();
  const y = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
  tx(() => {
    for (const t of ['timetable', 'incidents', 'discipline_records', 'discipline_validations', 'progressions', 'note_validations', 'notes',
      'officer_classes', 'students', 'class_subjects', 'subjects', 'subject_groups', 'subject_types', 'classes', 'announcements', 'audit_log', 'sessions', 'users', 'settings', 'periods', 'year_archives']) db.exec(`DELETE FROM ${t}`);
    db.exec("DELETE FROM sqlite_sequence");

    saveSettings({ ...DEFAULT_SETTINGS,
      nom: 'Lycée Pilote EduGest de Yaoundé', nom_court: 'LPEY', type: "Lycée d'enseignement général", statut: 'Public', sous_systeme: 'Francophone',
      delegation_regionale: 'du Centre', delegation_departementale: 'du Mfoundi', region: 'Centre', departement: 'Mfoundi', ville: 'Yaoundé',
      bp: '1234 Yaoundé', tel: '+237 6 99 00 00 00', email: 'contact@lpey.cm', immatriculation: 'LPEY-CE-0001', arrete_creation: 'Arrêté n° 000/A/MINESEC (fictif)',
      devise: 'Discipline – Travail – Excellence', chef_titre: 'Le Proviseur', chef_nom: 'Dr. ATANGANA Marie-Claire', censeur_nom: 'M. FOUDA Bernard',
      surveillant_general: 'M. NGUEMA Paul', annee_scolaire: `${y}-${y + 1}`, jours_actifs: [1, 2, 3, 4, 5] });

    // Calendrier : la séquence 1 est terminée, la séquence 2 est en cours
    const iso = (d) => d.toISOString().slice(0, 10);
    const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
    const s2start = addDays(today, -12), s2end = addDays(today, 30);
    const plan = [[addDays(s2start, -50), addDays(s2start, -3)], [s2start, s2end]];
    let cursor = addDays(s2end, 21);
    for (let i = 2; i < 6; i++) { plan.push([cursor, addDays(cursor, 40)]); cursor = addDays(cursor, 44); }
    const insP = db.prepare('INSERT INTO periods(seq, start_date, end_date, status, closed_at, closed_by) VALUES(?,?,?,?,?,?)');
    plan.forEach((p, i) => insP.run(i + 1, iso(p[0]), iso(p[1]), i === 0 ? 'closed' : 'open', i === 0 ? Math.floor(Date.now() / 1000) - 86400 : null, i === 0 ? 'admin' : null));

    // mots de passe générés conservés chiffrés dans le coffre des accès
    const insU0 = db.prepare(`INSERT INTO users(role, username, pass_hash, full_name, sexe, phone, specialite, matricule, must_change, pw_enc, pw_set_at)
      VALUES(?,?,?,?,?,?,?,?,0,?,unixepoch())`);
    const insU = { run: (role, u, pw, ...rest) => insU0.run(role, u, hashPassword(pw), ...rest, seal(pw)) };
    insU.run('admin', 'admin', 'Admin@2026', 'Dr. ATANGANA Marie-Claire', 'F', '+237 6 77 00 00 01', 'Direction', 'ADM-001');
    const teachers = [
      ['mbargajp', 'MBARGA Jean-Paul', 'M', 'Mathématiques'], ['ekotos', 'EKOTO Solange', 'F', 'Français'], ['tabiwa', 'TABI Walters Achu', 'M', 'Anglais'],
      ['nkoulouc', 'NKOULOU Christine', 'F', 'Physique-Chimie'], ['fotsoh', 'FOTSO Hervé', 'M', 'SVT'], ['bellol', 'BELLO Lamido', 'M', 'Histoire-Géographie'],
      ['ndongm', 'NDONG Mireille', 'F', 'ECM / LCN'], ['kamgaf', 'KAMGA Franck', 'M', 'Informatique'], ['abenaj', 'ABENA Joseph', 'M', 'EPS'],
      ['manga', 'MANGA Agnès', 'F', 'Philosophie / Espagnol'], ['ngoar', 'NGO BAYIHA Rose', 'F', 'Mathématiques'], ['djomop', 'DJOMO Patrick', 'M', 'Physique-Chimie']];
    const T = {};
    teachers.forEach(([u, n, s, sp], i) => { T[u] = Number(insU.run('teacher', u, u === 'mbargajp' ? 'Prof@2026' : genPassword(), n, s, `+237 6 9${i} 11 22 3${i % 10}`, sp, `MAT-${1000 + i}`).lastInsertRowid); });
    const sg1 = Number(insU.run('discipline', 'sg.nguemap', 'Disc@2026', 'NGUEMA Paul', 'M', '+237 6 55 44 33 22', 'Surveillant Général', 'SG-01').lastInsertRowid);
    const sg2 = Number(insU.run('discipline', 'sg.essomba', genPassword(), 'ESSOMBA Clarisse', 'F', '+237 6 55 44 33 23', 'Surveillante Générale adjointe', 'SG-02').lastInsertRowid);

    const subjects = [['Français', 'FRA', 1], ['Anglais', 'ANG', 1], ['Histoire-Géographie', 'HG', 1], ['Éducation à la citoyenneté', 'ECM', 1],
      ['Langues et cultures nationales', 'LCN', 1], ['Espagnol', 'ESP', 1], ['Philosophie', 'PHI', 1], ['Mathématiques', 'MATH', 2],
      ['Physique-Chimie', 'PCT', 2], ['Sciences de la vie et de la Terre', 'SVT', 2], ['Informatique', 'INFO', 2], ['Éducation physique et sportive', 'EPS', 3]];
    const S = {};
    // référentiels par défaut : Groupe 1/2/3 et Matière littéraire / scientifique / autre
    ensureTaxonomy();
    const G = Object.fromEntries(db.prepare('SELECT ordre, id FROM subject_groups').all().map((x) => [x.ordre, x.id]));
    const TY = Object.fromEntries(db.prepare('SELECT name, id FROM subject_types').all().map((x) => [x.name, x.id]));
    const typeOf = { 1: 'Matière littéraire', 2: 'Matière scientifique', 3: 'Autre matière' };
    const insS = db.prepare('INSERT INTO subjects(name, code, group_id, type_id) VALUES(?,?,?,?)');
    subjects.forEach(([n, c, g]) => { S[c] = Number(insS.run(n, c, G[g], TY[typeOf[g]]).lastInsertRowid); });

    const classes = [
      ['6e A', '6e', '', 'Premier cycle', 'B01', 'ekotos', ['FRA:4:5', 'ANG:3:4', 'HG:2:3', 'ECM:1:1', 'LCN:1:1', 'MATH:4:5', 'SVT:2:2', 'INFO:1:1', 'EPS:2:2']],
      ['5e A', '5e', '', 'Premier cycle', 'B02', 'tabiwa', ['FRA:4:5', 'ANG:3:4', 'HG:2:3', 'ECM:1:1', 'LCN:1:1', 'MATH:4:5', 'SVT:2:2', 'INFO:1:1', 'EPS:2:2']],
      ['4e A', '4e', 'Espagnol', 'Premier cycle', 'B03', 'bellol', ['FRA:4:5', 'ANG:3:4', 'ESP:2:3', 'HG:2:3', 'ECM:1:1', 'MATH:4:4', 'PCT:2:2', 'SVT:2:2', 'INFO:1:1', 'EPS:2:2']],
      ['3e A', '3e', 'Espagnol', 'Premier cycle', 'B04', 'mbargajp', ['FRA:4:5', 'ANG:3:4', 'ESP:2:3', 'HG:2:3', 'ECM:1:1', 'MATH:4:4', 'PCT:3:3', 'SVT:2:2', 'INFO:1:1', 'EPS:2:2']],
      ['2nde C', '2nde', 'C', 'Second cycle', 'C01', 'nkoulouc', ['FRA:3:4', 'ANG:2:3', 'HG:2:2', 'ECM:1:1', 'MATH:5:5', 'PCT:4:4', 'SVT:2:2', 'INFO:2:2', 'EPS:2:2']],
      ['Tle D', 'Terminale', 'D', 'Second cycle', 'C02', 'fotsoh', ['FRA:2:3', 'ANG:2:3', 'PHI:2:3', 'HG:2:2', 'ECM:1:1', 'MATH:4:4', 'PCT:4:4', 'SVT:5:5', 'INFO:1:1', 'EPS:2:2']]];
    const who = { FRA: ['ekotos'], ANG: ['tabiwa'], HG: ['bellol'], ECM: ['ndongm'], LCN: ['ndongm'], ESP: ['manga'], PHI: ['manga'],
      MATH: ['mbargajp', 'ngoar'], PCT: ['nkoulouc', 'djomop'], SVT: ['fotsoh'], INFO: ['kamgaf'], EPS: ['abenaj'] };
    const insC = db.prepare('INSERT INTO classes(name, level, serie, cycle, room, titulaire_id) VALUES(?,?,?,?,?,?)');
    const insCS = db.prepare('INSERT INTO class_subjects(class_id, subject_id, coef, teacher_id, hours_week) VALUES(?,?,?,?,?)');
    const C = [];
    classes.forEach(([n, l, se, cy, room, tit, subs], ci) => {
      const cid = Number(insC.run(n, l, se, cy, room, T[tit]).lastInsertRowid);
      C.push(cid);
      subs.forEach((x) => {
        const [code, coef, h] = x.split(':');
        const pool = who[code];
        const teacher = code === 'MATH' ? (['3e A', '2nde C', 'Tle D', '4e A'].includes(n) ? 'mbargajp' : 'ngoar') : code === 'PCT' ? (ci % 2 ? 'nkoulouc' : 'djomop') : pool[0];
        insCS.run(cid, S[code], +coef, T[teacher], +h);
      });
    });
    const insO = db.prepare('INSERT INTO officer_classes(user_id, class_id) VALUES(?,?)');
    C.forEach((cid, i) => insO.run(i < 4 ? sg1 : sg2, cid));

    const nomsM = ['ABANDA', 'ATEBA', 'BIYA', 'BILOA', 'EBOGO', 'ESSAMA', 'ETOGA', 'FOUDA', 'MBALLA', 'MBIDA', 'NANA', 'NDZANA', 'NGONO', 'OBAMA', 'OWONA', 'TCHOUA',
      'TAGNE', 'KAMDEM', 'FOKOU', 'NJOYA', 'MOUNCHIPOU', 'TCHINDA', 'WANDJI', 'YOUMBI', 'NGANDO', 'EWANE', 'DOUALA', 'EKANE', 'MOUKOKO', 'HAMADOU', 'ABDOULAYE', 'BOUBA', 'NCHE', 'FON', 'TANYI'];
    const prenomsM = ['Junior', 'Arnaud', 'Brice', 'Cédric', 'Dimitri', 'Franck', 'Gaël', 'Hugues', 'Ismaël', 'Kevin', 'Loïc', 'Moïse', 'Ndi', 'Patrick', 'Rodrigue', 'Samuel', 'Steve', 'Yannick', 'Ousmane', 'Emmanuel'];
    const prenomsF = ['Aïcha', 'Brenda', 'Carine', 'Danielle', 'Estelle', 'Flore', 'Grâce', 'Hortense', 'Inès', 'Joëlle', 'Larissa', 'Marlyse', 'Nadège', 'Orphée', 'Prisca', 'Rachel', 'Sandrine', 'Vanessa', 'Yvonne', 'Christelle'];
    const lieux = ['Yaoundé', 'Douala', 'Bafoussam', 'Garoua', 'Bamenda', 'Ebolowa', 'Bertoua', 'Ngaoundéré', 'Maroua', 'Kribi', 'Mbalmayo', 'Dschang'];
    const insSt = db.prepare(`INSERT INTO students(matricule, nom, prenom, sexe, date_naissance, lieu_naissance, class_id, redoublant, parent_nom, parent_tel) VALUES(?,?,?,?,?,?,?,?,?,?)`);
    let mat = 0;
    const baseAge = [11, 12, 13, 14, 15, 17];
    C.forEach((cid, ci) => {
      const n = 26 + Math.floor(rand() * 9);
      for (let k = 0; k < n; k++) {
        const sx = rand() < 0.52 ? 'F' : 'M';
        const nom = pick(nomsM);
        const by = y - baseAge[ci] - (rand() < 0.3 ? 1 : 0);
        insSt.run(`${String(y).slice(2)}LPEY${String(++mat).padStart(4, '0')}`, nom, `${pick(sx === 'F' ? prenomsF : prenomsM)}${rand() < 0.3 ? ' ' + pick(sx === 'F' ? prenomsF : prenomsM) : ''}`,
          sx, `${by}-${String(1 + Math.floor(rand() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rand() * 28)).padStart(2, '0')}`, pick(lieux), cid,
          rand() < 0.12 ? 1 : 0, `${nom} ${pick(prenomsM)}`, `+237 6 ${Math.floor(50 + rand() * 49)} ${Math.floor(10 + rand() * 89)} ${Math.floor(10 + rand() * 89)} ${Math.floor(10 + rand() * 89)}`);
      }
    });

    // Notes : S1 complète et validée ; S2 partiellement saisie (en cours)
    const students = db.prepare('SELECT id, class_id FROM students').all();
    const level = Object.fromEntries(students.map((s) => [s.id, 7 + rand() * 9]));
    const css = db.prepare('SELECT * FROM class_subjects').all();
    const insN = db.prepare('INSERT INTO notes(student_id, class_subject_id, seq, value, absent, updated_by) VALUES(?,?,?,?,?,?)');
    const insV = db.prepare('INSERT INTO note_validations(class_subject_id, seq, validated_at, validated_by) VALUES(?,?,unixepoch(),?)');
    const insPr = db.prepare('INSERT INTO progressions(class_subject_id, seq, planned, done, comment) VALUES(?,?,?,?,?)');
    css.forEach((cs, i) => {
      const st = students.filter((s) => s.class_id === cs.class_id);
      const diff = (rand() - 0.5) * 3;
      for (const seq of [1, 2]) {
        if (seq === 2 && i % 3 === 0) continue; // certaines matières pas encore saisies
        st.forEach((s) => {
          if (seq === 2 && i % 3 === 1 && rand() < 0.25) return; // saisie partielle
          const absent = rand() < 0.015;
          const v = Math.max(0, Math.min(20, Math.round((level[s.id] + diff + (rand() - 0.5) * 6) * 4) / 4));
          insN.run(s.id, cs.id, seq, absent ? null : v, absent ? 1 : 0, cs.teacher_id);
        });
        if (seq === 1) insV.run(cs.id, 1, cs.teacher_id);
      }
      const planned = Math.round(cs.hours_week * 5);
      insPr.run(cs.id, 1, planned, Math.max(0, planned - Math.floor(rand() * 3)), rand() < 0.3 ? 'Retard dû aux évaluations' : null);
      insPr.run(cs.id, 2, planned, Math.floor(planned * 0.4), null);
    });

    // Discipline
    const insD = db.prepare(`INSERT INTO discipline_records(student_id, seq, abs_j, abs_nj, retards, consignes, avertissement, blame, exclusion_jours, observation, officer_id)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
    const insI = db.prepare('INSERT INTO incidents(student_id, seq, date, type, gravite, sanction, description, officer_id) VALUES(?,?,?,?,?,?,?,?)');
    const types = [['Retard répété', 'mineure', 'Consigne 2 h'], ['Tenue non réglementaire', 'mineure', 'Avertissement verbal'], ['Usage du téléphone', 'moyenne', 'Confiscation + convocation parent'],
      ['Indiscipline en classe', 'moyenne', 'Consigne 4 h'], ['Bagarre / Violence', 'grave', 'Exclusion 3 jours'], ['Absence non justifiée', 'moyenne', 'Avertissement conduite']];
    students.forEach((s) => {
      for (const seq of [1, 2]) {
        if (seq === 2 && rand() < 0.4) continue;
        const nj = rand() < 0.3 ? Math.floor(rand() * 8) : 0;
        const off = C.indexOf(s.class_id) < 4 ? sg1 : sg2;
        insD.run(s.id, seq, rand() < 0.3 ? Math.floor(rand() * 6) : 0, nj, Math.floor(rand() * 3), nj > 4 ? 2 : 0, nj > 5 ? 1 : 0, 0, 0, nj > 5 ? 'Absences répétées, parent convoqué' : null, off);
        if (rand() < 0.07) {
          const [t, g, sa] = pick(types);
          const p = plan[seq - 1];
          const d = iso(addDays(p[0], Math.floor(rand() * Math.min(20, (today - p[0]) / 86400000 || 1))));
          insI.run(s.id, seq, d, t, g, sa, 'Fait constaté par le surveillant de secteur.', off);
          if (g === 'grave') db.prepare('UPDATE discipline_records SET exclusion_jours = 3, blame = 1 WHERE student_id = ? AND seq = ?').run(s.id, seq);
        }
      }
    });
    C.forEach((cid) => db.prepare('INSERT INTO discipline_validations(class_id, seq, validated_at, validated_by) VALUES(?,1,unixepoch(),?)').run(cid, sg1));

    const insA = db.prepare('INSERT INTO announcements(title, body, audience, author) VALUES(?,?,?,?)');
    insA.run('Conseils de classe du 1er trimestre', `Les conseils de classe se tiendront à la fin de la séquence 2. Les enseignants sont priés de finaliser la saisie des notes et de valider leurs relevés avant le ${iso(s2end)}.`, 'all', 'Dr. ATANGANA Marie-Claire');
    insA.run('Rappel : progression annuelle', 'Merci de mettre à jour le nombre de leçons prévues et faites pour chaque séquence. Les animateurs pédagogiques en feront le suivi.', 'teacher', 'Dr. ATANGANA Marie-Claire');
    insA.run('Contrôle des tenues', 'Un contrôle général des tenues et coiffures est prévu lundi au lever des couleurs.', 'discipline', 'Dr. ATANGANA Marie-Claire');
  });
  // Emplois du temps générés automatiquement
  for (const c of db.prepare('SELECT id FROM classes ORDER BY id').all()) generateTimetable(c.id);
  return DEMO_ACCOUNTS;
}

/** Établissement de démonstration léger : classes, élèves et quelques enseignants (pour le tableau de bord AI721). */
function seedLight({ classes, perClass, teachers }, seedNum) {
  const rand = rng(seedNum);
  const noms = ['ABENA', 'BELLA', 'DIKOUME', 'EYENGA', 'FOTSO', 'KAMGA', 'MBALLA', 'NJOYA', 'OYONO', 'TCHAMBA', 'YOUMBI', 'NDIFOR', 'ACHU', 'HAMIDOU'];
  const pren = ['Paul', 'Aïcha', 'Brice', 'Carine', 'Daniel', 'Estelle', 'Fabrice', 'Grâce', 'Hervé', 'Inès', 'Junior', 'Larissa'];
  tx(() => {
    const insC = db.prepare('INSERT INTO classes(name, level, cycle) VALUES(?,?,?)');
    const insS = db.prepare('INSERT INTO students(matricule, nom, prenom, sexe, class_id) VALUES(?,?,?,?,?)');
    let m = 0;
    classes.forEach((c) => {
      const cid = Number(insC.run(c, c.split(' ')[0], /Tle|1ère|2nde|Form [45]|Sixth/.test(c) ? 'Second cycle' : 'Premier cycle').lastInsertRowid);
      for (let k = 0; k < perClass + Math.floor(rand() * 8); k++)
        insS.run(`DEMO${String(seedNum).slice(-3)}${String(++m).padStart(4, '0')}`, noms[Math.floor(rand() * noms.length)], pren[Math.floor(rand() * pren.length)], rand() < 0.5 ? 'F' : 'M', cid);
    });
    const insU = db.prepare(`INSERT INTO users(role, username, pass_hash, full_name, specialite, must_change, pw_enc, pw_set_at) VALUES(?,?,?,?,?,0,?,unixepoch())`);
    teachers.forEach(([u, n, sp], i) => { const pw = genPassword(); insU.run(i === teachers.length - 1 ? 'discipline' : 'teacher', u, hashPassword(pw), n, sp, seal(pw)); });
  });
}

/** Plateforme de démonstration : 4 établissements dans des situations d'abonnement différentes. */
export function seedPlatformDemo() {
  const cur = schoolYearOf(); const y = +cur.slice(0, 4); const prev = `${y - 1}-${y}`;
  const addSub = (t, annee, montant, paid, mode, ref) => {
    const [from, to] = yearBounds(annee);
    pdb.prepare(`INSERT INTO subscriptions(tenant_id, annee, valid_from, valid_to, montant, paid, paid_at, mode, reference, created_by)
      VALUES(?,?,?,?,?,?,?,?,?,'AI721')`).run(t.id, annee, from, to, montant, paid ? 1 : 0, paid ? from : null, mode, ref);
  };
  // 1. Établissement complet (données de démonstration riches)
  const lpey = createTenant({ code: 'lpey', name: 'Lycée Pilote EduGest de Yaoundé', sigle: 'LPEY', type: "Lycée d'enseignement général", statut: 'Public',
    region: 'Centre', ville: 'Yaoundé', contact_nom: 'Dr. ATANGANA Marie-Claire', contact_tel: '+237 6 77 00 00 01', contact_email: 'contact@lpey.cm',
    annee: cur, montant: 150000, paid: true, mode: 'Mobile Money', reference: 'MOMO-458712' });
  inTenant(lpey.tenant, () => seedDemo());
  const adminId = inTenant(lpey.tenant, () => db.prepare("SELECT id FROM users WHERE username = 'admin'").get().id);
  pdb.prepare('UPDATE tenants SET admin_user_id = ?, admin_username = ?, admin_pw_enc = ? WHERE id = ?').run(adminId, 'admin', seal('Admin@2026'), lpey.tenant.id);
  addSub(lpey.tenant, prev, 150000, true, 'Virement', 'VIR-2025-0091');
  // 2. Établissement actif (données légères)
  const lbd = createTenant({ code: 'lbdouala', name: 'Lycée Bilingue Démo de Douala', sigle: 'LBDD', type: 'Lycée bilingue', statut: 'Public', region: 'Littoral', ville: 'Douala',
    contact_nom: 'M. EKANE Joseph', contact_tel: '+237 6 99 12 34 56', annee: cur, montant: 200000, paid: true, mode: 'Virement', reference: 'VIR-2026-0142' });
  inTenant(lbd.tenant, () => seedLight({ classes: ['6e A', '6e B', '5e A', '4e A', '3e A', 'Form 1', 'Form 4', '2nde C', 'Tle D'], perClass: 38,
    teachers: [['ekanej', 'EKANE Joseph', 'Anglais'], ['ngoleb', 'NGOLE Bertha', 'Mathématiques'], ['tanyip', 'TANYI Peter', 'Physique'], ['sg.mbome', 'MBOME Rachel', 'Surveillante générale']] }, 21));
  // 3. Abonnement de l'an dernier non renouvelé → expiré
  const ctb = createTenant({ code: 'cetbafoussam', name: "Collège d'Enseignement Technique Démo de Bafoussam", sigle: 'CETB', type: "Collège d'enseignement technique (CETIC)",
    statut: 'Privé laïc', region: 'Ouest', ville: 'Bafoussam', contact_nom: 'M. FOKOU Albert', contact_tel: '+237 6 70 11 22 33', annee: prev, montant: 100000, paid: true, mode: 'Espèces', reference: 'ESP-0457' });
  inTenant(ctb.tenant, () => seedLight({ classes: ['1ère année MEM', '2e année ELEC', '3e année MAV', '4e année CI'], perClass: 30,
    teachers: [['fokoua', 'FOKOU Albert', 'Électrotechnique'], ['sg.tagne', 'TAGNE Brigitte', 'Surveillante générale']] }, 33));
  // 4. Nouvel abonnement en attente de paiement
  const cesg = createTenant({ code: 'cesgaroua', name: "Collège d'Enseignement Secondaire Démo de Garoua", sigle: 'CESG', type: "Collège d'enseignement secondaire (CES)",
    statut: 'Public', region: 'Nord', ville: 'Garoua', contact_nom: 'M. HAMADOU Bello', contact_tel: '+237 6 94 55 66 77', annee: cur, montant: 75000, paid: false });
  inTenant(cesg.tenant, () => seedLight({ classes: ['6e', '5e', '4e', '3e'], perClass: 45, teachers: [['hamadoub', 'HAMADOU Bello', 'Français'], ['sg.aissatou', 'AÏSSATOU Mariam', 'Surveillante générale']] }, 45));
  return { lpey: lpey.tenant };
}

// Usage : npm run seed  → réinitialise l'établissement de démonstration « lpey » (ou crée la plateforme de démonstration)
if (process.argv[1]?.endsWith('seed.js')) {
  const t = getTenantByCode('lpey');
  if (t) inTenant(t, () => seedDemo()); else seedPlatformDemo();
  console.log('Démonstration prête. Console : AI721 / Ai721@2026 — Établissement /e/lpey :');
  DEMO_ACCOUNTS.forEach((a) => console.log(`  ${a.label.padEnd(28)} ${a.username} / ${a.password}`));
}
