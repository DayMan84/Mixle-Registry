#!/usr/bin/env node
/**
 * Validates Mixle theme pack manifests against schema/theme-manifest.v1.json
 * and ensures catalog.json references match packs on disk.
 *
 * Usage: node scripts/validate-packs.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PACKS_DIR = join(ROOT, 'packs');
const CATALOG_PATH = join(ROOT, 'catalog.json');

const HEX = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
const ID = /^[a-z][a-z0-9-]*[a-z0-9]$/;
const VERSION = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;

const REQUIRED_CAPS = [
  'inboxLayout', 'avatarShape', 'bubbleStyle', 'supportsColorMode', 'supportsAccentPreset',
  'supportsPixelateAvatars', 'supportsCompactConversationList', 'supportsConversationBubbleColors',
  'usesPinnedGridLayout', 'forcesDarkMode', 'pixelFrameBorders',
];

const INBOX_LAYOUTS = new Set(['modern', 'apple', 'cyberpunk']);
const AVATAR_SHAPES = new Set(['rounded', 'circle', 'pixel']);
const BUBBLE_STYLES = new Set(['default', 'ios-tail', 'cyberpunk-outline']);

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

function validatePreview(preview, path, requireImage = false) {
  for (const key of ['background', 'surface', 'outgoingBubble', 'incomingBubble', 'accent']) {
    assertHex(preview?.[key], `${path}.${key}`);
  }
  if (requireImage && !preview?.imageUrl) {
    fail(`${path}.imageUrl is required in catalog entries`);
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

function validateManifest(manifest, filePath) {
  const id = manifest.id;
  if (!id || !ID.test(id)) fail(`${filePath}: invalid id ${JSON.stringify(id)}`);
  if (!manifest.version || !VERSION.test(manifest.version)) {
    fail(`${filePath}: invalid version`);
  }
  if (!manifest.label || typeof manifest.label !== 'string') fail(`${filePath}: label required`);
  if (!manifest.publisher) fail(`${filePath}: publisher required`);
  validateCapabilities(manifest.capabilities, `${filePath}.capabilities`);
  validatePreview(manifest.preview, `${filePath}.preview`);
  if (manifest.preview?.imageUrl) {
    const imagePath = join(PACKS_DIR, manifest.id, manifest.preview.imageUrl);
    if (!existsSync(imagePath)) {
      fail(`${filePath}: preview.imageUrl file missing at ${imagePath}`);
    }
  }
  if (!manifest.tokens?.light) fail(`${filePath}: tokens.light required`);
  validateTokenSet(manifest.tokens.light, `${filePath}.tokens.light`);
  if (manifest.tokens.dark) {
    validateTokenSet(manifest.tokens.dark, `${filePath}.tokens.dark`);
  }
  if (manifest.capabilities.forcesDarkMode && manifest.tokens.dark) {
    fail(`${filePath}: forcesDarkMode packs should use tokens.light only`);
  }
}

function listPackDirs() {
  return readdirSync(PACKS_DIR).filter((name) => {
    const manifestPath = join(PACKS_DIR, name, 'manifest.json');
    return existsSync(manifestPath) && statSync(join(PACKS_DIR, name)).isDirectory();
  });
}

console.log('Validating theme packs...');
for (const packId of listPackDirs()) {
  const manifestPath = join(PACKS_DIR, packId, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.id !== packId) {
    fail(`${manifestPath}: id ${manifest.id} does not match directory ${packId}`);
  }
  validateManifest(manifest, manifestPath);
  console.log(`  OK  ${packId}@${manifest.version}`);
}

console.log('Validating catalog.json...');
const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
const packIdsOnDisk = new Set(listPackDirs());
const catalogIds = new Set();

for (const entry of catalog.packs ?? []) {
  if (!entry.id || catalogIds.has(entry.id)) fail(`catalog duplicate id ${entry.id}`);
  catalogIds.add(entry.id);
  if (!packIdsOnDisk.has(entry.id)) {
    fail(`catalog references missing pack ${entry.id}`);
  }
  const manifestPath = join(PACKS_DIR, entry.id, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (entry.version !== manifest.version) {
    fail(`catalog version for ${entry.id} (${entry.version}) != manifest (${manifest.version})`);
  }
  validatePreview(entry.preview, `catalog.packs.${entry.id}.preview`, true);
  if (entry.preview?.imageUrl) {
    const imagePath = join(PACKS_DIR, entry.id, entry.preview.imageUrl.replace(/^packs\/[^/]+\//, ''));
    if (!existsSync(imagePath)) {
      const altPath = join(ROOT, entry.preview.imageUrl);
      if (!existsSync(altPath)) {
        fail(`catalog preview image missing for ${entry.id}`);
      }
    }
  }
}

for (const packId of packIdsOnDisk) {
  if (!catalogIds.has(packId)) {
    fail(`pack ${packId} exists on disk but is missing from catalog.json`);
  }
}

if (!Array.isArray(catalog.builtins) || catalog.builtins.length < 2) {
  fail('catalog.builtins must list at least modern and pixel');
}

console.log(`  OK  catalog (${catalog.packs.length} packs, ${catalog.builtins.length} builtins)`);

if (errors > 0) {
  console.error(`\nValidation failed with ${errors} error(s).`);
  process.exit(1);
}
console.log('\nAll theme packs valid.');
