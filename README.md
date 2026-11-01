# EduGest CM

**Plateforme web responsive de gestion des notes, des faits disciplinaires et des emplois du temps des établissements d'enseignement secondaire général et technique du Cameroun.**

Six séquences regroupées en trois trimestres, notes sur 20, coefficients, rangs ex æquo, conseils de classe, bulletins officiels bilingues. L'application fonctionne sur ordinateur, tablette et smartphone, et s'installe comme une application (PWA).

| Profil | Fonctions principales |
|---|---|
| **Administrateur** | Paramétrage de l'établissement (identité, logo, en-tête officiel, horaires), calendrier et clôture des séquences et trimestres, classes, matières, coefficients, import des élèves, comptes enseignants et responsables avec identifiants faciles à retenir et fiches imprimables, attributions, emplois du temps (génération automatique sans conflit), suivi des saisies, résultats, bulletins, PV, statistiques, annonces, journal d'audit, sauvegardes, nouvelle année |
| **Enseignant** | Progression annuelle (leçons prévues et faites), saisie des notes (enregistrement automatique, brouillon hors ligne, raccourcis clavier, collage depuis Excel), validation, relevés PDF, emploi du temps |
| **Responsable disciplinaire** | Absences justifiées et non justifiées, retards, consignes, avertissements, blâmes, exclusions, registre des incidents, validation, fiches PDF de classe et individuelles |

## Livrables

| Livrable | Fichiers |
|---|---|
| Cahier des charges (avec diagrammes UML) | [`docs/Cahier_des_charges_EduGest_CM.docx`](docs/Cahier_des_charges_EduGest_CM.docx) · [`.pdf`](docs/Cahier_des_charges_EduGest_CM.pdf) |
| Manuel d'utilisation | [`docs/Manuel_utilisation_EduGest_CM.docx`](docs/Manuel_utilisation_EduGest_CM.docx) · [`.pdf`](docs/Manuel_utilisation_EduGest_CM.pdf) |
| Diagrammes UML (sources Mermaid + PNG) | [`docs/uml/`](docs/uml) |
| Captures d'écran | [`docs/captures/`](docs/captures) |

## Démarrage rapide (local)

Prérequis : **Node.js ≥ 22.13**. Aucune autre dépendance système n'est nécessaire.

```bash
npm install
DEMO=1 npm start          # établissement fictif pré-rempli → http://localhost:3000
```

Comptes de démonstration : `admin / Admin@2026`, `mbargajp / Prof@2026` (enseignant), `sg.nguemap / Disc@2026` (responsable disciplinaire).

Pour une installation réelle (base vide), lancez simplement `npm start`. Le compte `admin` est créé au premier démarrage : son mot de passe est affiché une seule fois dans la console, à moins qu'il ne soit fixé par la variable `ADMIN_PASSWORD`.

```bash
npm test                  # 14 tests d'intégration (sécurité, calculs, clôtures, PDF, sauvegarde)
```

## Déploiement

| Usage | Hébergeur | Procédure |
|---|---|---|
| **Démonstration** (gratuit, en un clic) | Render (offre Free) | [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/andje30/my_world) — le fichier `render.yaml` configure tout. Le disque gratuit est éphémère : la base de démonstration se recrée à chaque redémarrage. |
| **Production gratuite** | Oracle Cloud *Always Free* (VM ARM, 200 Go persistants) | Créez une VM Ubuntu, pointez un domaine vers son IP, puis exécutez `sudo DOMAIN=notes.mon-lycee.cm ADMIN_PASSWORD='…' bash deploy/oracle-cloud-init.sh` (Docker + Caddy, HTTPS automatique). |
| Production sur un serveur existant | Tout VPS ou serveur de l'établissement | `cd deploy && DOMAIN=… ADMIN_PASSWORD=… docker compose up -d --build` |

Variables d'environnement : `PORT`, `DATA_DIR` (dossier de la base, par défaut `./data`), `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `DEMO=1`, `TRUST_PROXY` (1 derrière un proxy, 0 en exposition directe), `AUTO_BACKUP=0` (désactive les sauvegardes automatiques, effectuées toutes les 6 h et conservées 14 jours dans `DATA_DIR/backups`).

## Architecture

- **Backend** : Node.js 22, Express 5, SQLite natif (`node:sqlite`, mode WAL), PDFKit. Deux dépendances seulement, sans module natif : l'application tourne sur x86 comme sur ARM.
- **Frontend** : SPA en JavaScript natif (modules ES), sans étape de build, avec un design system CSS maison (thème clair et sombre) et une PWA.
- **Sécurité** :
  - mots de passe hachés avec scrypt ;
  - sessions révocables (jeton haché, cookie HttpOnly et SameSite=Strict) ;
  - protection CSRF par en-tête et contrôle d'origine ;
  - CSP stricte et gabarits à échappement automatique ;
  - requêtes SQL paramétrées ;
  - limitation de débit par IP et par identifiant, verrouillage après 5 échecs ;
  - contrôle d'accès par rôle et par ressource, séquences clôturées verrouillées ;
  - journal d'audit et sauvegardes automatiques.

```
server/            API, sécurité, calculs, PDF, base de données, jeu de démonstration
public/            interface (HTML, CSS, JS), PWA
test/              tests d'intégration (node:test)
deploy/            docker-compose, Caddyfile, script d'installation serveur
docs/              cahier des charges, manuel, UML, captures
scripts/           génération des captures, des diagrammes et des documents Word/PDF
```

Pour régénérer les documents : `node scripts/render-uml.cjs <mermaid.min.js>`, puis `python3 scripts/docs/cahier.py`, `python3 scripts/docs/manuel.py` et `python3 scripts/docs/convert.py docs/*.docx` (nécessite python-docx et LibreOffice).
