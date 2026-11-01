import sys, os, datetime
sys.path.insert(0, os.path.dirname(__file__))
from docgen import Doc

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CAP = os.path.join(ROOT, 'docs', 'captures'); c = lambda f: os.path.join(CAP, f)
today = datetime.date.today().strftime('%d/%m/%Y')
URL = sys.argv[1] if len(sys.argv) > 1 else "l'adresse communiquée par votre établissement"

D = Doc("Manuel d'utilisation — EduGest CM", "Manuel d'utilisation")
D.cover("Manuel d'utilisation", 'EduGest CM',
        "Guide pas à pas pour l'administrateur, les enseignants et les responsables disciplinaires — sur ordinateur, tablette et smartphone",
        [('Application', 'EduGest CM — gestion des notes, de la discipline et des emplois du temps'), ('Version', '1.1 (groupes et types de matière)'), ('Date', today),
         ('Public', 'Administrateurs (proviseurs, directeurs, censeurs), enseignants, surveillants généraux'),
         ('Accès', URL)], logo=os.path.join(ROOT, 'public', 'img', 'icon-192.png'))
D.toc()

# =============================================================== 1
D.h1('1. Bienvenue dans EduGest CM')
D.p("EduGest CM est la plateforme en ligne de votre établissement pour gérer les **notes**, les **faits disciplinaires** et les **emplois du temps**. "
    "Elle fonctionne dans un navigateur internet, sans installation, sur ordinateur, tablette et smartphone. Elle respecte l'organisation de l'année "
    "scolaire camerounaise : **6 séquences** regroupées en **3 trimestres**, notes sur 20, coefficients, rangs, conseils de classe.", align='justify')
D.table(['Votre profil', 'Ce que vous pouvez faire', 'Chapitre'], [
    ['Administrateur', "Paramétrer l'établissement, créer les comptes, gérer élèves et classes, concevoir les emplois du temps, clôturer les séquences, éditer bulletins et statistiques", '3'],
    ['Enseignant', "Saisir vos notes et votre progression, valider vos saisies, imprimer vos relevés", '4'],
    ['Responsable disciplinaire', "Saisir absences, retards et sanctions, signaler les incidents, imprimer les fiches", '5']],
    widths=[3.6, 11, 2], font=9.5)
D.h2('1.1 Ce dont vous avez besoin')
D.bullets(["Un ordinateur, une tablette ou un smartphone avec un navigateur récent (Chrome, Edge, Firefox ou Safari).",
           "Une connexion internet (la 3G suffit). En cas de coupure pendant la saisie, vos notes sont conservées sur l'appareil et envoyées dès le retour du réseau.",
           f"L'adresse de l'application : **{URL}**.",
           "Vos identifiants, remis par l'administrateur sur une fiche imprimée."])
D.h2("1.2 Installer EduGest CM comme une application (recommandé sur smartphone)")
D.table(['Appareil', 'Procédure'], [
    ['Android (Chrome)', "Ouvrez l'adresse de l'application ▸ menu ⋮ en haut à droite ▸ « Installer l'application » ou « Ajouter à l'écran d'accueil »."],
    ['iPhone / iPad (Safari)', "Ouvrez l'adresse ▸ bouton Partager ▸ « Sur l'écran d'accueil » ▸ Ajouter."],
    ['Ordinateur (Chrome / Edge)', "Cliquez sur l'icône d'installation à droite de la barre d'adresse."]], widths=[4.2, 12.4], font=9.5)
D.p("L'icône EduGest apparaît alors avec vos autres applications et s'ouvre en plein écran.")

# =============================================================== 2
D.h1('2. Premiers pas')
D.h2('2.1 Se connecter')
D.figure(c('01_connexion.png'), "Écran de connexion", max_h=10)
D.numbered(["Saisissez votre **identifiant** (ex. mbargajp) — les majuscules n'ont pas d'importance.",
            "Saisissez votre **mot de passe** ; l'icône en forme d'œil permet de l'afficher pour vérifier la saisie.",
            "Cliquez sur **Se connecter**. Vous arrivez sur votre tableau de bord."])
D.note("**Sécurité :** après 5 mots de passe erronés, le compte est verrouillé pendant 15 minutes. L'administrateur peut le déverrouiller immédiatement. "
       "Le nombre d'essais restants s'affiche après chaque erreur.", 'warn')
D.h2('2.2 Première connexion : choisir votre mot de passe')
D.p("À la première connexion (et après chaque réinitialisation), l'application vous demande de remplacer le mot de passe fourni par un mot de passe personnel :")
D.numbered(["Recopiez le mot de passe de votre fiche dans « Mot de passe actuel ».",
            "Choisissez un nouveau mot de passe d'au moins 8 caractères, avec au moins une lettre et un chiffre. La jauge indique sa robustesse.",
            "Confirmez-le puis cliquez sur **Valider**."])
D.p("Astuce : une courte phrase est à la fois facile à retenir et difficile à deviner, par exemple « Mon lycée 2026 ! ».")
D.h2('2.3 Mot de passe oublié')
D.p("Pour des raisons de sécurité, aucun mot de passe n'est envoyé par e-mail. Adressez-vous à l'administrateur : il génère en un clic un nouveau mot de passe "
    "provisoire et vous remet une nouvelle fiche ; vous choisirez ensuite votre mot de passe personnel.", align='justify')
D.h2("2.4 Se repérer dans l'interface")
D.p("L'interface s'adapte automatiquement à votre écran :")
D.bullets([("Ordinateur : ", "menu complet à gauche, titre de la page en haut, frise des séquences (✓ = clôturée, vert = en cours), recherche (administrateur), thème clair/sombre et menu du compte."),
           ("Tablette : ", "le menu de gauche se réduit à des icônes (survolez-les ou appuyez dessus)."),
           ("Smartphone : ", "barre d'onglets en bas de l'écran pour les pages principales ; l'onglet **Menu** ouvre la liste complète.")])
D.figure(c('22_tablette_admin.png'), 'Affichage sur tablette (menu en icônes)', max_h=11)
D.figures_row([c('28_mobile_enseignant_accueil.png'), c('30_mobile_menu.png'), c('37_mobile_mode_sombre.png')],
              'Affichage sur smartphone : accueil, menu ouvert, thème sombre', width=4.6)
D.h2('2.5 Mon compte')
D.p("Cliquez sur votre avatar (en haut à droite) pour accéder à **Mon profil** (téléphone, e-mail, dernière connexion), **Changer mon mot de passe**, "
    "les **Annonces** et **Se déconnecter**. Pensez à toujours vous déconnecter sur un ordinateur partagé. Par sécurité, la session se ferme d'elle-même "
    "après 2 heures d'inactivité.", align='justify')

# =============================================================== 3
D.h1("3. Guide de l'administrateur")
D.h2('3.1 Mise en service en 10 étapes')
D.p("Pour démarrer l'année, suivez cet ordre. Chaque étape est détaillée dans les sections suivantes.")
D.table(['Étape', 'Action', 'Menu'], [
    ['1', "Se connecter avec le compte « admin » et choisir son mot de passe personnel", 'Connexion'],
    ['2', "Renseigner l'identité, l'en-tête officiel, le logo, l'année et les horaires", 'Établissement'],
    ['3', "Vérifier les dates des 6 séquences", 'Calendrier & clôtures'],
    ['4', "Vérifier les groupes et types de matière, puis ajouter les matières (bouton « programme officiel »)", 'Matières'],
    ['5', "Créer les classes (copie des matières pour les classes parallèles)", 'Classes'],
    ['6', "Créer les comptes enseignants et imprimer les fiches d'identifiants", 'Enseignants'],
    ['7', "Définir pour chaque classe : matières, coefficients, heures, enseignants", 'Attributions'],
    ['8', "Importer les listes d'élèves par classe", 'Élèves'],
    ['9', "Créer les responsables disciplinaires et leur affecter des classes", 'Resp. disciplinaires'],
    ['10', "Générer les emplois du temps, puis publier une annonce de lancement", 'Emplois du temps, Annonces']],
    widths=[1.4, 10.6, 4.6], font=9.5, caption='Check-list de mise en service')
D.h2('3.2 Tableau de bord')
D.figure(c('02_admin_tableau_de_bord.png'), "Tableau de bord de l'administrateur", max_h=14)
D.bullets([("Indicateurs : ", "élèves (garçons/filles), classes, enseignants, incidents de la séquence."),
           ("Saisie de la séquence en cours : ", "pourcentage global, matières validées par les enseignants, fiches disciplinaires validées."),
           ("Moyennes par classe : ", "dernière séquence clôturée ; une barre rouge signale une moyenne inférieure à 10."),
           ("Points d'attention : ", "matières sans enseignant, classes sans responsable, séquence échue non clôturée, comptes verrouillés… Cliquez pour corriger."),
           ("Activité récente : ", "dernières actions enregistrées dans le journal d'audit.")])
D.h2("3.3 Paramétrer l'établissement")
D.p("Menu **Établissement**. Les informations sont réparties en onglets ; cliquez sur **Enregistrer** dans chaque onglet.")
D.figure(c('03_admin_etablissement.png'), "Paramètres de l'établissement — onglet Identité", max_h=10)
D.table(['Onglet', 'Contenu'], [
    ['Identité', "Nom, sigle, matricule, type (lycée général, technique, bilingue, CES, CETIC, collège privé…), statut, sous-système, devise, acte de création, contacts."],
    ['En-tête officiel', "Région, département, ville, délégations régionale et départementale, intitulés du ministère en français et en anglais, titre et nom du chef d'établissement, censeur, surveillant général. Ces éléments composent l'en-tête de tous les PDF."],
    ['Logo', "Cliquez sur la zone ou déposez-y votre logo (PNG ou JPEG, 500 Ko maximum), vérifiez l'aperçu puis enregistrez."],
    ['Pédagogie', "Année scolaire, moyenne de réussite (10 par défaut), respect strict du calendrier (la saisie d'une séquence n'ouvre qu'à sa date de début)."],
    ['Horaires & jours', "Jours de cours (lundi à samedi) et créneaux horaires ; cochez « Pause » pour une récréation ou la pause déjeuner."]], widths=[3.2, 13.4], font=9.5)
D.figure(c('04_admin_horaires.png'), 'Onglet Horaires & jours', max_h=9)
D.h2('3.4 Calendrier et clôture des séquences')
D.figure(c('05_admin_calendrier.png'), 'Calendrier des séquences, regroupées par trimestre', max_h=10)
D.p("**Modifier les dates :** bouton **Dates** de la séquence. Les séquences ne doivent pas se chevaucher.", align='justify')
D.p("**Clôturer une séquence :** bouton **Clôturer**. L'application vérifie automatiquement que :")
D.bullets(["la séquence précédente est clôturée ;", "la date de fin de la séquence est atteinte ;",
           "toutes les notes de toutes les matières sont saisies **et validées** par les enseignants ;",
           "toutes les fiches disciplinaires sont **validées** par les responsables."])
D.figure(c('20_admin_cloture.png'), 'Confirmation de clôture avec option de forçage', max_h=8.5)
D.p("Si une condition manque, la clôture est refusée avec la liste des problèmes. Vous pouvez cocher **Forcer la clôture** : votre mot de passe "
    "est alors demandé et l'opération est inscrite au journal d'audit. **Clôturer le trimestre** clôture d'un coup ses deux séquences.", align='justify')
D.note("Une séquence clôturée est **verrouillée** : plus personne ne peut modifier ses notes, sa progression ou ses faits disciplinaires. En cas d'erreur, "
       "utilisez **Rouvrir** (mot de passe demandé), faites corriger, puis clôturez à nouveau.", 'info')
D.h2('3.5 Classes')
D.figure(c('06_admin_classes.png'), 'Gestion des classes', max_h=9)
D.p("Bouton **Nouvelle classe** : nom (ex. 2nde C1, Tle F3, Form 4 Sc), niveau, série/spécialité, cycle, salle, professeur principal. L'option "
    "**Copier les matières et coefficients de** une classe existante fait gagner beaucoup de temps pour les classes parallèles. Chaque carte donne "
    "accès aux élèves, aux matières et à l'emploi du temps de la classe. Une classe ne peut être supprimée que lorsqu'elle est vide.", align='justify')
D.h2('3.6 Matières, groupes et types de matière')
D.p("Le menu **Matières** comporte trois onglets. Chaque matière possède **deux caractéristiques indépendantes** :", align='justify')
D.bullets([("Le groupe : ", "il détermine le regroupement des matières sur le bulletin et les sous-totaux (Groupe 1, Groupe 2…), dans l'ordre de leur **position**."),
           ("Le type : ", "il indique la nature de la matière — Matière littéraire, Matière scientifique, Autre matière, ou tout type que vous ajoutez (ex. Matière technique). Il sert notamment aux statistiques par type.")])
D.p("Ainsi, une matière scientifique peut figurer dans n'importe quel groupe du bulletin, selon l'organisation de votre établissement.", align='justify')
D.h3('Onglet Matières')
D.figure(c('07_admin_matieres.png'), 'Catalogue des matières avec leur groupe et leur type', max_h=9.5)
D.numbered(["Cliquez sur **Nouvelle matière**.", "Saisissez l'intitulé et l'abréviation (utilisée dans l'emploi du temps et le procès-verbal).",
            "Choisissez le **groupe** puis le **type** dans leurs listes respectives.",
            "S'il manque un groupe ou un type, choisissez **➕ Nouveau groupe…** ou **➕ Nouveau type…** en bas de la liste : une petite fenêtre permet de le créer, et il est aussitôt sélectionné.",
            "Cliquez sur **Enregistrer**."])
D.figures_row([c('07e_admin_type_a_la_volee.png'), c('07b_admin_matiere_formulaire.png')], 'Création d\'un type à la volée, puis formulaire complété', width=8)
D.p("Le bouton **Ajouter le programme officiel** propose les disciplines courantes (enseignement général et technique) avec un groupe et un type par défaut, modifiables ensuite. "
    "La liste **Tous les types** filtre le catalogue. Une matière ne peut être supprimée si des notes ont déjà été saisies.", align='justify')
D.h3('Onglets Groupes et Types de matière')
D.figure(c('07c_admin_groupes.png'), 'Gestion des groupes', max_h=8.5)
D.bullets([("Ajouter : ", "bouton **Nouveau groupe** (libellé et position sur le bulletin) ou **Nouveau type** (libellé)."),
           ("Modifier : ", "icône crayon — renommez, ou changez la position d'un groupe pour réordonner le bulletin."),
           ("Supprimer : ", "icône corbeille, possible uniquement si aucune matière n'utilise le groupe ou le type. Réaffectez d'abord les matières concernées.")])
D.note("Par défaut, l'application propose les groupes **Groupe 1**, **Groupe 2**, **Groupe 3** et les types **Matière littéraire**, **Matière scientifique**, **Autre matière**. "
       "Lors de la mise à jour vers la version 1.1, les matières existantes ont été classées automatiquement (ancien groupe 1 → Groupe 1 / Matière littéraire, 2 → Groupe 2 / Matière scientifique, 3 → Groupe 3 / Autre matière).", 'info')
D.h2('3.7 Attributions (matières, coefficients, enseignants)')
D.figure(c('08_admin_attributions.png'), 'Attributions de la classe de 6e A', max_h=9)
D.numbered(["Choisissez la classe dans la liste.", "**Ajouter une matière** : matière, enseignant, coefficient, heures par semaine. Vous pouvez appliquer la même matière à plusieurs classes à la fois.",
            "Modifiez directement coefficient, heures ou enseignant dans le tableau : l'enregistrement est **automatique**.",
            "**Copier d'une autre classe** reprend les matières et coefficients (sans les enseignants)."])
D.p("Un enseignant ne voit que les classes et matières qui lui sont attribuées ici.")
D.h2('3.8 Élèves')
D.figure(c('09_admin_eleves.png'), 'Liste des élèves', max_h=9.5)
D.bullets([("Ajouter : ", "bouton **Nouvel élève** ; le matricule est généré automatiquement s'il est laissé vide (ex. 26LPEY0001)."),
           ("Rechercher : ", "par nom ou matricule ; filtrer par classe ou « Sans classe »."),
           ("Actions groupées : ", "cochez des élèves puis **Changer de classe** ou **Supprimer**."),
           ("Historique disciplinaire : ", "icône bouclier sur la ligne de l'élève."),
           ("Exporter : ", "bouton **Export** (fichier CSV pour Excel) ; **Liste PDF** pour imprimer la liste de classe.")])
D.h3('Importer une liste depuis Excel')
D.numbered(["Cliquez sur **Importer (CSV/Excel)** puis **Télécharger le modèle**.",
            "Remplissez le modèle dans Excel (une ligne par élève). Les dates peuvent être au format JJ/MM/AAAA.",
            "Enregistrez sous ▸ **CSV (séparateur : point-virgule)**.",
            "Choisissez éventuellement la classe par défaut, déposez le fichier, vérifiez l'aperçu, puis cliquez sur **Importer**.",
            "Un compte rendu indique les élèves créés, mis à jour (même matricule) et les lignes en erreur avec leur motif."])
D.table(['Colonne', 'Obligatoire', 'Exemple'], [['nom', 'Oui', 'MBALLA'], ['prenom', 'Non', 'Junior Arnaud'], ['sexe', 'Non', 'M ou F'],
    ['date_naissance', 'Non', '15/03/2012'], ['lieu_naissance', 'Non', 'Yaoundé'], ['classe', 'Non (sinon classe par défaut)', '6e A'],
    ['matricule', 'Non (généré)', '26LPEY0001'], ['redoublant', 'Non', 'oui / non'], ['parent_nom, parent_tel', 'Non', 'MBALLA Pierre, +237 699 00 00 00']],
    widths=[4.5, 5, 7.1], caption="Format du fichier d'import des élèves", font=9.5)
D.h2('3.9 Enseignants et comptes de connexion')
D.figure(c('10_admin_enseignants.png'), 'Liste des enseignants avec leurs attributions et l\'état des comptes', max_h=9.5)
D.numbered(["Cliquez sur **Nouvel enseignant** et saisissez le nom complet au format **NOM Prénom(s)** (ex. MBARGA Jean Paul), puis les autres informations.",
            "Cliquez sur **Créer le compte** : l'application génère un **identifiant** (mbargajp) et un **mot de passe facile à retenir** (ex. mangue-lion-482).",
            "Dans la fenêtre qui s'ouvre, cliquez sur **Imprimer les fiches (PDF)** et remettez la fiche à l'enseignant."])
D.figure(c('19_admin_identifiants.png'), 'Identifiants générés : copie et impression des fiches', max_h=9)
D.note("Le mot de passe n'est **jamais conservé en clair** : il n'est affiché qu'une seule fois. Si une fiche est perdue, utilisez **Réinitialiser le "
       "mot de passe**. Les identifiants générés pendant votre session restent accessibles via le bouton « Identifiants récents ».", 'warn')
D.p("Le menu **☰** de chaque ligne permet de : modifier, réinitialiser le mot de passe, désactiver/réactiver (ce qui déverrouille aussi un compte bloqué), "
    "voir l'emploi du temps, imprimer la fiche de progression, supprimer. En cochant plusieurs enseignants, **Réinitialiser les mots de passe et imprimer** "
    "produit toutes les fiches d'un coup (utile en début d'année). Le bouton **Importer** crée une liste de comptes depuis un fichier CSV "
    "(colonnes : nom ; prenom ; sexe ; matricule ; specialite ; phone ; email).", align='justify')
D.h2('3.10 Responsables disciplinaires')
D.figure(c('11_admin_responsables.png'), 'Responsables disciplinaires et classes à charge', max_h=8.5)
D.p("Même fonctionnement que pour les enseignants ; cochez en plus les **classes à charge**. L'identifiant commence par « sg. » (ex. sg.nguemap). "
    "Un responsable ne voit et ne modifie que ses classes.", align='justify')
D.h2('3.11 Emplois du temps')
D.figure(c('12_admin_edt.png'), "Emploi du temps d'une classe", max_h=10)
D.bullets([("Génération automatique : ", "répartit le volume horaire de chaque matière sur la semaine, par blocs, en évitant qu'un enseignant soit dans deux classes au même moment. Générez les classes l'une après l'autre."),
           ("Retouche manuelle : ", "cliquez sur une case, choisissez la matière et la salle. Les matières dont l'enseignant est déjà occupé sur ce créneau sont signalées ⚠ ; l'enregistrement est refusé en cas de conflit."),
           ("Volume horaire : ", "pour chaque matière, heures placées / heures dues (vert = complet)."),
           ("Vue par enseignant : ", "bouton « Par enseignant » en haut à droite ; **PDF** imprime l'emploi du temps affiché.")])
D.figure(c('21_admin_edt_case.png'), "Modification d'un créneau", max_h=8)
D.h2('3.12 Suivi des saisies')
D.figure(c('13_admin_suivi.png'), 'Suivi des saisies de la séquence', max_h=9.5)
D.p("Pour chaque classe et matière : notes saisies / effectif et état (en cours, complète, validée). Le filtre **À compléter** liste les retardataires ; "
    "**Ouvrir** affiche la grille de notes, que l'administrateur peut corriger tant que la séquence est ouverte. Le tableau du bas suit les fiches "
    "disciplinaires. **Exporter (CSV)** permet de diffuser l'état d'avancement.", align='justify')
D.h2('3.13 Résultats, bulletins et procès-verbaux')
D.figure(c('14_admin_resultats.png'), 'Résultats et classement de la classe', max_h=10)
D.numbered(["Choisissez la **classe** et la **période** : séquence, trimestre ou bilan annuel.",
            "Consultez les indicateurs (moyenne, réussite, extrêmes, effectif), le classement et les moyennes par matière.",
            "**Bulletins de la classe** génère un PDF avec un bulletin par élève (une page chacun) ; le bouton **Bulletin** d'une ligne génère le bulletin d'un seul élève.",
            "**Procès-verbal** produit le tableau récapitulatif du conseil de classe (au format paysage)."])
D.figure(c('pdf_bulletin.png'), 'Exemple de bulletin trimestriel généré', max_h=15)
D.h2('3.14 Statistiques')
D.figure(c('15_admin_statistiques.png'), "Statistiques de l'établissement", max_h=10)
D.p("Taux de réussite global, par classe, par matière, par **type de matière** (littéraires, scientifiques…), par sexe ; tableau d'honneur (10 meilleures moyennes) ; "
    "synthèse disciplinaire par classe. Changez la période en haut à droite.")
D.h2('3.15 Discipline et incidents')
D.p("Les menus **Discipline** et **Registre des incidents** donnent à l'administrateur les mêmes écrans que les responsables disciplinaires (chapitre 5), pour toutes les classes.")
D.h2('3.16 Annonces')
D.figure(c('16_admin_annonces.png'), 'Annonces', max_h=8)
D.p("**Nouvelle annonce** : titre, destinataires (tout le personnel, enseignants ou responsables) et message. L'annonce apparaît sur le tableau de bord des destinataires.")
D.h2("3.17 Journal d'audit")
D.figure(c('17_admin_audit.png'), "Journal d'audit", max_h=9)
D.p("Toutes les actions sensibles y sont enregistrées avec la date, l'utilisateur et l'adresse IP : connexions et échecs, saisies, validations, clôtures, "
    "créations et suppressions, exports de documents. Filtrez par mot-clé ; exportez en CSV pour archivage.", align='justify')
D.h2('3.18 Sauvegarde, restauration et nouvelle année')
D.figure(c('18_admin_sauvegarde.png'), 'Sauvegarde et année scolaire', max_h=9)
D.bullets([("Sauvegarder : ", "télécharge un fichier contenant toutes les données. Conservez-le hors du serveur (clé USB, Drive). Faites-le chaque semaine et avant chaque clôture. Le serveur réalise en plus une sauvegarde automatique toutes les 6 heures (14 jours conservés)."),
           ("Restaurer : ", "remplace toutes les données par celles d'un fichier de sauvegarde (mot de passe demandé, tous les utilisateurs sont déconnectés)."),
           ("Nouvelle année scolaire : ", "efface notes, progressions et discipline, rouvre les 6 séquences avec un nouveau calendrier ; conserve élèves, classes, matières, personnels et emplois du temps. Transférez ensuite les élèves dans leurs nouvelles classes (actions groupées).")])

# =============================================================== 4
D.h1("4. Guide de l'enseignant")
D.h2('4.1 Tableau de bord')
D.figure(c('23_enseignant_accueil.png'), "Tableau de bord de l'enseignant", max_h=12)
D.p("Vous y trouvez : vos classes et matières avec l'avancement de la saisie de la séquence en cours, le taux de couverture de votre programme, "
    "vos cours du jour et les annonces de l'administration. Chaque carte propose les boutons **Saisir**, **Relevé** et **Progression**.", align='justify')
D.h2('4.2 Saisir les notes')
D.figure(c('24_enseignant_saisie.png'), 'Grille de saisie des notes (ordinateur)', max_h=11)
D.numbered(["Menu **Saisie des notes** (ou bouton **Saisir** d'une carte).",
            "Choisissez la **classe/matière** et la **séquence** dans les listes en haut de la grille.",
            "Tapez chaque note sur 20 (virgule ou point, deux décimales au plus), puis **Entrée** pour passer à l'élève suivant.",
            "Pour un élève absent, cochez **Absent** ou tapez simplement la lettre **a**.",
            "Les statistiques (moyenne, minimum, maximum, réussite) et l'appréciation se mettent à jour en direct ; une note inférieure à 10 s'affiche en rouge.",
            "L'enregistrement est **automatique** quelques secondes après la saisie (bandeau en bas de l'écran). Vous pouvez aussi cliquer sur « Enregistrer maintenant ».",
            "Quand tous les élèves ont une note ou sont absents, cliquez sur **Valider la saisie**."])
D.figures_row([c('29_mobile_saisie_notes.png'), c('28_mobile_enseignant_accueil.png')], 'Saisie des notes et accueil sur smartphone', width=5.2)
D.table(['Astuce', 'Effet'], [
    ['Entrée ou ↓', "Passe à l'élève suivant"], ['↑', "Revient à l'élève précédent"], ['a', "Marque l'élève absent"],
    ['Coller (Ctrl+V) une colonne copiée depuis Excel', "Remplit automatiquement toute la liste à partir de l'élève sélectionné"],
    ['Effacer une note', "Laisse la case vide (l'élève redevient « sans note »)"]], widths=[7, 9.6], font=9.5, caption='Raccourcis de saisie')
D.note("**Coupure de réseau ?** Vos saisies sont conservées sur l'appareil. Au retour, l'application vous propose de les restaurer et de les envoyer. "
       "Ne fermez pas la page tant que le bandeau indique des modifications non enregistrées : un avertissement s'affiche si vous tentez de la quitter.", 'ok')
D.note("**Validation.** Valider signifie « mes notes sont définitives ». Toute modification ultérieure annule la validation : il faut alors valider à nouveau. "
       "Lorsque l'administration a **clôturé** la séquence, la grille est verrouillée.", 'info')
D.h2('4.3 Progression annuelle')
D.figure(c('25_enseignant_progression.png'), 'Progression annuelle', max_h=10)
D.p("Pour chaque classe/matière, indiquez par séquence le nombre de **leçons prévues** et de **leçons faites**, et une observation éventuelle "
    "(retard, difficulté). Le taux de couverture se calcule automatiquement. Cliquez sur **Enregistrer la progression**. Le bouton **Fiche de progression PDF** "
    "imprime le document à remettre à l'animateur pédagogique ou au censeur.", align='justify')
D.h2('4.4 Relevés de notes et exports PDF')
D.figure(c('26_enseignant_releves.png'), 'Relevés et exports', max_h=8.5)
D.p("Choisissez la **période** (séquence, trimestre ou année), puis **Relevé de notes** pour la classe voulue. Le relevé officiel comporte l'en-tête "
    "de l'établissement, les notes, les rangs, les appréciations, les statistiques de la classe et les zones de signature. Vous pouvez aussi imprimer "
    "la liste de classe, votre fiche de progression et votre emploi du temps.", align='justify')
D.figure(c('pdf_releve.png'), 'Exemple de relevé de notes', max_h=13)
D.h2('4.5 Mon emploi du temps')
D.figure(c('27_enseignant_edt.png'), "Emploi du temps de l'enseignant", max_h=9)

# =============================================================== 5
D.h1('5. Guide du responsable disciplinaire')
D.h2('5.1 Tableau de bord')
D.figure(c('31_discipline_accueil.png'), 'Tableau de bord du responsable disciplinaire', max_h=10)
D.p("Indicateurs de vos classes pour la séquence en cours (fiches validées, heures d'absence non justifiées, incidents) et accès direct à la saisie, "
    "aux fiches PDF et au registre de chaque classe.", align='justify')
D.h2('5.2 Saisir les faits disciplinaires')
D.figure(c('32_discipline_saisie.png'), "Fiche disciplinaire d'une classe", max_h=10)
D.numbered(["Menu **Saisie des faits**, choisissez la **classe** et la **séquence**.",
            "Pour chaque élève, renseignez : absences **justifiées** et **non justifiées** (en heures), **retards**, **consignes** (heures), "
            "**avertissement** et **blâme** de conduite (cases à cocher), **exclusion** (jours) et une **observation**.",
            "L'enregistrement est automatique ; les totaux de la classe se mettent à jour en haut de la fiche.",
            "Une fois la séquence terminée, cliquez sur **Valider la fiche**."])
D.figure(c('36_mobile_discipline.png'), 'Saisie disciplinaire sur smartphone', max_h=11)
D.h2('5.3 Signaler un incident')
D.figure(c('33_discipline_incident.png'), "Signalement d'un fait disciplinaire", max_h=9)
D.p("Bouton **Signaler un incident** : élève, date, séquence, nature du fait (absence non justifiée, indiscipline, bagarre, tricherie, tenue, téléphone…), "
    "gravité, sanction prononcée et description. Dans la fiche, le nombre d'incidents de chaque élève est cliquable et ouvre son **historique complet**, "
    "d'où vous pouvez imprimer sa fiche individuelle ou supprimer un incident saisi par erreur (tant que la séquence est ouverte).", align='justify')
D.h2('5.4 Registre des incidents')
D.figure(c('34_discipline_registre.png'), 'Registre des incidents', max_h=9)
D.h2('5.5 Fiches PDF')
D.figure(c('35_discipline_fiches.png'), 'Exports des fiches disciplinaires', max_h=8.5)
D.p("Choisissez la période puis **Fiche de classe** (format paysage, avec totaux et registre des incidents) ou **Fiches individuelles** pour imprimer "
    "la fiche d'un élève (synthèse des 6 séquences et incidents), par exemple pour une convocation des parents.", align='justify')
D.figure(c('pdf_discipline.png'), 'Exemple de fiche des faits disciplinaires', max_h=11)

# =============================================================== 6
D.h1('6. Documents officiels générés')
D.table(['Document', 'Contenu', 'Qui', 'Où'], [
    ['Bulletin de notes', "Notes par matière regroupées par groupe (avec sous-totaux), coefficients, rangs, moyenne de classe, résultats, profil de la classe, discipline, décision du conseil", 'Admin', 'Résultats & bulletins'],
    ['Procès-verbal', "Tableau récapitulatif de la classe : toutes les moyennes, rang, décision, statistiques", 'Admin', 'Résultats & bulletins'],
    ['Relevé de notes', "Notes d'une matière, rang, appréciation, statistiques", 'Enseignant, admin', 'Relevés & exports'],
    ['Fiche de progression', "Leçons prévues / faites par séquence et taux de couverture", 'Enseignant, admin', 'Progression, Enseignants'],
    ['Fiche disciplinaire de classe', "Absences, retards, consignes, sanctions, registre des incidents", 'Responsable, admin', 'Fiches PDF'],
    ['Fiche disciplinaire individuelle', "Synthèse des 6 séquences et incidents d'un élève", 'Responsable, admin', 'Fiches PDF, historique'],
    ['Emploi du temps', "Par classe ou par enseignant", 'Tous', 'Emplois du temps'],
    ['Liste de classe', "Élèves, matricules, naissance, contacts", 'Admin, enseignant', 'Élèves, Relevés'],
    ["Fiches d'identifiants", "Identifiant et mot de passe provisoire à découper", 'Admin', 'Enseignants, Responsables']],
    widths=[3.6, 7.4, 2.6, 3], font=9, caption='Documents PDF')
D.p("Tous les documents portent l'en-tête bilingue « République du Cameroun / Republic of Cameroon », le logo et les références de l'établissement, "
    "la date d'édition et la pagination. Ils s'ouvrent dans un nouvel onglet : utilisez ensuite **Imprimer** ou **Télécharger** de votre navigateur.", align='justify')

# =============================================================== 7
D.h1('7. Questions fréquentes et dépannage')
D.table(['Problème', 'Solution'], [
    ["« Identifiant ou mot de passe incorrect »", "Vérifiez la saisie (œil pour afficher le mot de passe), le clavier (majuscules). Après 5 erreurs, attendez 15 minutes ou demandez un déverrouillage à l'administrateur."],
    ["Je ne vois pas une de mes classes", "Elle ne vous est pas encore attribuée : contactez l'administrateur (menu Attributions ou classes à charge)."],
    ["La grille de notes est grisée, « séquence verrouillée »", "La séquence est clôturée, ou pas encore ouverte selon le calendrier. Contactez l'administration si une correction est nécessaire."],
    ["« Valider la saisie » est désactivé", "Certains élèves n'ont ni note ni mention Absent : complétez la liste."],
    ["Le bandeau indique une erreur d'enregistrement", "Votre connexion est coupée : les notes restent sur l'appareil. Réessayez avec « Enregistrer maintenant » dès le retour du réseau."],
    ["La clôture est refusée", "Lisez la liste des problèmes affichée ; consultez Suivi des saisies pour relancer les retardataires, ou forcez la clôture si nécessaire."],
    ["Le PDF ne s'ouvre pas", "Autorisez les fenêtres pop-up pour le site, ou maintenez le doigt sur le bouton et choisissez « Ouvrir dans un nouvel onglet »."],
    ["L'import d'élèves signale des erreurs", "Lisez le motif de chaque ligne (classe inconnue, date invalide…), corrigez le fichier et importez à nouveau : les élèves déjà importés sont mis à jour, pas dupliqués."],
    ["Session expirée", "Après 2 heures d'inactivité, reconnectez-vous ; les saisies non envoyées sont restaurées."]],
    widths=[5.6, 11], font=9.5)

# =============================================================== 8
D.h1('8. Bonnes pratiques de sécurité')
D.bullets(["Ne communiquez jamais votre mot de passe, même à un collègue ; l'administrateur n'en a pas besoin.",
           "Déconnectez-vous sur les ordinateurs partagés (salle des professeurs, cybercafé).",
           "Détruisez la fiche d'identifiants papier après avoir choisi votre mot de passe personnel.",
           "Administrateurs : téléchargez une sauvegarde chaque semaine, consultez le journal d'audit, désactivez immédiatement le compte d'un personnel qui quitte l'établissement.",
           "Les données des élèves sont personnelles et protégées par la loi n° 2024/017 du 23 décembre 2024 : n'exportez et n'imprimez que ce qui est nécessaire."])

# =============================================================== annexes
D.h1('Annexe A — Calcul des moyennes et des appréciations')
D.bullets(["**Moyenne d'une matière :** note de la séquence ; pour un trimestre, moyenne des deux séquences ; pour l'année, moyenne des trois trimestres. Un élève absent n'est pas noté dans la matière.",
           "**Moyenne générale :** somme des (moyenne × coefficient) divisée par la somme des coefficients des matières notées.",
           "**Rang :** les élèves de même moyenne sont classés ex æquo (1, 2, 2, 4…)."])
D.table(['Moyenne', 'Appréciation', 'Décision proposée'], [
    ['≥ 18', 'Excellent', "Tableau d'honneur + Félicitations"], ['16 à 17,99', 'Très bien', "Tableau d'honneur + Félicitations"],
    ['14 à 15,99', 'Bien', "Tableau d'honneur + Encouragements"], ['12 à 13,99', 'Assez bien', "Tableau d'honneur"],
    ['10 à 11,99', 'Passable', 'Travail acceptable'], ['8 à 9,99', 'Insuffisant', 'Avertissement travail'],
    ['5 à 7,99', 'Faible', 'Blâme travail'], ['< 5', 'Très faible', 'Blâme travail']], widths=[3.5, 4, 9.1], font=9.5)
D.p("La mention « Blâme conduite » est ajoutée en cas de blâme ou d'exclusion ; « Avertissement conduite » en cas d'avertissement ou d'au moins 10 heures d'absences non justifiées.")
D.h1('Annexe B — Comptes du mode démonstration')
D.p("L'instance de démonstration contient un établissement **fictif** (« Lycée Pilote EduGest de Yaoundé ») avec 6 classes, 181 élèves, 12 enseignants et "
    "2 responsables. Elle est réinitialisée régulièrement : ne l'utilisez pas pour de vraies données.", align='justify')
D.table(['Profil', 'Identifiant', 'Mot de passe'], [['Administrateur', 'admin', 'Admin@2026'], ['Enseignant (mathématiques)', 'mbargajp', 'Prof@2026'],
    ['Responsable disciplinaire', 'sg.nguemap', 'Disc@2026']], widths=[6, 5, 5.6], font=10)

out = os.path.join(ROOT, 'docs', 'Manuel_utilisation_EduGest_CM.docx')
D.save(out); print('OK', out)
