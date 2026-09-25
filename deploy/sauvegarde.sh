#!/usr/bin/env bash
# Sauvegarde de la base de production : un fichier compressé daté dans ./sauvegardes, les plus
# anciens (plus de 14 jours par défaut) sont supprimés. À lancer depuis la racine du dépôt, par
# exemple chaque nuit avec cron :
#   15 3 * * * cd /opt/coprophub && ./deploy/sauvegarde.sh >> sauvegardes/sauvegarde.log 2>&1
#
# Une sauvegarde qui n'a jamais été restaurée n'est pas une sauvegarde : essayez deploy/restauration.sh
# sur une machine de test.
set -euo pipefail

COMPOSE=(docker compose -f docker-compose.prod.yml --env-file "${ENV_FILE:-.env.production}")
DOSSIER="${DOSSIER_SAUVEGARDES:-sauvegardes}"
CONSERVATION_JOURS="${CONSERVATION_JOURS:-14}"

mkdir -p "$DOSSIER"
fichier="$DOSSIER/coprophub-$(date +%Y-%m-%d-%H%M%S).sql.gz"

# Écriture dans un fichier temporaire puis renommage : jamais de sauvegarde à moitié écrite.
"${COMPOSE[@]}" exec -T db pg_dump -U coprophub --no-owner coprophub | gzip > "$fichier.partiel"
mv "$fichier.partiel" "$fichier"

# Un fichier vide ou minuscule signale un échec silencieux de pg_dump.
if [ "$(wc -c < "$fichier")" -lt 200 ]; then
  echo "Sauvegarde suspecte (fichier trop petit) : $fichier" >&2
  exit 1
fi

find "$DOSSIER" -name 'coprophub-*.sql.gz' -mtime "+$CONSERVATION_JOURS" -delete
echo "Sauvegarde créée : $fichier ($(wc -c < "$fichier") octets)"
