#!/usr/bin/env node
/**
 * Validates Mixle theme pack manifests, catalog.json, and starter templates.
 *
 * Usage: node scripts/validate-packs.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PACKS_DIR = join(ROOT, 'packs');
const TEMPLATES_DIR = join(ROOT, 'templates');
const CATALOG_PATH = join(ROOT, 'catalog.json');

const HEX = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
const ID = /^[a-z][a-z0-9-]*[a-z0-9]$/;
const MODULE = /^[a-z][a-z0-9_]*[a-z0-9_]$/;
const VERSION = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
const APPROVAL = new Set(['pending', 'approved', 'rejected', 'official']);
const GALLERY_VISIBLE = new Set(['approved', 'official']);

const REQUIRED_CAPS = [
  'inboxLayout', 'avatarShape', 'bubbleStyle', 'supportsColorMode', 'supportsAccentPreset',
  'supportsPixelateAvatars', 'supportsCompactConversationList', 'supportsConversationBubbleColors',
  'usesPinnedGridLayout', 'forcesDarkMode', 'pixelFrameBorders',
];

const INBOX_LAYOUTS = new Set(['modern', 'apple', 'cyberpunk']);
const AVATAR_SHAPES = new Set(['rounded', 'circle', 'pixel']);
const BUBBLE_STYLES = new Set(['default', 'ios-tail', 'cyberpunk-outline']);
const LAYOUT_ENGINES = new Set(['apple-messages', 'cyberpunk']);

const TOKEN_COLOR_KEYS = [
  'background', 'surface', 'surfaceSecondary', 'border', 'borderLight',
  'textPrimary', 'textSecondary', 'textTertiary', 'textAccent', 'accent',
  'error', 'warning', 'success', 'overlay',
];

const BUBBLE_KEYS = [
  'incoming', 'outgoing', 'incomingText', 'outgoingText', 'incomingBorder', 'outgoingBorder',
];

const INBOX_KEYS = [
  'background', 'rowBackground', 'headerBackground', 'titleText', 'primaryText',
  'secondaryText', 'timestampText', 'divider', 'unreadDot', 'avatarFallbackBackground',
  'searchBackground', 'searchText', 'searchPlaceholder', 'composeButtonBackground',
  'composeIcon', 'accent', 'editText', 'chevron', 'headerButtonBackground',
];

const RADII_KEYS = ['sm', 'md', 'lg', 'xl', 'full', 'composer', 'bubble'];
const MAX_PREVIEW_IMAGES = 4;

let errors = 0;

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  errors += 1;
}

function assertHex(value, path) {
  if (typeof value !== 'string' || !HEX.test(value)) {
    fail(`${path} must be a hex color, got ${JSON.stringify(value)}`);
  }
}

function validateCapabilities(caps, path) {
  if (!caps || typeof caps !== 'object') {
    fail(`${path} must be an object`);
    return;
  }
  for (const key of REQUIRED_CAPS) {
    if (!(key in caps)) fail(`${path}.${key} is required`);
  }
  if (!INBOX_LAYOUTS.has(caps.inboxLayout)) fail(`${path}.inboxLayout invalid`);
  if (!AVATAR_SHAPES.has(caps.avatarShape)) fail(`${path}.avatarShape invalid`);
  if (!BUBBLE_STYLES.has(caps.bubbleStyle)) fail(`${path}.bubbleStyle invalid`);
  for (const key of REQUIRED_CAPS.slice(3)) {
    if (key in caps && typeof caps[key] !== 'boolean') {
      fail(`${path}.${key} must be boolean`);
    }
  }
}

function previewGalleryUrls(preview) {
  if (Array.isArray(preview?.imageUrls) && preview.imageUrls.length > 0) {
    return preview.imageUrls.slice(0, MAX_PREVIEW_IMAGES);
  }
  if (preview?.imageUrl) return [preview.imageUrl];
  return [];
}

function validatePreview(preview, path, requireImage = false) {
  for (const key of ['background', 'surface', 'outgoingBubble', 'incomingBubble', 'accent']) {
    assertHex(preview?.[key], `${path}.${key}`);
  }
  if (preview?.imageUrls != null) {
    if (!Array.isArray(preview.imageUrls)) {
      fail(`${path}.imageUrls must be an array`);
    } else {
      if (preview.imageUrls.length > MAX_PREVIEW_IMAGES) {
        fail(`${path}.imageUrls must have at most ${MAX_PREVIEW_IMAGES} items`);
      }
      for (const [i, url] of preview.imageUrls.entries()) {
        if (typeof url !== 'string' || !url.trim()) {
          fail(`${path}.imageUrls[${i}] must be a non-empty string`);
        }
      }
    }
  }
  if (requireImage && previewGalleryUrls(preview).length === 0) {
    fail(`${path} requires imageUrl or imageUrls for catalog entries`);
  }
}

function assertPreviewImageFiles(preview, baseDir, filePath) {
  for (const rel of previewGalleryUrls(preview)) {
    const imagePath = join(baseDir, rel);
    if (!existsSync(imagePath)) {
      fail(`${filePath}: preview image missing at ${imagePath}`);
    }
  }
}

function validateTokenSet(tokens, path) {
  if (!tokens || typeof tokens !== 'object') {
    fail(`${path} must be an object`);
    return;
  }
  for (const key of TOKEN_COLOR_KEYS) {
    assertHex(tokens[key], `${path}.${key}`);
  }
  if (!tokens.bubbles) fail(`${path}.bubbles is required`);
  else for (const key of BUBBLE_KEYS) assertHex(tokens.bubbles[key], `${path}.bubbles.${key}`);
  if (tokens.inbox) {
    for (const key of INBOX_KEYS) assertHex(tokens.inbox[key], `${path}.inbox.${key}`);
  }
  if (!tokens.radii) fail(`${path}.radii is required`);
  else for (const key of RADII_KEYS) {
    if (typeof tokens.radii[key] !== 'number') fail(`${path}.radii.${key} must be a number`);
  }
}

function validateLayoutModuleFields(manifest, filePath) {
  const layout = manifest.capabilities?.inboxLayout;
  const needsModule = layout === 'apple' || layout === 'cyberpunk';
  if (needsModule) {
    if (!manifest.featureModule || !MODULE.test(manifest.featureModule)) {
      fail(`${filePath}: featureModule required for inboxLayout ${layout}`);
    }
    if (!manifest.layoutEngine || !LAYOUT_ENGINES.has(manifest.layoutEngine)) {
      fail(`${filePath}: layoutEngine must be apple-messages or cyberpunk for custom inbox layouts`);
    }
  } else if (manifest.featureModule) {
    fail(`${filePath}: token-only modern packs must not declare featureModule`);
  }
}

function validateManifest(manifest, filePath, { isTemplate = false } = {}) {
  const id = manifest.id;
  if (!id || !ID.test(id)) fail(`${filePath}: invalid id ${JSON.stringify(id)}`);
  if (!manifest.version || !VERSION.test(manifest.version)) {
    fail(`${filePath}: invalid version`);
  }
  if (!manifest.label || typeof manifest.label !== 'string') fail(`${filePath}: label required`);
  if (!manifest.publisher) fail(`${filePath}: publisher required`);
  validateCapabilities(manifest.capabilities, `${filePath}.capabilities`);
  validatePreview(manifest.preview, `${filePath}.preview`);
  if (!isTemplate && previewGalleryUrls(manifest.preview).length > 0) {
    assertPreviewImageFiles(manifest.preview, dirname(filePath), filePath);
  }
  if (!manifest.tokens?.light) fail(`${filePath}: tokens.light required`);
  validateTokenSet(manifest.tokens.light, `${filePath}.tokens.light`);
  if (manifest.tokens.dark) {
    validateTokenSet(manifest.tokens.dark, `${filePath}.tokens.dark`);
  }
  if (manifest.capabilities.forcesDarkMode && manifest.tokens.dark) {
    fail(`${filePath}: forcesDarkMode packs should use tokens.light only`);
  }
  if (!isTemplate) {
    validateLayoutModuleFields(manifest, filePath);
  } else {
    if (manifest.template !== true) {
      fail(`${filePath}: templates must set "template": true`);
    }
    if (!manifest.basedOn) {
      fail(`${filePath}: templates must declare basedOn`);
    }
  }
}

function listPackDirs() {
  return readdirSync(PACKS_DIR).filter((name) => {
    const manifestPath = join(PACKS_DIR, name, 'manifest.json');
    return existsSync(manifestPath) && statSync(join(PACKS_DIR, name)).isDirectory();
  });
}

function listTemplateDirs() {
  if (!existsSync(TEMPLATES_DIR)) return [];
  return readdirSync(TEMPLATES_DIR).filter((name) => {
    const manifestPath = join(TEMPLATES_DIR, name, 'manifest.json');
    return existsSync(manifestPath) && statSync(join(TEMPLATES_DIR, name)).isDirectory();
  });
}

console.log('Validating theme packs...');
for (const packId of listPackDirs()) {
  const manifestPath = join(PACKS_DIR, packId, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.id !== packId) {
    fail(`${manifestPath}: id ${manifest.id} does not match directory ${packId}`);
  }
  if (manifest.template === true) {
    fail(`${manifestPath}: published packs under packs/ must not set template: true`);
  }
  validateManifest(manifest, manifestPath);
  console.log(`  OK  ${packId}@${manifest.version}`);
}

console.log('Validating starter templates...');
for (const templateId of listTemplateDirs()) {
  const manifestPath = join(TEMPLATES_DIR, templateId, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.id !== templateId) {
    fail(`${manifestPath}: id ${manifest.id} does not match directory ${templateId}`);
  }
  validateManifest(manifest, manifestPath, { isTemplate: true });
  console.log(`  OK  template ${templateId}@${manifest.version}`);
}

console.log('Validating catalog.json...');
const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
const packIdsOnDisk = new Set(listPackDirs());
const catalogIds = new Set();
const templateIds = new Set((catalog.templates ?? []).map((t) => t.id));

for (const entry of catalog.packs ?? []) {
  if (!entry.id || catalogIds.has(entry.id)) fail(`catalog duplicate id ${entry.id}`);
  catalogIds.add(entry.id);
  if (!entry.approvalStatus || !APPROVAL.has(entry.approvalStatus)) {
    fail(`catalog.packs.${entry.id}: approvalStatus must be pending|approved|rejected|official`);
  }
  if (!packIdsOnDisk.has(entry.id)) {
    fail(`catalog references missing pack ${entry.id}`);
  }
  const manifestPath = join(PACKS_DIR, entry.id, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (entry.version !== manifest.version) {
    fail(`catalog version for ${entry.id} (${entry.version}) != manifest (${manifest.version})`);
  }
  if (entry.layoutEngine && entry.layoutEngine !== manifest.layoutEngine) {
    fail(`catalog layoutEngine for ${entry.id} != manifest`);
  }
  if (entry.featureModule && entry.featureModule !== manifest.featureModule) {
    fail(`catalog featureModule for ${entry.id} != manifest`);
  }
  validatePreview(entry.preview, `catalog.packs.${entry.id}.preview`, true);
  for (const rel of previewGalleryUrls(entry.preview)) {
    const imagePath = join(PACKS_DIR, entry.id, rel.replace(/^packs\/[^/]+\//, ''));
    if (!existsSync(imagePath)) {
      const altPath = join(ROOT, rel);
      if (!existsSync(altPath)) {
        fail(`catalog preview image missing for ${entry.id}: ${rel}`);
      }
    }
  }
  const needsModule = entry.capabilities?.inboxLayout === 'apple' ||
    entry.capabilities?.inboxLayout === 'cyberpunk';
  if (needsModule && !entry.featureModule) {
    fail(`catalog.packs.${entry.id}: featureModule required for custom inbox layouts`);
  }
}

for (const packId of packIdsOnDisk) {
  if (!catalogIds.has(packId)) {
    fail(`pack ${packId} exists on disk but is missing from catalog.json`);
  }
}

for (const template of catalog.templates ?? []) {
  if (!template.id || templateIds.has(template.id) === false) continue;
  if (!ID.test(template.id)) fail(`catalog template invalid id ${template.id}`);
  if (!template.manifestUrl) fail(`catalog.templates.${template.id}: manifestUrl required`);
  const manifestPath = join(ROOT, template.manifestUrl);
  if (!existsSync(manifestPath)) {
    fail(`catalog template manifest missing: ${template.manifestUrl}`);
  } else {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (manifest.id !== template.id) {
      fail(`template ${template.id} manifest id mismatch (${manifest.id})`);
    }
    if (template.basedOn && manifest.basedOn && template.basedOn !== manifest.basedOn) {
      fail(`template ${template.id}: basedOn mismatch between catalog and manifest`);
    }
  }
}

if (!Array.isArray(catalog.builtins) || catalog.builtins.length < 2) {
  fail('catalog.builtins must list at least modern and pixel');
}

const builtinIds = new Set((catalog.builtins ?? []).map((b) => b.id));
if (!builtinIds.has('modern') || !builtinIds.has('pixel')) {
  fail('catalog.builtins must include modern and pixel');
}

if (catalog.approvalWorkflow?.defaultStatus &&
    !APPROVAL.has(catalog.approvalWorkflow.defaultStatus)) {
  fail('catalog.approvalWorkflow.defaultStatus invalid');
}

console.log(
  `  OK  catalog (${catalog.packs.length} packs, ${(catalog.templates ?? []).length} templates, ${catalog.builtins.length} builtins)`,
);

if (errors > 0) {
  console.error(`\nValidation failed with ${errors} error(s).`);
  process.exit(1);
}
console.log('\nAll theme packs valid.');
