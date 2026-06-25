# Mixle Theme Registry

Public registry for installable Mixle theme packs — the **approval-gated gallery** for paid theming in the Mixle Android app.

**https://github.com/DayMan84/Mixle-Registry**

## Layout

```
├── catalog.json                 # Gallery index (packs, templates, builtins, approval workflow)
├── schema/
│   ├── catalog.v1.json          # Catalog + approval schema
│   └── theme-manifest.v1.json   # Per-pack manifest schema
├── packs/                       # Published gallery packs (PR-reviewed)
│   ├── apple-messages/
│   └── cyberpunk/
├── templates/                   # Forkable starters (not in gallery until published)
│   └── modern-starter/
├── scripts/
│   ├── validate-packs.mjs
│   └── build-packs.mjs
└── dist/                        # Generated .mixle-pack archives (gitignored)
```

## Built-in vs gallery themes

| ID | Source | Gallery | Notes |
|----|--------|---------|-------|
| `modern` | App built-in | No (free) | Accent presets, full settings |
| `pixel` | App built-in | No (free) | Pixel borders + avatars |
| `apple-messages` | Registry | Yes (`official`) | Requires `theme_pack_apple_messages` module |
| `cyberpunk` | Registry | Yes (`official`) | Requires `theme_pack_cyberpunk` module |

## Approval workflow

The app only shows packs where `approvalStatus` is **`approved`** or **`official`**:

| Status | Gallery visible | Meaning |
|--------|----------------|---------|
| `pending` | No | Submitted, awaiting Mixle review |
| `approved` | Yes | Community pack approved by Mixle |
| `rejected` | No | Did not pass review |
| `official` | Yes | First-party Mixle pack |

New submissions must use `"approvalStatus": "pending"` in `catalog.json`. Mixle updates the status after review.

## Publishing a community theme

1. Copy `templates/modern-starter/` to `packs/your-theme-id/` (or fork an existing pack).
2. Edit `manifest.json` — colors, capabilities, label, publisher.
3. Add `preview.png` and set `preview.imageUrl`.
4. Run `node scripts/validate-packs.mjs`.
5. Add a catalog entry with `"approvalStatus": "pending"` and `downloadUrl`.
6. Open a PR — CI validates manifests and catalog consistency.

### Token-only vs layout-engine packs

| Type | `inboxLayout` | `featureModule` | Custom inbox UI |
|------|---------------|-----------------|-----------------|
| Token-only (modern starter) | `modern` | omit | No |
| Apple Messages | `apple` | `theme_pack_apple_messages` | Yes |
| CyberPunk | `cyberpunk` | `theme_pack_cyberpunk` | Yes |

Token-only packs change colors/tokens only. Layout-engine packs ship UI via Play Feature Delivery modules in the Mixle app.

## Modern starter template

`templates/modern-starter/` mirrors the built-in **Modern** theme (violet accent, light/dark tokens, standard inbox). Creators fork this to publish color variants without writing Kotlin layout code.

## App import flow

1. User unlocks the **theme gallery** (paid entitlement).
2. App fetches `catalog.json` from this repo.
3. Gallery lists packs filtered by `approvalStatus`.
4. Install: download manifest → optional `featureModule` via Play Feature Delivery → `ThemePackEngine` applies tokens.
5. Users with **submit** entitlement see starter templates for authoring.

## Local validation

```bash
node scripts/validate-packs.mjs
node scripts/build-packs.mjs
```

## Catalog fields (pack entries)

| Field | Required | Description |
|-------|----------|-------------|
| `approvalStatus` | Yes | `pending` / `approved` / `rejected` / `official` |
| `featureModule` | For apple/cyberpunk | Play module name (underscores only) |
| `layoutEngine` | For apple/cyberpunk | Theme id registered by the module |
| `bundled` | No | Auto-install manifest when gallery unlocked |
| `downloadUrl` | Yes | Path to manifest JSON or `.mixle-pack` |
