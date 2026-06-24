#!/usr/bin/env node
/**
 * Builds distributable .mixle-pack archives (zip) for each theme pack.
 * Output: dist/{id}-{version}.mixle-pack
 */
import { readFileSync, mkdirSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PACKS_DIR = join(ROOT, 'packs');
const DIST_DIR = join(ROOT, 'dist');

mkdirSync(DIST_DIR, { recursive: true });

function listPackDirs() {
  return readdirSync(PACKS_DIR).filter((name) => {
    const manifestPath = join(PACKS_DIR, name, 'manifest.json');
    return existsSync(manifestPath) && statSync(join(PACKS_DIR, name)).isDirectory();
  });
}

for (const packId of listPackDirs()) {
  const packDir = join(PACKS_DIR, packId);
  const manifest = JSON.parse(readFileSync(join(packDir, 'manifest.json'), 'utf8'));
  const outName = `${manifest.id}-${manifest.version}.mixle-pack`;
  const outPath = join(DIST_DIR, outName);
  const isWin = process.platform === 'win32';
  if (isWin) {
    const zipPath = `${outPath}.zip`;
    execSync(
      `powershell -NoProfile -Command "Compress-Archive -Path '${packDir}\\*' -DestinationPath '${zipPath}' -Force"`,
      { stdio: 'inherit' },
    );
    execSync(`powershell -NoProfile -Command "Move-Item -Path '${zipPath}' -Destination '${outPath}' -Force"`, {
      stdio: 'inherit',
    });
  } else {
    execSync(`cd "${packDir}" && zip -r "${outPath}" .`, { stdio: 'inherit' });
  }
  console.log(`Built ${outName}`);
}
