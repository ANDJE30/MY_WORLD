<?php
/**
 * ============================================================
 * Configuration de la connexion à la base de données
 * ============================================================
 * Ce fichier centralise les paramètres de connexion MySQL et
 * expose un objet PDO ($pdo) réutilisable par toute l'API.
 *
 * Modifiez les constantes ci-dessous selon votre environnement
 * (identifiants XAMPP/WAMP par défaut : utilisateur "root",
 * mot de passe vide).
 */

define('DB_HOST', 'localhost');
define('DB_NAME', 'gestion_patients');
define('DB_USER', 'root');
define('DB_PASS', '');

try {
    // DSN : chaîne décrivant le pilote, l'hôte, la base et l'encodage
    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';

    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        // Lève une exception PHP en cas d'erreur SQL (plus facile à déboguer)
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        // Retourne les résultats sous forme de tableaux associatifs
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        // Utilise de vraies requêtes préparées côté serveur (sécurité)
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    // En cas d'échec de connexion, on répond en JSON avec un code HTTP 500
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'error' => 'Connexion à la base de données impossible.',
        'details' => $e->getMessage(),
    ]);
    exit;
}
