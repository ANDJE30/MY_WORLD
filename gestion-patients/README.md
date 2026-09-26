# MediGest — Application de Gestion des Patients

Application web simple permettant de gérer un registre de patients :
ajout, modification, suppression et recherche.

- **Front-end** : HTML5, CSS3, JavaScript natif (aucun framework, aucune dépendance)
- **Back-end** : PHP (PDO / MySQL), API REST en JSON
- **Base de données** : MySQL / MariaDB

## Structure du projet

```
gestion-patients/
├── index.html              # Page principale (interface utilisateur)
├── css/
│   └── style.css           # Feuille de style
├── js/
│   └── app.js               # Logique front-end (appels API, interactions)
└── backend/
    ├── config/
    │   └── database.php     # Connexion PDO à MySQL
    ├── api/
    │   └── patients.php     # API REST : GET / POST / PUT / DELETE
    └── sql/
        └── schema.sql        # Script de création de la base de données
```

## Installation

### 1. Prérequis
- PHP 7.4 ou supérieur (avec l'extension `pdo_mysql`)
- MySQL ou MariaDB
- Un serveur web (Apache/Nginx) ou simplement le serveur intégré de PHP

### 2. Créer la base de données
Importez le script SQL fourni :

```bash
mysql -u root -p < backend/sql/schema.sql
```

Ce script crée la base `gestion_patients`, la table `patients` et
insère quelques données de démonstration.

### 3. Configurer la connexion
Modifiez si nécessaire les identifiants dans `backend/config/database.php`
(par défaut : hôte `localhost`, utilisateur `root`, mot de passe vide —
identifiants classiques de XAMPP/WAMP/MAMP en local).

### 4. Lancer l'application

Avec le serveur intégré de PHP, depuis le dossier `gestion-patients/` :

```bash
php -S localhost:8000
```

Puis ouvrez votre navigateur à l'adresse : http://localhost:8000

> Avec XAMPP/WAMP, placez simplement le dossier `gestion-patients/`
> dans `htdocs/` (ou `www/`) et accédez-y via
> `http://localhost/gestion-patients/`.

## Fonctionnalités

- Tableau de bord avec statistiques (total, hommes, femmes)
- Liste des patients avec âge calculé automatiquement
- Recherche instantanée par nom, prénom ou email
- Ajout et modification via une fenêtre modale avec validation
- Suppression avec confirmation
- Messages de succès/erreur
- Interface responsive (adaptée mobile/tablette)

## API

| Méthode | URL                                | Description                     |
|---------|-------------------------------------|----------------------------------|
| GET     | `backend/api/patients.php`          | Liste tous les patients          |
| GET     | `backend/api/patients.php?id=1`     | Détail d'un patient               |
| GET     | `backend/api/patients.php?search=x` | Recherche par nom/prénom/email   |
| POST    | `backend/api/patients.php`          | Crée un patient (JSON)           |
| PUT     | `backend/api/patients.php`          | Met à jour un patient (JSON)     |
| DELETE  | `backend/api/patients.php?id=1`     | Supprime un patient               |

## Pistes d'amélioration

- Authentification (connexion des utilisateurs/praticiens)
- Pagination du tableau pour de grands volumes de données
- Gestion de rendez-vous et d'historique médical détaillé
- Export des dossiers patients (PDF/CSV)
