"""Cahier des charges — SVTC Répétitions (papier en-tête SVTC). Usage : python3 cahier.py"""
import datetime
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from docgen import DOCS, Doc  # noqa: E402

URL = os.environ.get('SVTC_URL', 'https://svtc-repetitions.vercel.app')
UML = os.path.join(DOCS, 'uml')
CAP = os.path.join(DOCS, 'captures')
u = lambda f: os.path.join(UML, f)
c = lambda f: os.path.join(CAP, f)
today = datetime.date.today().strftime('%d/%m/%Y')

D = Doc('Cahier des charges — SVTC Répétitions', 'Cahier des charges')
D.cover(
    'Cahier des charges fonctionnel et technique',
    'SVTC Répétitions',
    "Application web responsive de gestion de l'activité de soutien scolaire (répétitions) en informatique",
    [
        ('Maître d’ouvrage', 'SILICON VALLEY TRAINING CENTER (SVTC) — Centre Éducatif TYRANNUS, Biyem-Assi Lac, Yaoundé (Cameroun)'),
        ('Projet', 'SVTC Répétitions : planning, séances, présences, notes, suivi des élèves, paiements, caisse, location des salles, salaires et communication avec les parents'),
        ('Document', 'Cahier des charges : besoins, spécifications fonctionnelles et techniques, conception UML, sécurité, hébergement, recette'),
        ('Version', '1.0 — application réalisée, testée et déployée'),
        ('Date', today),
        ('Adresse de l’application', URL),
        ('Rédaction', 'Équipe de développement full stack'),
        ('Contacts SVTC', '657 513 641 · 695 840 597 · 697 760 779'),
    ],
    motto="« C'est votre **ATTITUDE**, non pas seulement votre aptitude, qui détermine votre **ALTITUDE**. »",
    image=os.path.join(DOCS, 'couverture.png'),
)
D.toc()

# ------------------------------------------------------------------ 1
D.h1('1. Présentation du projet')
D.h2('1.1 Contexte')
D.p("La **Silicon Valley Training Center (SVTC)** organise des **cours de répétitions et de préparation aux examens officiels** "
    "(BEPC, Probatoire, Baccalauréat) en informatique pour les élèves de l'enseignement secondaire, **de la sixième à la terminale**, "
    "y compris les séries techniques **Première TI (PTI)** et **Terminale TI (TTI)**. Les cours se déroulent au **Centre Éducatif TYRANNUS**, "
    "sis à **Yaoundé, Biyem-Assi Lac**, dans des salles louées à l'heure.")
D.p("L'activité est rythmée par **deux séances hebdomadaires** : le **mercredi de 15h30 à 18h00** et le **dimanche de 10h00 à 14h00**. "
    "Des encadreurs spécialisés interviennent dans six domaines : **Informatique**, **Algorithmique et programmation**, **Programmation**, "
    "**Système d'information**, **Maintenance – Réseau – Création numérique** et **Réseau – Internet – Sécurité informatique**.")
D.p("La gestion repose aujourd'hui sur des cahiers, des listes papier et des messages téléphoniques : planning difficile à diffuser, "
    "heures des encadreurs mal tracées, calcul manuel des salaires et de la location des salles, suivi incomplet des paiements et "
    "parents peu informés de l'assiduité et des résultats de leur enfant.")
D.h2('1.2 Problématique')
D.bullets([
    "Comment produire un **planning de travail sans conflit** (classe, encadreur, salle) et le diffuser à tous ?",
    "Comment **tracer de façon fiable** les heures réellement effectuées par chaque encadreur, base de leur rémunération ?",
    "Comment calculer **sans erreur** les salaires au **pourcentage des heures faites**, la **location des salles** (500 FCFA/h le mercredi, 1000 FCFA/h le dimanche) et l'**état de la caisse** ?",
    "Comment informer rapidement les **parents** (rappels de paiement, absences, réunions) et leur donner accès au **suivi** de leur enfant ?",
    "Comment rendre tout cela utilisable **sur ordinateur, tablette et smartphone**, simplement, et **sécurisé** pour des données de mineurs ?",
])
D.h2('1.3 Objectifs')
D.table(['Objectif', 'Indicateur de réussite'], [
    ['Centraliser la gestion du centre dans une application unique', 'Élèves, parents, encadreurs, planning, finances et communication dans un seul outil en ligne'],
    ['Planifier automatiquement', 'Planning hebdomadaire généré en un clic, sans aucun conflit, exportable en PDF par classe et général'],
    ['Tracer les séances', 'Heure de début et de fin enregistrées par l’encadreur, appel des élèves, validation par l’administration'],
    ['Calculer la paie et la location sans erreur', 'États PDF des salaires (prorata des heures) et de location des salles générés automatiquement'],
    ['Maîtriser la trésorerie', 'Reçus numérotés avec QR code, impayés, dépenses et état de caisse PDF à jour en temps réel'],
    ['Associer les parents', 'Espace parent : planning, détail des séances, messages, état de suivi PDF, paiements ; SMS et WhatsApp'],
    ['Être disponible partout', 'Interface responsive, installable comme une application (PWA) sur smartphone'],
    ['Garantir la sécurité', 'Accès cloisonnés par rôle, mots de passe chiffrés, verrouillage, journal d’audit, en-têtes de sécurité'],
], widths=[6.2, 10.4], caption='Objectifs du projet')
D.h2('1.4 Périmètre')
D.p("Le périmètre couvre l'ensemble de l'activité de répétition de la SVTC pour une ou plusieurs années scolaires : paramétrage de la structure, "
    "gestion des personnes, pédagogie (planning, séances, présences, évaluations, documents), finances (paiements des élèves, dépenses, caisse, "
    "location des salles, salaires), communication (messages internes, SMS, WhatsApp), sécurité et administration technique (comptes, audit, sauvegardes).")
D.figure(os.path.join(DOCS, 'couverture.png'), "Les trois espaces de l'application sur ordinateur et smartphone", max_h=9)

# ------------------------------------------------------------------ 2
D.h1('2. Acteurs et profils')
D.p("L'application distingue **trois profils**, chacun avec **sa propre interface** (adresse, page de connexion, couleurs, navigation) adaptée à son usage. "
    "Le contrôle des droits est appliqué **côté serveur** sur chaque page, action, document PDF et fichier : un compte ne peut ouvrir que l'espace de son profil.")
D.table(['Profil', 'Interface', 'Responsabilités', 'Données accessibles'], [
    ['**Administrateur**', '/admin — console bleu nuit et or, menu latéral, recherche Ctrl + K', 'Paramétrage, personnes, planning, validation des heures, finances, communication, sécurité', 'Tout le centre'],
    ['**Encadreur**', '/encadreur — espace de travail bleu roi, barre d’onglets sur mobile', 'Séances (début, fin, appel), fiches de TD, évaluations et notes, suivi des élèves', 'Uniquement ses classes, ses séances, ses documents'],
    ['**Parent**', '/parent — application familiale claire et dorée', 'Consultation du planning, des séances, des messages, du suivi et des paiements', 'Uniquement ses enfants'],
], widths=[2.6, 4.6, 5.4, 4.0], caption='Profils utilisateurs')
D.table(['Élément', 'Administration', 'Encadreur', 'Parent'], [
    ['Connexion', '/admin/connexion', '/encadreur/connexion', '/parent/connexion'],
    ['Identifiant', 'Choisi à l’installation (ex. admin)', 'prénom.nom (ex. paul.ndjock)', 'Numéro de téléphone (ex. 657513641)'],
    ['Mot de passe', 'Personnel', 'Généré, facile à retenir (ex. Baobab@4827), modifiable', 'Généré, facile à retenir, modifiable'],
    ['Durée de session', '12 h (4 h d’inactivité)', '7 jours', '30 jours'],
], widths=[3.0, 4.5, 4.6, 4.5], caption='Trois interfaces de connexion distinctes')
D.figure(u('01_cas_utilisation_admin.png'), "Diagramme des cas d'utilisation — Administrateur", max_h=17)
D.figure(u('02_cas_utilisation_encadreur_parent.png'), "Diagramme des cas d'utilisation — Encadreur et Parent", max_h=17)

# ------------------------------------------------------------------ 3
D.h1('3. Exigences fonctionnelles')
D.p("Chaque exigence est identifiée (EF-xx) et priorisée selon la méthode MoSCoW : **M** = indispensable, **S** = important, **C** = souhaitable. "
    "Toutes les exigences listées sont **réalisées** dans la version livrée. Les exigences marquées « + » ont été ajoutées par l'équipe pour l'autonomie et la qualité.")
EF = [
    ('3.1 Administrateur — structure et paramètres', [
        ('EF-01', 'Authentification', "Connexion par une interface dédiée ; première installation par assistant si aucun administrateur n'existe.", 'M'),
        ('EF-02', 'Paramètres de la structure', "Nom, sigle, accroche, devise, slogan, présentation, lieu, adresse, ville, 3 téléphones, WhatsApp, e-mail, site, signataire des documents.", 'M'),
        ('EF-03', 'Logo et bandeau', "Chargement du logo (PNG/JPEG/WebP ≤ 1 Mo) et du bandeau d'en-tête des PDF ; retour à l'image d'origine SVTC.", 'M'),
        ('EF-04', 'Jours et horaires des séances', "Mercredi 15h30–18h00 et dimanche 10h00–14h00 par défaut, modifiables ; découpage en créneaux ; autres jours activables.", 'M'),
        ('EF-05', 'Classes', "Liste par défaut (6e à Tle, PTI, TTI), ajout de classes, code, cycle, frais d'inscription, mensualité, effectif maximal, couleur, activation.", 'M'),
        ('EF-06', 'Matières', "Les 6 domaines de formation, ajout, couleur, description, activation.", 'M'),
        ('EF-07', 'Salles et tarifs', "Salles A et B (mercredi 500 FCFA/h, dimanche 1000 FCFA/h), ajout de salles, tarif par jour de séance, capacité.", 'M'),
        ('EF-08', 'Années scolaires +', "Création d'une nouvelle année, bascule de l'année active ; historique conservé.", 'S'),
        ('EF-09', 'Facturation, salaires, SMS, sécurité +', "Préfixe des reçus, mois facturables, base de calcul de la location et des heures, mode de salaire, signature SMS, changement de mot de passe obligatoire.", 'S'),
    ]),
    ('3.2 Administrateur — personnes', [
        ('EF-10', 'Élèves', "Inscription (nom, prénoms, sexe, naissance, classe, établissement fréquenté, réduction, statut), matricule automatique, fiche détaillée (finances, assiduité, notes).", 'M'),
        ('EF-11', 'Parents', "Fiche parent (téléphone = identifiant), création automatique à l'inscription, fratries (un numéro = un parent), appel et WhatsApp en un clic.", 'M'),
        ('EF-12', 'Import des listes +', "Import CSV ou copier-coller depuis Excel des élèves et de leurs parents, modèle téléchargeable, rapport des lignes rejetées.", 'S'),
        ('EF-13', 'Encadreurs', "Fiche (contact, spécialité, diplôme, salaire de référence, taux horaire, couleur), activation, suppression ou désactivation si séances effectuées.", 'M'),
        ('EF-14', 'Comptes des encadreurs et parents', "Génération d'identifiants faciles à retenir, réinitialisation, ajout et suppression, génération groupée, fiches d'accès PDF avec QR code, envoi WhatsApp/SMS.", 'M'),
        ('EF-15', 'Attribution des classes', "Pour chaque classe et chaque matière : encadreur et nombre de créneaux hebdomadaires.", 'M'),
        ('EF-16', 'Comptes utilisateurs +', "Liste de tous les comptes, sessions ouvertes, verrouillages, désactivation, ajout d'administrateurs.", 'S'),
    ]),
    ('3.3 Administrateur — pédagogie', [
        ('EF-20', 'Planning automatique', "Génération du planning hebdomadaire à partir des attributions, sans conflit de classe, d'encadreur ni de salle ; liste des demandes non placées.", 'M'),
        ('EF-21', 'Planning manuel', "Ajout, modification et suppression de créneaux, refus de tout chevauchement, grille par jour et par salle, vue par classe.", 'M'),
        ('EF-22', 'Planning PDF', "Planning général (toutes classes) et planning de travail par classe (hebdomadaire + séances des 5 semaines suivantes), planning daté du mois.", 'M'),
        ('EF-23', 'Séances datées', "Génération des séances réelles sur une période ; séance ponctuelle (rattrapage) ; annulation d'une séance ou d'une journée (jour férié) ; mise à jour des séances futures.", 'M'),
        ('EF-24', 'Suivi et validation des heures', "Liste filtrable (période, classe, encadreur, statut), séances non pointées, correction des heures, validation unitaire ou groupée.", 'M'),
        ('EF-25', 'Documents pédagogiques', "Consultation en ligne des fiches de TD (PDF) déposées par les encadreurs, approbation, renvoi avec commentaire, partage aux parents.", 'M'),
        ('EF-26', 'Présences +', "Taux de présence par classe et par élève sur une période, état de présence PDF, prévenir le parent par WhatsApp.", 'S'),
        ('EF-27', 'Notes et classement +', "Moyennes par matière et générale, classement de la classe, envoi groupé des états de suivi aux parents.", 'S'),
    ]),
    ('3.4 Administrateur — finances', [
        ('EF-30', 'Paiements des élèves', "Encaissement (espèces, MTN Mobile Money, Orange Money, virement), référence obligatoire pour le Mobile Money, numéro de reçu séquentiel, reçu PDF avec montant en lettres et QR code, annulation motivée et tracée.", 'M'),
        ('EF-31', 'Situation des élèves', "Montant dû à ce jour (inscription + mensualités échues depuis l'inscription), payé, solde, mois réglés, avance.", 'M'),
        ('EF-32', 'Impayés et relances +', "Liste des élèves en retard, total des impayés, relance personnalisée de tous les parents concernés (application, SMS, WhatsApp), liste PDF.", 'S'),
        ('EF-33', 'Dépenses +', "Saisie des sorties de caisse par catégorie ; les salaires et la location réglés y sont inscrits automatiquement.", 'S'),
        ('EF-34', 'État de caisse PDF', "Journal chronologique des recettes et dépenses avec soldes d'ouverture et de clôture, répartition par mode et par catégorie.", 'M'),
        ('EF-35', 'État de location des salles PDF', "Heures d'occupation par salle et par jour, tarif du mercredi et du dimanche, montant par salle et total, règlement enregistré en dépense.", 'M'),
        ('EF-36', 'État des salaires PDF', "Par encadreur : heures prévues, heures effectuées, pourcentage, montant dû, primes, retenues, net à payer, émargement ; paiement unitaire ou groupé.", 'M'),
    ]),
    ('3.5 Administrateur — communication, pilotage et sécurité', [
        ('EF-40', 'Messages aux parents', "Envoi à tous les parents, par classe, à des parents choisis, aux parents en retard de paiement ou aux encadreurs ; modèles (rappel de paiement, réunion, absence, examens) ; variables {parent}, {eleve}, {classe}, {solde}.", 'M'),
        ('EF-41', 'SMS et WhatsApp', "SMS par passerelle (Orange SMS API, Twilio, Africa's Talking) ; sans passerelle, liens WhatsApp personnalisés en un clic et SMS groupé depuis le téléphone (gratuit) ; suivi des envois et des lectures.", 'M'),
        ('EF-42', 'Tableau de bord +', "Indicateurs (élèves, encadreurs, séances de la semaine, présence, encaissements, impayés, solde de caisse, documents), graphiques, alertes, prochaine journée de séances.", 'S'),
        ('EF-43', 'Recherche rapide +', "Palette de commandes Ctrl + K pour atteindre n'importe quelle page au clavier.", 'C'),
        ('EF-44', 'Journal d’audit +', "Traçabilité des connexions, paiements, annulations, comptes, planning, documents, exports (utilisateur, date, adresse IP).", 'S'),
        ('EF-45', 'Sauvegarde et exports +', "Sauvegarde complète JSON et exports CSV (Excel) des élèves, paiements, dépenses, séances, présences, notes, encadreurs, salaires.", 'S'),
        ('EF-46', 'Vérification des documents +', "Page publique /verifier/CODE : authenticité des reçus et états de suivi via le QR code imprimé.", 'S'),
    ]),
    ('3.6 Encadreur', [
        ('EF-50', 'Authentification', "Connexion avec les identifiants remis par l'administration ; changement du mot de passe.", 'M'),
        ('EF-51', 'Séances du jour', "Bouton « Démarrer la séance » (heure de début réelle) et « Terminer » (heure de fin réelle), chronomètre en direct.", 'M'),
        ('EF-52', 'Saisie des heures', "En cas d'oubli : saisie manuelle de l'heure de début et de fin dans les 7 jours, tant que la séance n'est pas validée.", 'M'),
        ('EF-53', 'Appel des élèves', "Présent / En retard / Absent / Justifié, motif, « Tous présents », compteurs ; obligatoire avant de terminer la séance.", 'M'),
        ('EF-54', 'Fiche de TD', "Dépôt d'un PDF (≤ 4 Mo, contrôle de la signature du fichier) rattaché à une séance ou à une classe et une matière ; suivi de l'avis de l'administration.", 'M'),
        ('EF-55', 'Contenu de séance +', "Leçon traitée, résumé, travail à faire (visible par les parents).", 'S'),
        ('EF-56', 'Évaluations et notes', "Création d'une évaluation (type, barème, coefficient), saisie rapide des notes (virgule acceptée, « abs »), moyenne de la classe.", 'M'),
        ('EF-57', 'Évolution d’un élève', "Graphique d'évolution des notes, moyennes par matière, assiduité, état de suivi PDF.", 'M'),
        ('EF-58', 'Envoi du suivi au parent', "Envoi de l'état de suivi (assiduité et performances) dans l'espace parent, et par SMS si une passerelle est configurée.", 'M'),
        ('EF-59', 'Mes heures +', "Heures prévues et effectuées du mois, pourcentage, estimation ou montant du salaire payé.", 'S'),
    ]),
    ('3.7 Parent', [
        ('EF-60', 'Authentification', "Connexion avec le numéro de téléphone et le mot de passe remis par le centre.", 'M'),
        ('EF-61', 'Planning', "Planning hebdomadaire de la classe de l'enfant, séances récentes et à venir, planning PDF.", 'M'),
        ('EF-62', 'Détail d’une séance', "Matière, encadreur, date, horaire prévu, heures de début et de fin effectives, salle, présence de l'enfant, leçon, travail à faire, fiche de TD partagée.", 'M'),
        ('EF-63', 'Messages', "Boîte de réception (informations, rappels, absences, états de suivi), marquage lu.", 'M'),
        ('EF-64', 'État de suivi PDF', "Assiduité, moyenne générale et par matière, détail des évaluations, absences et retards, appréciation, QR code d'authenticité.", 'M'),
        ('EF-65', 'Paiements +', "Total payé, reste à payer, mois réglés, historique et reçus PDF.", 'S'),
        ('EF-66', 'Plusieurs enfants +', "Sélecteur d'enfant pour les fratries.", 'S'),
    ]),
]
for title, rows in EF:
    D.h2(title)
    D.table(['Réf.', 'Exigence', 'Description', 'Prio.'], [[a, f'**{b}**', cc, d] for a, b, cc, d in rows], widths=[1.3, 3.4, 10.8, 1.1], font=8.4)

# ------------------------------------------------------------------ 4
D.h1('4. Règles de gestion')
D.table(['Réf.', 'Règle'], [
    ['RG-01', "**Heures prévues** d'un encadreur pour un mois = somme des durées prévues de ses séances non annulées."],
    ['RG-02', "**Heures effectuées** = durée réelle (fin réelle − début réel) de chaque séance terminée, **plafonnée à la durée prévue** (paramétrable : durée réelle sans plafond ou durée prévue)."],
    ['RG-03', "**Salaire au prorata** : montant dû = salaire mensuel de référence × (heures effectuées ÷ heures prévues), pourcentage plafonné à 100 % (paramétrable). Mode alternatif : taux horaire × heures effectuées. Net = montant dû + prime − retenue."],
    ['RG-04', "**Location des salles** : pour chaque salle et chaque date, heures × tarif du jour (mercredi 500 FCFA/h, dimanche 1000 FCFA/h pour les salles A et B). Base de calcul paramétrable : durée prévue des séances tenues (défaut), durée réelle, ou plage complète de la journée de séance. Les séances annulées ne sont pas facturées."],
    ['RG-05', "**Montant dû par un élève à ce jour** = frais d'inscription + mensualité nette × nombre de mois facturables écoulés depuis le mois d'inscription (inclus). Mensualité nette = mensualité de la classe × (1 − réduction)."],
    ['RG-06', "Les paiements sont **affectés** d'abord à l'inscription, puis aux mois dans l'ordre chronologique ; un mois est « payé », « partiel » ou « impayé »."],
    ['RG-07', "Numéro de reçu **séquentiel et unique** : SVTC-R2627-00001 ; un reçu n'est jamais supprimé, il est **annulé avec motif** et reste tracé."],
    ['RG-08', "Paiement Mobile Money (MTN, Orange) : la **référence de transaction est obligatoire**."],
    ['RG-09', "Matricule élève automatique : SVTC-26-0001 (préfixe, année, numéro)."],
    ['RG-10', "Un encadreur ne peut démarrer qu'une séance **du jour** ; il ne peut **terminer** une séance qu'après avoir fait l'appel."],
    ['RG-11', "L'encadreur peut corriger heures, appel et contenu pendant **7 jours** ; une séance **validée** par l'administration est verrouillée."],
    ['RG-12', "Le planning refuse tout chevauchement d'une même **classe**, d'un même **encadreur** ou d'une même **salle** sur un même jour."],
    ['RG-13', "Taux d'assiduité = (présences + retards) ÷ (présences + retards + absences) ; les absences justifiées ne sont pas comptées."],
    ['RG-14', "Moyenne : chaque note est ramenée sur 20, pondérée par le coefficient ; un élève absent à une évaluation n'est pas pénalisé."],
    ['RG-15', "Identifiant d'un parent = son numéro de téléphone (9 chiffres) ; un même numéro rattache les frères et sœurs au même parent."],
    ['RG-16', "Mot de passe généré : mot simple + symbole + 4 chiffres (ex. Baobab@4827). Il n'est affiché qu'**une seule fois** ; seule son empreinte chiffrée est conservée."],
    ['RG-17', "5 échecs de connexion consécutifs verrouillent le compte **15 minutes** ; au-delà de 10 tentatives par identifiant ou 30 par adresse IP en 15 minutes, les connexions sont suspendues."],
    ['RG-18', "Un encadreur qui a déjà assuré des séances n'est pas supprimé mais **désactivé** (sa paie reste calculable) ; une classe contenant des élèves est désactivée et non supprimée."],
], widths=[1.4, 15.2], caption='Règles de gestion', font=8.6)
D.figure(u('09_activite_salaires.png'), "Diagramme d'activité — calcul des salaires au pourcentage des heures faites", max_h=14)
D.figure(u('10_etats_seance.png'), "Diagramme d'états — cycle de vie d'une séance", max_h=11)

# ------------------------------------------------------------------ 5
D.h1('5. Conception UML')
D.p("La conception suit la notation UML 2. Les diagrammes ci-dessous décrivent la structure (classes, données), la dynamique (séquences, activités) "
    "et l'architecture (composants, déploiement) de l'application. Leurs sources Mermaid sont livrées dans le dossier docs/uml du projet.")
D.h2('5.1 Diagramme de classes')
D.p("Le modèle s'organise autour de la **séance**, issue d'un **créneau** du planning hebdomadaire, qui relie une classe, une matière, un encadreur et une salle. "
    "Les présences et les évaluations rattachent l'élève à la pédagogie ; les paiements, dépenses et bulletins de salaire constituent la partie financière.")
D.figure(u('03_classes.png'), 'Diagramme de classes du domaine', max_h=15)
D.h2('5.2 Modèle de données')
D.figure(u('04a_mcd_pedagogie.png'), 'Modèle de données — pédagogie (PostgreSQL)', max_h=15)
D.figure(u('04b_mcd_finances.png'), 'Modèle de données — comptes, finances et communication', max_h=12)
D.table(['Table', 'Rôle'], [
    ['settings, academic_years', 'Paramètres de la structure (JSON validé), années scolaires'],
    ['users, auth_sessions, rate_limits', 'Comptes, sessions (empreintes des jetons), limitation de débit'],
    ['classes, subjects, rooms', 'Référentiels : classes et frais, matières, salles et tarifs par jour'],
    ['tutors, parents, students', 'Encadreurs, parents (téléphone unique), élèves (matricule unique)'],
    ['assignments, timeslots', 'Attributions classe × matière × encadreur, créneaux du planning hebdomadaire'],
    ['seances, attendances', 'Séances datées (prévu / réel / statut / validation), appel des élèves'],
    ['evaluations, grades', 'Évaluations (barème, coefficient) et notes'],
    ['documents, files', 'Fiches de TD et documents (métadonnées), fichiers binaires (PDF, images)'],
    ['payments, expenses, salary_slips, rent_settlements', 'Paiements, dépenses, bulletins de salaire, règlements de location'],
    ['messages, message_recipients', 'Messages, destinataires personnalisés, statut SMS, lecture'],
    ['audit_logs, verifications', 'Journal d’audit, codes de vérification des documents (QR)'],
], widths=[6.0, 10.6], caption='Tables de la base de données (27 tables)')
D.h2('5.3 Diagrammes de séquence')
D.figure(u('05_sequence_connexion.png'), 'Séquence — connexion sécurisée', max_h=13)
D.figure(u('06_sequence_seance.png'), "Séquence — déroulement d'une séance, de l'appel à la paie et au suivi parent", max_h=13)
D.figure(u('07_sequence_paiement.png'), "Séquence — encaissement, reçu vérifiable et relance", max_h=11)
D.h2('5.4 Diagramme d’activité — génération du planning')
D.p("L'algorithme place chaque demande (classe, matière, encadreur, nombre de créneaux) sur un créneau où la classe, l'encadreur et une salle sont libres. "
    "Un score privilégie la répartition des matières d'une classe sur les deux jours, le regroupement des interventions d'un encadreur et la stabilité de la salle. "
    "Si l'ordre naturel ne permet pas de tout placer, jusqu'à 400 ordres alternatifs sont essayés et le meilleur résultat est retenu.")
D.figure(u('08_activite_planning.png'), "Diagramme d'activité — génération automatique du planning", max_h=17)
D.h2('5.5 Composants et déploiement')
D.figure(u('12_composants.png'), 'Diagramme de composants', max_h=14)
D.figure(u('11_deploiement.png'), 'Diagramme de déploiement', max_h=8)

# ------------------------------------------------------------------ 6
D.h1('6. Exigences non fonctionnelles')
D.table(['Domaine', 'Exigence', 'Réponse apportée'], [
    ['Ergonomie', 'Prise en main sans formation longue', 'Interfaces distinctes par profil, langage simple, actions principales en un clic, tableau de bord avec alertes, recherche Ctrl + K'],
    ['Responsive', 'Ordinateur, tablette, smartphone', 'Mise en page fluide (360 px à 4K), menu latéral repliable, barre d’onglets mobile, boutons tactiles de 40 px, champs adaptés (clavier numérique pour les notes et téléphones)'],
    ['Application mobile', 'Accès rapide depuis le téléphone', 'PWA installable (icône SVTC sur l’écran d’accueil, plein écran)'],
    ['Performance', 'Pages rapides même en 3G', 'Rendu serveur, graphiques SVG sans bibliothèque, ressources statiques en cache CDN, requêtes SQL indexées'],
    ['Disponibilité', '24 h/24, sans mise en veille', 'Hébergement serverless Vercel, base Neon managée'],
    ['Fiabilité', 'Données cohérentes', 'Contraintes d’unicité et clés étrangères, transactions, numérotation protégée contre les doublons, tests automatisés'],
    ['Sécurité', 'Protection des données de mineurs', 'Voir chapitre 7'],
    ['Confidentialité', 'Loi n° 2024/017 du 23 décembre 2024 (protection des données personnelles au Cameroun)', 'Minimisation des données, accès cloisonnés, mots de passe jamais conservés en clair, journal d’audit, export et suppression possibles'],
    ['Langue et formats', 'Contexte camerounais', 'Interface en français, FCFA, numéros +237, fuseau Africa/Douala, Mobile Money MTN et Orange'],
    ['Maintenabilité', 'Évolution facile', 'TypeScript strict, architecture en couches, migrations SQL versionnées, code commenté, tests'],
    ['Accessibilité', 'Lisibilité', 'Contrastes élevés, libellés de formulaires, navigation au clavier, attributs ARIA'],
], widths=[2.8, 4.6, 9.2], caption='Exigences non fonctionnelles', font=8.4)

# ------------------------------------------------------------------ 7
D.h1('7. Sécurité')
D.table(['Menace', 'Mesure mise en œuvre'], [
    ['Vol de mots de passe', 'Hachage **scrypt** avec sel aléatoire (N = 16384) ; comparaison en temps constant ; politique de complexité ; aucun mot de passe stocké en clair (affiché une seule fois à la génération)'],
    ['Attaque par force brute', '**Verrouillage** 15 min après 5 échecs, **limitation de débit** par IP et par identifiant, temps de réponse identique si l’identifiant n’existe pas'],
    ['Vol de session', 'Jeton aléatoire de 256 bits ; seule son empreinte SHA-256 est en base ; cookie **__Host-**, HttpOnly, Secure, SameSite=Lax ; expiration absolue et d’inactivité ; révocation à la déconnexion, au changement de mot de passe et à la désactivation'],
    ['Accès non autorisé', '**Contrôle d’accès côté serveur** sur chaque page, action, PDF et fichier : rôle + rattachement (encadreur ↔ ses classes, parent ↔ ses enfants) ; cloisonnement des trois espaces'],
    ['Falsification de requête (CSRF)', 'Actions serveur protégées par contrôle d’origine ; cookie SameSite ; contrôle d’origine sur l’API des fiches d’accès'],
    ['Injection de script (XSS)', 'Rendu React échappé ; **CSP stricte avec nonce unique** par requête et strict-dynamic ; images servies isolées'],
    ['Injection SQL', 'Requêtes paramétrées (Drizzle ORM), validation **Zod** de toutes les entrées'],
    ['Fichiers malveillants', 'Vérification de la **signature binaire** (vrai PDF %PDF-, vraies images PNG/JPEG/WebP), taille limitée, noms nettoyés, pas de SVG, téléchargement avec contrôle d’accès'],
    ['Détournement de cadre, sniffing', 'HSTS (2 ans), X-Frame-Options SAMEORIGIN, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, suppression de X-Powered-By'],
    ['Injection dans Excel', 'Neutralisation des formules dans les exports CSV'],
    ['Contrefaçon de reçus', '**QR code et code d’authenticité** vérifiables en ligne ; reçus annulés signalés comme tels'],
    ['Répudiation', '**Journal d’audit** : utilisateur, action, élément, détails, adresse IP, date'],
    ['Perte de données', 'Sauvegardes Neon (restauration à un instant donné) + export JSON/CSV à la demande'],
], widths=[4.0, 12.6], caption='Mesures de sécurité', font=8.5)

# ------------------------------------------------------------------ 8
D.h1('8. Architecture technique et hébergement')
D.h2('8.1 Choix technologiques')
D.table(['Couche', 'Technologie', 'Justification'], [
    ['Interface', 'Next.js 16 (App Router), React 19, Tailwind CSS 4, Poppins', 'Standard mondial, rendu serveur rapide, composants modernes, police de l’identité SVTC'],
    ['Logique serveur', 'Server Actions, routes API Next.js (Node.js 22), TypeScript', 'Un seul langage typé de bout en bout, sécurité intégrée (contrôle d’origine)'],
    ['Base de données', 'PostgreSQL (Neon), Drizzle ORM, migrations SQL', 'Base relationnelle robuste, transactions, contraintes d’intégrité'],
    ['Documents', '@react-pdf/renderer, QR codes', 'PDF vectoriels au gabarit du papier en-tête SVTC, générés côté serveur'],
    ['Messagerie', 'Orange SMS API, Twilio, Africa’s Talking, liens WhatsApp', 'Couverture du Cameroun, solution gratuite par WhatsApp'],
    ['Qualité', 'Tests node:test (calculs) et Playwright (parcours complets)', 'Non-régression des calculs financiers et des parcours utilisateurs'],
], widths=[2.8, 6.4, 7.4], caption='Pile technique', font=8.5)
D.h2('8.2 Choix de l’hébergeur gratuit')
D.table(['Solution', 'Points forts', 'Limites', 'Verdict'], [
    ['**Vercel (Hobby) + Neon (Free)**', 'Optimisé pour Next.js, aucune mise en veille, HTTPS et CDN mondiaux, déploiement à chaque git push ; PostgreSQL managé, sauvegardes, 0,5 Go', 'Offre Hobby à usage non commercial (passage à Pro si nécessaire)', '**Retenu**'],
    ['Render (Free) + Neon', 'Simple, Node.js classique', 'Mise en veille après 15 min (30 à 60 s de réveil), disque éphémère', 'Alternative'],
    ['Netlify + Neon', 'Usage commercial autorisé', 'Adaptateur Next.js tiers, fonctions plus limitées', 'Alternative'],
    ['Oracle Cloud Always Free', 'VM gratuite permanente, disque persistant', 'Administration système à la charge du centre', 'Pour l’autonomie totale'],
], widths=[3.6, 6.0, 4.8, 2.2], caption='Comparatif des hébergeurs gratuits', font=8.4)
D.p(f"L'application est publiée à l'adresse **{URL}**. Les migrations de la base s'exécutent automatiquement à chaque déploiement ; "
    "le compte administrateur initial est créé au premier démarrage à partir de la variable ADMIN_PASSWORD.")
D.h2('8.3 Variables d’environnement')
D.table(['Variable', 'Rôle'], [
    ['DATABASE_URL', 'Connexion PostgreSQL (renseignée automatiquement par l’intégration Neon)'],
    ['ADMIN_PASSWORD', 'Mot de passe initial du compte « admin » (premier démarrage)'],
    ['APP_URL', 'Adresse publique (liens des QR codes et des fiches d’accès)'],
    ['SMS_PROVIDER', 'SIMULATION, ORANGE, TWILIO ou AFRICASTALKING'],
    ['ORANGE_CLIENT_ID, ORANGE_CLIENT_SECRET, ORANGE_SENDER_PHONE', 'Orange SMS API (Orange Developer, Cameroun)'],
    ['TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM', 'Twilio'],
    ['AT_USERNAME, AT_API_KEY, AT_SENDER_ID', 'Africa’s Talking'],
], widths=[7.0, 9.6], caption='Configuration', font=8.5)

# ------------------------------------------------------------------ 9
D.h1('9. Documents produits par l’application')
D.table(['Document', 'Contenu', 'Accès'], [
    ['Planning général (PDF)', 'Grille par jour, créneau et salle ; planning par classe', 'Administrateur'],
    ['Planning de travail d’une classe (PDF)', 'Créneaux hebdomadaires et séances datées des 5 semaines suivantes', 'Administrateur, encadreur, parent'],
    ['Planning des séances du mois (PDF)', 'Toutes les séances datées avec statut et heures réalisées', 'Administrateur'],
    ['État de paiement des salaires (PDF)', 'Heures, pourcentage, montant dû, primes, retenues, net, émargement, montant en lettres', 'Administrateur'],
    ['État de location des salles (PDF)', 'Détail par salle et date, tarifs, total en lettres, signatures', 'Administrateur'],
    ['État de caisse (PDF)', 'Soldes, journal, répartitions, solde arrêté en lettres', 'Administrateur'],
    ['Reçu de paiement (PDF, A5)', 'Montant en chiffres et en lettres, solde restant, QR code d’authenticité', 'Administrateur, parent'],
    ['État de suivi de l’apprenant (PDF)', 'Assiduité, moyennes, évaluations, absences, appréciation, QR code', 'Administrateur, encadreur, parent'],
    ['Liste des élèves, impayés, état de présence (PDF)', 'Listes par classe', 'Administrateur'],
    ['Fiches d’accès (PDF)', 'Identifiant, mot de passe, adresse, QR code, à découper', 'Administrateur'],
], widths=[5.2, 7.6, 3.8], caption='Documents PDF', font=8.5)
D.figures_row([c('pdf_salaires.png'), c('pdf_recu.png'), c('pdf_suivi.png')], 'États de salaires, reçu et état de suivi au gabarit du papier en-tête SVTC', width=5.1)

# ------------------------------------------------------------------ 10
D.h1('10. Recette et tests')
D.p("La recette s'appuie sur des tests automatisés exécutés avant chaque livraison, en développement et sur la version de production.")
D.table(['Campagne', 'Contenu', 'Résultat'], [
    ['Tests unitaires (11)', 'Salaire au prorata et horaire, heures plafonnées, location mercredi/dimanche, montant dû et affectation des paiements, assiduité, moyenne pondérée, planning sans conflit, détection des conflits, montants en lettres, formats camerounais, fuseau horaire', '**11/11 réussis**'],
    ['Tests de bout en bout (29)', 'Administrateur : paramètres, classe, inscription, compte parent, paiement et reçu, séance, message, salaires, location, document, caisse. Encadreur (smartphone) : démarrage, appel, fin, dépôt PDF et refus d’un faux PDF, notes (refus d’une note hors barème), envoi du suivi. Parent : connexion par téléphone, messages, reçu et suivi. Sécurité : cloisonnement des espaces, refus d’accès aux PDF d’autrui, verrouillage, mauvais espace, en-têtes, accès anonyme', '**29/29 réussis**'],
    ['Parcours complet des pages', 'Toutes les pages des trois espaces, sans erreur serveur ni erreur JavaScript', '**Aucune erreur**'],
    ['Build de production', 'Compilation TypeScript stricte et optimisation Next.js', '**Réussi**'],
], widths=[3.6, 10.6, 2.4], caption='Résultats de la recette', font=8.5)

# ------------------------------------------------------------------ 11
D.h1('11. Livrables et planning de réalisation')
D.table(['Phase', 'Contenu', 'Livrable'], [
    ['1. Analyse', 'Étude des supports SVTC, recueil des besoins, règles de gestion', 'Cahier des charges'],
    ['2. Conception', 'Modélisation UML, modèle de données, maquettes des trois interfaces', 'Diagrammes UML'],
    ['3. Réalisation', 'Développement full stack, sécurité, PDF, messagerie', 'Code source (GitHub)'],
    ['4. Recette', 'Tests unitaires et de bout en bout, correction', 'Rapport de tests'],
    ['5. Déploiement', 'Hébergement Vercel + Neon, configuration', f'Application en ligne : {URL}'],
    ['6. Accompagnement', 'Manuel d’utilisation illustré, prise en main', 'Manuel (Word et PDF)'],
], widths=[3.2, 8.4, 5.0], caption='Phases et livrables', font=8.5)

# ------------------------------------------------------------------ 12
D.h1('12. Évolutions possibles')
D.bullets([
    ('Paiement en ligne : ', 'intégration des API MTN Mobile Money et Orange Money pour un paiement par les parents depuis leur espace, avec reçu automatique.'),
    ('Notifications : ', 'notifications push sur smartphone (rappel de séance, nouvelle note, message).'),
    ('Bulletins périodiques : ', 'bulletin trimestriel avec rang et appréciations de chaque encadreur.'),
    ('E-learning : ', 'bibliothèque de cours, exercices interactifs et quiz corrigés automatiquement, sujets d’examens officiels.'),
    ('Multi-centres : ', 'ouverture d’autres sites SVTC avec consolidation des statistiques.'),
    ('Double authentification : ', 'code à usage unique pour les administrateurs.'),
    ('Pointage par QR code : ', 'scan d’un QR code affiché en salle pour démarrer la séance et confirmer la présence.'),
    ('Statistiques avancées : ', 'taux de réussite aux examens officiels, progression par cohorte, rentabilité par classe.'),
])

# ------------------------------------------------------------------ Annexe
D.h1('Annexe — paramètres livrés par défaut')
D.table(['Paramètre', 'Valeur'], [
    ['Structure', 'SILICON VALLEY TRAINING CENTER (SVTC) — Centre Éducatif TYRANNUS, Biyem-Assi Lac, Yaoundé'],
    ['Contacts', '657 513 641 · 695 840 597 · 697 760 779'],
    ['Séances', 'Mercredi 15h30–18h00 (créneaux 15h30–16h45, 16h45–18h00) ; dimanche 10h00–14h00 (10h00–12h00, 12h00–14h00)'],
    ['Classes', '6e, 5e, 4e, 3e, 2nde, 1ère, Tle, PTI (Première TI), TTI (Terminale TI) — ajout libre'],
    ['Matières', 'Informatique ; Algorithmique et programmation ; Programmation ; Système d’information ; Maintenance – Réseau – Création numérique ; Réseau – Internet – Sécurité informatique'],
    ['Salles', 'Salle A et Salle B : 500 FCFA/h le mercredi, 1000 FCFA/h le dimanche'],
    ['Frais (indicatifs, modifiables)', 'Inscription 5 000 FCFA ; mensualité 5 000 à 10 000 FCFA selon la classe ; mois facturables d’octobre à mai'],
    ['Salaires', 'Salaire mensuel de référence au prorata des heures effectuées, plafonné à 100 %'],
], widths=[4.2, 12.4], caption='Paramètres par défaut', font=8.6)

out = os.path.join(DOCS, 'Cahier_des_charges_SVTC_Repetitions.docx')
D.save(out)
print('OK', out)
