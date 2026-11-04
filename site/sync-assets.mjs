#!/usr/bin/env node
/**
 * Sync marketing visual assets to VitePress public assets directory.
 * Uses only node:fs.
 */

import { existsSync, mkdirSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '../docs/marketplace/assets');
const DEST = join(HERE, 'public/assets');

mkdirSync(DEST, { recursive: true });

if (existsSync(SRC)) {
  cpSync(SRC, DEST, { recursive: true });
  console.log(`Assets synced from ${SRC} to ${DEST}`);
} else {
  console.log(`Source assets directory not found at ${SRC}`);
}
