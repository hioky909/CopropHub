#!/usr/bin/env bash
# Restaure une sauvegarde dans la base de production : REMPLACE toutes les données actuelles.
#   ./deploy/restauration.sh sauvegardes/coprophub-2026-11-14-031500.sql.gz
# Le service backend est arrêté pendant l'opération, puis relancé.
set -euo pipefail

if [ "$#" -ne 1 ] || [ ! -f "$1" ]; then
  echo "Usage : $0 <fichier .sql.gz>" >&2
  exit 2
fi
fichier="$1"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file "${ENV_FILE:-.env.production}")

# Contrôle d'intégrité de l'archive avant de toucher à quoi que ce soit.
gzip -t "$fichier"

if [ "${CONFIRMER:-}" != "oui" ]; then
  read -r -p "Cette opération REMPLACE toutes les données actuelles par $fichier. Taper « oui » pour continuer : " reponse
  [ "$reponse" = "oui" ] || { echo "Abandon."; exit 1; }
fi

"${COMPOSE[@]}" stop backend
# On repart d'un schéma vide : la sauvegarde contient le schéma et les données.
"${COMPOSE[@]}" exec -T db psql -U coprophub -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS coprophub WITH (FORCE)" -c "CREATE DATABASE coprophub OWNER coprophub"
gunzip -c "$fichier" | "${COMPOSE[@]}" exec -T db psql -U coprophub -d coprophub -v ON_ERROR_STOP=1 --quiet
"${COMPOSE[@]}" up -d backend
echo "Restauration terminée depuis $fichier."
