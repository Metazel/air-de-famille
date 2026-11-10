# Tests publics

Aucune photo réelle ici : les images de test sont générées à la volée.
Les tests de régression sur la banque familiale restent privés.

```bash
bash tests/garde_fous.sh                              # état du dépôt
bash tests/garde_fous.sh --historique origin/main..HEAD   # chaque commit d'une branche
pip install playwright==1.63.0 pillow==12.3.0 && python -m playwright install chromium
npm install --prefix tests --no-save axe-core@4.14.0
python tests/e2e_public.py .                          # e2e, accessibilité, CSP, hors ligne
```

- `empreintes.sha256` : empreintes du moteur, des modèles, des polices et des icônes. À régénérer
  seulement lors d'une mise à jour volontaire, avec justification dans la demande de fusion.
- La CSP attendue figure dans les deux scripts : la mettre à jour aux deux endroits si elle change.
- `visage_synthetique.js` : visage dessiné à la volée (68 repères génériques, empreinte aléatoire),
  injecté par `AirDeFamille.putCanvas` pour tester résultats, contrôle de qualité, masques et photos
  multiples sans aucune photo réelle.
- `iris_synthetique.js` : iris générés à paramètres connus (filaments, sillons, spirales, cryptes,
  collerette, reflet ; fond blanc ou œil avec paupières), importés comme des fichiers PNG pour tester
  l'onglet Iris de bout en bout sans aucune vraie photo.
- Écarts connus et non bloquants : `AXE_CONNUS` et `FOCUS_CONNUS` dans `e2e_public.py`, déclarés
  par règle et par élément, avec leur identifiant du registre. Les retirer une fois corrigés.
