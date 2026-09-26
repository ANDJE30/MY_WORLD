-- ============================================================
-- Schéma de la base de données : Gestion des Patients
-- ============================================================
-- Ce script crée la base de données et la table nécessaires
-- au fonctionnement de l'application.
-- À importer via phpMyAdmin ou : mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS gestion_patients
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE gestion_patients;

-- Table principale contenant les dossiers des patients
CREATE TABLE IF NOT EXISTS patients (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    nom                VARCHAR(100)  NOT NULL,
    prenom             VARCHAR(100)  NOT NULL,
    date_naissance     DATE          NOT NULL,
    genre              ENUM('Homme', 'Femme', 'Autre') NOT NULL,
    telephone          VARCHAR(20)   DEFAULT NULL,
    email              VARCHAR(150)  DEFAULT NULL,
    adresse            VARCHAR(255)  DEFAULT NULL,
    groupe_sanguin     VARCHAR(5)    DEFAULT NULL,
    notes_medicales    TEXT          DEFAULT NULL,
    date_creation      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    date_modification  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Index pour accélérer les recherches par nom/prénom
    INDEX idx_nom_prenom (nom, prenom)
) ENGINE=InnoDB;

-- Quelques données de démonstration (facultatif)
INSERT INTO patients (nom, prenom, date_naissance, genre, telephone, email, adresse, groupe_sanguin, notes_medicales)
VALUES
    ('Dupont', 'Marie', '1990-04-12', 'Femme', '0601020304', 'marie.dupont@email.com', '12 rue des Lilas, Paris', 'A+', 'Allergie à la pénicilline.'),
    ('Kouassi', 'Jean', '1985-11-23', 'Homme', '0611223344', 'jean.kouassi@email.com', '5 avenue de la Paix, Lyon', 'O-', 'Suivi tensionnel régulier.'),
    ('Traoré', 'Aminata', '2002-07-08', 'Femme', '0699887766', 'aminata.traore@email.com', '8 boulevard du Marché, Abidjan', 'B+', 'Aucun antécédent notable.');
