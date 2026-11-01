/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: volatility layering rules (ADR-002), checked on every source file's imports.
 */

import * as fs from 'fs';
import * as path from 'path';

const SRC = path.join(__dirname, '..', 'src');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir).flatMap(name => {
    const p = path.join(dir, name);
    return fs.statSync(p).isDirectory() ? sourceFiles(p) : /\.tsx?$/.test(name) ? [p] : [];
  });
}

/** Import specifiers of a file, resolved to a path under src/ when relative. */
function importsOf(file: string): string[] {
  const text = fs.readFileSync(file, 'utf8');
  const specs = Array.from(text.matchAll(/(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]/g)).map(m => m[1]);
  return specs.map(s => (s.startsWith('.') ? path.relative(SRC, path.resolve(path.dirname(file), s)) : s));
}

const rel = (file: string) => path.relative(SRC, file);
const files = sourceFiles(SRC);
const inside = (spec: string, folder: string) => spec === folder || spec.startsWith(folder + '/');

function violations(filter: (f: string) => boolean, allowed: (spec: string, file: string) => boolean): string[] {
  return files.filter(f => filter(rel(f))).flatMap(f => importsOf(f).filter(s => !allowed(s, rel(f))).map(s => `${rel(f)} imports ${s}`));
}

describe('ADR-002 volatility layering', () => {
  it('has the four service layers and the contract', () => {
    for (const folder of ['contract', 'engine', 'accessor', 'manager']) {
      expect(fs.existsSync(path.join(SRC, folder))).toBe(true);
    }
  });

  it('Engines import only contracts', () => {
    expect(violations(f => inside(f, 'engine'), s => inside(s, 'contract'))).toEqual([]);
  });

  it('Managers import only contracts', () => {
    expect(violations(f => inside(f, 'manager'), s => inside(s, 'contract'))).toEqual([]);
  });

  it('only Accessors import @forge/api or @forge/kvs', () => {
    expect(violations(f => !inside(f, 'accessor'), s => !/^@forge\/(api|kvs)$/.test(s))).toEqual([]);
  });

  it('Accessors import only contracts, other accessors and the platform', () => {
    expect(violations(f => inside(f, 'accessor'), s => inside(s, 'contract') || inside(s, 'accessor') || /^@forge\/(api|kvs)$/.test(s))).toEqual([]);
  });

  it('only index.ts imports Default implementations', () => {
    expect(violations(f => f !== 'index.ts', s => !/\/default-[^/]+$/.test(s))).toEqual([]);
  });

  it('the UI imports only contracts, UI code, React and the UI Kit bridge', () => {
    expect(violations(f => inside(f, 'frontend') || inside(f, 'ui'),
      s => inside(s, 'contract') || inside(s, 'ui') || inside(s, 'frontend') || ['react', '@forge/react', '@forge/bridge'].includes(s))).toEqual([]);
  });

  it('contracts import only contracts', () => {
    expect(violations(f => inside(f, 'contract'), s => inside(s, 'contract'))).toEqual([]);
  });

  it('production code has no NODE_ENV branch', () => {
    expect(files.filter(f => fs.readFileSync(f, 'utf8').includes('NODE_ENV')).map(rel)).toEqual([]);
  });
});
