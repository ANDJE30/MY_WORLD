/**
 * ============================================================
 * MediGest — Logique front-end
 * ============================================================
 * Ce script gère :
 *  - le chargement et l'affichage des patients (fetch vers l'API PHP)
 *  - la recherche en direct
 *  - l'ouverture/fermeture des modales (ajout, modification, suppression)
 *  - l'envoi des formulaires (POST / PUT / DELETE)
 * Aucune dépendance externe : JavaScript natif (Vanilla JS).
 */

// URL de base de l'API backend (chemin relatif au fichier index.html)
const API_URL = 'backend/api/patients.php';

// Cache local de la liste des patients actuellement affichée
let patientsCache = [];
// Id du patient en attente de suppression (utilisé par la modale de confirmation)
let patientIdToDelete = null;

// ---------------- Références aux éléments du DOM ----------------
const tbody = document.getElementById('patients-tbody');
const emptyState = document.getElementById('empty-state');
const alertBox = document.getElementById('alert-box');
const searchInput = document.getElementById('search-input');

const modalOverlay = document.getElementById('modal-overlay');
const modalTitle = document.getElementById('modal-title');
const patientForm = document.getElementById('patient-form');

const confirmOverlay = document.getElementById('confirm-overlay');
const confirmName = document.getElementById('confirm-name');

// ============================================================
// Initialisation
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    chargerPatients();

    // Recherche « en direct » avec un léger anti-rebond (debounce)
    let debounceTimer;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => chargerPatients(searchInput.value.trim()), 300);
    });

    document.getElementById('btn-add-patient').addEventListener('click', () => ouvrirModale());
    document.getElementById('modal-close').addEventListener('click', fermerModale);
    document.getElementById('btn-cancel').addEventListener('click', fermerModale);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) fermerModale();
    });

    patientForm.addEventListener('submit', soumettreFormulaire);

    document.getElementById('btn-cancel-delete').addEventListener('click', fermerConfirmation);
    document.getElementById('btn-confirm-delete').addEventListener('click', confirmerSuppression);
});

// ============================================================
// Chargement & affichage des patients
// ============================================================

/**
 * Récupère la liste des patients depuis l'API (avec recherche optionnelle)
 * puis met à jour le tableau et les statistiques.
 */
async function chargerPatients(recherche = '') {
    try {
        const url = recherche
            ? `${API_URL}?search=${encodeURIComponent(recherche)}`
            : API_URL;

        const reponse = await fetch(url);
        if (!reponse.ok) throw new Error('Erreur lors du chargement des patients.');

        patientsCache = await reponse.json();
        afficherPatients(patientsCache);
        mettreAJourStats(patientsCache);
    } catch (erreur) {
        afficherAlerte(erreur.message, 'error');
    }
}

/**
 * Construit dynamiquement les lignes du tableau à partir d'un tableau de patients.
 */
function afficherPatients(patients) {
    tbody.innerHTML = '';

    if (!patients || patients.length === 0) {
        emptyState.hidden = false;
        return;
    }
    emptyState.hidden = true;

    patients.forEach((patient) => {
        const tr = document.createElement('tr');

        tr.innerHTML = `
            <td>${echapper(patient.nom)} ${echapper(patient.prenom)}</td>
            <td>${calculerAge(patient.date_naissance)} ans</td>
            <td>${badgeGenre(patient.genre)}</td>
            <td>${echapper(patient.telephone) || '—'}</td>
            <td>${echapper(patient.email) || '—'}</td>
            <td>${echapper(patient.groupe_sanguin) || '—'}</td>
            <td class="col-actions">
                <button class="btn-icon" title="Modifier" data-action="edit" data-id="${patient.id}">✏️</button>
                <button class="btn-icon" title="Supprimer" data-action="delete" data-id="${patient.id}">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Délégation d'événements : un seul écouteur pour tous les boutons d'action
    tbody.querySelectorAll('[data-action="edit"]').forEach((btn) => {
        btn.addEventListener('click', () => ouvrirModale(trouverPatient(btn.dataset.id)));
    });
    tbody.querySelectorAll('[data-action="delete"]').forEach((btn) => {
        btn.addEventListener('click', () => ouvrirConfirmation(trouverPatient(btn.dataset.id)));
    });
}

/** Met à jour les cartes de statistiques (total, hommes, femmes). */
function mettreAJourStats(patients) {
    document.getElementById('stat-total').textContent = patients.length;
    document.getElementById('stat-hommes').textContent = patients.filter(p => p.genre === 'Homme').length;
    document.getElementById('stat-femmes').textContent = patients.filter(p => p.genre === 'Femme').length;
}

// ============================================================
// Gestion de la modale Ajouter / Modifier
// ============================================================

/**
 * Ouvre la modale de formulaire. Si un patient est fourni, la modale
 * passe en mode « modification » et pré-remplit les champs.
 */
function ouvrirModale(patient = null) {
    patientForm.reset();

    if (patient) {
        modalTitle.textContent = 'Modifier le patient';
        document.getElementById('patient-id').value = patient.id;
        document.getElementById('nom').value = patient.nom;
        document.getElementById('prenom').value = patient.prenom;
        document.getElementById('date_naissance').value = patient.date_naissance;
        document.getElementById('genre').value = patient.genre;
        document.getElementById('telephone').value = patient.telephone || '';
        document.getElementById('email').value = patient.email || '';
        document.getElementById('adresse').value = patient.adresse || '';
        document.getElementById('groupe_sanguin').value = patient.groupe_sanguin || '';
        document.getElementById('notes_medicales').value = patient.notes_medicales || '';
    } else {
        modalTitle.textContent = 'Nouveau patient';
        document.getElementById('patient-id').value = '';
    }

    modalOverlay.hidden = false;
}

function fermerModale() {
    modalOverlay.hidden = true;
}

/**
 * Envoie le formulaire vers l'API : POST pour une création,
 * PUT pour une modification (déterminé par la présence d'un id).
 */
async function soumettreFormulaire(event) {
    event.preventDefault();

    const id = document.getElementById('patient-id').value;

    const donnees = {
        nom: document.getElementById('nom').value.trim(),
        prenom: document.getElementById('prenom').value.trim(),
        date_naissance: document.getElementById('date_naissance').value,
        genre: document.getElementById('genre').value,
        telephone: document.getElementById('telephone').value.trim(),
        email: document.getElementById('email').value.trim(),
        adresse: document.getElementById('adresse').value.trim(),
        groupe_sanguin: document.getElementById('groupe_sanguin').value,
        notes_medicales: document.getElementById('notes_medicales').value.trim(),
    };

    if (id) donnees.id = id;

    try {
        const reponse = await fetch(API_URL, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(donnees),
        });

        const resultat = await reponse.json();

        if (!reponse.ok) {
            const message = resultat.errors ? resultat.errors.join(' ') : resultat.error;
            throw new Error(message || 'Une erreur est survenue.');
        }

        afficherAlerte(resultat.message, 'success');
        fermerModale();
        chargerPatients(searchInput.value.trim());
    } catch (erreur) {
        afficherAlerte(erreur.message, 'error');
    }
}

// ============================================================
// Gestion de la modale de confirmation de suppression
// ============================================================

function ouvrirConfirmation(patient) {
    patientIdToDelete = patient.id;
    confirmName.textContent = `${patient.nom} ${patient.prenom}`;
    confirmOverlay.hidden = false;
}

function fermerConfirmation() {
    confirmOverlay.hidden = true;
    patientIdToDelete = null;
}

/** Envoie la requête de suppression à l'API pour le patient sélectionné. */
async function confirmerSuppression() {
    if (!patientIdToDelete) return;

    try {
        const reponse = await fetch(`${API_URL}?id=${patientIdToDelete}`, { method: 'DELETE' });
        const resultat = await reponse.json();

        if (!reponse.ok) throw new Error(resultat.error || 'Suppression impossible.');

        afficherAlerte(resultat.message, 'success');
        chargerPatients(searchInput.value.trim());
    } catch (erreur) {
        afficherAlerte(erreur.message, 'error');
    } finally {
        fermerConfirmation();
    }
}

// ============================================================
// Fonctions utilitaires
// ============================================================

/** Retrouve un patient dans le cache local à partir de son id (chaîne ou nombre). */
function trouverPatient(id) {
    return patientsCache.find((p) => String(p.id) === String(id));
}

/** Calcule l'âge en années révolues à partir d'une date de naissance (AAAA-MM-JJ). */
function calculerAge(dateNaissance) {
    const naissance = new Date(dateNaissance);
    const aujourdHui = new Date();
    let age = aujourdHui.getFullYear() - naissance.getFullYear();
    const moisEcoule = aujourdHui.getMonth() - naissance.getMonth();
    if (moisEcoule < 0 || (moisEcoule === 0 && aujourdHui.getDate() < naissance.getDate())) {
        age--;
    }
    return age;
}

/** Retourne un badge HTML coloré selon le genre du patient. */
function badgeGenre(genre) {
    const classe = genre === 'Homme' ? 'badge-homme' : genre === 'Femme' ? 'badge-femme' : 'badge-autre';
    return `<span class="badge ${classe}">${echapper(genre)}</span>`;
}

/** Échappe les caractères HTML pour éviter toute injection dans le tableau (XSS). */
function echapper(valeur) {
    if (valeur === null || valeur === undefined) return '';
    const div = document.createElement('div');
    div.textContent = valeur;
    return div.innerHTML;
}

/** Affiche un message temporaire (succès ou erreur) en haut de la page. */
function afficherAlerte(message, type = 'success') {
    alertBox.textContent = message;
    alertBox.className = `alert alert-${type}`;
    alertBox.hidden = false;

    clearTimeout(afficherAlerte._timer);
    afficherAlerte._timer = setTimeout(() => {
        alertBox.hidden = true;
    }, 4000);
}
