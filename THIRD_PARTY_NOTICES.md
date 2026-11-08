# Composants tiers

L'application redistribue les composants suivants, sous leur propre licence.
Ces licences s'appliquent à ces composants seulement ; le reste du dépôt relève de `LICENSE`.

| Composant | Fichiers | Version | Licence | Texte |
|---|---|---|---|---|
| @vladmandic/face-api (Vladimir Mandic) | `vendor/face-api.js` | 1.7.15 (identique au paquet npm) | MIT | [licences/face-api-MIT.txt](licences/face-api-MIT.txt) |
| Modèles face-api (détection, repères, reconnaissance, âge), issus de face-api.js de Vincent Mühler | `model/` (fichiers `.bin` renommés en `.wasm`) | 1.7.15 (identiques au paquet npm) | MIT | [licences/face-api.js-MIT.txt](licences/face-api.js-MIT.txt) |
| TensorFlow.js (Google), inclus dans `vendor/face-api.js` | `vendor/face-api.js` | 4.22 | Apache 2.0 | [licences/Apache-2.0.txt](licences/Apache-2.0.txt) |
| Familjen Grotesk (Familjen Grotesk Project Authors) | `fonts/familjen-grotesk-*.woff2` | 5.3.0 (Fontsource) | SIL OFL 1.1 | [fonts/OFL-familjen-grotesk.txt](fonts/OFL-familjen-grotesk.txt) |
| Martian Mono (Martian Mono Project Authors) | `fonts/martian-mono-*.woff2` | 5.3.0 (Fontsource) | SIL OFL 1.1 | [fonts/OFL-martian-mono.txt](fonts/OFL-martian-mono.txt) |

L'intégrité de ces fichiers est contrôlée à chaque demande de fusion par `tests/empreintes.sha256`.
