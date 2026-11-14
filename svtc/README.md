# SVTC Répétitions — Silicon Valley Training Center

Application web responsive de gestion des **cours de répétitions en informatique** de la **Silicon Valley Training Center** (Centre Éducatif TYRANNUS, Biyem-Assi Lac, Yaoundé — Cameroun).

> Comprendre. Pratiquer. Maîtriser. — « C'est votre ATTITUDE, non pas seulement votre aptitude, qui détermine votre ALTITUDE. »

| Espace | Adresse | Style | Fonctions principales |
|---|---|---|---|
| **Administration** | `/admin` | Console bleu nuit et or, menu latéral, palette de commandes `Ctrl + K` | Paramètres du centre (nom, logo, bandeau PDF, horaires), classes, matières, salles et tarifs, élèves et parents (import Excel/CSV), encadreurs et comptes d'accès, attributions, **planning automatique sans conflit** et PDF, séances et validation des heures, présences, notes, documents pédagogiques, paiements et reçus (QR code), impayés et relances, dépenses, **état de caisse PDF**, **location des salles PDF**, **salaires au prorata des heures PDF**, messages aux parents (application, SMS, WhatsApp), comptes, journal d'audit, sauvegardes |
| **Encadreur** | `/encadreur` | Espace de travail bleu roi, barre d'onglets mobile | Séances du jour (démarrer / terminer, chronomètre), appel tactile, contenu de séance, dépôt des fiches de TD (PDF), évaluations et notes, progression des élèves et **état de suivi PDF**, envoi du suivi au parent, heures et estimation de salaire, messages |
| **Parent** | `/parent` | Application familiale claire et dorée | Planning de l'enfant, détail des séances (encadreur, heures de début et de fin, contenu, travail à faire), messages, **état de suivi PDF**, notes et assiduité, paiements et reçus |

Les trois interfaces de connexion sont distinctes (`/admin/connexion`, `/encadreur/connexion`, `/parent/connexion`) et chaque compte n'ouvre que son propre espace.

## Démarrer en local

Prérequis : Node.js 20.9 ou plus, PostgreSQL 14 ou plus.

```bash
npm install
```

```bash
cp .env.example .env.local   # puis renseignez DATABASE_URL et ADMIN_PASSWORD
```

```bash
npm run db:migrate
```

```bash
npm run dev
```

L'application crée automatiquement au premier démarrage : les paramètres de la SVTC, l'année scolaire, les 6 matières, 9 classes (6e à Tle, PTI, TTI), les salles A et B (mercredi 500 FCFA/h, dimanche 1000 FCFA/h) et le compte `admin` (mot de passe `ADMIN_PASSWORD`). Sans `ADMIN_PASSWORD`, la page `/installation` permet de créer le premier administrateur.

### Données de démonstration (facultatif)

```bash
npm run seed:demo -- --reset
```

| Espace | Identifiant | Mot de passe |
|---|---|---|
| Administration | `admin` | valeur de `ADMIN_PASSWORD` |
| Encadreur | `paul.ndjock` (ou `aline.mekongo`, `serge.tchamba`…) | `Demo@2026` |
| Parent | `690000001` | `Demo@2026` |

⚠️ N'exécutez jamais `seed:demo --reset` sur la base de production : il efface les données.

## Tests

```bash
npm test            # 11 tests unitaires : salaires, location, soldes, planning, montants en lettres, dates
npm run test:e2e    # 29 tests de bout en bout (Playwright) : parcours admin, encadreur, parent et sécurité
```

## Mise en ligne sur Render : https://svtc-tutoring.onrender.com

Le fichier [`render.yaml`](render.yaml) (Blueprint) crée en une fois le **service web `svtc-tutoring`** et sa **base PostgreSQL** (offre gratuite, région Francfort).

1. Connectez-vous sur **dashboard.render.com** (« Sign in with GitHub »).
2. **New ▸ Blueprint** ▸ choisissez le dépôt **ANDJE30/MY_WORLD**, la branche (`claude/tutoring-management-platform-eqy60z`, ou `master` après fusion) et **Blueprint Path : `svtc/render.yaml`**.
3. Renseignez **ADMIN_PASSWORD** (mot de passe initial du compte `admin`, 8 caractères minimum avec lettres et chiffres) puis **Deploy Blueprint**.
4. Après la construction (5 à 10 minutes), ouvrez **https://svtc-tutoring.onrender.com/admin/connexion** (identifiant `admin`) et changez le mot de passe.

Chaque `git push` sur la branche choisie redéploie automatiquement ; les migrations de la base s'appliquent pendant la construction.

> **Limites de l'offre gratuite Render.** Le service s'endort après 15 minutes sans visite (premier affichage d'environ une minute ensuite). La **base PostgreSQL gratuite expire 30 jours après sa création** : avant l'échéance, passez-la à l'offre Basic (quelques dollars par mois) ou remplacez `DATABASE_URL` par une base **Neon** gratuite et permanente (neon.tech), sans autre changement de code.

Autre hébergeur possible : **Vercel + Neon** (projet Vercel, *Root Directory* `svtc`, base Neon intégrée, variable `ADMIN_PASSWORD`). Les paramètres `channel_binding` des adresses Neon sont neutralisés automatiquement.

Variables d'environnement : voir `.env.example` (base de données, mot de passe initial, adresse publique `APP_URL`, passerelle SMS facultative : Orange SMS API, Twilio ou Africa's Talking).

## Livrables

| Livrable | Fichiers |
|---|---|
| Cahier des charges (avec diagrammes UML) | [`docs/Cahier_des_charges_SVTC_Repetitions.docx`](docs/Cahier_des_charges_SVTC_Repetitions.docx) · [`.pdf`](docs/Cahier_des_charges_SVTC_Repetitions.pdf) |
| Manuel d'utilisation | [`docs/Manuel_utilisation_SVTC_Repetitions.docx`](docs/Manuel_utilisation_SVTC_Repetitions.docx) · [`.pdf`](docs/Manuel_utilisation_SVTC_Repetitions.pdf) |
| Diagrammes UML (sources Mermaid + PNG) | [`docs/uml/`](docs/uml) |
| Captures d'écran et exemples de PDF générés | [`docs/captures/`](docs/captures) |

Régénérer les documents : `node scripts/render-uml.cjs <mermaid.min.js>`, puis `python3 docs/scripts/cahier.py`, `python3 docs/scripts/manuel.py` et `python3 docs/scripts/convert.py docs/*.docx` (python-docx, LibreOffice et la police Poppins).

## Architecture

- **Next.js 16** (App Router, Server Components, Server Actions, React 19), **TypeScript**, **Tailwind CSS 4**.
- **PostgreSQL** via **Drizzle ORM** et `postgres` (migrations SQL versionnées dans `drizzle/`).
- **PDF** générés côté serveur avec `@react-pdf/renderer`, au gabarit du papier en-tête SVTC (bandeau, filigrane, pied de page, police Poppins), QR codes de vérification (`/verifier/<code>`).
- **PWA** installable sur smartphone (manifeste, icônes, service worker limité aux ressources statiques).

### Sécurité

- Mots de passe hachés avec **scrypt** (sel aléatoire), politique de complexité, mots de passe générés faciles à retenir (`Baobab@4827`).
- Sessions révocables : jeton aléatoire de 256 bits, seule son empreinte SHA-256 est stockée, cookie `__Host-` HttpOnly, Secure, SameSite ; expiration absolue et d'inactivité par profil.
- **Verrouillage** du compte 15 minutes après 5 échecs, **limitation de débit** par IP et par identifiant.
- **Contrôle d'accès côté serveur** sur chaque page, action et fichier (rôle + rattachement : un encadreur ne voit que ses classes, un parent que ses enfants).
- Protection **CSRF** des actions serveur (contrôle d'origine), **CSP stricte avec nonce** par requête, HSTS, `X-Frame-Options`, `nosniff`, `Permissions-Policy`.
- Fichiers déposés contrôlés par **signature binaire** (vrais PDF, vraies images), taille limitée, servis avec contrôle d'accès.
- Validation de toutes les entrées (Zod), requêtes SQL paramétrées, neutralisation des formules dans les exports CSV.
- **Journal d'audit** de toutes les opérations sensibles ; aucun mot de passe en clair n'est conservé.

```
src/app/            pages et routes (admin, encadreur, parent, API PDF, exports, fichiers, vérification)
src/app/actions/    actions serveur (authentification, structure, personnes, pédagogie, finances, messages, encadreur)
src/lib/            métier (calculs, paie, planning, PDF, SMS, sécurité, formats)
src/db/             schéma de la base (Drizzle)
drizzle/            migrations SQL
scripts/            migration, jeu de démonstration
tests/              tests unitaires et de bout en bout
```
