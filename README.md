# AI721 SchoolX CM — une plateforme AI721 TECH STUFF

*Anciennement « EduGest CM » (versions 1.x et 2.x).*

**Plateforme web responsive (SaaS, multi-établissements) de gestion des notes, des faits disciplinaires, des emplois du temps, de l'assiduité et des documents administratifs du personnel des établissements d'enseignement secondaire général et technique du Cameroun.**

Elle suit l'organisation scolaire camerounaise : 6 séquences en 3 trimestres, notes sur 20, coefficients, rangs ex æquo, conseils de classe et bulletins officiels bilingues. Elle fonctionne sur ordinateur, tablette et smartphone, et s'installe comme une application (PWA).

L'éditeur, **AI721 TECH STUFF**, commercialise la plateforme sur **abonnement annuel**. Les accès d'un établissement sont valables **du 1er septembre au 31 août**.

| Profil | Interface | Fonctions principales |
|---|---|---|
| **Super administrateur AI721** | `/console` | Établissements abonnés (une base de données dédiée par établissement), abonnements et paiements (reçus PDF), coffre des accès des administrateurs, liens et fiches d'accès (PDF, WhatsApp), suspension et renouvellement, tableau de bord commercial |
| **Administrateur d'établissement** | `/e/<code>/admin` | Paramétrage, comptes du personnel avec **coffre des accès** (mots de passe générés et liens, envoi par WhatsApp), classes, matières (groupe et type), élèves, attributions, emplois du temps, clôtures par séquence et par trimestre, **clôture de l'année** (statistiques annuelles et sauvegarde archivées), bulletins, PV, **statistiques exportables en PDF**, **messages aux parents** (SMS, WhatsApp), **assiduité des enseignants** (pointage journalier, taux d'assiduité) et **documents administratifs** (présence effective au poste, prise de service, rappel à l'ordre, lettre d'observation, demande d'explication) |
| **Enseignant** | `/e/<code>/enseignant` | Saisie des notes **par séquence ou par trimestre**, progression annuelle (dont leçons digitalisées), validation, relevés PDF, emploi du temps, **mes documents administratifs** (accusé de réception, **réponse en ligne aux demandes d'explication**) et mon assiduité |
| **Responsable disciplinaire** | `/e/<code>/discipline` | Absences, retards, consignes, sanctions, incidents, récapitulatif trimestriel, fiches PDF |

Les quatre interfaces de connexion sont distinctes : chacune a son adresse, ses couleurs et sa page, et n'accepte que son propre rôle.

## Livrables

| Livrable | Fichiers |
|---|---|
| Cahier des charges (avec diagrammes UML) | [`docs/Cahier_des_charges_AI721_SchoolX_CM.docx`](docs/Cahier_des_charges_AI721_SchoolX_CM.docx) · [`.pdf`](docs/Cahier_des_charges_AI721_SchoolX_CM.pdf) |
| Manuel d'utilisation | [`docs/Manuel_utilisation_AI721_SchoolX_CM.docx`](docs/Manuel_utilisation_AI721_SchoolX_CM.docx) · [`.pdf`](docs/Manuel_utilisation_AI721_SchoolX_CM.pdf) |
| Diagrammes UML (sources Mermaid + PNG) | [`docs/uml/`](docs/uml) |
| Captures d'écran | [`docs/captures/`](docs/captures) |

## Démarrage rapide (local)

Prérequis : **Node.js ≥ 22.13**. Aucune autre dépendance système n'est nécessaire.

```bash
npm install
```

```bash
DEMO=1 npm start
```

Le mode démonstration crée une plateforme avec 4 établissements fictifs (http://localhost:3000) :

| Interface | Adresse | Identifiant / mot de passe |
|---|---|---|
| Console AI721 | `/console` | `AI721` / `Ai721@2026` |
| Administration | `/e/lpey/admin` | `admin` / `Admin@2026` |
| Enseignants | `/e/lpey/enseignant` | `mbargajp` / `Prof@2026` |
| Vie scolaire | `/e/lpey/discipline` | `sg.nguemap` / `Disc@2026` |

Les autres établissements de démonstration illustrent les situations d'abonnement : `lbdouala` (actif), `cetbafoussam` (expiré) et `cesgaroua` (en attente de paiement).

Pour une installation réelle, lancez `npm start` sur un dossier de données vide. Le compte `AI721` est créé au premier démarrage avec le mot de passe `SUPERADMIN_PASSWORD`, ou un mot de passe affiché une seule fois dans la console. Une installation 1.x existante (`data/edugest.db`) est **convertie automatiquement** en premier établissement de la plateforme.

```bash
npm test                  # 32 tests d'intégration (plateforme, abonnements, isolation, sécurité, calculs, clôtures, assiduité, documents administratifs, PDF, migrations)
```

## Déploiement

| Usage | Hébergeur | Procédure |
|---|---|---|
| **Démonstration** (gratuit, en un clic) | Render (offre Free) | [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/andje30/my_world) — le fichier `render.yaml` configure tout. Le disque gratuit est éphémère : la base de démonstration se recrée à chaque redémarrage. |
| **Production gratuite** | Oracle Cloud *Always Free* (VM ARM, 200 Go persistants) | Créez une VM Ubuntu, pointez un domaine vers son IP, puis exécutez `sudo DOMAIN=schoolx.ai721.cm SUPERADMIN_PASSWORD='…' bash deploy/oracle-cloud-init.sh` (Docker + Caddy, HTTPS automatique, clé du coffre générée). |
| Production sur un serveur existant | Tout VPS | `cd deploy && DOMAIN=… SUPERADMIN_PASSWORD=… VAULT_KEY=$(openssl rand -hex 32) docker compose up -d --build` |

**Mettre à jour le site** :
- **Render** : chaque fusion dans `master` redéploie automatiquement le service.
- **Serveur de production** : lancez `sudo bash /opt/edugest/deploy/mise-a-jour.sh`. Le script sauvegarde la base, récupère le code et redémarre l'application. Les migrations de la base s'appliquent automatiquement et les données sont conservées.

Variables d'environnement :

| Variable | Rôle |
|---|---|
| `PORT` | Port d'écoute |
| `DATA_DIR` | Dossier des données, `./data` par défaut. Contient `platform.db`, `tenants/<code>/edugest.db`, `backups/`, `vault.key` |
| `SUPERADMIN_PASSWORD` | Mot de passe du compte AI721 |
| `VAULT_KEY` | 32 octets en hexadécimal : clé du coffre des accès (sinon `DATA_DIR/vault.key`, à sauvegarder avec les données) |
| `DEMO=1` | Plateforme de démonstration |
| `TRUST_PROXY` | 1 derrière un proxy, 0 en exposition directe |
| `AUTO_BACKUP=0` | Désactive les sauvegardes automatiques (toutes les 6 h, 14 jours conservés) |

## Architecture

- **Multi-établissements** : une base « plateforme » (établissements, abonnements, super admin) et **une base SQLite par établissement**. Chaque requête s'exécute dans le contexte de son établissement (`AsyncLocalStorage`) ; le cookie de session est limité à `/e/<code>/`.
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
  - journal d'audit et sauvegardes automatiques ;
  - coffre des accès chiffré en AES-256-GCM, limité aux mots de passe **générés** (un mot de passe choisi par l'utilisateur n'est jamais conservé) ;
  - contrôle de l'abonnement et de la suspension à chaque requête.

```
server/            API, sécurité, calculs, PDF, base de données, jeu de démonstration
public/            interface (HTML, CSS, JS), PWA
test/              tests d'intégration (node:test)
deploy/            docker-compose, Caddyfile, script d'installation serveur
docs/              cahier des charges, manuel, UML, captures
scripts/           génération des captures, des diagrammes et des documents Word/PDF
```

Pour régénérer les documents : `node scripts/render-uml.cjs <mermaid.min.js>`, puis `python3 scripts/docs/cahier.py`, `python3 scripts/docs/manuel.py` et `python3 scripts/docs/convert.py docs/*.docx` (nécessite python-docx et LibreOffice).

## Historique des versions

- **3.2** :
  - appellations au choix : **Séquence** ou **Situation**, **Professeur Principal** ou **Titulaire** (interface, messages et PDF) ;
  - **leçons digitalisées** dans la progression annuelle (saisie, taux de digitalisation, suivi par l'administration, fiche PDF) ;
  - **attestation de présence effective au poste** au modèle administratif officiel (APEP), enrichie du taux d'assiduité ; actes administratifs en Liberation Serif et Anton (polices embarquées, licence OFL) ;
  - **messages aux parents** (remise des bulletins, réunion des parents, information) personnalisés avec le nom de l'enfant : SMS par passerelle (Africa's Talking, Twilio, Orange — configurée dans la console AI721), WhatsApp ou SMS depuis le téléphone, export CSV, historique et relance.

- **3.1** : appellations des fonctions paramétrables (onglet *Établissement ▸ Fonctions*) — chef d'établissement (Proviseur, Directeur, Principal), adjoint (Censeur, Préfet, Préfet Adjoint), vie scolaire (Surveillant Général, Surveillant Général Adjoint), animation pédagogique (Animateur Pédagogique, Coordonnateur) — reprises avec le nom des titulaires sur les signatures de tous les documents.

- **3.0** :
  - nouveau nom : **AI721 SchoolX CM** (adresses, comptes et données inchangés ; les sauvegardes « EduGest CM » restent restaurables) ;
  - dossier administratif des enseignants : grade, statut, diplôme, fonction, prise de service, acte d'affectation ;
  - assiduité : heures dues calculées depuis l'emploi du temps, pointage journalier des cours, absences (heures, journée, période) et retards, jours non ouvrés, taux d'assiduité par séquence, trimestre, mois ou année, état et relevé PDF ;
  - documents administratifs numérotés : attestation de présence effective au poste (avec taux d'assiduité), certificat de prise de service, rappel à l'ordre, lettre d'observation, demande d'explication avec espace de réponse pour l'intéressé ;
  - faits proposés automatiquement (absences, retards, notes non validées, progression en retard), remise, suite réservée, annulation, registre PDF, alertes ;
  - espace enseignant « Mes documents & assiduité » : lecture, accusé de réception, réponse en ligne ;
  - correction : le service worker ne met plus en cache les réponses des API d'établissement.

- **2.0** :
  - plateforme multi-établissements AI721 TECH STUFF : console super admin, abonnements annuels (septembre → août), paiements et reçus, suspension, coffre des accès des administrateurs ;
  - quatre interfaces de connexion distinctes ;
  - coffre des accès de l'administrateur avec liens et envoi par WhatsApp ;
  - saisie, suivi, statistiques et clôtures par trimestre, statistiques exportables en PDF ;
  - clôture de l'année avec rapport annuel et sauvegarde archivés ;
  - migration automatique des installations 1.x.
- **1.1** :
  - groupe et type de matière dissociés : référentiels administrables (onglets « Groupes » et « Types de matière »), création à la volée depuis le formulaire d'une matière ;
  - statistiques par type de matière ;
  - migration automatique des bases et des sauvegardes de la version 1.0 ;
  - script de mise à jour du serveur.
- **1.0** : version initiale.
