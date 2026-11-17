import { cpSync, mkdirSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const www = join(root, 'www');

const SKIP = new Set([
  'android',
  'www',
  'node_modules',
  'ref',
  'test',
  'docs',
  'scripts',
  '.git',
  '.gitignore',
  '.idea',
  '.vscode',
  'package.json',
  'package-lock.json',
  'capacitor.config.json',
  'capacitor.config.ts',
  'README.md'
]);

const COPY_FILES = [
  'index.html',
  'shell.css',
  'tools-bridge.css',
  'sw.js',
  'manifest.webmanifest'
];

const COPY_DIRS = ['icons', 'js', 'tools'];

if (existsSync(www)) rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

for (const name of COPY_FILES) {
  const src = join(root, name);
  if (!existsSync(src)) {
    console.error('Missing:', src);
    process.exit(1);
  }
  cpSync(src, join(www, name));
}

for (const name of COPY_DIRS) {
  const src = join(root, name);
  if (!existsSync(src)) {
    console.error('Missing:', src);
    process.exit(1);
  }
  cpSync(src, join(www, name), { recursive: true });
}

// Guard: never ship android/ref into www if someone adds a broad copy later.
for (const entry of readdirSync(www)) {
  if (SKIP.has(entry)) {
    const bad = join(www, entry);
    if (statSync(bad).isDirectory()) rmSync(bad, { recursive: true, force: true });
  }
}

console.log('Synced PWA → www/');
