# Tests publics

Aucune photo réelle ici : les images de test sont générées à la volée.
Les tests de régression sur la banque familiale restent privés.

```bash
bash tests/garde_fous.sh                     # photos, banque, descripteurs, secrets, CSP
pip install playwright pillow && python -m playwright install chromium
npm install --prefix tests --no-save axe-core@4
python tests/e2e_public.py .                 # e2e, accessibilité, hors ligne
```

Les écarts connus et non bloquants sont listés dans `CONNUS` (fin de `e2e_public.py`),
avec leur identifiant du registre. Les retirer de la liste une fois corrigés.
