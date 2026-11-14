"""Manuel d'utilisation — SVTC Répétitions (papier en-tête SVTC). Usage : python3 manuel.py"""
import datetime
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from docgen import DOCS, Doc  # noqa: E402

URL = os.environ.get('SVTC_URL', 'https://svtc-repetitions.vercel.app')
DEMO = os.environ.get('SVTC_DEMO', '0') == '1'
CAP = os.path.join(DOCS, 'captures')
c = lambda f: os.path.join(CAP, f)
today = datetime.date.today().strftime('%d/%m/%Y')

D = Doc("Manuel d'utilisation — SVTC Répétitions", "Manuel d'utilisation")
D.cover(
    "Manuel d'utilisation",
    'SVTC Répétitions',
    'Guide illustré de l’administrateur, de l’encadreur et du parent',
    [
        ('Application', f'SVTC Répétitions — {URL}'),
        ('Structure', 'SILICON VALLEY TRAINING CENTER — Centre Éducatif TYRANNUS, Biyem-Assi Lac, Yaoundé'),
        ('Public', 'Administration du centre, encadreurs, parents d’élèves'),
        ('Appareils', 'Ordinateur, tablette et smartphone (navigateur récent ou application installée)'),
        ('Version', f'1.0 — {today}'),
        ('Assistance', '657 513 641 · 695 840 597 · 697 760 779'),
    ],
    motto="Comprendre. **Pratiquer.** Maîtriser.",
    image=os.path.join(DOCS, 'couverture.png'),
)
D.toc()

# ------------------------------------------------------------------ 1
D.h1('1. Bien démarrer')
D.h2('1.1 Présentation')
D.p("**SVTC Répétitions** est l'application en ligne de gestion des cours de répétitions en informatique de la Silicon Valley Training Center. "
    "Elle comporte **trois espaces**, chacun avec sa propre adresse, sa page de connexion et sa présentation :")
D.table(['Espace', 'Adresse', 'Pour qui ?', 'Identifiant'], [
    ['**Administration**', f'{URL}/admin', 'Direction et secrétariat du centre', 'admin (choisi à l’installation)'],
    ['**Encadreur**', f'{URL}/encadreur', 'Enseignants (encadreurs)', 'prénom.nom — ex. paul.ndjock'],
    ['**Parent**', f'{URL}/parent', 'Parents et tuteurs des élèves', 'Numéro de téléphone — ex. 657513641'],
], widths=[2.8, 5.8, 4.0, 4.0], caption='Les trois espaces de l’application')
D.p(f"La page d'accueil **{URL}** présente le centre (domaines de formation, horaires, contacts) et donne accès aux trois espaces.")
D.figure(c('01_accueil_site.png'), "Page d'accueil publique de la SVTC", max_h=10)
D.h2('1.2 Se connecter')
D.steps([
    'Ouvrez l’adresse de votre espace (ou cliquez sur « Se connecter » depuis l’accueil puis choisissez votre espace).',
    'Saisissez votre **identifiant** et votre **mot de passe** remis par le centre. Pour un parent, l’identifiant est son **numéro de téléphone** (avec ou sans espaces).',
    'Cliquez sur **Se connecter**. L’icône en forme d’œil permet d’afficher le mot de passe pendant la saisie.',
])
D.figures_row([c('04_mobile_choix_espace.png'), c('05_mobile_connexion_parent.png')], 'Choix de l’espace et connexion parent sur smartphone', width=4.6)
D.note("**Sécurité.** Après **5 erreurs** de mot de passe, le compte est bloqué **15 minutes**. Un compte ne s’ouvre que dans **son** espace : un parent qui tente de se connecter à l’espace encadreur est refusé avec l’indication du bon espace.", 'warn')
D.h2('1.3 Mot de passe oublié ou à changer')
D.bullets([
    ('Changer son mot de passe : ', 'menu **Mon compte** (icône de profil) ▸ « Changer mon mot de passe ». Toutes les autres sessions sont alors fermées.'),
    ('Mot de passe oublié : ', 'l’encadreur ou le parent appelle le centre ; l’administrateur génère un nouveau mot de passe (voir § 3.4) et le transmet par WhatsApp, SMS ou fiche imprimée.'),
])
D.h2('1.4 Installer l’application sur un smartphone')
D.bullets([
    ('Android (Chrome) : ', 'ouvrez l’adresse de l’application ▸ menu ⋮ ▸ « Installer l’application » ou « Ajouter à l’écran d’accueil ».'),
    ('iPhone (Safari) : ', 'bouton Partager ▸ « Sur l’écran d’accueil ».'),
    ('Résultat : ', 'une icône SVTC apparaît sur l’écran d’accueil et l’application s’ouvre en plein écran.'),
])

# ------------------------------------------------------------------ 2
D.h1('2. Administrateur — prise en main')
D.h2('2.1 Les premières étapes')
D.p("À la première mise en service, l'application contient déjà les paramètres de la SVTC (nom, contacts, horaires), les 6 matières, les classes "
    "de la 6e à la Terminale (dont **PTI** et **TTI**) et les salles A et B avec leurs tarifs. Suivez ensuite ces étapes :")
D.steps([
    '**Paramètres du centre** : vérifiez l’identité, le logo, les horaires et les frais (§ 3.1).',
    '**Encadreurs** : ajoutez chaque encadreur ; son compte d’accès est créé en même temps (§ 3.4).',
    '**Attributions** : pour chaque classe, indiquez l’encadreur de chaque matière (§ 3.5).',
    '**Élèves** : inscrivez-les un par un ou importez la liste depuis Excel ; les parents sont créés automatiquement (§ 3.3).',
    '**Parents** : cliquez sur « Générer tous les comptes » et transmettez les accès (§ 3.4).',
    '**Planning** : « Générer automatiquement », puis « Générer les séances » du mois et exportez le PDF (§ 4.1).',
])
D.h2('2.2 Le tableau de bord')
D.p("Le tableau de bord résume l'activité en temps réel : élèves actifs, encadreurs, séances de la semaine, taux de présence, encaissements du mois, "
    "impayés, solde de caisse et documents à examiner. Le graphique compare recettes et dépenses sur six mois. Le bloc **À traiter** liste les actions en attente "
    "(documents à examiner, séances à valider, séances non pointées, impayés, élèves sans parent, parents sans compte) : un clic ouvre directement la page concernée.")
D.figure(c('10_admin_tableau_de_bord.png'), "Tableau de bord de l'administrateur", max_h=10.5)
D.h2('2.3 Navigation et recherche rapide')
D.bullets([
    ('Menu latéral : ', 'les pages sont regroupées par thème (Structure, Personnes, Pédagogie, Finances, Communication, Sécurité). Les pastilles dorées signalent des éléments à traiter.'),
    ('Recherche rapide : ', 'appuyez sur **Ctrl + K** (ou sur la loupe) et tapez quelques lettres (« salaires », « sms », « planning ») puis Entrée.'),
    ('Sur smartphone et tablette : ', 'le menu s’ouvre avec le bouton ☰ en haut à gauche.'),
])
D.figures_row([c('11_admin_palette.png'), c('36_tablette_admin.png'), c('38_mobile_admin_menu.png')], 'Recherche rapide (Ctrl + K), tablette et menu sur smartphone', width=5.2)

# ------------------------------------------------------------------ 3
D.h1('3. Administrateur — structure et personnes')
D.h2('3.1 Paramètres du centre')
D.p("Menu **Paramètres du centre**. Chaque bloc s'enregistre séparément avec son bouton.")
D.bullets([
    ('Identité : ', 'nom, sigle, devise, slogan, présentation, lieu, adresse, 3 téléphones, WhatsApp, e-mail, nom et titre du signataire des documents (ex. « Le Promoteur »).'),
    ('Logo & bandeau : ', 'chargez un nouveau logo (PNG transparent conseillé, 1 Mo maximum) ou un bandeau d’en-tête pour les PDF ; « Logo d’origine » rétablit l’image SVTC.'),
    ('Jours, horaires et créneaux : ', 'cochez les jours de séance, saisissez début et fin, puis les créneaux séparés par « ; » (ex. 15:30-16:45 ; 16:45-18:00). Le planning automatique utilise ces créneaux.'),
    ('Facturation : ', 'préfixe des reçus, mois facturables (mensualités) et base de calcul de la location des salles.'),
    ('Salaires : ', 'mode « prorata des heures » (salaire de référence × % d’heures effectuées) ou « taux horaire » ; heures retenues ; plafond à 100 %.'),
    ('SMS & sécurité : ', 'état de la passerelle SMS, nom d’expéditeur, signature ; option « changer le mot de passe à la première connexion ».'),
    ('Années scolaires : ', 'créez l’année suivante puis « Activer » au moment de la rentrée.'),
])
D.figure(c('12_admin_parametres.png'), 'Paramètres : identité, logo, bandeau et années scolaires', max_h=10)
D.figure(c('12b_admin_parametres_horaires.png'), 'Paramètres : jours, horaires et créneaux des séances', max_h=10)
D.h2('3.2 Classes, matières et salles')
D.bullets([
    ('Classes : ', '« Ajouter une classe » : code (ex. STI), nom (Seconde TI), cycle, frais d’inscription, mensualité, effectif maximum, couleur. Une classe qui contient des élèves est désactivée au lieu d’être supprimée.'),
    ('Matières : ', 'les 6 domaines sont prêts ; vous pouvez en ajouter et choisir leur couleur (utilisée dans tout le planning).'),
    ('Salles : ', 'pour chaque salle, le tarif horaire de chaque jour de séance (par défaut 500 FCFA le mercredi, 1000 FCFA le dimanche).'),
])
D.figure(c('13_admin_classes.png'), 'Liste des classes et frais de répétition', max_h=9)
D.figure(c('15_admin_salles.png'), 'Salles et tarifs de location par jour', max_h=8)
D.h2('3.3 Élèves')
D.steps([
    'Menu **Élèves** ▸ **Inscrire un élève**.',
    'Renseignez le nom, les prénoms, la classe, l’établissement fréquenté, la date d’inscription et une éventuelle réduction (%).',
    'Dans « Parent / tuteur », choisissez un parent existant **ou** saisissez le nom et le téléphone d’un nouveau parent. Un numéro déjà connu rattache automatiquement l’élève au même parent (fratrie).',
    'Cliquez sur **Inscrire l’élève** : le matricule (ex. SVTC-26-0042) est attribué automatiquement.',
])
D.p("**Importer une liste** : bouton **Importer** ▸ choisissez un fichier CSV (dans Excel : « Enregistrer sous ▸ CSV ») ou collez directement les lignes copiées depuis Excel. "
    "La première ligne doit contenir les titres : nom ; prenom ; sexe ; classe ; date_naissance ; etablissement ; parent ; telephone_parent ; lien. Le modèle est téléchargeable dans la fenêtre d’import. "
    "Les lignes incorrectes sont listées avec la raison du rejet.")
D.figure(c('16_admin_eleves.png'), 'Liste des élèves avec classe, parent et solde', max_h=10)
D.figures_row([c('16b_admin_eleve_formulaire.png'), c('16c_admin_import.png')], 'Inscription d’un élève et import d’une liste Excel/CSV', width=8.0)
D.p("La **fiche élève** (clic sur son nom) regroupe l'identité, le parent (appel, WhatsApp), la situation financière mois par mois, les paiements et reçus, "
    "l'évolution des notes et l'assiduité. Les boutons permettent d'**encaisser**, d'éditer l'**état de suivi PDF** et de l'**envoyer au parent**.")
D.figure(c('17_admin_fiche_eleve.png'), 'Fiche détaillée d’un élève', max_h=10)
D.h2('3.4 Parents, encadreurs et comptes d’accès')
D.p("**Encadreurs** : « Ajouter un encadreur » (nom, téléphone, spécialité, diplôme, salaire mensuel de référence et/ou taux horaire). "
    "Laissez cochée la case « Créer son compte d’accès maintenant » : l’identifiant (prénom.nom) et un mot de passe facile à retenir sont générés.")
D.p("**Parents** : chaque parent a pour identifiant son numéro de téléphone. Cliquez sur **Créer l’accès** pour un parent, ou sur **Générer tous les comptes** pour tous ceux qui n’en ont pas.")
D.p("Une fenêtre affiche alors les identifiants **une seule fois** (par sécurité, l’application ne conserve que l’empreinte chiffrée des mots de passe) :")
D.bullets([
    ('Fiches d’accès (PDF) : ', 'fiches à découper, avec l’adresse de l’espace, l’identifiant, le mot de passe et un QR code.'),
    ('WhatsApp : ', 'ouvre la conversation avec le message d’accès déjà rédigé.'),
    ('SMS : ', 'ouvre l’application SMS du téléphone avec le message prêt.'),
    ('Mot de passe oublié : ', 'bouton **Réinitialiser** (parents), **Nouveau mot de passe** (encadreurs) ou icône clé dans **Comptes utilisateurs**.'),
])
D.figure(c('18b_admin_identifiants.png'), 'Identifiants générés : fiche PDF, WhatsApp ou SMS', max_h=9.5)
D.figure(c('19_admin_encadreurs.png'), 'Encadreurs, attributions, rémunération et comptes', max_h=10)
D.figure(c('pdf_acces.png'), 'Fiches d’accès imprimables', max_h=11)
D.h2('3.5 Attributions')
D.p("Menu **Attributions** : pour chaque classe et chaque matière, choisissez l’encadreur et le nombre de **créneaux par semaine** (1 par défaut). "
    "Laissez « — » si la matière n’est pas suivie dans cette classe, puis cliquez sur **Enregistrer toutes les attributions**.")
D.figure(c('20_admin_attributions.png'), 'Attribution des classes et matières aux encadreurs', max_h=10)
D.h2('3.6 Comptes, journal et sauvegarde')
D.bullets([
    ('Comptes utilisateurs : ', 'tous les accès, dernière connexion, sessions ouvertes, comptes verrouillés ; réinitialiser, désactiver (ferme immédiatement les sessions) ou supprimer ; ajouter un administrateur (secrétariat).'),
    ('Journal d’audit : ', 'qui a fait quoi et quand (connexions, paiements, annulations, comptes, planning…), avec recherche.'),
    ('Sauvegarde & export : ', 'sauvegarde complète (JSON) et exports Excel (CSV) des élèves, paiements, dépenses, séances, présences, notes, encadreurs et salaires. Conseil : une sauvegarde à chaque fin de mois.'),
])

# ------------------------------------------------------------------ 4
D.h1('4. Administrateur — pédagogie')
D.h2('4.1 Planning')
D.steps([
    'Menu **Planning** ▸ **Générer automatiquement** : l’application place chaque attribution sur un créneau libre, **sans conflit** de classe, d’encadreur ni de salle. Si une demande ne peut pas être placée, elle est signalée (ajoutez une salle, un créneau ou réduisez les créneaux hebdomadaires).',
    'Ajustez si besoin : bouton **+ Ajouter** dans une case, crayon pour modifier, corbeille pour supprimer. Tout chevauchement est refusé avec son explication.',
    'Bloc **1. Générer les séances datées** : choisissez la période (ex. le mois) ▸ **Générer les séances**. Ce sont ces séances que les encadreurs démarrent et que les parents consultent.',
    'Bloc **2. Exporter le planning (PDF)** : planning général, planning de travail d’une classe, ou séances du mois.',
    'Bloc **3. Ajustements** : après une modification du planning, « Appliquer le planning aux séances futures » ; pour un jour férié, « Annuler une journée de séances ».',
])
D.figure(c('21_admin_planning.png'), 'Planning hebdomadaire par jour, créneau et salle', max_h=10.5)
D.figures_row([c('pdf_planning.png'), c('pdf_planning_classe.png')], 'Planning général et planning de travail d’une classe (PDF)', width=8.0)
D.h2('4.2 Séances et validation des heures')
D.p("Menu **Séances** : filtrez par période, classe, encadreur ou statut. Les statuts sont : **Planifiée**, **En cours**, **Terminée**, **Annulée** ; "
    "une séance passée non démarrée apparaît **Non pointée**. Pour chaque séance terminée, contrôlez les heures réelles puis validez (icône ✓) ou cliquez sur **Valider** pour toutes les séances affichées. "
    "Une séance validée est verrouillée et sert au calcul des salaires.")
D.bullets([
    ('Séance ponctuelle : ', 'rattrapage ou séance supplémentaire (date, horaire, classe, matière, encadreur, salle).'),
    ('Annuler : ', 'avec un motif (encadreur absent…) ; la séance n’est comptée ni dans la paie ni dans la location. « Rétablir » l’annule.'),
    ('Corriger : ', 'ouvrez la séance (œil) ▸ « Corriger la séance » pour saisir les heures réelles oubliées ou changer d’encadreur ou de salle.'),
])
D.figure(c('22_admin_seances.png'), 'Suivi des séances et validation des heures', max_h=10)
D.h2('4.3 Présences, notes et documents')
D.bullets([
    ('Présences : ', 'taux de présence de chaque classe sur la période ; en choisissant une classe, détail par élève (du moins assidu au plus assidu), bouton WhatsApp pour prévenir le parent, et **état de présence PDF**.'),
    ('Notes & suivi : ', 'moyennes par matière, moyenne générale et classement de la classe ; état de suivi PDF de chaque élève ; **Envoyer les états de suivi** à tous les parents de la classe.'),
    ('Documents pédagogiques : ', 'fiches de TD déposées par les encadreurs. **Consulter** affiche le PDF ; **Examiner** permet d’approuver, de renvoyer pour correction avec un commentaire, et de rendre le document visible des parents.'),
])
D.figure(c('23_admin_presences.png'), 'Présences par classe et par élève', max_h=10)
D.figure(c('25_admin_documents.png'), 'Documents pédagogiques à examiner', max_h=10)

# ------------------------------------------------------------------ 5
D.h1('5. Administrateur — finances')
D.h2('5.1 Encaisser un paiement')
D.steps([
    'Bouton **Encaisser** (tableau de bord, fiche élève ou page Paiements).',
    'Recherchez l’élève : son solde à ce jour et sa mensualité s’affichent, le montant dû est proposé.',
    'Indiquez le montant, la nature (mensualité, inscription, autre), le mode (espèces, MTN Mobile Money, Orange Money, virement) et, pour le Mobile Money, la **référence de la transaction** (obligatoire).',
    'Cliquez sur **Enregistrer le paiement**, puis **Imprimer le reçu**.',
])
D.p("Le reçu porte un **numéro séquentiel**, le montant en chiffres et **en lettres**, le solde restant et un **QR code** d’authenticité. "
    "Un paiement erroné n’est jamais supprimé : bouton ⊘ ▸ motif ▸ il est **annulé** et reste visible dans l’historique et le journal d’audit.")
D.figures_row([c('26b_admin_encaisser.png'), c('pdf_recu.png')], 'Encaissement et reçu PDF avec QR code', width=8.0)
D.h2('5.2 Impayés et relances')
D.p("Menu **Impayés & relances** : élèves dont le montant dû à ce jour n’est pas réglé, avec les mois concernés. **Relancer tous les parents** envoie un rappel "
    "personnalisé (nom du parent, de l’enfant, classe, montant) dans leur espace et, au choix, par SMS. Les icônes téléphone et WhatsApp permettent une relance individuelle.")
D.figure(c('27_admin_impayes.png'), 'Impayés et relances', max_h=10)
D.h2('5.3 Dépenses et état de caisse')
D.p("Menu **Dépenses** : saisissez les sorties de caisse (fournitures, communication, transport, entretien…). Les salaires et la location des salles réglés depuis leurs pages y sont ajoutés automatiquement.")
D.p("Menu **État de caisse** : choisissez la période ; l’écran affiche le solde d’ouverture, les recettes, les dépenses, le solde de clôture et le journal chronologique. "
    "**Exporter l’état de caisse (PDF)** produit le document à signer.")
D.figures_row([c('29_admin_caisse.png'), c('pdf_caisse.png')], 'État de caisse à l’écran et en PDF', width=8.0)
D.h2('5.4 Location des salles')
D.p("Menu **Location des salles** ▸ choisissez le mois. Le calcul reprend chaque journée d’occupation de chaque salle : heures × tarif du jour "
    "(mercredi 500 FCFA/h, dimanche 1000 FCFA/h pour les salles A et B). **État de location (PDF)** produit le document ; **Marquer comme réglé** enregistre le paiement en dépense.")
D.figures_row([c('30_admin_location.png'), c('pdf_location.png')], 'Location des salles à l’écran et en PDF', width=8.0)
D.h2('5.5 Salaires des encadreurs')
D.p("Menu **Salaires des encadreurs** ▸ choisissez le mois. Pour chaque encadreur : heures prévues, heures effectuées (pointées), **pourcentage des heures faites**, "
    "montant dû (= salaire de référence × pourcentage), prime, retenue et **net à payer**.")
D.steps([
    'Vérifiez qu’il ne reste pas de séances « à valider » (message d’avertissement en haut de page).',
    'Saisissez éventuellement primes et retenues ▸ **Enregistrer primes et retenues**.',
    '**État de paiement (PDF)** : document avec colonne d’émargement et total en lettres.',
    '**Payer** (un encadreur) ou **Tout payer** : chaque paiement est inscrit en dépense « Salaires ».',
])
D.figures_row([c('31_admin_salaires.png'), c('pdf_salaires.png')], 'Salaires au prorata des heures et état de paiement PDF', width=8.0)

# ------------------------------------------------------------------ 6
D.h1('6. Administrateur — communication')
D.p("Menu **Messages aux parents** :")
D.steps([
    'Choisissez un **modèle** (rappel de paiement, réunion des parents, absence, information, examens) ou rédigez librement.',
    'Utilisez les variables **{parent}**, **{eleve}**, **{classe}**, **{solde}**, **{centre}**, **{telephone}** : elles sont remplacées pour chaque destinataire.',
    'Choisissez les **destinataires** : tous les parents, par classe, parents choisis, parents en retard de paiement, ou encadreurs.',
    'Cochez **Envoyer aussi par SMS** si une passerelle SMS est configurée.',
    'Cliquez sur **Envoyer le message**.',
])
D.p("Le message arrive dans l’espace de chaque destinataire. L’écran de confirmation propose ensuite l’**envoi gratuit depuis votre téléphone** : "
    "un lien **WhatsApp** par parent (message personnalisé déjà rédigé) et un SMS groupé. L’historique indique le nombre de destinataires, de lectures et de SMS envoyés.")
D.figure(c('32_admin_messages.png'), 'Messages aux parents : modèles, destinataires, historique', max_h=10)
D.note("**Passerelle SMS.** Sans configuration, les SMS sont en « mode simulation » et l’envoi se fait par WhatsApp ou depuis le téléphone. "
       "Pour des SMS automatiques, souscrivez à Orange SMS API (Orange Developer), Twilio ou Africa’s Talking et renseignez les clés dans l’hébergeur (§ 10.2).", 'info')

# ------------------------------------------------------------------ 7
D.h1('7. Espace encadreur')
D.h2('7.1 Accueil et séances du jour')
D.p("L'accueil affiche les séances du jour, les prochaines séances, les heures du mois, le pourcentage d'heures effectuées, l'estimation du salaire et la présence de vos élèves. "
    "Des alertes signalent les séances non clôturées et les documents à revoir.")
D.steps([
    'À l’arrivée en salle, appuyez sur **Démarrer la séance** : l’heure de début est enregistrée et un chronomètre s’affiche.',
    'Appuyez sur **Faire l’appel** (voir § 7.2).',
    'À la fin du cours, appuyez sur **Terminer** : l’heure de fin est enregistrée. L’appel doit avoir été fait.',
])
D.figure(c('40_encadreur_accueil.png'), 'Accueil de l’encadreur avec une séance en cours', max_h=10)
D.h2('7.2 Faire l’appel')
D.p("Pour chaque élève, touchez **P** (présent), **R** (en retard), **A** (absent) ou **J** (absence justifiée, avec motif). "
    "« Tous présents » coche tout le monde d’un coup. Touchez **Enregistrer l’appel**. Vous pouvez corriger l’appel pendant 7 jours, tant que l’administration n’a pas validé la séance.")
D.figures_row([c('50_mobile_encadreur_appel.png'), c('49_mobile_encadreur_accueil.png'), c('51_mobile_encadreur_menu.png')], 'Appel, accueil et menu de l’encadreur sur smartphone', width=4.7)
D.h2('7.3 Heures oubliées, contenu et fiche de TD')
D.bullets([
    ('Saisir les heures : ', 'si vous avez oublié de démarrer ou de terminer, ouvrez la séance ▸ **Saisir les heures** (début et fin réels).'),
    ('Contenu de la séance : ', 'leçon traitée, résumé et travail à faire (visibles par les parents).'),
    ('Fiche de TD : ', 'choisissez le fichier **PDF** (4 Mo maximum) ▸ **Déposer la fiche**. Un fichier qui n’est pas un vrai PDF est refusé. Le menu **Fiches de TD** liste vos documents et l’avis de l’administration.'),
])
D.figure(c('41_encadreur_seance.png'), 'Page d’une séance : heures, appel, contenu et fiche de TD', max_h=10)
D.h2('7.4 Évaluations et notes')
D.steps([
    'Menu **Notes** ▸ **Nouvelle évaluation** : classe et matière, intitulé, type (TD, interrogation, devoir…), date, barème et coefficient.',
    'Saisissez les notes (la virgule est acceptée) ou « abs » pour un absent ; laissez vide pour ne pas noter.',
    'Cliquez sur **Enregistrer les notes**. Une note hors barème est refusée avec un message clair.',
])
D.figure(c('46_encadreur_saisie_notes.png'), 'Saisie des notes d’une évaluation', max_h=10)
D.h2('7.5 Suivi d’un élève et envoi au parent')
D.p("Menu **Élèves** ▸ choisissez la classe puis l’élève : assiduité, moyenne, évolution des notes, détail des notes et des présences. "
    "**État de suivi (PDF)** télécharge le document ; **Envoyer au parent** dépose l’état de suivi (assiduité et performances) dans l’espace du parent, avec le PDF.")
D.figure(c('44_encadreur_suivi_eleve.png'), 'Évolution d’un élève et envoi de l’état de suivi', max_h=10)
D.h2('7.6 Mes heures et messages')
D.p("**Mes heures** détaille chaque séance du mois (prévu, réalisé, retenu), le pourcentage d’heures faites et l’estimation du salaire (ou le montant payé). "
    "**Messages** contient les informations envoyées par l’administration.")
D.figure(c('48_encadreur_heures.png'), 'Mes heures et ma rémunération', max_h=9.5)

# ------------------------------------------------------------------ 8
D.h1('8. Espace parent')
D.p("L'espace parent est conçu pour le smartphone. Si vous avez plusieurs enfants inscrits, choisissez l'enfant en haut de l'écran. "
    "La barre du bas donne accès à : **Accueil**, **Planning**, **Suivi**, **Messages**, **Paiements**.")
D.bullets([
    ('Accueil : ', 'assiduité, moyenne, montant à régler, prochaine séance (date, horaire, matière, encadreur, salle), derniers messages, appel du centre en un clic.'),
    ('Planning : ', 'emploi du temps hebdomadaire de la classe et liste des séances récentes et à venir ; planning PDF.'),
    ('Détail d’une séance : ', 'encadreur, horaire prévu, **heures de début et de fin effectives**, salle, présence de votre enfant, leçon, travail à faire et fiche de TD partagée.'),
    ('Suivi : ', 'assiduité, absences et retards, notes, moyennes par matière, graphique d’évolution ; **Télécharger l’état de suivi (PDF)**.'),
    ('Messages : ', 'rappels, informations, états de suivi envoyés par le centre ou les encadreurs.'),
    ('Paiements : ', 'total payé, reste à payer, mois réglés, historique et **reçus PDF**.'),
])
D.figures_row([c('60_mobile_parent_accueil.png'), c('61_mobile_parent_planning.png'), c('62_mobile_parent_seance.png')], 'Accueil, planning et détail d’une séance', width=4.7)
D.figures_row([c('63_mobile_parent_suivi.png'), c('64_mobile_parent_messages.png'), c('65_mobile_parent_paiements.png')], 'Suivi, messages et paiements', width=4.7)
D.figure(c('pdf_suivi.png'), 'État de suivi de l’apprenant (PDF)', max_h=12)

# ------------------------------------------------------------------ 9
D.h1('9. Vérifier un document')
D.p(f"Chaque reçu et chaque état de suivi porte un **QR code** et un **code d’authenticité**. Scannez le QR code avec un smartphone, ou ouvrez **{URL}/verifier** et saisissez le code : "
    "la page indique si le document est authentique (et ses informations principales), s’il a été annulé, ou s’il est inconnu.")

# ------------------------------------------------------------------ 10
D.h1('10. Mise en ligne et maintenance')
D.h2('10.1 Mettre l’application en ligne (Vercel + Neon, gratuit)')
D.p(f"L'application est conçue pour l'hébergeur **Vercel** (serveur web mondial, HTTPS, pas de mise en veille) avec une base de données **Neon PostgreSQL** "
    f"(sauvegardes automatiques). Adresse prévue : **{URL}** (le sous-domaine exact est attribué par Vercel). La mise en ligne prend environ 5 minutes :")
D.steps([
    'Sur GitHub, fusionnez la branche de développement dans **master** (dépôt ANDJE30/MY_WORLD).',
    'Créez un compte gratuit sur **vercel.com** avec « Continue with GitHub ».',
    '**Add New ▸ Project** ▸ importez le dépôt **MY_WORLD** ▸ **Root Directory : svtc** (Vercel détecte Next.js).',
    'Dans **Environment Variables**, ajoutez **ADMIN_PASSWORD** (mot de passe initial de l’administrateur, 8 caractères minimum avec lettres et chiffres).',
    'Cliquez sur **Deploy**, puis, dans l’onglet **Storage** du projet : **Create Database ▸ Neon** (offre gratuite, région Francfort) ▸ **Connect** : DATABASE_URL est ajoutée automatiquement.',
    'Onglet **Deployments** ▸ **Redeploy** : les tables sont créées automatiquement pendant la construction.',
    'Ouvrez **https://<votre-projet>.vercel.app/admin/connexion** et connectez-vous avec **admin** et ADMIN_PASSWORD, puis changez ce mot de passe.',
])
D.p("Ensuite, chaque mise à jour publiée sur la branche master est déployée automatiquement et les modifications de la base s’appliquent toutes seules. "
    "Un nom de domaine personnalisé (ex. repetitions.svtc.cm) peut être ajouté dans **Settings ▸ Domains**.")
D.h2('10.2 Paramètres de l’hébergeur')
D.table(['Variable', 'Rôle'], [
    ['DATABASE_URL', 'Base de données (renseignée automatiquement par l’intégration Neon)'],
    ['ADMIN_PASSWORD', 'Mot de passe initial du compte administrateur « admin »'],
    ['APP_URL', 'Adresse publique de l’application (QR codes, fiches d’accès)'],
    ['SMS_PROVIDER + clés', 'ORANGE, TWILIO ou AFRICASTALKING et leurs identifiants (facultatif)'],
], widths=[5.0, 11.6], caption='Variables d’environnement (Vercel ▸ Settings ▸ Environment Variables)')
D.h2('10.3 Bonnes pratiques')
D.bullets([
    'Changez le mot de passe administrateur après la première connexion et ne le partagez pas ; créez un compte par personne (secrétariat).',
    'Validez les séances chaque semaine et éditez l’état des salaires au début de chaque mois.',
    'Faites une **sauvegarde** (Sauvegarde & export) à chaque fin de mois et conservez-la hors ligne.',
    'Désactivez immédiatement le compte d’un encadreur qui quitte le centre.',
    'À la rentrée : créez la nouvelle année scolaire, activez-la, puis réinscrivez ou importez les élèves.',
])

# ------------------------------------------------------------------ 11
D.h1('11. Questions fréquentes')
D.table(['Question', 'Réponse'], [
    ['Je n’arrive pas à me connecter.', 'Vérifiez l’espace (administration, encadreur, parent) et l’identifiant (téléphone pour les parents). Après 5 erreurs, attendez 15 minutes. En cas d’oubli, demandez un nouveau mot de passe au centre.'],
    ['L’encadreur ne voit pas « Démarrer la séance ».', 'Le bouton n’apparaît que le jour de la séance, si des séances datées ont été générées depuis le Planning, et si la séance lui est attribuée.'],
    ['Un encadreur a oublié de pointer.', 'Il peut saisir ses heures pendant 7 jours (« Saisir les heures ») ; au-delà, l’administrateur corrige la séance.'],
    ['Le planning automatique ne place pas tout.', 'La capacité est limitée par le nombre de salles × créneaux : ajoutez une salle ou un créneau, ou réduisez les créneaux hebdomadaires dans Attributions.'],
    ['Un paiement a été saisi par erreur.', 'Annulez-le (icône ⊘) avec un motif puis saisissez le bon paiement : l’historique reste traçable.'],
    ['Les SMS ne partent pas.', 'Sans passerelle configurée, l’application est en mode simulation : utilisez les liens WhatsApp ou le SMS groupé proposés après l’envoi.'],
    ['Le fichier de TD est refusé.', 'Seuls les vrais PDF de 4 Mo maximum sont acceptés : réduisez sa taille (ex. ilovepdf.com) ou exportez-le à nouveau en PDF.'],
    ['Un parent a plusieurs enfants.', 'Inscrivez chaque enfant avec le même numéro de téléphone du parent : un seul compte parent, avec sélection de l’enfant.'],
], widths=[5.0, 11.6], caption='Questions fréquentes', font=8.6)

if DEMO:
    D.h1('Annexe — comptes de démonstration')
    D.p("L’instance de démonstration contient des données fictives (6 encadreurs, 64 élèves, 55 parents, séances d’octobre et novembre) pour découvrir l’application. "
        "Elles doivent être effacées avant la mise en service réelle.")
    D.table(['Espace', 'Identifiant', 'Mot de passe'], [
        ['Encadreur', 'paul.ndjock (ou aline.mekongo, serge.tchamba, clarisse.nguema, herve.kamdem, rodrigue.essama)', 'Demo@2026'],
        ['Parent', '690000001', 'Demo@2026'],
    ], widths=[3.0, 9.6, 4.0], caption='Comptes de démonstration')

out = os.path.join(DOCS, 'Manuel_utilisation_SVTC_Repetitions.docx')
D.save(out)
print('OK', out)
