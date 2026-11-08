#!/usr/bin/env bash
# Garde-fous du dépôt public Air de famille.
# Échoue si une photo, une banque de visages, des descripteurs, un secret,
# un appel externe ou une CSP modifiée apparaissent dans le dépôt.
#
#   bash tests/garde_fous.sh                 fichiers suivis par git (défaut)
#   bash tests/garde_fous.sh --index         fichiers indexés (hook pre-commit)
#   bash tests/garde_fous.sh --historique R  + fichiers ajoutés dans chaque commit de R (ex. origin/main..HEAD)
set -euo pipefail
cd "$(dirname "$0")/.."
err=0
fail() { echo "ÉCHEC : $*"; err=1; }

mode="${1:-}"
if [ "$mode" = "--index" ]; then
  mapfile -t fichiers < <(git diff --cached --name-only --diff-filter=ACMR)
  lire() { git show ":$1"; }
else
  mapfile -t fichiers < <(git ls-files)
  lire() { cat -- "$1"; }
fi

# Photos, vidéos et archives : seules les icônes de l'application sont autorisées.
autorisees='^(icon-192\.png|icon-512\.png|icon-maskable-512\.png)$'
interdites='\.(jpe?g|png|webp|heic|heif|avif|gif|bmp|tiff?|svg|mp4|mov|m4v|avi|webm|zip|7z|rar|tar|gz|tgz)$'
verifier_nom() {
  local f="$1" bas
  bas=$(printf '%s' "$f" | tr '[:upper:]' '[:lower:]')
  if [[ "$bas" =~ $interdites ]] && ! [[ "$f" =~ $autorisees ]]; then
    fail "fichier image, vidéo ou archive non autorisé : $f (aucune photo réelle dans le dépôt)"
  fi
  case "$bas" in
    *banque*|*bank*|*descripteur*|*descriptor*|tests/prive/*|dev/*) fail "fichier privé détecté : $f" ;;
  esac
}
for f in "${fichiers[@]}"; do verifier_nom "$f"; done

# Historique : un fichier ajouté puis supprimé dans la même demande reste public.
if [ "$mode" = "--historique" ]; then
  plage="${2:?plage de commits attendue, ex. origin/main..HEAD}"
  while IFS= read -r f; do
    [ -n "$f" ] && verifier_nom "$f"
  done < <(git log --diff-filter=A --name-only --format= "$plage" | sort -u)
fi

# Contenu des fichiers texte (hors moteur et modèles, vérifiés par empreinte).
for f in "${fichiers[@]}"; do
  case "$f" in vendor/*|model/*|fonts/*.woff2|*.png|tests/empreintes.sha256) continue ;; esac
  contenu=$(lire "$f" 2>/dev/null | tr -d '\000' || true)
  # Image intégrée en base64.
  if grep -qE 'data:image/[a-z+]+;base64,[A-Za-z0-9+/]{200}' <<<"$contenu"; then
    fail "image intégrée en base64 dans $f"
  fi
  # Descripteur de visage sérialisé : tableau d'au moins 128 nombres décimaux.
  if grep -qE '\[\s*(-?[0-9]*\.[0-9]+(e-?[0-9]+)?\s*,\s*){127}' <<<"$contenu"; then
    fail "tableau de 128 nombres ou plus (descripteur de visage probable) dans $f"
  fi
  # Secrets.
  if grep -qiE '(api[_-]?key|secret|token|password|passwd)\s*[:=]\s*["'"'"']?[A-Za-z0-9_\-]{16,}' <<<"$contenu" \
     || grep -qE '(^|[^A-Za-z0-9_-])(ghp_|github_pat_|AKIA|AIza|sk-)[A-Za-z0-9_]{16,}' <<<"$contenu"; then
    fail "secret probable dans $f"
  fi
done

# Confidentialité by design : aucune adresse externe dans le code de l'application.
for f in index.html app.js sw.js manifest.webmanifest fonts/fonts.css; do
  if [ -f "$f" ] && grep -qE 'https?://' "$f"; then
    fail "adresse externe dans $f : l'application ne doit appeler aucun autre site"
  fi
done

# CSP : comparée directive par directive à la politique attendue.
attendue="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"
normaliser() { tr ';' '\n' | sed -E 's/^ +//; s/ +$//; s/ +/ /g' | grep -v '^$' | sort; }
publiee=$(grep -oE 'http-equiv="Content-Security-Policy" content="[^"]*"' index.html | sed -E 's/.*content="([^"]*)"/\1/' || true)
if [ -z "$publiee" ]; then
  fail "CSP absente de index.html"
elif [ "$(normaliser <<<"$publiee")" != "$(normaliser <<<"$attendue")" ]; then
  fail "CSP modifiée. Attendue : $attendue — trouvée : $publiee"
fi

# Moteur, modèles, polices et icônes : empreintes SHA-256 attendues.
if [ "$mode" != "--index" ]; then
  if ! sha256sum --quiet -c tests/empreintes.sha256; then
    fail "moteur, modèle, police ou icône modifié : mettre à jour tests/empreintes.sha256 avec justification"
  fi
fi

# Taille : pas de fichier inattendu de plus de 8 Mo.
for f in "${fichiers[@]}"; do
  [ -f "$f" ] && [ "$(stat -c %s "$f")" -gt 8388608 ] && fail "fichier de plus de 8 Mo : $f"
done

[ $err -eq 0 ] && echo "Garde-fous : OK"
exit $err
