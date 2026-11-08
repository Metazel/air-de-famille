#!/usr/bin/env bash
# Garde-fous du dépôt public Air de famille.
# Échoue si une photo, une banque de visages, des descripteurs, un secret
# ou un appel vers un site externe apparaissent dans le dépôt.
set -euo pipefail
cd "$(dirname "$0")/.."
err=0
fail() { echo "ÉCHEC : $*"; err=1; }

# 1. Images : seules les icônes de l'application sont autorisées.
autorisees='^\./(icon-192\.png|icon-512\.png|icon-maskable-512\.png)$'
while IFS= read -r f; do
  [[ "$f" =~ $autorisees ]] || fail "image non autorisée : $f (aucune photo réelle dans le dépôt)"
done < <(find . -path ./.git -prune -o -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' -o -iname '*.heic' -o -iname '*.gif' -o -iname '*.bmp' -o -iname '*.mp4' -o -iname '*.mov' \) -print)

# 2. Banque familiale, descripteurs, tests privés.
for motif in 'banque' 'bank' 'descripteur' 'descriptor' 'regression_v2' 'e2e_v2' 'eval_js' 'bank_eval'; do
  hits=$(find . -path ./.git -prune -o -type f -iname "*${motif}*" -print)
  [ -z "$hits" ] || fail "fichier privé détecté ($motif) : $hits"
done
if grep -rIlE '"descriptor"\s*:\s*\[' --exclude-dir=.git --exclude-dir=model --exclude-dir=vendor . >/dev/null 2>&1; then
  fail "descripteurs de visage sérialisés détectés"
fi

# 3. Secrets.
if grep -rIniE '(api[_-]?key|secret|token|password)\s*[:=]\s*["'"'"'][A-Za-z0-9_\-]{12,}' --exclude-dir=.git --exclude-dir=vendor --exclude-dir=tests . ; then
  fail "secret probable détecté"
fi

# 4. Confidentialité by design : CSP présente et aucun site externe appelé.
grep -q "connect-src 'self'" index.html || fail "CSP connect-src 'self' absente de index.html"
grep -q "default-src 'self'" index.html || fail "CSP default-src 'self' absente de index.html"
if grep -oE "(fetch|loadScript|importScripts)\([^)]*https?://" app.js sw.js; then
  fail "appel réseau vers un site externe dans le code"
fi

# 5. Taille : pas de fichier inattendu de plus de 8 Mo.
big=$(find . -path ./.git -prune -o -type f -size +8M -print)
[ -z "$big" ] || fail "fichier de plus de 8 Mo : $big"

[ $err -eq 0 ] && echo "Garde-fous : OK"
exit $err
