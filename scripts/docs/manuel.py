import sys, os, datetime
sys.path.insert(0, os.path.dirname(__file__))
from docgen import Doc

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CAP = os.path.join(ROOT, 'docs', 'captures'); c = lambda f: os.path.join(CAP, f)
today = datetime.date.today().strftime('%d/%m/%Y')
URL = sys.argv[1] if len(sys.argv) > 1 else "l'adresse communiquée par votre établissement"

D = Doc("Manuel d'utilisation — AI721 SchoolX CM", "Manuel d'utilisation")
D.cover("Manuel d'utilisation", 'AI721 SchoolX CM',
        "Guide pas à pas pour le super administrateur AI721, les administrateurs d'établissement, les enseignants et les responsables disciplinaires — sur ordinateur, tablette et smartphone",
        [('Application', 'AI721 SchoolX CM — notes, discipline, emplois du temps, assiduité et documents administratifs du personnel'), ('Version', '3.0 (anciennement EduGest CM)'), ('Date', today),
         ('Public', 'Super administrateur AI721 TECH STUFF, administrateurs (proviseurs, directeurs, censeurs), enseignants, surveillants généraux'),
         ('Éditeur', 'AI721 TECH STUFF'),
         ('Accès', URL)], logo=os.path.join(ROOT, 'public', 'img', 'icon-192.png'))
D.toc()

# =============================================================== 1
D.h1('1. Bienvenue dans AI721 SchoolX CM')
D.p("AI721 SchoolX CM est une plateforme proposée par **AI721 TECH STUFF** aux établissements, sur abonnement annuel. Chaque établissement abonné dispose de son propre espace, "
    "accessible du **1er septembre au 31 août** de l'année scolaire couverte.", align='justify')
D.p("AI721 SchoolX CM est la plateforme en ligne de votre établissement pour gérer les **notes**, les **faits disciplinaires** et les **emplois du temps**. "
    "Elle fonctionne dans un navigateur internet, sans installation, sur ordinateur, tablette et smartphone. Elle respecte l'organisation de l'année "
    "scolaire camerounaise : **6 séquences** regroupées en **3 trimestres**, notes sur 20, coefficients, rangs, conseils de classe.", align='justify')
D.note("**Nouveau en version 3.0 :** la plateforme s'appelle désormais **AI721 SchoolX CM** (vos adresses, identifiants et données ne changent pas). "
       "Elle gère aussi l'**assiduité des enseignants** (pointage, taux d'assiduité) et leurs **documents administratifs** : attestation de présence effective au poste, "
       "certificat de prise de service, rappel à l'ordre, lettre d'observation et demande d'explication, à laquelle l'enseignant peut répondre en ligne.", 'ok')
D.table(['Votre profil', 'Ce que vous pouvez faire', 'Chapitre'], [
    ['Super administrateur (AI721)', "Créer les établissements abonnés, enregistrer abonnements et paiements, transmettre et retrouver les accès des administrateurs", '3'],
    ['Administrateur', "Paramétrer l'établissement, créer les comptes et transmettre les accès, gérer élèves et classes, emplois du temps, clôtures, bulletins, statistiques, fin d'année, assiduité et documents administratifs des enseignants", '4'],
    ['Enseignant', "Saisir vos notes (par séquence ou par trimestre) et votre progression, valider vos saisies, imprimer vos relevés, consulter vos documents administratifs et votre assiduité, répondre à une demande d'explication", '5'],
    ['Responsable disciplinaire', "Saisir absences, retards et sanctions, signaler les incidents, imprimer les fiches", '6']],
    widths=[3.6, 11, 2], font=9.5)
D.p("Chaque profil dispose de **sa propre interface de connexion**, avec une adresse et des couleurs différentes :")
D.table(['Interface', 'Adresse', 'Pour qui'], [
    ['Console AI721 (indigo)', '/console', 'Le super administrateur AI721 TECH STUFF'],
    ['Administration (vert)', '/e/<code>/admin', "L'administrateur de l'établissement"],
    ['Enseignants (bleu)', '/e/<code>/enseignant', 'Les enseignants'],
    ['Vie scolaire (ambre)', '/e/<code>/discipline', 'Les responsables disciplinaires']], widths=[4.4, 5, 7.2], font=9.5,
    caption="Les interfaces de connexion (<code> = code de l'établissement, par exemple lpey)")
D.h2('1.1 Ce dont vous avez besoin')
D.bullets(["Un ordinateur, une tablette ou un smartphone avec un navigateur récent (Chrome, Edge, Firefox ou Safari).",
           "Une connexion internet (la 3G suffit). En cas de coupure pendant la saisie, vos notes sont conservées sur l'appareil et envoyées dès le retour du réseau.",
           f"L'adresse de l'application : **{URL}**.",
           "Le **lien de votre interface** et vos identifiants, transmis par l'administrateur (fiche imprimée, message WhatsApp ou SMS)."])
D.h2("1.2 Installer AI721 SchoolX CM comme une application (recommandé sur smartphone)")
D.table(['Appareil', 'Procédure'], [
    ['Android (Chrome)', "Ouvrez l'adresse de l'application ▸ menu ⋮ en haut à droite ▸ « Installer l'application » ou « Ajouter à l'écran d'accueil »."],
    ['iPhone / iPad (Safari)', "Ouvrez l'adresse ▸ bouton Partager ▸ « Sur l'écran d'accueil » ▸ Ajouter."],
    ['Ordinateur (Chrome / Edge)', "Cliquez sur l'icône d'installation à droite de la barre d'adresse."]], widths=[4.2, 12.4], font=9.5)
D.p("L'icône SchoolX apparaît alors avec vos autres applications et s'ouvre en plein écran.")

# =============================================================== 2
D.h1('2. Premiers pas')
D.h2('2.1 Se connecter')
D.p("Ouvrez le **lien de votre interface** (ou la page de votre établissement /e/<code>, puis choisissez votre espace). Chaque interface a sa propre page de connexion :")
D.figure(c('00b_choix_espace.png'), "Page d'accueil d'un établissement : choix de l'espace", max_h=8)
D.figures_row([c('01b_connexion_admin.png'), c('01c_connexion_enseignant.png')], 'Interfaces Administration (vert) et Enseignants (bleu)', width=8)
D.figures_row([c('01d_connexion_discipline.png'), c('01_connexion_console.png')], 'Interfaces Vie scolaire (ambre) et Console AI721 (indigo)', width=8)
D.numbered(["Saisissez votre **identifiant** (ex. mbargajp) — les majuscules n'ont pas d'importance.",
            "Saisissez votre **mot de passe** ; l'icône en forme d'œil permet de l'afficher pour vérifier la saisie.",
            "Cliquez sur **Se connecter**. Vous arrivez sur votre tableau de bord."])
D.note("**Sécurité :** après 5 mots de passe erronés, le compte est verrouillé pendant 15 minutes. L'administrateur peut le déverrouiller immédiatement. "
       "Le nombre d'essais restants s'affiche après chaque erreur.", 'warn')
D.p("Si vous utilisez la page d'une autre interface (par exemple un enseignant sur l'interface Administration), la connexion est refusée et le lien de **votre** interface vous est proposé. "
    "Si l'abonnement de l'établissement a expiré ou n'est pas réglé, la page de connexion l'indique : l'administration doit contacter AI721 TECH STUFF.", align='justify')
D.figures_row([c('01f_mauvaise_interface.png'), c('01e_abonnement_expire.png')], 'Mauvaise interface (à gauche) et abonnement expiré (à droite)', width=8)
D.h2('2.2 Votre mot de passe')
D.p("Le mot de passe qui vous a été remis est **facile à retenir** (deux mots et trois chiffres, ex. mangue-lion-482) et reste valable : vous pouvez l'utiliser tel quel. "
    "Il est conservé de façon chiffrée dans le **coffre des accès** de votre administrateur, qui peut vous le rappeler en cas d'oubli.", align='justify')
D.p("Vous pouvez aussi le remplacer par un mot de passe personnel (menu de votre compte ▸ **Changer mon mot de passe**). Dans ce cas il n'est **plus consultable** par personne : "
    "en cas d'oubli, l'administrateur vous en générera un nouveau.", align='justify')
D.numbered(["Saisissez votre mot de passe actuel.",
            "Choisissez un nouveau mot de passe d'au moins 8 caractères, avec au moins une lettre et un chiffre. La jauge indique sa robustesse.",
            "Confirmez-le puis cliquez sur **Valider**."])
D.p("Astuce : une courte phrase est à la fois facile à retenir et difficile à deviner, par exemple « Mon lycée 2026 ! ».")
D.h2('2.3 Mot de passe oublié')
D.bullets([("Enseignant ou responsable disciplinaire : ", "adressez-vous à l'administrateur de l'établissement. Il retrouve votre mot de passe généré dans son coffre des accès, ou vous en génère un nouveau, et vous le renvoie (fiche ou WhatsApp)."),
           ("Administrateur de l'établissement : ", "contactez AI721 TECH STUFF, qui retrouve vos accès dans son coffre ou génère un nouveau mot de passe."),
           ("Aucun mot de passe n'est envoyé par e-mail ", "et personne ne peut lire un mot de passe que vous avez choisi vous-même.")])
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

# =============================================================== 3 (nouveau) — console AI721
D.h1('3. Guide du super administrateur (AI721 TECH STUFF)')
D.p("La console AI721 (adresse /console) permet à l'éditeur de gérer les établissements abonnés : création, abonnements annuels, paiements, accès des administrateurs et suivi.", align='justify')
D.h2('3.1 Tableau de bord de la console')
D.figure(c('40_console_tableau_de_bord.png'), 'Tableau de bord de la console AI721', max_h=14)
D.bullets([("Indicateurs : ", "établissements abonnés (actifs / inactifs), élèves et enseignants gérés, recettes de l'année (et montant attendu), établissements à relancer."),
           ("Établissements : ", "abonnement en cours, statut (Actif, Expire dans n jours, Expiré, En attente de paiement, Suspendu), élèves, dernière activité, accès rapide aux identifiants."),
           ("Échéances & relances : ", "impayés, abonnements expirés ou expirant dans moins de 30 jours."),
           ("Recettes par année, répartition par région, activité récente ", "et **Liste PDF** de tous les établissements.")])
D.h2('3.2 Créer un établissement abonné')
D.numbered(["Menu **Établissements** ▸ **Nouvel établissement**.",
            "Renseignez le nom, le sigle (le **code** de l'adresse est proposé automatiquement, ex. ltk → /e/ltk), le type, le statut, la région, la ville et le contact (téléphone WhatsApp).",
            "Choisissez l'**année scolaire** de l'abonnement (valable du 1er septembre au 31 août), le **montant**, cochez **Paiement reçu** et indiquez le mode et la référence.",
            "Cliquez sur **Créer et générer les accès** : la base de l'établissement et le compte de son administrateur (identifiant admin.<code>, mot de passe facile à retenir) sont créés."])
D.figures_row([c('44_console_nouvel_etablissement.png'), c('44b_console_acces_generes.png')], "Création d'un établissement et accès générés", width=8)
D.h2("3.3 Transmettre et retrouver les accès d'un administrateur")
D.p("Le bouton **Accès** (ou l'icône clé) ouvre le coffre de l'établissement : identifiant et mot de passe de l'administrateur, et les **liens des trois interfaces**.", align='justify')
D.figure(c('43_console_acces.png'), "Coffre : accès de l'administrateur et liens de la plateforme", max_h=10)
D.bullets([("Fiche d'accès PDF : ", "document à remettre au chef d'établissement (lien, identifiants, liens à transmettre aux personnels, mise en route)."),
           ("Copier le message / WhatsApp : ", "message prêt à envoyer, avec les liens et les identifiants."),
           ("Nouveau mot de passe : ", "en cas d'oubli ou si l'administrateur a choisi son propre mot de passe (qui n'est alors plus consultable).")])
D.figure(c('pdf_fiche_acces.png'), "Fiche d'accès remise à l'administrateur", max_h=13)
D.h2('3.4 Fiche, abonnements et paiements')
D.figure(c('42_console_fiche.png'), "Fiche d'un établissement", max_h=14)
D.bullets([("Nouvel abonnement / renouvellement : ", "pour l'année suivante, avant le 31 août ; option « Générer de nouveaux identifiants » pour l'administrateur."),
           ("Encaisser : ", "menu **Abonnements & paiements** ▸ **Encaisser** sur un abonnement en attente ; l'accès est rétabli immédiatement."),
           ("Reçu : ", "reçu de paiement PDF numéroté pour chaque abonnement."),
           ("Suspendre / Réactiver : ", "bloque immédiatement toutes les connexions de l'établissement (sessions fermées)."),
           ("Supprimer : ", "retire l'établissement (mot de passe demandé) ; ses données sont archivées sur le serveur.")])
D.figure(c('45_console_abonnements.png'), 'Abonnements et paiements de l\'année', max_h=9)
D.figure(c('pdf_recu.png'), 'Reçu de paiement', max_h=11)
D.h2("3.5 Paramètres de l'entreprise et journal")
D.p("Le menu **Paramètres de l'entreprise** définit la raison sociale, les coordonnées, le RCCM, le NIU, le **tarif annuel par défaut** et la devise, repris sur les fiches d'accès et les reçus. "
    "Le **journal d'audit** trace les créations, paiements, consultations du coffre, réinitialisations et suspensions.", align='justify')
D.note("**Règle d'accès :** un établissement ne peut se connecter que si son abonnement couvre la date du jour, est **payé**, et si l'établissement n'est pas suspendu. "
       "Au 31 août, tous les accès sont bloqués jusqu'au renouvellement.", 'warn')

# =============================================================== 4
D.h1("4. Guide de l'administrateur")
D.h2('4.1 Mise en service en 10 étapes')
D.p("Pour démarrer l'année, suivez cet ordre. Chaque étape est détaillée dans les sections suivantes.")
D.table(['Étape', 'Action', 'Menu'], [
    ['1', "Ouvrir le lien « Administration » reçu d'AI721 TECH STUFF (fiche d'accès) et se connecter", 'Connexion'],
    ['2', "Renseigner l'identité, l'en-tête officiel, le logo, l'année et les horaires", 'Établissement'],
    ['3', "Vérifier les dates des 6 séquences", 'Calendrier & clôtures'],
    ['4', "Vérifier les groupes et types de matière, puis ajouter les matières (bouton « programme officiel »)", 'Matières'],
    ['5', "Créer les classes (copie des matières pour les classes parallèles)", 'Classes'],
    ['6', "Créer les comptes enseignants, puis transmettre à chacun le lien de son interface et ses identifiants", 'Enseignants, Coffre des accès'],
    ['7', "Définir pour chaque classe : matières, coefficients, heures, enseignants", 'Attributions'],
    ['8', "Importer les listes d'élèves par classe", 'Élèves'],
    ['9', "Créer les responsables disciplinaires et leur affecter des classes", 'Resp. disciplinaires'],
    ['10', "Générer les emplois du temps, puis publier une annonce de lancement", 'Emplois du temps, Annonces'],
    ['11', "Compléter le dossier administratif des enseignants (grade, prise de service, affectation) et les jours non ouvrés de l'année", 'Assiduité & pointage, dossier enseignant']],
    widths=[1.4, 10.6, 4.6], font=9.5, caption='Check-list de mise en service')
D.h2('4.2 Tableau de bord')
D.figure(c('02_admin_tableau_de_bord.png'), "Tableau de bord de l'administrateur", max_h=14)
D.bullets([("Indicateurs : ", "élèves (garçons/filles), classes, enseignants, incidents de la séquence."),
           ("Saisie de la séquence en cours : ", "pourcentage global, matières validées par les enseignants, fiches disciplinaires validées."),
           ("Moyennes par classe : ", "dernière séquence clôturée ; une barre rouge signale une moyenne inférieure à 10."),
           ("Points d'attention : ", "matières sans enseignant, classes sans responsable, séquence échue non clôturée, comptes verrouillés… Cliquez pour corriger."),
           ("Activité récente : ", "dernières actions enregistrées dans le journal d'audit.")])
D.h2("4.3 Paramétrer l'établissement")
D.p("Menu **Établissement**. Les informations sont réparties en onglets ; cliquez sur **Enregistrer** dans chaque onglet.")
D.figure(c('03_admin_etablissement.png'), "Paramètres de l'établissement — onglet Identité", max_h=10)
D.table(['Onglet', 'Contenu'], [
    ['Identité', "Nom, sigle, matricule, type (lycée général, technique, bilingue, CES, CETIC, collège privé…), statut, sous-système, devise, acte de création, contacts."],
    ['En-tête officiel', "Région, département, ville, délégations régionale et départementale, intitulés du ministère en français et en anglais, titre et nom du chef d'établissement, censeur, surveillant général. Ces éléments composent l'en-tête de tous les PDF."],
    ['Logo', "Cliquez sur la zone ou déposez-y votre logo (PNG ou JPEG, 500 Ko maximum), vérifiez l'aperçu puis enregistrez."],
    ['Pédagogie', "Année scolaire, moyenne de réussite (10 par défaut), respect strict du calendrier (la saisie d'une séquence n'ouvre qu'à sa date de début)."],
    ['Horaires & jours', "Jours de cours (lundi à samedi) et créneaux horaires ; cochez « Pause » pour une récréation ou la pause déjeuner."]], widths=[3.2, 13.4], font=9.5)
D.figure(c('04_admin_horaires.png'), 'Onglet Horaires & jours', max_h=9)
D.h2('4.4 Calendrier et clôture des séquences')
D.figure(c('05_admin_calendrier.png'), 'Calendrier des séquences, regroupées par trimestre', max_h=10)
D.p("**Modifier les dates :** bouton **Dates** de la séquence. Les séquences ne doivent pas se chevaucher.", align='justify')
D.p("**Clôturer une séquence :** bouton **Clôturer**. L'application vérifie automatiquement que :")
D.bullets(["la séquence précédente est clôturée ;", "la date de fin de la séquence est atteinte ;",
           "toutes les notes de toutes les matières sont saisies **et validées** par les enseignants ;",
           "toutes les fiches disciplinaires sont **validées** par les responsables."])
D.figure(c('20_admin_cloture.png'), 'Confirmation de clôture avec option de forçage', max_h=8.5)
D.p("Si une condition manque, la clôture est refusée avec la liste des problèmes. Vous pouvez cocher **Forcer la clôture** : votre mot de passe "
    "est alors demandé et l'opération est inscrite au journal d'audit. **Clôturer le trimestre** clôture d'un coup ses deux séquences.", align='justify')
D.h3("Clôture de l'année scolaire")
D.p("Après la clôture des trois trimestres, la carte **Clôture de l'année scolaire** (en bas de la page Calendrier & clôtures) produit les **statistiques annuelles** "
    "(rapport PDF archivé) et une **sauvegarde complète** conservée sur le serveur. Les années clôturées restent consultables (rapport et sauvegarde téléchargeables). "
    "La nouvelle année scolaire ne peut être démarrée qu'après cette clôture.", align='justify')
D.figure(c('20b_admin_cloture_annee.png'), "Clôture de l'année (mot de passe demandé)", max_h=8.5)
D.note("Une séquence clôturée est **verrouillée** : plus personne ne peut modifier ses notes, sa progression ou ses faits disciplinaires. En cas d'erreur, "
       "utilisez **Rouvrir** (mot de passe demandé), faites corriger, puis clôturez à nouveau.", 'info')
D.h2('4.5 Classes')
D.figure(c('06_admin_classes.png'), 'Gestion des classes', max_h=9)
D.p("Bouton **Nouvelle classe** : nom (ex. 2nde C1, Tle F3, Form 4 Sc), niveau, série/spécialité, cycle, salle, professeur principal. L'option "
    "**Copier les matières et coefficients de** une classe existante fait gagner beaucoup de temps pour les classes parallèles. Chaque carte donne "
    "accès aux élèves, aux matières et à l'emploi du temps de la classe. Une classe ne peut être supprimée que lorsqu'elle est vide.", align='justify')
D.h2('4.6 Matières, groupes et types de matière')
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
D.h2('4.7 Attributions (matières, coefficients, enseignants)')
D.figure(c('08_admin_attributions.png'), 'Attributions de la classe de 6e A', max_h=9)
D.numbered(["Choisissez la classe dans la liste.", "**Ajouter une matière** : matière, enseignant, coefficient, heures par semaine. Vous pouvez appliquer la même matière à plusieurs classes à la fois.",
            "Modifiez directement coefficient, heures ou enseignant dans le tableau : l'enregistrement est **automatique**.",
            "**Copier d'une autre classe** reprend les matières et coefficients (sans les enseignants)."])
D.p("Un enseignant ne voit que les classes et matières qui lui sont attribuées ici.")
D.h2('4.8 Élèves')
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
D.h2('4.9 Enseignants et comptes de connexion')
D.figure(c('10_admin_enseignants.png'), 'Liste des enseignants avec leurs attributions et l\'état des comptes', max_h=9.5)
D.numbered(["Cliquez sur **Nouvel enseignant** et saisissez le nom complet au format **NOM Prénom(s)** (ex. MBARGA Jean Paul), puis les autres informations.",
            "Cliquez sur **Créer le compte** : l'application génère un **identifiant** (mbargajp) et un **mot de passe facile à retenir** (ex. mangue-lion-482).",
            "Dans la fenêtre qui s'ouvre : **Imprimer les fiches (PDF)**, **Copier le message** ou **WhatsApp** pour transmettre à l'enseignant le **lien de l'interface Enseignants** et ses identifiants."])
D.figure(c('19_admin_identifiants.png'), 'Identifiants générés : copie et impression des fiches', max_h=9)
D.note("Le mot de passe généré est conservé **chiffré** dans votre **coffre des accès** (section 4.11) : vous pouvez le retrouver à tout moment, avec le lien de l'interface "
       "de l'utilisateur, et le lui renvoyer. S'il a choisi son propre mot de passe, celui-ci n'est pas consultable : utilisez **Réinitialiser le mot de passe**.", 'info')
D.p("Le menu **☰** de chaque ligne permet de : modifier, réinitialiser le mot de passe, désactiver/réactiver (ce qui déverrouille aussi un compte bloqué), "
    "voir l'emploi du temps, imprimer la fiche de progression, supprimer. En cochant plusieurs enseignants, **Réinitialiser les mots de passe et imprimer** "
    "produit toutes les fiches d'un coup (utile en début d'année). Le bouton **Importer** crée une liste de comptes depuis un fichier CSV "
    "(colonnes : nom ; prenom ; sexe ; matricule ; specialite ; phone ; email).", align='justify')
D.h2('4.10 Responsables disciplinaires')
D.figure(c('11_admin_responsables.png'), 'Responsables disciplinaires et classes à charge', max_h=8.5)
D.p("Même fonctionnement que pour les enseignants ; cochez en plus les **classes à charge**. L'identifiant commence par « sg. » (ex. sg.nguemap). "
    "Un responsable ne voit et ne modifie que ses classes.", align='justify')
D.h2('4.11 Coffre des accès et transmission des liens')
D.p("Le menu **Coffre des accès** rassemble les identifiants de tous vos enseignants et responsables disciplinaires, leurs **mots de passe générés** (chiffrés, affichés à la demande) "
    "et les **liens** de leurs interfaces. Il vous permet d'intervenir immédiatement en cas d'oubli.", align='justify')
D.figure(c('11c_admin_coffre_affiche.png'), 'Coffre des accès (un mot de passe affiché)', max_h=11)
D.bullets([("Liens : ", "les cartes du haut donnent les liens des interfaces Enseignants, Vie scolaire et Administration (bouton copier)."),
           ("Afficher : ", "révèle le mot de passe généré d'un compte (chaque consultation est enregistrée dans le journal d'audit)."),
           ("Envoyer : ", "ouvre une fenêtre avec le lien et les identifiants, un message prêt à copier et un bouton **WhatsApp**."),
           ("Personnel : ", "l'utilisateur a choisi son propre mot de passe ; il n'est pas consultable — utilisez ↻ pour en générer un nouveau."),
           ("Imprimer : ", "fiches PDF de la sélection ou de tous les comptes, avec le lien propre à chaque rôle.")])
D.figure(c('19_admin_identifiants.png'), 'Envoi des accès à un enseignant : lien, identifiants, message, WhatsApp', max_h=10)
D.h2('4.12 Emplois du temps')
D.figure(c('12_admin_edt.png'), "Emploi du temps d'une classe", max_h=10)
D.bullets([("Génération automatique : ", "répartit le volume horaire de chaque matière sur la semaine, par blocs, en évitant qu'un enseignant soit dans deux classes au même moment. Générez les classes l'une après l'autre."),
           ("Retouche manuelle : ", "cliquez sur une case, choisissez la matière et la salle. Les matières dont l'enseignant est déjà occupé sur ce créneau sont signalées ⚠ ; l'enregistrement est refusé en cas de conflit."),
           ("Volume horaire : ", "pour chaque matière, heures placées / heures dues (vert = complet)."),
           ("Vue par enseignant : ", "bouton « Par enseignant » en haut à droite ; **PDF** imprime l'emploi du temps affiché.")])
D.figure(c('21_admin_edt_case.png'), "Modification d'un créneau", max_h=8)
D.h2('4.13 Suivi des saisies')
D.figure(c('13_admin_suivi.png'), 'Suivi des saisies de la séquence', max_h=9.5)
D.p("La liste **Période** propose aussi les **trimestres** : les deux séquences du trimestre sont alors affichées côte à côte pour chaque matière et chaque fiche disciplinaire.", align='justify')
D.figure(c('13b_admin_suivi_trimestre.png'), 'Suivi des saisies du trimestre 1', max_h=9.5)
D.p("Pour chaque classe et matière : notes saisies / effectif et état (en cours, complète, validée). Le filtre **À compléter** liste les retardataires ; "
    "**Ouvrir** affiche la grille de notes, que l'administrateur peut corriger tant que la séquence est ouverte. Le tableau du bas suit les fiches "
    "disciplinaires. **Exporter (CSV)** permet de diffuser l'état d'avancement.", align='justify')
D.h2('4.14 Résultats, bulletins et procès-verbaux')
D.figure(c('14_admin_resultats.png'), 'Résultats et classement de la classe', max_h=10)
D.numbered(["Choisissez la **classe** et la **période** : séquence, trimestre ou bilan annuel.",
            "Consultez les indicateurs (moyenne, réussite, extrêmes, effectif), le classement et les moyennes par matière.",
            "**Bulletins de la classe** génère un PDF avec un bulletin par élève (une page chacun) ; le bouton **Bulletin** d'une ligne génère le bulletin d'un seul élève.",
            "**Procès-verbal** produit le tableau récapitulatif du conseil de classe (au format paysage)."])
D.figure(c('pdf_bulletin.png'), 'Exemple de bulletin trimestriel généré', max_h=15)
D.h2('4.15 Statistiques')
D.figure(c('15_admin_statistiques.png'), "Statistiques de l'établissement", max_h=10)
D.p("Le bouton **Exporter en PDF** produit le rapport statistique de la période choisie (séquence, trimestre ou année) pour exploitation : résultats par classe, par matière, "
    "par type de matière, tableau d'honneur et discipline.", align='justify')
D.figure(c('pdf_statistiques.png'), 'Rapport statistique PDF (trimestre 1)', max_h=13)
D.p("Taux de réussite global, par classe, par matière, par **type de matière** (littéraires, scientifiques…), par sexe ; tableau d'honneur (10 meilleures moyennes) ; "
    "synthèse disciplinaire par classe. Changez la période en haut à droite.")
D.h2('4.16 Discipline et incidents')
D.p("Les menus **Discipline** et **Registre des incidents** donnent à l'administrateur les mêmes écrans que les responsables disciplinaires (chapitre 6), pour toutes les classes.")
D.h2('4.17 Annonces')
D.figure(c('16_admin_annonces.png'), 'Annonces', max_h=8)
D.p("**Nouvelle annonce** : titre, destinataires (tout le personnel, enseignants ou responsables) et message. L'annonce apparaît sur le tableau de bord des destinataires.")
D.h2("4.18 Journal d'audit")
D.figure(c('17_admin_audit.png'), "Journal d'audit", max_h=9)
D.p("Toutes les actions sensibles y sont enregistrées avec la date, l'utilisateur et l'adresse IP : connexions et échecs, saisies, validations, clôtures, "
    "créations et suppressions, exports de documents. Filtrez par mot-clé ; exportez en CSV pour archivage.", align='justify')
D.h2('4.19 Sauvegarde, restauration et nouvelle année')
D.figure(c('18_admin_sauvegarde.png'), 'Sauvegarde et année scolaire', max_h=9)
D.bullets([("Sauvegarder : ", "télécharge un fichier contenant toutes les données. Conservez-le hors du serveur (clé USB, Drive). Faites-le chaque semaine et avant chaque clôture. Le serveur réalise en plus une sauvegarde automatique toutes les 6 heures (14 jours conservés)."),
           ("Restaurer : ", "remplace toutes les données par celles d'un fichier de sauvegarde (mot de passe demandé, tous les utilisateurs sont déconnectés)."),
           ("Nouvelle année scolaire : ", "possible après la clôture de l'année ; efface notes, progressions, discipline et pointage des enseignants, rouvre les 6 séquences avec un nouveau calendrier ; conserve élèves, classes, matières, personnels, emplois du temps et le registre des documents administratifs. Transférez ensuite les élèves dans leurs nouvelles classes (actions groupées).")])

D.h2('4.20 Assiduité du personnel enseignant et pointage')
D.p("Le menu **Assiduité & pointage** (groupe Personnel) mesure la **présence effective** des enseignants. Les **heures dues** sont calculées automatiquement à partir de "
    "l'**emploi du temps** de chaque enseignant, pour chaque jour de classe de la période (hors week-ends, vacances entre les séquences et jours non ouvrés). "
    "Les absences et retards enregistrés donnent les **heures effectuées** et le **taux d'assiduité**.", align='justify')
D.h3("Onglet Taux d'assiduité")
D.figure(c('47_admin_assiduite.png'), "Taux d'assiduité des enseignants (cumul de l'année)", max_h=15)
D.bullets([("Période : ", "année (cumul à ce jour), trimestre, séquence ou mois."),
           ("Indicateurs : ", "taux global de l'établissement, heures d'absence non justifiées, retards, nombre d'enseignants sous 80 %."),
           ("Tableau : ", "pour chaque enseignant, heures dues, effectuées, absences justifiées et non justifiées, retards, taux (barre verte ≥ 90 %, orange ≥ 70 %, rouge en dessous) et documents déjà émis ; cliquez sur un nom pour ouvrir son dossier."),
           ("État d'assiduité (PDF) : ", "tableau officiel de tous les enseignants pour la période, à transmettre à la hiérarchie.")])
D.figure(c('pdf_etat_assiduite.png'), "État d'assiduité du personnel enseignant (PDF)", max_w=16, max_h=11)
D.h3('Onglet Pointage journalier')
D.p("Chaque jour, ouvrez **Pointage du jour** : la liste des cours prévus à l'emploi du temps s'affiche, regroupée par horaire (classe, matière, enseignant). "
    "Chaque cours est **présumé assuré** : ne marquez que les exceptions.", align='justify')
D.numbered(["Choisissez la date (flèches ‹ › ou calendrier ; une date future n'est pas possible).",
            "Pour un cours non assuré, cliquez sur **Absent** ; pour un retard, cliquez sur **Retard** et indiquez les minutes.",
            "Cochez **Justifié** si l'absence est couverte par une pièce (certificat médical, convocation…) et précisez le motif.",
            "Le champ **Filtrer** retrouve rapidement un enseignant ou une classe.",
            "Cliquez sur **Enregistrer le pointage**."])
D.figure(c('48_admin_pointage.png'), 'Pointage journalier : une absence et un retard marqués', max_h=12)
D.h3('Onglets Absences & retards et Jours non ouvrés')
D.p("Le bouton **Absence / retard** enregistre une absence en dehors du pointage : quelques heures un jour donné, une **journée entière** ou une **période de plusieurs jours** "
    "(les heures prévues à l'emploi du temps de chaque jour sont alors décomptées), ou un retard. L'onglet **Absences & retards** liste tous les enregistrements de la période : "
    "l'interrupteur **Justifiée** se modifie directement, le crayon change le motif, la corbeille supprime une saisie erronée.", align='justify')
D.figure(c('49_admin_absences.png'), 'Absences et retards de la période', max_h=10)
D.p("L'onglet **Jours non ouvrés** contient les fêtes légales à date fixe, ajoutées automatiquement chaque année. Ajoutez-y les fêtes mobiles (Vendredi saint, Ascension, "
    "Djouldé Soumaé, Fête du Mouton) et les journées banalisées : ces jours ne sont pas dus.", align='justify')
D.figure(c('50_admin_jours_non_ouvres.png'), 'Jours non ouvrés', max_h=8)

D.h2("4.21 Dossier administratif d'un enseignant")
D.p("Ouvrez le dossier depuis le tableau d'assiduité (clic sur le nom) ou depuis **Enseignants** ▸ menu ☰ ▸ **Dossier administratif & assiduité**.", align='justify')
D.figure(c('51_admin_dossier_enseignant.png'), "Dossier d'un enseignant : situation administrative, assiduité, documents", max_h=15)
D.bullets([("Situation administrative : ", "bouton **Dossier** pour renseigner matricule, grade (PLEG, PCEG, PLET, PCET, PEPS…), statut, diplôme, fonction, date et lieu de naissance, **date de prise de service** et **acte d'affectation**. Ces informations figurent sur les documents."),
           ("Assiduité : ", "taux, heures dues et effectuées, absences, retards et détail par séquence pour la période choisie ; bouton **Relevé** pour le relevé d'assiduité PDF."),
           ("Absences et retards : ", "historique de la période, avec ajout rapide."),
           ("Documents administratifs : ", "tous les documents émis à son nom, et le bouton **Émettre un document**.")])

D.h2('4.22 Documents administratifs du personnel')
D.p("Le menu **Documents administratifs** est le **registre** de tous les documents émis pour les enseignants. Cinq documents sont disponibles :", align='justify')
D.table(['Document', 'Contenu', 'Réf.'], [
    ['Attestation de présence effective au poste', "Atteste que l'enseignant est présent à son poste, avec le tableau d'assiduité de la période (par séquence), le taux et son appréciation.", 'APE'],
    ['Certificat de prise de service', "Certifie la date de prise de service, avec le grade, le matricule, l'acte d'affectation et la fonction.", 'CPS'],
    ["Rappel à l'ordre", "Courrier listant les manquements constatés et invitant l'enseignant à se ressaisir.", 'RO'],
    ["Lettre d'observation", "Courrier plus sévère, versé au dossier administratif ; peut citer une demande d'explication en référence.", 'LO'],
    ["Demande d'explication", "Courrier listant les faits reprochés, avec un délai de réponse et un **espace de réponse pour l'intéressé(e)**, puis un cadre « suite réservée ».", 'DE']],
    widths=[4.6, 10.4, 1.6], font=9.5, caption='Les documents administratifs')
D.figure(c('52_admin_documents.png'), 'Registre des documents administratifs', max_h=12)
D.h3('Émettre un document')
D.numbered(["Cliquez sur **Nouveau document** et choisissez le type (ou, depuis le dossier, **Émettre un document**).",
            "Choisissez l'enseignant et vérifiez la date du document.",
            "Attestation de présence : choisissez la **période** ; le taux calculé s'affiche avant l'émission. Certificat de prise de service : la date de prise de service doit être renseignée (bouton **Compléter le dossier**).",
            "Courriers : précisez l'objet et rédigez les **faits**, un par ligne. Cliquez sur une proposition de la rubrique **Faits constatés dans la plateforme** (absences non justifiées, retards, notes non validées, progression en retard) ou des **Motifs usuels** pour l'ajouter.",
            "Demande d'explication : choisissez le **délai de réponse** (72 heures par défaut). Lettre d'observation : choisissez éventuellement la demande d'explication **en référence**.",
            "Vérifiez les **ampliations** (copies), puis cliquez sur **Émettre le document** et **Ouvrir le PDF** pour l'imprimer, le signer et y apposer le cachet."])
D.figure(c('53_admin_nouveau_document.png'), "Rédaction d'une demande d'explication avec les faits proposés", max_h=12)
D.figure(c('56_admin_presence_effective.png'), "Attestation de présence effective : aperçu du taux de la période", max_h=12)
D.p("Chaque document reçoit une **référence** unique, numérotée par type et par année (ex. N° 004/2026-2027/LPEY/P/DE). L'identité de l'enseignant, le signataire et, "
    "pour l'attestation, les chiffres d'assiduité sont **figés** au moment de l'émission.", align='justify')
D.figures_row([c('pdf_doc_presence.png'), c('pdf_doc_prise_service.png')], 'Attestation de présence effective et certificat de prise de service', width=8)
D.figures_row([c('pdf_doc_rappel_ordre.png'), c('pdf_doc_observation.png')], "Rappel à l'ordre et lettre d'observation", width=8)
D.figures_row([c('pdf_doc_demande_explication_vierge_p1.png'), c('pdf_doc_demande_explication_vierge_p2.png')], "Demande d'explication : courrier et espace de réponse à remplir à la main", width=8)
D.h3('Suivre un document : remise, réponse, suite')
D.p("Le bouton **Ouvrir** d'une ligne affiche la fiche du document :", align='justify')
D.bullets([("Remis en main propre : ", "enregistre la date de remise. Pour une demande d'explication, le **délai de réponse court à partir de cette date** (ou de la lecture par l'enseignant dans son espace)."),
           ("Modifier : ", "possible tant que le document n'a pas été remis."),
           ("Réponse de l'intéressé(e) : ", "si l'enseignant a répondu en ligne, sa réponse s'affiche ici et figure dans l'espace de réponse du PDF ; sinon, il répond à la main sur le document imprimé."),
           ("Suite réservée : ", "votre décision (classement, lettre d'observation…) ; elle clôt le dossier et apparaît sur le PDF et dans l'espace de l'enseignant."),
           ("Lettre d'observation : ", "émet directement une lettre d'observation en référence à la demande d'explication."),
           ("Annuler : ", "avec un motif ; le document reste au registre avec la mention « Annulé » et son numéro n'est pas réattribué.")])
D.figure(c('55_admin_document_fiche.png'), "Fiche d'une demande d'explication : réponse de l'enseignant et suite réservée", max_h=12)
D.figures_row([c('pdf_doc_demande_explication_p1.png'), c('pdf_doc_demande_explication_p2.png')], "Demande d'explication avec la réponse transmise en ligne et la suite réservée", width=8)
D.p("Le **tableau de bord** signale les demandes d'explication restées sans réponse dans le délai et les réponses à examiner. Le bouton **Registre (PDF)** imprime le registre annuel.", align='justify')

# =============================================================== 4
D.h1("5. Guide de l'enseignant")
D.h2('5.1 Tableau de bord')
D.figure(c('23_enseignant_accueil.png'), "Tableau de bord de l'enseignant", max_h=12)
D.p("Vous y trouvez : vos classes et matières avec l'avancement de la saisie de la séquence en cours, le taux de couverture de votre programme, "
    "vos cours du jour et les annonces de l'administration. Chaque carte propose les boutons **Saisir**, **Relevé** et **Progression**.", align='justify')
D.h2('5.2 Saisir les notes')
D.figure(c('24_enseignant_saisie.png'), 'Grille de saisie des notes (ordinateur)', max_h=11)
D.numbered(["Menu **Saisie des notes** (ou bouton **Saisir** d'une carte).",
            "Choisissez la **classe/matière** et la **séquence** dans les listes en haut de la grille.",
            "Tapez chaque note sur 20 (virgule ou point, deux décimales au plus), puis **Entrée** pour passer à l'élève suivant.",
            "Pour un élève absent, cochez **Absent** ou tapez simplement la lettre **a**.",
            "Les statistiques (moyenne, minimum, maximum, réussite) et l'appréciation se mettent à jour en direct ; une note inférieure à 10 s'affiche en rouge.",
            "L'enregistrement est **automatique** quelques secondes après la saisie (bandeau en bas de l'écran). Vous pouvez aussi cliquer sur « Enregistrer maintenant ».",
            "Quand tous les élèves ont une note ou sont absents, cliquez sur **Valider la saisie**."])
D.figures_row([c('29_mobile_saisie_notes.png'), c('28_mobile_enseignant_accueil.png')], 'Saisie des notes et accueil sur smartphone', width=5.2)
D.h3('Saisie par trimestre')
D.p("Dans la liste **Période**, choisissez « Trimestre n — séquences … » (ou le bouton **Trimestre** d'une carte de l'accueil) : les **deux séquences** du trimestre "
    "s'affichent côte à côte avec la **moyenne trimestrielle** de chaque élève, calculée en direct. Une séquence déjà clôturée reste visible mais verrouillée (cadenas). "
    "**Valider le trimestre** valide d'un coup les séquences ouvertes complètes.", align='justify')
D.figure(c('24b_enseignant_saisie_trimestre.png'), 'Saisie par trimestre : séquences 1 et 2 et moyenne trimestrielle', max_h=10)
D.table(['Astuce', 'Effet'], [
    ['Entrée ou ↓', "Passe à l'élève suivant"], ['↑', "Revient à l'élève précédent"], ['a', "Marque l'élève absent"],
    ['Coller (Ctrl+V) une colonne copiée depuis Excel', "Remplit automatiquement toute la liste à partir de l'élève sélectionné"],
    ['Effacer une note', "Laisse la case vide (l'élève redevient « sans note »)"]], widths=[7, 9.6], font=9.5, caption='Raccourcis de saisie')
D.note("**Coupure de réseau ?** Vos saisies sont conservées sur l'appareil. Au retour, l'application vous propose de les restaurer et de les envoyer. "
       "Ne fermez pas la page tant que le bandeau indique des modifications non enregistrées : un avertissement s'affiche si vous tentez de la quitter.", 'ok')
D.note("**Validation.** Valider signifie « mes notes sont définitives ». Toute modification ultérieure annule la validation : il faut alors valider à nouveau. "
       "Lorsque l'administration a **clôturé** la séquence, la grille est verrouillée.", 'info')
D.h2('5.3 Progression annuelle')
D.figure(c('25_enseignant_progression.png'), 'Progression annuelle', max_h=10)
D.p("Pour chaque classe/matière, indiquez par séquence le nombre de **leçons prévues** et de **leçons faites**, et une observation éventuelle "
    "(retard, difficulté). Le taux de couverture se calcule automatiquement. Cliquez sur **Enregistrer la progression**. Le bouton **Fiche de progression PDF** "
    "imprime le document à remettre à l'animateur pédagogique ou au censeur.", align='justify')
D.h2('5.4 Relevés de notes et exports PDF')
D.figure(c('26_enseignant_releves.png'), 'Relevés et exports', max_h=8.5)
D.p("Choisissez la **période** (séquence, trimestre ou année), puis **Relevé de notes** pour la classe voulue. Le relevé officiel comporte l'en-tête "
    "de l'établissement, les notes, les rangs, les appréciations, les statistiques de la classe et les zones de signature. Vous pouvez aussi imprimer "
    "la liste de classe, votre fiche de progression et votre emploi du temps.", align='justify')
D.figure(c('pdf_releve.png'), 'Exemple de relevé de notes', max_h=13)
D.h2('5.5 Mon emploi du temps')
D.figure(c('27_enseignant_edt.png'), "Emploi du temps de l'enseignant", max_h=9)
D.h2('5.6 Mes documents administratifs et mon assiduité')
D.p("Le menu **Mes documents & assiduité** rassemble les documents émis à votre nom par le chef d'établissement (attestations, certificats, courriers) et votre assiduité. "
    "Un bandeau sur votre tableau de bord signale un document non lu ou une demande d'explication en attente de réponse.", align='justify')
D.figure(c('57_enseignant_documents.png'), 'Mes documents administratifs et mon assiduité', max_h=12)
D.bullets([("Lire le document : ", "ouvre le PDF officiel. L'ouverture vaut **accusé de réception**."),
           ("Accuser réception : ", "confirme que vous avez pris connaissance du document ; pour une demande d'explication, le délai de réponse court à partir de ce moment."),
           ("Mon assiduité : ", "votre taux d'assiduité, vos heures dues et effectuées, vos absences et retards pour la période choisie, et votre **relevé d'assiduité** PDF. En cas d'erreur, signalez-la à l'administration.")])
D.h3("Répondre à une demande d'explication")
D.numbered(["Cliquez sur **Répondre** sous la demande d'explication.",
            "Rédigez votre réponse (6 000 caractères au plus) ; elle est conservée sur l'appareil si vous fermez la fenêtre avant l'envoi.",
            "Cliquez sur **Transmettre ma réponse** puis confirmez. **La réponse est définitive** : elle ne peut plus être modifiée.",
            "Votre réponse apparaît dans l'espace « Réponse de l'intéressé(e) » du document ; la suite réservée par le chef d'établissement s'affichera ensuite sous le document."])
D.figure(c('58_enseignant_reponse.png'), "Réponse en ligne à une demande d'explication", max_h=11)
D.note("Vous pouvez aussi répondre **à la main** dans l'espace prévu sur le document imprimé, puis le remettre signé à l'administration. "
       "Respectez le délai indiqué : une réponse transmise après l'échéance est signalée « hors délai ».", 'info')
D.figure(c('60_mobile_enseignant_documents.png'), 'Mes documents sur smartphone', max_h=11)

# =============================================================== 5
D.h1('6. Guide du responsable disciplinaire')
D.h2('6.1 Tableau de bord')
D.figure(c('31_discipline_accueil.png'), 'Tableau de bord du responsable disciplinaire', max_h=10)
D.p("Indicateurs de vos classes pour la séquence en cours (fiches validées, heures d'absence non justifiées, incidents) et accès direct à la saisie, "
    "aux fiches PDF et au registre de chaque classe.", align='justify')
D.h2('6.2 Saisir les faits disciplinaires')
D.figure(c('32_discipline_saisie.png'), "Fiche disciplinaire d'une classe", max_h=10)
D.numbered(["Menu **Saisie des faits**, choisissez la **classe** et la **séquence**.",
            "Pour chaque élève, renseignez : absences **justifiées** et **non justifiées** (en heures), **retards**, **consignes** (heures), "
            "**avertissement** et **blâme** de conduite (cases à cocher), **exclusion** (jours) et une **observation**.",
            "L'enregistrement est automatique ; les totaux de la classe se mettent à jour en haut de la fiche.",
            "Une fois la séquence terminée, cliquez sur **Valider la fiche**."])
D.figure(c('36_mobile_discipline.png'), 'Saisie disciplinaire sur smartphone', max_h=11)
D.p("En choisissant un **trimestre** dans la liste des périodes, vous obtenez le **récapitulatif** des deux séquences (absences, retards, sanctions, incidents) en lecture seule, "
    "et la fiche PDF du trimestre. La saisie se fait toujours par séquence, car chaque fait est daté.", align='justify')
D.figure(c('32b_discipline_recap_trimestre.png'), 'Récapitulatif disciplinaire du trimestre 1', max_h=9.5)
D.h2('6.3 Signaler un incident')
D.figure(c('33_discipline_incident.png'), "Signalement d'un fait disciplinaire", max_h=9)
D.p("Bouton **Signaler un incident** : élève, date, séquence, nature du fait (absence non justifiée, indiscipline, bagarre, tricherie, tenue, téléphone…), "
    "gravité, sanction prononcée et description. Dans la fiche, le nombre d'incidents de chaque élève est cliquable et ouvre son **historique complet**, "
    "d'où vous pouvez imprimer sa fiche individuelle ou supprimer un incident saisi par erreur (tant que la séquence est ouverte).", align='justify')
D.h2('6.4 Registre des incidents')
D.figure(c('34_discipline_registre.png'), 'Registre des incidents', max_h=9)
D.h2('6.5 Fiches PDF')
D.figure(c('35_discipline_fiches.png'), 'Exports des fiches disciplinaires', max_h=8.5)
D.p("Choisissez la période puis **Fiche de classe** (format paysage, avec totaux et registre des incidents) ou **Fiches individuelles** pour imprimer "
    "la fiche d'un élève (synthèse des 6 séquences et incidents), par exemple pour une convocation des parents.", align='justify')
D.figure(c('pdf_discipline.png'), 'Exemple de fiche des faits disciplinaires', max_h=11)

# =============================================================== 6
D.h1('7. Documents officiels générés')
D.table(['Document', 'Contenu', 'Qui', 'Où'], [
    ['Bulletin de notes', "Notes par matière regroupées par groupe (avec sous-totaux), coefficients, rangs, moyenne de classe, résultats, profil de la classe, discipline, décision du conseil", 'Admin', 'Résultats & bulletins'],
    ['Procès-verbal', "Tableau récapitulatif de la classe : toutes les moyennes, rang, décision, statistiques", 'Admin', 'Résultats & bulletins'],
    ['Relevé de notes', "Notes d'une matière, rang, appréciation, statistiques", 'Enseignant, admin', 'Relevés & exports'],
    ['Fiche de progression', "Leçons prévues / faites par séquence et taux de couverture", 'Enseignant, admin', 'Progression, Enseignants'],
    ['Fiche disciplinaire de classe', "Absences, retards, consignes, sanctions, registre des incidents", 'Responsable, admin', 'Fiches PDF'],
    ['Fiche disciplinaire individuelle', "Synthèse des 6 séquences et incidents d'un élève", 'Responsable, admin', 'Fiches PDF, historique'],
    ['Emploi du temps', "Par classe ou par enseignant", 'Tous', 'Emplois du temps'],
    ['Liste de classe', "Élèves, matricules, naissance, contacts", 'Admin, enseignant', 'Élèves, Relevés'],
    ["Fiches d'identifiants", "Identifiant et mot de passe provisoire à découper", 'Admin', 'Enseignants, Responsables'],
    ['Attestation de présence effective au poste', "Présence à son poste, tableau d'assiduité de la période, taux et appréciation", 'Admin (enseignant : lecture)', 'Documents administratifs'],
    ['Certificat de prise de service', "Date de prise de service, grade, matricule, acte d'affectation, fonction", 'Admin (enseignant : lecture)', 'Documents administratifs'],
    ["Rappel à l'ordre, lettre d'observation", "Courriers numérotés : manquements, formules réglementaires, ampliations", 'Admin (enseignant : lecture)', 'Documents administratifs'],
    ["Demande d'explication", "Faits reprochés, délai, espace de réponse de l'intéressé(e), suite réservée", 'Admin ; réponse de l\'enseignant', 'Documents administratifs, Mes documents'],
    ["État et relevé d'assiduité", "Heures dues, effectuées, absences, retards, taux : tous les enseignants ou un seul", 'Admin, enseignant (le sien)', 'Assiduité, dossier, Mes documents'],
    ['Registre des documents administratifs', "Tous les documents de l'année avec leur statut", 'Admin', 'Documents administratifs']],
    widths=[3.6, 7.4, 2.6, 3], font=9, caption='Documents PDF')
D.p("Tous les documents portent l'en-tête bilingue « République du Cameroun / Republic of Cameroon », le logo et les références de l'établissement, "
    "la date d'édition et la pagination. Ils s'ouvrent dans un nouvel onglet : utilisez ensuite **Imprimer** ou **Télécharger** de votre navigateur.", align='justify')

# =============================================================== 7
D.h1('8. Questions fréquentes et dépannage')
D.table(['Problème', 'Solution'], [
    ["« Identifiant ou mot de passe incorrect »", "Vérifiez la saisie (œil pour afficher le mot de passe), le clavier (majuscules). Après 5 erreurs, attendez 15 minutes ou demandez un déverrouillage à l'administrateur."],
    ["Je ne vois pas une de mes classes", "Elle ne vous est pas encore attribuée : contactez l'administrateur (menu Attributions ou classes à charge)."],
    ["La grille de notes est grisée, « séquence verrouillée »", "La séquence est clôturée, ou pas encore ouverte selon le calendrier. Contactez l'administration si une correction est nécessaire."],
    ["« Valider la saisie » est désactivé", "Certains élèves n'ont ni note ni mention Absent : complétez la liste."],
    ["Le bandeau indique une erreur d'enregistrement", "Votre connexion est coupée : les notes restent sur l'appareil. Réessayez avec « Enregistrer maintenant » dès le retour du réseau."],
    ["La clôture est refusée", "Lisez la liste des problèmes affichée ; consultez Suivi des saisies pour relancer les retardataires, ou forcez la clôture si nécessaire."],
    ["Le PDF ne s'ouvre pas", "Autorisez les fenêtres pop-up pour le site, ou maintenez le doigt sur le bouton et choisissez « Ouvrir dans un nouvel onglet »."],
    ["L'import d'élèves signale des erreurs", "Lisez le motif de chaque ligne (classe inconnue, date invalide…), corrigez le fichier et importez à nouveau : les élèves déjà importés sont mis à jour, pas dupliqués."],
    ["Session expirée", "Après 2 heures d'inactivité, reconnectez-vous ; les saisies non envoyées sont restaurées."],
    ["« Ce compte doit se connecter via… »", "Vous êtes sur l'interface d'un autre rôle : cliquez sur « Ouvrir cette interface » ou utilisez le lien qui vous a été transmis."],
    ["« L'abonnement … a expiré » / « en attente de paiement »", "L'établissement doit renouveler ou régler son abonnement auprès d'AI721 TECH STUFF ; l'accès est rétabli dès l'encaissement."],
    ["J'ai oublié mon mot de passe", "Enseignants et responsables : l'administrateur le retrouve dans son coffre. Administrateur : contactez AI721 TECH STUFF."],
    ["Le taux d'assiduité d'un enseignant semble faux", "Vérifiez son emploi du temps (les heures dues en dépendent), les jours non ouvrés et le pointage de la période (onglet Absences & retards)."],
    ["Aucun cours n'apparaît dans le pointage", "Le jour n'est pas un jour de cours, est un jour non ouvré, ou les emplois du temps ne sont pas encore générés."],
    ["Je ne peux plus modifier un document administratif", "Il a déjà été remis ou lu par l'enseignant : annulez-le (avec un motif) et émettez-en un nouveau."],
    ["Le certificat de prise de service est refusé", "Renseignez d'abord la date de prise de service dans le dossier de l'enseignant (bouton Dossier ou Compléter le dossier)."],
    ["Enseignant : où répondre à une demande d'explication ?", "Menu Mes documents & assiduité ▸ bouton Répondre ; ou à la main sur le document imprimé."]],
    widths=[5.6, 11], font=9.5)

# =============================================================== 8
D.h1('9. Bonnes pratiques de sécurité')
D.bullets(["Ne communiquez jamais votre mot de passe, même à un collègue ; l'administrateur n'en a pas besoin.",
           "Déconnectez-vous sur les ordinateurs partagés (salle des professeurs, cybercafé).",
           "Détruisez la fiche d'identifiants papier après avoir choisi votre mot de passe personnel.",
           "Administrateurs : téléchargez une sauvegarde chaque semaine, consultez le journal d'audit, désactivez immédiatement le compte d'un personnel qui quitte l'établissement.",
           "Les documents administratifs et l'assiduité d'un enseignant sont confidentiels : seuls l'intéressé et l'administration y ont accès ; chaque émission, consultation et réponse est tracée.",
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
D.h1("Annexe B — Calcul de l'assiduité et références des documents")
D.bullets(["**Heures dues :** pour chaque jour de classe de la période (jour de cours, compris dans une séquence, hors jour non ouvré, jusqu'à aujourd'hui), nombre de cours prévus ce jour-là à l'emploi du temps de l'enseignant (un créneau = une heure).",
           "**Heures effectuées :** heures dues moins les heures d'absence, justifiées ou non.",
           "**Taux d'assiduité :** heures effectuées ÷ heures dues × 100. Le taux « hors absences justifiées » est aussi indiqué. Les retards sont comptés à part."])
D.table(["Taux d'assiduité", 'Appréciation'], [['≥ 98 %', 'Excellente'], ['95 à 97,9 %', 'Très bonne'], ['90 à 94,9 %', 'Bonne'], ['80 à 89,9 %', 'Assez bonne'], ['70 à 79,9 %', 'Passable'], ['< 70 %', 'Insuffisante']], widths=[6, 10.6], font=9.5)
D.p("**Références :** N° numéro/année scolaire/sigle/P/code — APE (présence effective), CPS (prise de service), RO (rappel à l'ordre), LO (lettre d'observation), DE (demande d'explication). "
    "La numérotation repart à 001 chaque année pour chaque type ; un numéro annulé n'est jamais réutilisé. Le paramètre « ref_documents » permet de remplacer « sigle/P » par la référence administrative complète de l'établissement.", align='justify')
D.h1('Annexe C — Comptes du mode démonstration')
D.p("L'instance de démonstration contient un établissement **fictif** (« Lycée Pilote SchoolX de Yaoundé ») avec 6 classes, 181 élèves, 12 enseignants et "
    "2 responsables. Elle est réinitialisée régulièrement : ne l'utilisez pas pour de vraies données.", align='justify')
D.table(['Profil', 'Interface', 'Identifiant', 'Mot de passe'], [['Super administrateur', '/console', 'AI721', 'Ai721@2026'],
    ['Administrateur', '/e/lpey/admin', 'admin', 'Admin@2026'], ['Enseignant (mathématiques)', '/e/lpey/enseignant', 'mbargajp', 'Prof@2026'],
    ['Responsable disciplinaire', '/e/lpey/discipline', 'sg.nguemap', 'Disc@2026']], widths=[4.6, 4.4, 3.4, 4.2], font=9.5)
D.p("Les enseignants de démonstration ont un dossier administratif, un pointage depuis la rentrée et plusieurs documents (prise de service, présence effective, rappel à l'ordre, "
    "demandes d'explication avec et sans réponse, lettre d'observation). L'enseignant de démonstration a une demande d'explication à laquelle répondre.", align='justify')
D.p("La console de démonstration contient aussi trois autres établissements fictifs illustrant les situations d'abonnement : actif (lbdouala), expiré (cetbafoussam) et en attente de paiement (cesgaroua).", align='justify')

out = os.path.join(ROOT, 'docs', 'Manuel_utilisation_AI721_SchoolX_CM.docx')
D.save(out); print('OK', out)
