#!/bin/bash
# Installation automatique sur une VM Ubuntu 22.04/24.04 (Oracle Cloud Always Free, amd64 ou arm64).
# Usage : sudo DOMAIN=schoolx.ai721.cm SUPERADMIN_PASSWORD='MotDePasseFort!2026' bash oracle-cloud-init.sh
set -euo pipefail
: "${DOMAIN:?Définissez DOMAIN (nom de domaine pointant vers l’adresse IP publique du serveur)}"
apt-get update && apt-get install -y ca-certificates curl git iptables-persistent
curl -fsSL https://get.docker.com | sh
# Ouvre les ports 80/443 (les images Oracle bloquent tout sauf SSH par défaut)
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
netfilter-persistent save
[ -d /opt/edugest ] || git clone -b "${BRANCH:-master}" https://github.com/andje30/my_world.git /opt/edugest
cd /opt/edugest/deploy
# clé du coffre des accès : générée une fois et conservée dans /opt/edugest/deploy/.env
[ -f .env ] || echo "VAULT_KEY=$(openssl rand -hex 32)" > .env && chmod 600 .env
DOMAIN="$DOMAIN" SUPERADMIN_PASSWORD="${SUPERADMIN_PASSWORD:-}" docker compose up -d --build
echo "AI721 SchoolX CM est en ligne : console https://$DOMAIN/console (identifiant AI721)"
