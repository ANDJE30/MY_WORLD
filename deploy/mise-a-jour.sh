#!/bin/bash
# Mise à jour d'une installation de production (serveur Oracle Cloud / VPS installé avec oracle-cloud-init.sh).
# Les données sont conservées ; les migrations s'exécutent automatiquement au redémarrage
# (passage 1.x → 2.0 : l'établissement existant devient le premier établissement de la plateforme).
# Usage : sudo bash /opt/edugest/deploy/mise-a-jour.sh
set -euo pipefail
cd /opt/edugest
BRANCH="${BRANCH:-master}"
# sauvegarde de sécurité avant la mise à jour
# (tout le dossier de données : plateforme, établissements et clé du coffre ; compatible versions 1.x et 2.x)
docker compose -f deploy/docker-compose.yml exec -T app sh -c 'mkdir -p /data/backups && tar czf /data/backups/avant-maj-$(date +%Y%m%d-%H%M%S).tgz -C /data --exclude=./backups .' 2>/dev/null || true
git fetch origin "$BRANCH" && git checkout "$BRANCH" && git pull --ff-only origin "$BRANCH"
cd deploy && docker compose up -d --build
for i in $(seq 1 30); do
  if docker compose exec -T app wget -qO- http://127.0.0.1:3000/healthz >/dev/null 2>&1; then echo "Mise à jour terminée : EduGest CM est en ligne."; exit 0; fi
  sleep 2
done
echo "L'application ne répond pas : consultez « docker compose logs app »." >&2; exit 1
