#!/usr/bin/env bash
# Contrôle de fumée d'une installation de production : l'application, l'API, le repli de la SPA et
# les en-têtes de sécurité répondent comme prévu. Utilisable après un déploiement (et par la CI).
#   ./deploy/verifier-production.sh https://copro.example.org
#   ./deploy/verifier-production.sh https://localhost:18443 --insecure     # certificat local de Caddy
set -uo pipefail

base="${1:-}"
if [ -z "$base" ]; then
  echo "Usage : $0 <url de base> [--insecure]" >&2
  exit 2
fi
base="${base%/}"
curl_options=(--silent --show-error --max-time 15)
[ "${2:-}" = "--insecure" ] && curl_options+=(--insecure)

echec=0
verifier() { # description, commande de test
  if eval "$2"; then echo "  ok   $1"; else echo "  ÉCHEC $1"; echec=1; fi
}
corps() { curl "${curl_options[@]}" "$base$1"; }
entetes() { curl "${curl_options[@]}" --head "$base$1"; }
code() { curl "${curl_options[@]}" --output /dev/null --write-out '%{http_code}' "$@"; }

echo "Vérification de $base"
verifier "la page d'accueil est servie (200, HTML)" '[ "$(code "$base/")" = 200 ] && corps / | grep -qi "<div id=\"root\">"'
verifier "une route de l'application se replie sur index.html (200)" '[ "$(code "$base/assemblees")" = 200 ] && corps /assemblees | grep -qi "<div id=\"root\">"'
verifier "l'API répond : /api/health → {\"status\":\"ok\"}" 'corps /api/health | grep -q "\"status\":\"ok\""'
verifier "l'API refuse un visiteur anonyme : /api/auth/moi → 401" '[ "$(code "$base/api/auth/moi")" = 401 ]'
verifier "une route inconnue de l'API ne renvoie pas la page de l'application" '! corps /api/route-inexistante | grep -qi "<div id=\"root\">"'
verifier "HSTS présent" 'entetes / | grep -qi "^strict-transport-security: max-age="'
verifier "Content-Security-Policy présente, sans ressource tierce" 'entetes / | grep -i "^content-security-policy:" | grep -q "default-src .self." && ! entetes / | grep -i "^content-security-policy:" | grep -qi "https://"'
verifier "X-Content-Type-Options: nosniff" 'entetes / | grep -qi "^x-content-type-options: nosniff"'
verifier "X-Frame-Options: DENY" 'entetes / | grep -qi "^x-frame-options: DENY"'
verifier "l'en-tête Server n'est pas exposé" '! entetes / | grep -qi "^server:"'
verifier "une connexion refusée ne pose aucun cookie de session" '! curl "${curl_options[@]}" --include --request POST --header "Content-Type: application/json" --data "{\"email\":\"x@example.org\",\"motDePasse\":\"incorrect-incorrect\"}" "$base/api/auth/connexion" | grep -qi "^set-cookie: session="'

if [ "$echec" -eq 0 ]; then echo "Tout est conforme."; else echo "Des vérifications ont échoué." >&2; fi
exit "$echec"
