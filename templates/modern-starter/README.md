# Modern starter template

Token-only theme pack that mirrors the **built-in Modern** layout shipped in the Mixle app. Use this as the starting point when creating gallery themes that only change colors, typography tokens, and radii — no custom inbox layout module required.

## What you get

- `inboxLayout: modern` — uses the app's built-in inbox scaffold (search header, standard conversation rows).
- `bubbleStyle: default` — rounded bubbles with tails.
- Light + dark token sets with violet accent (`#7C3AED`).
- Full `purple` scale for selection chrome and accents.

## Fork workflow

1. Copy this folder to `packs/your-theme-id/`.
2. Change `id`, `label`, `description`, and `publisher` in `manifest.json`.
3. Customize `tokens.light` / `tokens.dark` (and `capabilities` if needed).
4. Add `preview.png` and reference it from `preview.imageUrl`.
5. Run `node scripts/validate-packs.mjs` from the registry root.
6. Open a PR with a **catalog entry** using `"approvalStatus": "pending"`.
7. After Mixle review, status becomes `"approved"` and the pack appears in the gallery.

## Layout engines vs token-only

| Pack type | `featureModule` in catalog | Custom inbox UI |
|-----------|---------------------------|-----------------|
| Token-only (this template) | omit | No — uses built-in modern |
| Apple Messages | `theme_pack_apple_messages` | Yes |
| CyberPunk | `theme_pack_cyberpunk` | Yes |

Custom layout engines require a Play Feature Delivery module in the Mixle Android app; token-only packs do not.
