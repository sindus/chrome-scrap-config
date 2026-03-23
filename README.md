# Scraping Config Builder

[![CI](https://github.com/sindus/chrome-scrap-config/actions/workflows/ci.yml/badge.svg)](https://github.com/sindus/chrome-scrap-config/actions/workflows/ci.yml)

Extension Chrome (Manifest V3) pour construire visuellement des configurations JSON de scraping — sans écrire une seule ligne de code.

## Fonctionnalités

- **Mode simple** — cliquez sur n'importe quel élément d'une page pour capturer son sélecteur CSS, puis téléchargez un fichier `scraping-config.json`.
- **Mode chapitrage** — construisez une liste ordonnée de `{page, path}` sur plusieurs pages, réorganisez-les en drag-and-drop, et exportez un `chapitrage.json`.
- **Sélection intelligente** — seuls les éléments de type bloc (`div`, `article`, `section`, `li`, `table`…) sont sélectionnables. Les liens et textes inline sont ignorés.
- **Génération de sélecteur robuste** — préfère les sélecteurs `#id`, sinon construit un chemin `tag.classe:nth-of-type(n)`.
- **État persistant** — le popup restaure son état depuis `chrome.storage.local` entre chaque ouverture/fermeture.

## Formats de sortie

**Mode simple** — `scraping-config.json`
```json
{
  "page": "https://example.com/article",
  "path": "article.post"
}
```

**Mode chapitrage** — `chapitrage.json`
```json
{
  "chapters": [
    { "page": "https://example.com/chapitre-1", "path": "div.content" },
    { "page": "https://example.com/chapitre-2", "path": "section.body" }
  ]
}
```

## Installation

1. Clonez ce dépôt.
2. Ouvrez Chrome et allez sur `chrome://extensions/`.
3. Activez le **Mode développeur** (toggle en haut à droite).
4. Cliquez sur **Charger l'extension non empaquetée** et sélectionnez le dossier racine du projet.
5. L'icône de l'extension apparaît dans la barre d'outils.

### Regénérer les icônes (optionnel)

```bash
node scripts/generate-icons.js
```

## Utilisation

### Mode simple

1. Naviguez vers la page à scraper.
2. Cliquez sur l'icône de l'extension et appuyez sur **Sélectionner un élément**.
3. Survolez les éléments (les blocs sont surlignés en rouge) et cliquez pour confirmer.
4. Rouvrez le popup — l'URL et le sélecteur CSS sont affichés.
5. Cliquez sur **Télécharger JSON** pour sauvegarder `scraping-config.json`.

> Appuyez sur **Échap** pour annuler la sélection.

### Mode chapitrage

1. Cliquez sur **Mode chapitrage** dans le popup.
2. Naviguez vers la première page, ouvrez le popup, et appuyez sur **Sélectionner sur cette page**.
3. Après avoir sélectionné un élément, rouvrez le popup — une section verte affiche la sélection en attente.
4. Cliquez sur **+ Ajouter à la liste** pour l'ajouter, ou **Ignorer** pour l'écarter.
5. Répétez les étapes 2–4 pour chaque page/chapitre.
6. Réordonnez les entrées en faisant glisser la poignée `⠿`, ou supprimez-les avec `×`.
7. Cliquez sur **Exporter le chapitrage JSON** pour télécharger `chapitrage.json`.
8. Cliquez sur **Quitter le mode chapitrage** pour revenir au mode simple.

## Structure du projet

```
chrome-scrap-config/
├── manifest.json           # Manifest de l'extension (MV3)
├── popup.html              # Interface du popup
├── popup.js                # Logique du popup (modes, storage, export)
├── content.js              # Content script (sélection des éléments)
├── lib/
│   └── selector.js         # Utilitaires CSS partagés (browser + Node.js)
├── scripts/
│   └── generate-icons.js   # Génération des icônes PNG
├── icons/                  # Icônes PNG (16, 32, 48, 128 px)
└── tests/
    ├── unit/               # Tests unitaires Jest (lib/selector.js)
    ├── integration/        # Tests d'intégration Jest (logique storage popup)
    └── e2e/                # Tests end-to-end Playwright (Chromium + extension)
```

## Développement

### Prérequis

- Node.js 18+
- npm

```bash
npm install
```

### Linting

```bash
npm run lint        # rapport d'erreurs
npm run lint:fix    # correction automatique
```

### Tests

| Commande | Description |
|---|---|
| `npm test` | Tests unitaires + intégration (Jest) |
| `npm run test:unit` | Tests unitaires uniquement |
| `npm run test:integration` | Tests d'intégration uniquement |
| `npm run test:e2e` | Tests end-to-end (Playwright, Chromium requis) |
| `npm run test:all` | Tous les tests |

> **Note :** Les tests E2E chargent l'extension dans un vrai Chromium. Ils nécessitent un affichage (ou un framebuffer virtuel en CI).

## CI / GitHub Actions

Trois jobs tournent sur chaque push et pull request :

| Job | Description |
|---|---|
| `lint` | ESLint sur tous les fichiers sources |
| `test` | Jest avec rapport de couverture |
| `e2e` | Playwright avec Chromium |

## Permissions

| Permission | Raison |
|---|---|
| `activeTab` | Lire l'URL et l'ID de l'onglet actif |
| `scripting` | Injecter `content.js` dans les pages ouvertes avant l'installation |
| `storage` | Persister la config et la liste des chapitres |

## Contribuer

Les pull requests sont les bienvenues. Pour les changements importants, ouvrez d'abord une issue pour discuter de ce que vous souhaitez modifier.
