import sys, os, datetime
sys.path.insert(0, os.path.dirname(__file__))
from docgen import Doc, GREEN

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
UML = os.path.join(ROOT, 'docs', 'uml'); CAP = os.path.join(ROOT, 'docs', 'captures')
u = lambda f: os.path.join(UML, f); c = lambda f: os.path.join(CAP, f)
today = datetime.date.today().strftime('%d/%m/%Y')

D = Doc('Cahier des charges — EduGest CM', 'Cahier des charges')
D.cover('Cahier des charges fonctionnel et technique', 'EduGest CM',
        "Application web responsive de gestion des notes, des faits disciplinaires et des emplois du temps des établissements d'enseignement secondaire général et technique du Cameroun",
        [('Projet', 'EduGest CM — plateforme de gestion scolaire'), ('Document', 'Cahier des charges (spécifications fonctionnelles, techniques et conception UML)'),
         ('Version', '1.0'), ('Date', today), ('Statut', 'Validé pour réalisation — application livrée'),
         ('Destinataires', "Chefs d'établissement, censeurs, surveillants généraux, enseignants, promoteurs d'établissements privés, équipe technique"),
         ('Rédaction', 'Équipe de développement full stack EduGest CM')], logo=os.path.join(ROOT, 'public', 'img', 'icon-192.png'))
D.toc()

# ------------------------------------------------------------------ 1
D.h1('1. Présentation du projet')
D.h2('1.1 Contexte')
D.p("Les établissements d'enseignement secondaire du Cameroun, placés sous la tutelle du Ministère des Enseignements Secondaires (MINESEC), organisent "
    "l'année scolaire en **trois trimestres** comprenant chacun **deux séquences d'évaluation** (six séquences au total ; on parle aussi de « situations » "
    "dans l'approche par les compétences). À l'issue de chaque séquence et de chaque trimestre, l'établissement doit produire des relevés de notes, "
    "des procès-verbaux de conseil de classe et des bulletins, en tenant compte des coefficients de chaque discipline et de la conduite des élèves "
    "(absences justifiées et non justifiées, retards, consignes, avertissements, blâmes, exclusions).", align='justify')
D.p("Dans la majorité des établissements, ces opérations reposent encore sur des cahiers, des fiches papier et des tableurs dispersés. Il en résulte "
    "des retards dans la remise des notes, des erreurs de calcul de moyennes et de rangs, des pertes de données, une difficulté à suivre la progression "
    "des programmes et une charge de travail considérable pour l'administration à chaque fin de séquence.", align='justify')
D.h2('1.2 Problématique')
D.bullets(["Comment permettre à chaque enseignant de saisir ses notes **où qu'il soit**, depuis un ordinateur, une tablette ou un simple smartphone, même avec une connexion instable ?",
           "Comment garantir que les moyennes, rangs et décisions soient **calculés sans erreur** et que les documents officiels soient **conformes** à la présentation administrative camerounaise ?",
           "Comment donner au chef d'établissement une **vision en temps réel** de l'avancement des saisies et lui permettre de **clôturer** une séquence selon un calendrier précis ?",
           "Comment **sécuriser** des données personnelles de mineurs, conformément à la loi n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel ?"])
D.h2('1.3 Objectifs')
D.table(['Objectif', 'Indicateur de réussite'], [
    ["Dématérialiser la saisie des notes et des faits disciplinaires", "100 % des notes saisies en ligne ; zéro fiche papier à ressaisir"],
    ["Réduire le délai de production des bulletins", "Bulletins d'une classe générés en moins de 10 secondes après la clôture"],
    ["Supprimer les erreurs de calcul", "Moyennes pondérées, rangs ex æquo et statistiques calculés automatiquement et testés"],
    ["Piloter l'établissement", "Tableau de bord en temps réel : taux de saisie, moyennes, réussite, discipline"],
    ["Garantir sécurité et traçabilité", "Accès par rôle, verrouillage des séquences clôturées, journal d'audit complet"],
    ["Être utilisable partout", "Interface responsive (ordinateur, tablette, smartphone), installable comme une application"]],
    widths=[7.5, 9], caption='Objectifs du projet')
D.h2('1.4 Périmètre')
D.p("Le périmètre couvre un établissement (lycée, collège ou CES, général ou technique, public ou privé, francophone, anglophone ou bilingue) "
    "et une année scolaire active, avec passage à l'année suivante. Il comprend :", align='justify')
D.bullets(["la gestion administrative de référence : établissement, classes, matières, coefficients, élèves, personnels, attributions ;",
           "la gestion pédagogique : calendrier des séquences, saisie des notes, progression annuelle, résultats, bulletins, statistiques ;",
           "la gestion disciplinaire : absences, retards, consignes, sanctions, registre des incidents ;",
           "la gestion des emplois du temps : conception, génération automatique, détection des conflits ;",
           "l'édition de tous les documents officiels au format PDF ;",
           "l'administration technique : sauvegarde, restauration, journal d'audit, nouvelle année scolaire."])
D.p("Sont **hors périmètre de la version 1.0** (mais prévus dans la feuille de route, § 13) : le portail parents/élèves, la gestion financière "
    "(frais de scolarité), les notifications SMS et la gestion multi-établissements centralisée.", align='justify')

# ------------------------------------------------------------------ 2
D.h1('2. Acteurs et profils utilisateurs')
D.p("L'application distingue trois profils. Chaque utilisateur ne voit que les menus et les données correspondant à son rôle ; le contrôle est "
    "appliqué côté serveur pour chaque requête (et pas seulement dans l'interface).", align='justify')
D.table(['Profil', 'Personnes concernées', 'Responsabilités principales', 'Périmètre de données'], [
    ["**Administrateur**", "Proviseur, directeur, principal, censeur, secrétaire de direction", "Paramétrage, comptes, attributions, calendrier, clôtures, emplois du temps, bulletins, statistiques, sauvegardes", "Tout l'établissement"],
    ["**Enseignant**", "Professeurs titulaires et vacataires", "Progression annuelle, saisie et validation des notes, relevés PDF", "Uniquement les classes et matières qui lui sont attribuées"],
    ["**Responsable disciplinaire**", "Surveillant général, surveillants de secteur, conseillers d'orientation", "Saisie des faits disciplinaires, incidents, validation des fiches, fiches PDF", "Uniquement les classes qui lui sont confiées"]],
    widths=[3.2, 3.8, 5.8, 3.8], caption='Profils utilisateurs')

# ------------------------------------------------------------------ 3
D.h1('3. Exigences fonctionnelles')
D.p("Chaque exigence est identifiée (EF-xx) et priorisée selon la méthode MoSCoW : **M** = indispensable (Must), **S** = important (Should), "
    "**C** = souhaitable (Could). Toutes les exigences M et S, ainsi que les exigences C signalées, sont **réalisées** dans la version livrée.", align='justify')
EF = [
 ('3.1 Authentification et compte (tous profils)', [
   ('EF-01', 'Connexion', "Connexion par identifiant et mot de passe ; message d'erreur générique ; nombre d'essais restants affiché.", 'M'),
   ('EF-02', 'Première connexion', "Changement de mot de passe obligatoire avant tout accès (mot de passe généré par l'administrateur).", 'M'),
   ('EF-03', 'Verrouillage', "Compte verrouillé 15 minutes après 5 échecs ; déverrouillage possible par l'administrateur.", 'M'),
   ('EF-04', 'Changement de mot de passe', "Indicateur de robustesse ; déconnexion automatique des autres appareils après changement.", 'M'),
   ('EF-05', 'Profil', "Consultation du profil, mise à jour du téléphone et de l'e-mail, date de dernière connexion.", 'S'),
   ('EF-06', 'Session', "Expiration après 2 h d'inactivité et 8 h au maximum ; déconnexion manuelle.", 'M'),
   ('EF-07', 'Thème', "Thème clair / sombre mémorisé ; respect de la préférence du système.", 'C')]),
 ('3.2 Administrateur — paramétrage', [
   ('EF-10', "Identité de l'établissement", "Nom, sigle, matricule/code, type (lycée général, technique, bilingue, CES, CETIC, collège privé…), statut (public, privé laïc, confessionnel), sous-système, devise, acte de création, BP, téléphone, e-mail, site.", 'M'),
   ('EF-11', 'En-tête officiel', "Région, département, ville, délégations régionale et départementale, intitulés du ministère (FR/EN), titre et nom du chef d'établissement, censeur, surveillant général — repris sur tous les PDF.", 'M'),
   ('EF-12', 'Logo', "Téléversement du logo (PNG/JPEG ≤ 500 Ko, glisser-déposer), aperçu, suppression ; affiché dans l'application et sur les documents.", 'M'),
   ('EF-13', 'Paramètres pédagogiques', "Année scolaire, moyenne de réussite (par défaut 10/20), respect strict du calendrier.", 'M'),
   ('EF-14', 'Horaires', "Jours de cours (lundi à samedi) et créneaux horaires, y compris récréations et pauses.", 'M')]),
 ('3.3 Administrateur — calendrier et clôtures', [
   ('EF-20', 'Calendrier', "Dates de début et de fin des 6 séquences, regroupées en 3 trimestres ; contrôle de cohérence (pas de chevauchement).", 'M'),
   ('EF-21', 'État des saisies', "Pour une séquence : matières complètes et validées, fiches disciplinaires validées, pourcentage global.", 'M'),
   ('EF-22', 'Clôture de séquence', "Possible si la séquence précédente est clôturée, la date de fin atteinte, toutes les notes saisies et validées, toutes les fiches disciplinaires validées.", 'M'),
   ('EF-23', 'Clôture forcée', "Possibilité de passer outre les conditions, avec confirmation par mot de passe et trace dans le journal d'audit.", 'S'),
   ('EF-24', 'Clôture de trimestre', "Clôture en une opération des deux séquences du trimestre.", 'M'),
   ('EF-25', 'Réouverture', "Réouverture d'une séquence (dans l'ordre inverse), confirmée par mot de passe.", 'S'),
   ('EF-26', 'Verrouillage', "Une séquence clôturée est en lecture seule pour les notes, la progression et la discipline.", 'M')]),
 ('3.4 Administrateur — scolarité', [
   ('EF-30', 'Classes', "Création, modification, suppression (si vide) ; niveau (6e … Terminale, Form 1 … Upper Sixth, années du technique), série/spécialité, cycle, salle, professeur principal ; copie des matières d'une classe parallèle.", 'M'),
   ('EF-31', 'Matières', "Catalogue avec code et groupe du bulletin (1 : littéraires, 2 : scientifiques, 3 : autres) ; ajout du programme officiel en un clic.", 'M'),
   ('EF-32', 'Attributions', "Pour chaque classe : matières, coefficients, volume horaire hebdomadaire, enseignant ; application simultanée à plusieurs classes ; enregistrement automatique.", 'M'),
   ('EF-33', 'Élèves', "Fiche complète (matricule, nom, prénoms, sexe, date et lieu de naissance, classe, redoublant, parent, téléphone) ; matricule généré automatiquement si absent.", 'M'),
   ('EF-34', 'Import des élèves', "Import CSV/Excel par classe avec modèle téléchargeable, aperçu, mise à jour par matricule et rapport d'erreurs ligne par ligne.", 'M'),
   ('EF-35', 'Actions groupées', "Sélection multiple : changement de classe, suppression ; recherche par nom ou matricule ; export CSV ; liste de classe PDF.", 'S')]),
 ('3.5 Administrateur — personnels et comptes', [
   ('EF-40', 'Enseignants', "Ajout, modification, suppression, activation/désactivation ; spécialité, matricule, contacts ; liste des attributions.", 'M'),
   ('EF-41', 'Identifiants faciles à retenir', "Génération automatique : identifiant = nom + initiales (ex. MBARGA Jean Paul → mbargajp) ; mot de passe = deux mots + 3 chiffres (ex. mangue-lion-482).", 'M'),
   ('EF-42', "Fiches d'identifiants", "Affichage unique des identifiants, copie et impression PDF de fiches découpables (le mot de passe n'est jamais stocké en clair).", 'M'),
   ('EF-43', 'Responsables disciplinaires', "Mêmes fonctions + affectation des classes à charge (sélection multiple).", 'M'),
   ('EF-44', 'Import des personnels', "Import CSV avec génération automatique des comptes et des fiches.", 'S'),
   ('EF-45', 'Réinitialisation', "Réinitialisation individuelle ou groupée des mots de passe avec impression des nouvelles fiches.", 'M')]),
 ('3.6 Administrateur — emplois du temps', [
   ('EF-50', 'Grille', "Grille hebdomadaire par classe (jours × créneaux), édition case par case (matière, salle).", 'M'),
   ('EF-51', 'Conflits', "Refus d'un créneau si l'enseignant ou la salle est déjà occupé ailleurs ; signalement dans la liste des matières.", 'M'),
   ('EF-52', 'Génération automatique', "Répartition du volume horaire de chaque matière sur la semaine, par blocs, sans conflit d'enseignant.", 'S'),
   ('EF-53', 'Vues et PDF', "Vue par classe et par enseignant ; suivi heures placées / heures dues ; export PDF.", 'M')]),
 ('3.7 Administrateur — pilotage, résultats et communication', [
   ('EF-60', 'Tableau de bord', "Indicateurs clés, avancement de la saisie, moyennes par classe, calendrier, points d'attention, activité récente.", 'M'),
   ('EF-61', 'Suivi des saisies', "Avancement par classe/matière/enseignant ; filtre « à compléter » ; ouverture et correction d'une grille ; export CSV.", 'M'),
   ('EF-62', 'Résultats', "Classement par période (séquence, trimestre, année) : moyenne, rang, appréciation, décision, absences ; statistiques par matière.", 'M'),
   ('EF-63', 'Bulletins', "Bulletins PDF par élève ou pour toute la classe ; procès-verbal de conseil de classe.", 'M'),
   ('EF-64', 'Statistiques', "Réussite par classe, par matière, par sexe ; tableau d'honneur ; discipline par classe.", 'S'),
   ('EF-65', 'Discipline (supervision)', "Accès à toutes les fiches disciplinaires et au registre des incidents.", 'S'),
   ('EF-66', 'Annonces', "Publication de messages ciblés (tous, enseignants, responsables), affichés sur les tableaux de bord.", 'S'),
   ('EF-67', "Journal d'audit", "Traçabilité des actions sensibles (connexions, échecs, saisies, clôtures, suppressions, exports) ; recherche et export.", 'M'),
   ('EF-68', 'Recherche globale', "Recherche instantanée d'élèves, personnels et classes depuis la barre supérieure.", 'C'),
   ('EF-69', 'Sauvegarde et année', "Sauvegarde complète téléchargeable, restauration, sauvegardes automatiques quotidiennes, démarrage d'une nouvelle année scolaire.", 'M')]),
 ('3.8 Enseignant', [
   ('EF-70', 'Tableau de bord', "Classes et matières attribuées, avancement de la saisie de la séquence en cours, couverture du programme, cours du jour, annonces.", 'M'),
   ('EF-71', 'Progression annuelle', "Pour chaque classe/matière et chaque séquence : leçons prévues, leçons faites, taux de couverture, observations ; fiche PDF.", 'M'),
   ('EF-72', 'Saisie des notes', "Grille par classe et séquence : note sur 20 (virgule ou point, 2 décimales), case « absent », appréciation et statistiques en direct.", 'M'),
   ('EF-73', 'Ergonomie de saisie', "Navigation clavier (Entrée/↓/↑), touche « a » pour absent, collage d'une colonne Excel, enregistrement automatique, brouillon conservé hors ligne.", 'M'),
   ('EF-74', 'Validation', "« Valider la saisie » lorsque tous les élèves ont une note ou sont absents ; toute modification ultérieure annule la validation.", 'M'),
   ('EF-75', 'Relevés PDF', "Relevé de notes officiel par classe/matière et par période (séquence, trimestre, année) avec rang et statistiques.", 'M'),
   ('EF-76', 'Emploi du temps', "Consultation et export PDF de son emploi du temps personnel.", 'S')]),
 ('3.9 Responsable disciplinaire', [
   ('EF-80', 'Tableau de bord', "Classes à charge, fiches validées, heures d'absence non justifiées, incidents.", 'M'),
   ('EF-81', 'Fiche disciplinaire', "Par classe et séquence : absences justifiées et non justifiées (heures), retards, consignes, avertissement et blâme de conduite, jours d'exclusion, observation.", 'M'),
   ('EF-82', 'Incidents', "Signalement daté (nature, gravité, sanction, description), registre filtrable, historique par élève, suppression tant que la séquence est ouverte.", 'M'),
   ('EF-83', 'Validation', "Validation de la fiche d'une classe pour la séquence (prérequis à la clôture).", 'M'),
   ('EF-84', 'Exports PDF', "Fiche des faits disciplinaires de la classe (séquence, trimestre ou année) et fiche individuelle de l'élève.", 'M')]),
 ('3.10 Exigences transverses', [
   ('EF-90', 'Responsive', "Interface adaptée à l'ordinateur (barre latérale), à la tablette (rail d'icônes) et au smartphone (menu tiroir + barre d'onglets).", 'M'),
   ('EF-91', 'Application installable', "Progressive Web App : installation sur l'écran d'accueil, coquille disponible hors ligne.", 'S'),
   ('EF-92', 'Documents PDF', "En-tête bilingue officiel « République du Cameroun / Republic of Cameroon », logo, pagination, date d'édition, zones de signature.", 'M'),
   ('EF-93', 'Données de démonstration', "Mode démonstration avec établissement fictif pour la formation et l'évaluation.", 'C')])]
for title, rows in EF:
    D.h2(title)
    D.table(['ID', 'Fonctionnalité', 'Description', 'Prio.'], [list(r) for r in rows], widths=[1.4, 3.4, 10.6, 1.2], font=9)

# ------------------------------------------------------------------ 4
D.h1('4. Règles de gestion')
D.table(['Réf.', 'Règle'], [
  ['RG-01', "Les notes sont comprises entre 0 et 20, avec au plus deux décimales. Un élève absent à l'évaluation est marqué « ABS » ; il n'est pas compté dans la moyenne de la matière."],
  ['RG-02', "Moyenne d'une matière : séquence = note de la séquence ; trimestre = moyenne des notes disponibles des deux séquences ; année = moyenne des trois moyennes trimestrielles."],
  ['RG-03', "Moyenne générale = Σ (moyenne matière × coefficient) / Σ coefficients, calculée sur les seules matières notées."],
  ['RG-04', "Rang : classement décroissant des moyennes ; les élèves de même moyenne partagent le même rang (ex æquo) et le rang suivant est sauté (1, 2, 2, 4…). Un rang est aussi calculé par matière."],
  ['RG-05', "Appréciations : ≥ 18 Excellent ; ≥ 16 Très bien ; ≥ 14 Bien ; ≥ 12 Assez bien ; ≥ 10 Passable ; ≥ 8 Insuffisant ; ≥ 5 Faible ; < 5 Très faible."],
  ['RG-06', "Décision proposée : ≥ 16 Tableau d'honneur + Félicitations ; ≥ 14 + Encouragements ; ≥ 12 Tableau d'honneur ; ≥ 10 Travail acceptable ; ≥ 8 Avertissement travail ; < 8 Blâme travail. Mention « Blâme conduite » si blâme ou exclusion, « Avertissement conduite » si avertissement ou ≥ 10 h d'absences non justifiées."],
  ['RG-07', "Statistiques de classe : effectif, élèves classés, moyenne, écart-type, plus forte et plus faible moyennes, nombre d'admis et taux de réussite (moyenne ≥ seuil paramétré)."],
  ['RG-08', "Trimestres : T1 = S1 + S2 ; T2 = S3 + S4 ; T3 = S5 + S6."],
  ['RG-09', "Une séquence ne peut être clôturée que si la précédente l'est ; une séquence ne peut être rouverte que si la suivante est ouverte."],
  ['RG-10', "Saisie autorisée si la séquence est ouverte et, en mode calendrier strict, si sa date de début est atteinte."],
  ['RG-11', "Une saisie de notes est « complète » lorsque chaque élève actif de la classe a une note ou la mention absent. La validation exige la complétude ; toute modification annule la validation."],
  ['RG-12', "Un enseignant n'accède qu'aux couples classe/matière qui lui sont attribués ; un responsable disciplinaire qu'aux classes qui lui sont confiées."],
  ['RG-13', "Matricule élève automatique : 2 chiffres de l'année + sigle de l'établissement + numéro d'ordre sur 4 chiffres (ex. 26LPEY0001)."],
  ['RG-14', "Identifiants : enseignant = nom + initiales des prénoms ; responsable disciplinaire = « sg. » + nom + initiales ; suffixe numérique en cas de doublon."],
  ['RG-15', "Mot de passe personnel : 8 caractères minimum, au moins une lettre et un chiffre, différent de l'actuel et ne contenant pas l'identifiant."],
  ['RG-16', "Une classe ne peut être supprimée que si elle ne contient aucun élève ; une matière ne peut être supprimée si des notes existent."],
  ['RG-17', "Emploi du temps : un enseignant ou une salle ne peut être affecté à deux classes sur le même créneau ; les créneaux de pause ne sont pas affectables."],
  ['RG-18', "Il doit toujours exister au moins un compte administrateur ; un administrateur ne peut ni supprimer ni désactiver son propre compte."]],
  widths=[1.6, 15], caption='Règles de gestion', font=9.5)

# ------------------------------------------------------------------ 5
D.h1('5. Exigences non fonctionnelles')
D.h2('5.1 Sécurité (« security by design »)')
D.table(['Menace', 'Mesure mise en œuvre'], [
  ['Vol de mots de passe', "Hachage **scrypt** (N = 16384, sel aléatoire de 16 octets) ; comparaison à temps constant ; mots de passe jamais stockés ni journalisés en clair."],
  ['Attaque par force brute', "Limitation de débit par IP (150 essais / 15 min, adapté aux établissements derrière une même IP) et par identifiant (10 / 15 min) ; verrouillage du compte après 5 échecs ; temps de réponse égalisé pour les identifiants inconnus."],
  ['Vol de session', "Jeton aléatoire de 256 bits, stocké **haché** en base ; cookie HttpOnly, SameSite=Strict, Secure en HTTPS ; expiration (2 h d'inactivité, 8 h max) ; révocation à la déconnexion, au changement ou à la réinitialisation du mot de passe."],
  ['CSRF', "En-tête personnalisé obligatoire sur toute requête d'écriture + vérification de l'origine + cookie SameSite=Strict."],
  ['XSS', "Politique CSP stricte (aucun script en ligne ni externe) ; gabarits HTML à échappement automatique dans l'interface."],
  ['Injection SQL', "Requêtes exclusivement paramétrées ; validation stricte des types, bornes et longueurs côté serveur."],
  ['Élévation de privilèges', "Contrôle d'accès par rôle **et** par ressource (classe, matière) sur chaque route serveur ; principe du moindre privilège."],
  ['Altération des résultats', "Verrouillage des séquences clôturées ; validation des saisies ; journal d'audit horodaté avec adresse IP."],
  ['Perte de données', "Base SQLite en mode WAL avec transactions ; sauvegardes automatiques toutes les 6 h (14 jours conservés) ; sauvegarde/restauration manuelles."],
  ['Fuite d\'informations', "Messages d'erreur génériques avec référence ; en-têtes HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP/CORP."]],
  widths=[3.6, 13], caption='Mesures de sécurité', font=9.5)
D.note("**Conformité.** Les données traitées (identité, date de naissance, résultats, discipline de mineurs) sont des données personnelles au sens de la "
       "loi n° 2024/017 du 23 décembre 2024 relative à la protection des données à caractère personnel au Cameroun. L'établissement, responsable du traitement, "
       "doit informer les familles, limiter l'accès aux personnels habilités (ce que garantit le contrôle d'accès), conserver les données pour une durée "
       "proportionnée et, au titre de la souveraineté numérique, privilégier un hébergement maîtrisé (serveur de l'établissement ou hébergeur national) "
       "lorsque cela est possible (voir § 10).", 'warn')
D.h2('5.2 Performance et disponibilité')
D.bullets(["Temps de réponse de l'API < 200 ms pour 95 % des requêtes sur un serveur d'entrée de gamme (base de 2 000 élèves).",
           "Bulletins d'une classe de 70 élèves générés en moins de 5 secondes.",
           "Interface légère (pas de framework, moins de 250 Ko de code non compressé) adaptée aux connexions 3G/4G.",
           "Fonctionnement continu sans maintenance ; point de contrôle de santé /healthz pour la supervision."])
D.h2('5.3 Ergonomie et accessibilité')
D.bullets(["Interface entièrement en français, vocabulaire du système éducatif camerounais (séquence, trimestre, conseil de classe, consigne, blâme…).",
           "Zones tactiles d'au moins 40 px sur mobile, champs numériques avec clavier décimal, contrastes conformes WCAG AA, navigation clavier, libellés ARIA.",
           "Retours immédiats : notifications, indicateurs d'enregistrement, confirmations avant toute action destructive.",
           "Respect de la préférence « réduction des animations » et du thème sombre du système."])
D.h2('5.4 Compatibilité')
D.p("Navigateurs récents : Chrome, Edge, Firefox, Safari (ordinateur et mobile), navigateurs Android à partir d'Android 8. Écrans de 320 px à 2560 px de large.")
D.h2('5.5 Maintenabilité et extensibilité')
D.bullets(["Architecture modulaire (routes par domaine, moteur de calcul et moteur PDF séparés), code commenté en français.",
           "Deux dépendances de production seulement (Express et PDFKit) : surface d'attaque et maintenance réduites, aucun module natif (fonctionne sur processeurs x86 et ARM).",
           "Tests d'intégration automatisés (npm test) couvrant sécurité, calculs, clôtures, imports et documents.",
           "API REST documentée (§ 9) permettant de brancher de futurs modules (portail parents, application mobile, SMS)."])

# ------------------------------------------------------------------ 6
D.h1('6. Conception UML')
D.p("Les diagrammes suivants modélisent le système livré. Leurs sources (format Mermaid) sont versionnées dans le dossier docs/uml du projet.", align='justify')
D.h2('6.1 Diagrammes de cas d\'utilisation')
D.figure(u('01a_cas_utilisation_admin.png'), "Cas d'utilisation de l'administrateur", max_h=19)
D.figure(u('01b_cas_utilisation_ens_resp.png'), "Cas d'utilisation de l'enseignant et du responsable disciplinaire", max_h=17)
def wide():
    D.h2('6.2 Diagramme de classes (modèle du domaine)')
    D.p("Le modèle s'articule autour de l'**Attribution** (une matière enseignée dans une classe, avec son coefficient et son enseignant) : les notes, la progression et les créneaux d'emploi du temps lui sont rattachés. La **Séquence** porte l'état d'ouverture qui conditionne toutes les saisies.", align='justify')
    D.figure(u('02_classes.png'), 'Diagramme de classes du domaine', max_w=25.3, max_h=13.2)
    D.page_break()
    D.h2('6.3 Modèle physique de données')
    D.figure(u('03_mcd.png'), 'Modèle entité-association (base SQLite)', max_w=25.3, max_h=14.5)
D.landscape(wide)
D.h2('6.4 Diagrammes de séquence')
D.figure(u('04_seq_authentification.png'), 'Séquence « Authentification »', max_h=14)
D.figure(u('05_seq_saisie_notes.png'), 'Séquence « Saisie des notes avec enregistrement automatique »', max_h=14)
D.figure(u('06_seq_cloture.png'), 'Séquence « Clôture d\'une séquence »', max_h=13)
D.h2("6.5 Diagramme d'états-transitions")
D.figure(u('07_etats_sequence.png'), "Cycle de vie d'une séquence d'évaluation", max_h=13)
D.h2("6.6 Diagramme d'activités")
D.figure(u('08_activite_sequence.png'), "Déroulement d'une séquence, de la préparation aux bulletins", max_h=21)
D.h2('6.7 Diagrammes de composants et de déploiement')
D.figure(u('10_architecture.png'), 'Architecture logicielle (composants)', max_h=15)
D.figure(u('09_deploiement.png'), 'Diagramme de déploiement')

# ------------------------------------------------------------------ 7
D.h1('7. Architecture technique et choix technologiques')
D.table(['Couche', 'Technologie', 'Justification'], [
  ['Serveur', 'Node.js 22 LTS, Express 5', "Écosystème mature, très performant pour une API JSON ; Express 5 gère nativement les erreurs asynchrones."],
  ['Base de données', 'SQLite (module natif node:sqlite), mode WAL', "Zéro administration, un seul fichier facile à sauvegarder, transactions ACID, largement suffisant pour un établissement (des dizaines de milliers d'enregistrements)."],
  ['Documents', 'PDFKit', "Génération côté serveur de PDF vectoriels légers, identiques sur tous les terminaux."],
  ['Interface', 'JavaScript natif (modules ES), CSS moderne', "Aucune étape de compilation, chargement rapide sur réseau mobile, maintenance simple ; design system maison (clair/sombre)."],
  ['Mobile', 'Progressive Web App', "Installation sur smartphone sans magasin d'applications ; une seule base de code pour tous les terminaux."],
  ['Sécurité', 'crypto (scrypt, SHA-256), CSP, cookies HttpOnly', "Primitives cryptographiques standard de Node.js, sans dépendance tierce."],
  ['Déploiement', 'Docker, Caddy (HTTPS automatique), Render', "Déploiement reproductible ; certificats TLS Let's Encrypt automatiques."],
  ['Qualité', 'node:test, Playwright', "Tests d'intégration de l'API et parcours de bout en bout dans un navigateur réel."]],
  widths=[2.8, 4.6, 9.2], caption='Pile technologique', font=9.5)
D.h2('7.1 Organisation du code source')
D.table(['Chemin', 'Contenu'], [
  ['server/index.js', "Démarrage, en-têtes de sécurité, sessions, CSRF, gestion des erreurs, sauvegardes automatiques"],
  ['server/db.js', "Schéma de la base, transactions, paramètres, journal d'audit"],
  ['server/security.js', "Hachage, génération des identifiants, sessions, limitation de débit"],
  ['server/calc.js', "Moyennes, rangs, appréciations, décisions, complétude, calendrier"],
  ['server/pdf.js', "Mise en page des documents officiels"],
  ['server/routes/*.js', "auth, admin, work (notes, progression, discipline), pdfRoutes, common, access (contrôle d'accès)"],
  ['server/seed.js', "Jeu de démonstration (établissement fictif)"],
  ['public/js/*.js', "app (coquille, routeur), ui (composants), api, shared, admin, teacher, discipline"],
  ['public/css/app.css', "Design system responsive"],
  ['test/api.test.js', "Tests d'intégration"], ['deploy/', "docker-compose, Caddyfile, script d'installation serveur"]],
  widths=[4.2, 12.4], font=9.5)

# ------------------------------------------------------------------ 8
D.h1('8. Dictionnaire des données')
D.table(['Table', 'Rôle', 'Champs principaux'], [
  ['settings', "Paramètres de l'établissement (clé/valeur JSON)", "nom, sigle, type, délégations, logo, année, seuil, horaires…"],
  ['users', 'Comptes (3 rôles)', "role, username, pass_hash, full_name, active, must_change, failed_attempts, locked_until"],
  ['sessions', 'Sessions actives', "token_hash, user_id, expires_at, last_seen, ip"],
  ['classes', 'Classes', "name, level, serie, cycle, room, titulaire_id"],
  ['subjects', 'Matières', "name, code, groupe"],
  ['class_subjects', 'Attributions', "class_id, subject_id, coef, teacher_id, hours_week"],
  ['students', 'Élèves', "matricule, nom, prenom, sexe, date/lieu de naissance, class_id, redoublant, parent"],
  ['officer_classes', 'Classes des responsables', "user_id, class_id"],
  ['periods', 'Séquences', "seq (1–6), start_date, end_date, status, closed_at, closed_by, forced"],
  ['notes', 'Notes', "student_id, class_subject_id, seq, value, absent"],
  ['note_validations', 'Validations des saisies', "class_subject_id, seq, validated_at"],
  ['progressions', 'Progression annuelle', "class_subject_id, seq, planned, done, comment"],
  ['discipline_records', 'Synthèse disciplinaire', "student_id, seq, abs_j, abs_nj, retards, consignes, avertissement, blame, exclusion_jours"],
  ['incidents', 'Registre des incidents', "student_id, seq, date, type, gravite, sanction, description"],
  ['discipline_validations', 'Validations des fiches', "class_id, seq, validated_at"],
  ['timetable', 'Emplois du temps', "class_id, day, slot, class_subject_id, room"],
  ['announcements', 'Annonces', "title, body, audience"], ['audit_log', "Journal d'audit", "at, user, action, detail, ip"]],
  widths=[3.6, 4.2, 8.8], caption='Tables de la base de données', font=9)

# ------------------------------------------------------------------ 9
D.h1('9. Interface de programmation (API REST)')
D.p("Toutes les routes sont préfixées par /api, échangent du JSON et exigent une session valide (sauf connexion et informations publiques).")
D.table(['Domaine', 'Principales routes'], [
  ['Authentification', "POST auth/login, auth/logout, auth/password ; GET auth/me, auth/public ; PUT auth/profile"],
  ['Commun', "GET periods, announcements, classes/mine, timetable/class/:id, timetable/teacher/:id, search"],
  ['Administration', "GET admin/dashboard ; GET|PUT admin/settings ; PUT admin/periods/:seq ; GET admin/periods/:seq/check ; POST admin/periods/:seq/close|reopen ; POST admin/trimestres/:n/close"],
  ['Scolarité', "CRUD admin/classes, admin/subjects, admin/class-subjects, admin/students ; POST admin/students/import|bulk ; POST admin/classes/:id/copy-subjects"],
  ['Personnels', "GET|POST admin/users ; POST admin/users/import ; PUT|DELETE admin/users/:id ; POST admin/users/:id/reset|toggle"],
  ['Emplois du temps', "GET admin/timetable/:classId ; PUT|DELETE admin/timetable ; POST admin/timetable/:classId/generate"],
  ['Résultats', "GET admin/results, admin/stats, admin/progressions, admin/audit"],
  ['Maintenance', "GET admin/backup ; POST admin/restore, admin/new-year ; POST|DELETE admin/announcements"],
  ['Enseignant', "GET teacher/assignments ; GET|PUT notes/grid ; POST notes/validate ; GET|PUT progression"],
  ['Discipline', "GET discipline/classes ; GET|PUT discipline/sheet ; POST discipline/validate ; GET|POST|DELETE discipline/incidents ; GET discipline/student/:id"],
  ['Documents PDF', "GET pdf/releve, pdf/progression, pdf/discipline, pdf/discipline-eleve, pdf/bulletins, pdf/pv, pdf/liste, pdf/timetable ; POST pdf/credentials"]],
  widths=[3.4, 13.2], caption="Routes de l'API", font=9)

# ------------------------------------------------------------------ 10
D.h1('10. Hébergement et déploiement')
D.h2('10.1 Comparatif des hébergeurs gratuits')
D.table(['Hébergeur', 'Avantages', 'Limites', 'Usage recommandé'], [
  ['**Render** (offre Free)', "Déploiement en un clic depuis GitHub (fichier render.yaml fourni), HTTPS automatique, sans carte bancaire", "Mise en veille après 15 min d'inactivité ; disque éphémère : la base est effacée à chaque redémarrage", "**Démonstration et formation** (la base de démonstration se recrée automatiquement)"],
  ['**Oracle Cloud** (Always Free)', "Machine virtuelle gratuite permanente (processeurs ARM Ampere), 200 Go de stockage persistant, contrôle total", "Création de compte avec vérification bancaire ; installation à réaliser (script fourni)", "**Production gratuite** recommandée"],
  ['Render (offre payante + disque)', "Simplicité de Render avec disque persistant", "Payant (quelques dollars par mois)", "Production sans administration système"],
  ["Serveur de l'établissement / hébergeur national", "Souveraineté des données, fonctionnement possible en réseau local", "Matériel, électricité et connexion à assurer", "Établissements disposant d'une salle informatique"]],
  widths=[3.3, 4.6, 4.6, 4.1], caption='Comparatif des solutions d\'hébergement', font=9)
D.p("**Choix retenu :** Render (gratuit) pour l'instance de démonstration accessible immédiatement, et **Oracle Cloud Always Free** pour la production : "
    "c'est la seule offre gratuite offrant un stockage persistant suffisant pour héberger durablement une base SQLite. L'application, sans module natif, "
    "fonctionne indifféremment sur les processeurs ARM d'Oracle et sur x86.", align='justify')
D.h2('10.2 Procédures')
D.bullets([("Démonstration (Render) : ", "connecter le dépôt GitHub à Render ▸ « New Blueprint » ▸ le fichier render.yaml crée le service ; l'URL publique est fournie par Render."),
           ("Production (serveur Linux) : ", "créer une VM Ubuntu, faire pointer un nom de domaine vers son IP, puis exécuter deploy/oracle-cloud-init.sh ; Docker et Caddy installent l'application avec HTTPS automatique."),
           ("Premier démarrage : ", "le compte « admin » est créé ; son mot de passe est défini par la variable ADMIN_PASSWORD ou affiché une fois dans les journaux du serveur."),
           ("Variables d'environnement : ", "PORT, DATA_DIR (dossier de la base), ADMIN_USERNAME, ADMIN_PASSWORD, DEMO (1 = démonstration), TRUST_PROXY, AUTO_BACKUP.")])

# ------------------------------------------------------------------ 11
D.h1('11. Recette et assurance qualité')
D.p("La qualité est assurée par une suite de tests d'intégration automatisés (14 scénarios) exécutée avec npm test, et par un parcours de bout en bout "
    "dans un navigateur réel (Playwright) qui visite toutes les pages des trois profils sur ordinateur, tablette et smartphone sans aucune erreur.", align='justify')
D.table(['Scénario de test', 'Résultat attendu', 'Statut'], [
  ['Connexion correcte / incorrecte', "200 / 401, cookie HttpOnly", 'Réussi'], ['Requête sans en-tête anti-CSRF ou d\'origine étrangère', '403', 'Réussi'],
  ['En-têtes de sécurité', 'CSP, X-Frame-Options, nosniff présents', 'Réussi'],
  ['Cloisonnement des rôles', "Enseignant et responsable refusés (403) hors de leur périmètre", 'Réussi'],
  ['Verrouillage après 5 échecs', '423 puis déverrouillage par l\'administrateur', 'Réussi'],
  ['Génération de compte et 1re connexion', "Identifiant lisible, accès bloqué (428) tant que le mot de passe n'est pas changé", 'Réussi'],
  ['Saisie de notes : bornes, décimales, élève étranger, séquence clôturée', '400 / 423 selon le cas, enregistrement correct sinon', 'Réussi'],
  ['Discipline : fiche, incident, validation', 'Données enregistrées, classe non attribuée refusée', 'Réussi'],
  ['Clôture : ordre, conditions, forçage par mot de passe, réouverture', '400 / 409 / 403 / 200', 'Réussi'],
  ['Calculs : moyenne pondérée et ordre des rangs', 'Écart < 0,01 sur tous les élèves', 'Réussi'],
  ['Emploi du temps : conflit enseignant, créneau de pause', '409 / 400', 'Réussi'],
  ['Import CSV des élèves', 'Lignes valides créées, erreurs signalées, dates JJ/MM/AAAA converties', 'Réussi'],
  ['Génération de tous les documents (9 types de PDF)', 'Fichiers PDF valides (signature %PDF)', 'Réussi'], ['Sauvegarde puis restauration', 'Données identiques après restauration', 'Réussi']],
  widths=[7.2, 7.4, 2], caption='Plan de tests automatisés', font=9)
D.p("**Recette utilisateur.** Avant la mise en production, l'établissement réalise une recette sur le mode démonstration puis sur ses propres données "
    "(import d'une classe, saisie d'une séquence complète, clôture, édition des bulletins) en s'appuyant sur le manuel d'utilisation.", align='justify')

# ------------------------------------------------------------------ 12
D.h1('12. Planning, livrables et maintenance')
D.table(['Phase', 'Contenu', 'Livrable'], [
  ['1. Analyse', "Recueil des besoins, règles de gestion camerounaises", 'Cahier des charges'],
  ['2. Conception', "Modélisation UML, maquettes, architecture, sécurité", 'Diagrammes UML, design system'],
  ['3. Réalisation', "Backend, interface responsive, documents PDF", 'Code source versionné'],
  ['4. Tests', "Tests automatisés, parcours de bout en bout, revue de sécurité", 'Rapport de tests'],
  ['5. Déploiement', "Instance de démonstration, procédure de production", 'Application en ligne, scripts de déploiement'],
  ['6. Formation', "Administration, enseignants, surveillants", "Manuel d'utilisation (Word et PDF)"],
  ['7. Maintenance', "Corrections, évolutions, sauvegardes, nouvelle année", 'Versions successives']],
  widths=[3, 8, 5.6], font=9.5)

# ------------------------------------------------------------------ 13
D.h1("13. Évolutions et extensions prévues")
D.p("L'architecture modulaire et l'API REST permettent d'ajouter les modules suivants sans remettre en cause l'existant :", align='justify')
D.table(['Module', 'Description'], [
  ['Portail parents / élèves', "Consultation des notes, bulletins, absences et emploi du temps ; comptes parents liés au téléphone."],
  ['Notifications SMS / WhatsApp', "Alerte automatique des parents en cas d'absence non justifiée, de sanction ou à la publication des bulletins (passerelles des opérateurs locaux)."],
  ['Frais de scolarité', "Suivi des paiements, reçus, relances, intégration du paiement mobile (Mobile Money)."],
  ['Interface bilingue', "Interface et documents intégralement en anglais pour le sous-système anglophone (terminologie GCE : terms, Form, Lower/Upper Sixth)."],
  ['Évaluation par compétences', "Grilles de compétences et appréciations qualitatives par situation d'apprentissage (APC)."],
  ['Examens officiels', "Préparation des listes de candidats (BEPC, CAP, Probatoire, Baccalauréat, GCE O/A Level), moyennes d'admission."],
  ['Cahier de textes numérique', "Contenu des leçons par séance, lié à la progression annuelle et à l'emploi du temps."],
  ['Gestion des absences enseignants', "Suivi des heures dues/effectuées, remplacements, statistiques de présence."],
  ['Multi-établissements', "Console d'un promoteur ou d'une délégation pour plusieurs établissements ; statistiques consolidées."],
  ['Mode hors ligne complet', "Saisie entièrement hors ligne avec synchronisation différée (le brouillon local actuel en est la première étape)."],
  ['Authentification renforcée', "Double authentification (code par SMS ou application) pour les comptes administrateurs."]],
  widths=[4.2, 12.4], caption='Feuille de route', font=9.5)

# ------------------------------------------------------------------ 14
D.h1('14. Glossaire')
D.table(['Terme', 'Définition'], [
  ['Séquence / situation', "Période d'évaluation ; l'année en compte six."], ['Trimestre', "Regroupement de deux séquences, sanctionné par un bulletin trimestriel."],
  ['Coefficient', "Poids d'une matière dans le calcul de la moyenne générale."], ['Conseil de classe', "Réunion qui arrête les résultats et décisions de fin de période."],
  ['Consigne', "Retenue de l'élève (en heures) à titre de sanction."], ['Avertissement / blâme', "Sanctions de conduite (ou de travail) mentionnées au bulletin."],
  ['Attribution', "Affectation d'une matière d'une classe à un enseignant, avec son coefficient."], ['Clôture', "Verrouillage d'une séquence après la fin des saisies."],
  ['PWA', "Progressive Web App : site web installable comme une application."], ['CSRF / XSS', "Attaques web visant à faire exécuter une action ou un script à l'insu de l'utilisateur."],
  ['scrypt', "Algorithme de hachage de mots de passe résistant aux attaques matérielles."], ['MINESEC', "Ministère des Enseignements Secondaires du Cameroun."]],
  widths=[4, 12.6], font=9.5)

out = os.path.join(ROOT, 'docs', 'Cahier_des_charges_EduGest_CM.docx')
D.save(out); print('OK', out)
