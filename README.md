# AI721_ASTRA_LUZ_2.0

Application web du secrétariat des évaluations du second cycle du Collège François-Xavier Vogt (Yaoundé) : planification des épreuves, répartition en salles, anonymat des copies par code-barres, saisie des notes à la douchette, levée d'anonymat, relevés, statistiques et éditions PDF.

Cette branche `gh-pages` contient le site prêt à servir. Elle ne contient aucune donnée d'élève : les données vivent soit dans le navigateur de chaque poste (base locale), soit dans la base Firebase du collège.

## Adresse

https://andje30.github.io/MY_WORLD/

## Activer GitHub Pages (une seule fois)

1. Sur github.com, ouvrir le dépôt ANDJE30/MY_WORLD, puis **Settings › Pages**.
2. Sous *Build and deployment*, choisir **Source : Deploy from a branch**.
3. Choisir la branche **gh-pages** et le dossier **/ (root)**, puis **Save**.
4. Attendre une à deux minutes : l'adresse ci-dessus s'affiche en haut de la page.

## Brancher la base en ligne Firebase (comptes nominatifs et partage entre postes)

1. Sur https://console.firebase.google.com, **Créer un projet** (nom proposé : `astra-luz-vogt`). Google Analytics n'est pas nécessaire.
2. **Build › Authentication › Get started**, onglet *Sign-in method* : activer **Adresse e-mail/Mot de passe**.
3. **Build › Firestore Database › Create database** : emplacement `eur3 (europe-west)` ou le plus proche, mode **production**.
4. Onglet **Rules** de Firestore : remplacer tout le contenu par celui du fichier `firestore.rules` de cette branche, puis **Publish**.
5. **Authentication › Settings › Authorized domains** : ajouter `andje30.github.io`.
6. **Paramètres du projet** (roue dentée) › *Vos applications* › icône **</>** : enregistrer une application web, puis copier le bloc `firebaseConfig`.
7. Deux possibilités :
   - coller ce bloc dans l'application, **Paramètres et sauvegarde › Base en ligne (Firebase)**, sur chaque poste ;
   - ou remplacer `null` dans `config.js` de cette branche par ce bloc : tous les postes sont alors connectés d'office.
8. Ouvrir l'application et **Créer un compte** : le premier compte créé sur une base vide devient le compte de **coordination**. Les comptes suivants attendent que la coordination leur attribue un rôle (écran *Utilisateurs et rôles*).

La configuration `firebaseConfig` n'est pas un mot de passe : elle identifie le projet. La sécurité repose sur les comptes et sur les règles `firestore.rules`.

## Offre gratuite utilisée

- GitHub Pages : site de 1 Go au plus, environ 100 Go de trafic par mois (limite souple).
- Firebase, offre Spark sans carte bancaire : Firestore 1 Gio stocké, 50 000 lectures et 20 000 écritures par jour ; authentification par e-mail.

## Mettre à jour le site

Le code source, le script de construction (`src/build.py`) et les diagrammes UML sont dans l'archive `AI721_ASTRA_LUZ_2.0_source.zip` remise avec les livrables. La construction produit `dist/web`, dont le contenu remplace celui de cette branche.
