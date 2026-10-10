# Plateforme d'inscription et de paiement en ligne — Collège Vogt

Prototype fonctionnel (front-end) du cahier des spécifications : inscriptions aux **CRN**, à **VOGT Sport** et à la **formation en informatique**, paiement **MTN Mobile Money / Orange Money**, **facture A5 paysage** avec QR code, espace payeur et back-office.

Pile : Vue 3 + TypeScript + Tailwind CSS + Vite (chap. 11 de la spécification). Police Poppins embarquée, charte bleu marine et or.

```bash
npm install
npm run dev      # développement
npm run build    # vérification des types + build de production
npm test         # tests de recette T1, T2, T9 (âge/catégorie, montant en lettres)
```

## Couverture
- Parcours en 5 étapes (EF-01 à EF-07) : contrôle champ par champ, montant recalculé, plusieurs participants, saisie conservée 24 h, « Mon espace » par code SMS, FR/EN.
- CRN (filtre des matières, forfait plafond, listes d'attente, doublons), VOGT Sport (catégorie calculée, autorisation horodatée, certificat), informatique (champs selon la profession, parent payeur, blocage des créneaux, prérequis, remise).
- Paiement : réservation 15 min, attente 5 min, statuts, webhook signé (rejeu et signature falsifiée simulés), une seule facture par paiement.
- Facture A5 paysage `CFXV-AAAA-OFF-NNNNN`, montant en lettres, QR code vers `/verifier/:code`, duplicata, avoirs.
- Back-office (`/admin/connexion`) : tableau de bord, inscriptions, listes et exports, encaissements, avoirs, tarifs avec historique, SMS groupés, comptes et droits, journal d'audit.

## Limites
- Les données sont simulées dans le navigateur (`src/api/`), selon les points d'accès de la §11.4. Serveur Laravel, agrégateur de paiement, SMS/e-mails et application Flutter restent à réaliser ; seule la couche `src/api` est à remplacer.
- Comptes de démonstration sur la page de connexion (2FA et code SMS : `123456`).
- PDF via l'impression du navigateur ; l'export « Excel » est un classeur HTML lisible par Excel, pas un vrai XLSX.
- Tarifs, coordonnées et numéros fictifs.
