// main.ts — hands the Merpati flight game in.
// Copies game/ and screenshots/ into the output directory, then writes
// dossier.json with buildDossier from vendor/makefun-game.ts.
// The output directory is $MAKEFUN_OUTPUT_DIR, or /output when unset.
// This program only ever writes into the output directory, never the repo.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';

const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 256 * 1024 },
  game_max_files: 993,
  game_max_bytes: 48 * 1024 * 1024,
  game_path_max_bytes: 1000,
};

function copyTree(name: string): void {
  const from = join(repoRoot, name);
  const to = join(outDir, name);
  if (!existsSync(from)) throw new Error(`main.ts: missing ${name}/ in the repository`);
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true, dereference: true });
}

// The game is not an entry without its screenshots: refuse a silent empty set.
function requireScreenshots(): void {
  const dir = join(repoRoot, 'screenshots');
  const shots = readdirSync(dir).filter((f) => !f.startsWith('.'));
  if (shots.length < 3) throw new Error(`main.ts: screenshots/ holds ${shots.length} images, need at least 3`);
}

mkdirSync(outDir, { recursive: true });
requireScreenshots();
copyTree('game');
copyTree('screenshots');

const dossier = buildDossier(outDir, caps);
writeFileSync(join(outDir, 'dossier.json'), dossier);
