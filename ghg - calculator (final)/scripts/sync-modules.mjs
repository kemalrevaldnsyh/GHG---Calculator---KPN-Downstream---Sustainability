#!/usr/bin/env node
/** Copy src/modules → public/modules (dev serves public/). */
import { cpSync, mkdirSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = resolve(root, 'src/modules');
const pubRoot = resolve(root, 'public/modules');

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src)) {
    const s = join(src, name);
    const d = join(dest, name);
    if (statSync(s).isDirectory()) copyDir(s, d);
    else cpSync(s, d);
  }
}

copyDir(srcRoot, pubRoot);
console.log('Synced src/modules → public/modules');
