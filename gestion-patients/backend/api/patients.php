<?php
/**
 * ============================================================
 * API REST - Gestion des Patients
 * ============================================================
 * Ce fichier unique gère toutes les opérations CRUD (Create,
 * Read, Update, Delete) sur la ressource "patients".
 *
 * Routes disponibles (toutes sur ce même fichier) :
 *   GET    /patients.php            -> liste tous les patients
 *   GET    /patients.php?id=1       -> détail d'un patient
 *   GET    /patients.php?search=xx  -> recherche par nom/prénom/email
 *   POST   /patients.php            -> crée un patient (JSON en body)
 *   PUT    /patients.php            -> met à jour un patient (JSON en body, avec "id")
 *   DELETE /patients.php?id=1       -> supprime un patient
 *
 * Toutes les réponses sont au format JSON.
 */

// ---- En-têtes communs ---------------------------------------
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *'); // Autorise les appels depuis le front-end
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Les navigateurs envoient une requête OPTIONS avant PUT/DELETE (pré-vérification CORS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        handleGet($pdo);
        break;
    case 'POST':
        handlePost($pdo);
        break;
    case 'PUT':
        handlePut($pdo);
        break;
    case 'DELETE':
        handleDelete($pdo);
        break;
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Méthode HTTP non autorisée.']);
}

/**
 * Récupère un patient précis, une recherche, ou la liste complète.
 */
function handleGet(PDO $pdo): void
{
    // Cas 1 : récupération d'un patient précis via son id
    if (isset($_GET['id'])) {
        $stmt = $pdo->prepare('SELECT * FROM patients WHERE id = :id');
        $stmt->execute(['id' => $_GET['id']]);
        $patient = $stmt->fetch();

        if (!$patient) {
            http_response_code(404);
            echo json_encode(['error' => 'Patient introuvable.']);
            return;
        }

        echo json_encode($patient);
        return;
    }

    // Cas 2 : recherche texte sur nom, prénom ou email
    if (!empty($_GET['search'])) {
        $terme = '%' . $_GET['search'] . '%';
        $stmt = $pdo->prepare(
            'SELECT * FROM patients
             WHERE nom LIKE :terme OR prenom LIKE :terme OR email LIKE :terme
             ORDER BY nom, prenom'
        );
        $stmt->execute(['terme' => $terme]);
        echo json_encode($stmt->fetchAll());
        return;
    }

    // Cas 3 : liste complète, triée par ordre alphabétique
    $stmt = $pdo->query('SELECT * FROM patients ORDER BY nom, prenom');
    echo json_encode($stmt->fetchAll());
}

/**
 * Crée un nouveau patient à partir du JSON envoyé dans le corps de la requête.
 */
function handlePost(PDO $pdo): void
{
    $data = json_decode(file_get_contents('php://input'), true) ?? [];

    $erreurs = validerPatient($data);
    if (!empty($erreurs)) {
        http_response_code(422); // Entité non traitable : données invalides
        echo json_encode(['errors' => $erreurs]);
        return;
    }

    $sql = 'INSERT INTO patients
                (nom, prenom, date_naissance, genre, telephone, email, adresse, groupe_sanguin, notes_medicales)
            VALUES
                (:nom, :prenom, :date_naissance, :genre, :telephone, :email, :adresse, :groupe_sanguin, :notes_medicales)';

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        'nom'             => trim($data['nom']),
        'prenom'          => trim($data['prenom']),
        'date_naissance'  => $data['date_naissance'],
        'genre'           => $data['genre'],
        'telephone'       => $data['telephone'] ?? null,
        'email'           => $data['email'] ?? null,
        'adresse'         => $data['adresse'] ?? null,
        'groupe_sanguin'  => $data['groupe_sanguin'] ?? null,
        'notes_medicales' => $data['notes_medicales'] ?? null,
    ]);

    http_response_code(201); // Créé
    echo json_encode([
        'id'      => (int) $pdo->lastInsertId(),
        'message' => 'Patient ajouté avec succès.',
    ]);
}

/**
 * Met à jour un patient existant (identifié par "id" dans le JSON envoyé).
 */
function handlePut(PDO $pdo): void
{
    $data = json_decode(file_get_contents('php://input'), true) ?? [];

    if (empty($data['id'])) {
        http_response_code(400);
        echo json_encode(['error' => "L'identifiant du patient est requis."]);
        return;
    }

    $erreurs = validerPatient($data);
    if (!empty($erreurs)) {
        http_response_code(422);
        echo json_encode(['errors' => $erreurs]);
        return;
    }

    $sql = 'UPDATE patients SET
                nom = :nom,
                prenom = :prenom,
                date_naissance = :date_naissance,
                genre = :genre,
                telephone = :telephone,
                email = :email,
                adresse = :adresse,
                groupe_sanguin = :groupe_sanguin,
                notes_medicales = :notes_medicales
            WHERE id = :id';

    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        'id'              => $data['id'],
        'nom'             => trim($data['nom']),
        'prenom'          => trim($data['prenom']),
        'date_naissance'  => $data['date_naissance'],
        'genre'           => $data['genre'],
        'telephone'       => $data['telephone'] ?? null,
        'email'           => $data['email'] ?? null,
        'adresse'         => $data['adresse'] ?? null,
        'groupe_sanguin'  => $data['groupe_sanguin'] ?? null,
        'notes_medicales' => $data['notes_medicales'] ?? null,
    ]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Patient introuvable ou aucune modification apportée.']);
        return;
    }

    echo json_encode(['message' => 'Patient mis à jour avec succès.']);
}

/**
 * Supprime un patient identifié par son id passé en paramètre GET (?id=).
 */
function handleDelete(PDO $pdo): void
{
    $id = $_GET['id'] ?? null;

    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => "L'identifiant du patient est requis."]);
        return;
    }

    $stmt = $pdo->prepare('DELETE FROM patients WHERE id = :id');
    $stmt->execute(['id' => $id]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Patient introuvable.']);
        return;
    }

    echo json_encode(['message' => 'Patient supprimé avec succès.']);
}

/**
 * Valide les champs obligatoires d'un patient et retourne
 * un tableau de messages d'erreur (vide si tout est valide).
 */
function validerPatient(array $data): array
{
    $erreurs = [];

    if (empty($data['nom'])) {
        $erreurs[] = 'Le nom est obligatoire.';
    }
    if (empty($data['prenom'])) {
        $erreurs[] = 'Le prénom est obligatoire.';
    }
    if (empty($data['date_naissance'])) {
        $erreurs[] = 'La date de naissance est obligatoire.';
    } elseif (!DateTime::createFromFormat('Y-m-d', $data['date_naissance'])) {
        $erreurs[] = 'La date de naissance est invalide (format attendu : AAAA-MM-JJ).';
    }
    if (empty($data['genre']) || !in_array($data['genre'], ['Homme', 'Femme', 'Autre'], true)) {
        $erreurs[] = 'Le genre doit être Homme, Femme ou Autre.';
    }
    if (!empty($data['email']) && !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
        $erreurs[] = "L'adresse email n'est pas valide.";
    }

    return $erreurs;
}
