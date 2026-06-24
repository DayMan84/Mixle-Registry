# Mixle Theme Registry

Public registry for installable Mixle theme packs and addons — modeled after the [ComfyUI Registry](https://github.com/Comfy-Org/registry-backend) publish/validate flow, but **static-first**: packs live in this repo, CI validates them, and the app imports from `catalog.json`.

**https://github.com/DayMan84/Mixle-Registry**

When publishing to the standalone registry repo, push these paths to the **repository root** (`catalog.json`, `packs/`, `schema/`, `scripts/`, `.github/`).

## Layout

```
├── catalog.json              # Registry index (builtins + published packs)
├── schema/
│   └── theme-manifest.v1.json
├── packs/
│   ├── apple-messages/       # Example pack (formerly built-in)
│   │   └── manifest.json
│   └── cyberpunk/            # Example pack (formerly built-in)
│       └── manifest.json
├── scripts/
│   ├── validate-packs.mjs    # CI validation
│   └── build-packs.mjs       # Build .mixle-pack archives
└── dist/                     # Generated archives (gitignored)
```

## Built-in vs registry themes

| ID | Source | Notes |
|----|--------|-------|
| `modern` | App builtin | Accent presets, full settings |
| `pixel` | App builtin | Pixel borders + avatars |
| `apple-messages` | Registry pack (bundled) | iOS-style inbox |
| `cyberpunk` | Registry pack (bundled) | Terminal chrome + outline bubbles |

## Publishing a theme

1. Fork [Mixle-Registry](https://github.com/DayMan84/Mixle-Registry) (or add a pack under `packs/your-theme/`).
2. Add `manifest.json` following `schema/theme-manifest.v1.json`.
3. Run `node scripts/validate-packs.mjs`.
4. Add an entry to `catalog.json` with `downloadUrl` pointing to the pack archive or manifest.
5. Open a PR — GitHub Actions runs validation automatically.

## Import flow (app)

1. App fetches `catalog.json` from `https://raw.githubusercontent.com/DayMan84/Mixle-Registry/main/catalog.json`.
2. User selects an uninstalled pack → download `.mixle-pack` (zip) or manifest JSON.
3. Pack is stored in app storage and validated against the schema.
4. `ThemePackEngine` builds a runtime `MixleTheme` from manifest tokens + capabilities.

## Local validation

```bash
node scripts/validate-packs.mjs
node scripts/build-packs.mjs
```

## Registry API (future)

This static catalog mirrors Comfy's registry **index** layer. A full backend (search, publishers, signed uploads) can wrap the same `catalog.json` + `.mixle-pack` format.
