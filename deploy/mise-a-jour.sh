#!/bin/bash
# Mise à jour d'une installation de production (serveur Oracle Cloud / VPS installé avec oracle-cloud-init.sh).
# Les données sont conservées ; les migrations de la base s'exécutent automatiquement au redémarrage.
# Usage : sudo bash /opt/edugest/deploy/mise-a-jour.sh
set -euo pipefail
cd /opt/edugest
BRANCH="${BRANCH:-master}"
# sauvegarde de sécurité avant la mise à jour
docker compose -f deploy/docker-compose.yml exec -T app sh -c 'cp /data/edugest.db /data/backups/avant-maj-$(date +%Y%m%d-%H%M%S).db' 2>/dev/null || true
git fetch origin "$BRANCH" && git checkout "$BRANCH" && git pull --ff-only origin "$BRANCH"
cd deploy && docker compose up -d --build
for i in $(seq 1 30); do
  if docker compose exec -T app wget -qO- http://127.0.0.1:3000/healthz >/dev/null 2>&1; then echo "Mise à jour terminée : EduGest CM est en ligne."; exit 0; fi
  sleep 2
done
echo "L'application ne répond pas : consultez « docker compose logs app »." >&2; exit 1
