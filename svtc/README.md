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

## Mise en ligne (gratuite) : Vercel + Neon

**Vercel (offre Hobby) + Neon PostgreSQL (offre Free)** : pas de mise en veille, HTTPS et CDN mondiaux, base PostgreSQL managée avec sauvegardes et restauration à un instant donné, déploiement automatique à chaque `git push`.

**En un clic** (après fusion de la branche dans `master`) :

[![Déployer sur Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FANDJE30%2FMY_WORLD%2Ftree%2Fmaster%2Fsvtc&project-name=svtc-repetitions&repository-name=svtc-repetitions&env=ADMIN_PASSWORD&envDescription=Mot%20de%20passe%20initial%20du%20compte%20administrateur%20(8%20caract%C3%A8res%20minimum%2C%20lettres%20et%20chiffres)&products=%5B%7B%22type%22%3A%22integration%22%2C%22protocol%22%3A%22storage%22%2C%22productSlug%22%3A%22neon%22%2C%22integrationSlug%22%3A%22neon%22%7D%5D)

Le bouton crée le projet, propose la base **Neon** (gratuite, `DATABASE_URL` renseignée automatiquement) et demande `ADMIN_PASSWORD`.

**Manuellement** :

1. Créez un compte sur vercel.com (connexion avec GitHub).
2. *Add New ▸ Project* : importez le dépôt, **Root Directory = `svtc`**.
3. *Environment Variables* : ajoutez `ADMIN_PASSWORD` (mot de passe initial de l'administrateur), puis *Deploy*.
4. Onglet *Storage* : *Create Database ▸ Neon* (gratuit, région Francfort) ▸ *Connect* : `DATABASE_URL` est renseignée automatiquement.
5. *Deployments ▸ Redeploy* : les migrations de la base s'exécutent pendant le build (`npm run build`).
6. Ouvrez `https://<projet>.vercel.app/admin/connexion` (identifiant `admin`, mot de passe `ADMIN_PASSWORD`) et changez le mot de passe.

Variables d'environnement : voir `.env.example` (base de données, mot de passe initial, adresse publique `APP_URL`, passerelle SMS facultative : Orange SMS API, Twilio ou Africa's Talking). Les paramètres `channel_binding` des adresses Neon sont neutralisés automatiquement.

> L'offre Hobby de Vercel est destinée à un usage non commercial. Pour un usage commercial intensif, passez à l'offre Pro, ou déployez la même application sur tout hébergeur Node.js (Render, Railway, VPS) avec la même base Neon (`npm run build && npm start`).

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
