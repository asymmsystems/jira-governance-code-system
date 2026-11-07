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

  it('only Accessors import @forge/api, @forge/kvs, @forge/events or @forge/object-store (ADR-015)', () => {
    expect(violations(f => !inside(f, 'accessor'), s => !/^@forge\/(api|kvs|events|object-store)$/.test(s))).toEqual([]);
  });

  it('Accessors import only contracts, other accessors and the platform (Node crypto for signatures, ADR-012 and ADR-015)', () => {
    expect(violations(f => inside(f, 'accessor'), s => inside(s, 'contract') || inside(s, 'accessor') || /^@forge\/(api|kvs|events|object-store)$/.test(s) || s === 'crypto')).toEqual([]);
  });

  it('ADR-015: crypto, the queue and Object Store are imported only in src/accessor/', () => {
    expect(violations(f => !inside(f, 'accessor'), s => !['crypto', '@forge/events', '@forge/object-store'].includes(s))).toEqual([]);
  });

  it('only index.ts imports Default implementations', () => {
    expect(violations(f => f !== 'index.ts', s => !/\/default-[^/]+$/.test(s))).toEqual([]);
  });

  it('the UI imports only contracts, UI code, brand primitives, React, the UI Kit bridge and the shared admin panel', () => {
    expect(violations(f => inside(f, 'frontend') || inside(f, 'ui'),
      s => inside(s, 'contract') || inside(s, 'ui') || inside(s, 'frontend') || inside(s, 'brand') || ['react', '@forge/react', '@forge/bridge'].includes(s)
        || (s === '@asymm/jira-ui' && inside(s, '@asymm/jira-ui')))).toEqual([]);
  });

  it('brand components import only React, @forge/react and brand code', () => {
    expect(violations(f => inside(f, 'brand'),
      s => inside(s, 'brand') || ['react', '@forge/react'].includes(s))).toEqual([]);
  });

  it('contracts import only contracts', () => {
    expect(violations(f => inside(f, 'contract'), s => inside(s, 'contract'))).toEqual([]);
  });

  it('B-22: UI logic modules import no React and no UI Kit', () => {
    expect(violations(f => inside(f, 'ui'), s => inside(s, 'contract') || inside(s, 'ui'))).toEqual([]);
  });

  it('B-22: React files export components, not logic functions', () => {
    const logic = files.filter(f => inside(rel(f), 'frontend') || (inside(rel(f), 'brand') && f.endsWith('.tsx')))
      .flatMap(f => Array.from(fs.readFileSync(f, 'utf8').matchAll(/^export (?:async )?function ([a-z]\w*)/gm)).map(m => `${rel(f)}: ${m[1]}`));
    expect(logic).toEqual([]);
  });

  it('B-22: no test asserts only that a value is defined', () => {
    const testDir = path.join(__dirname);
    const all = (dir: string): string[] => fs.readdirSync(dir).flatMap(n => {
      const p = path.join(dir, n);
      return fs.statSync(p).isDirectory() ? all(p) : /\.test\.tsx?$/.test(n) ? [p] : [];
    });
    const hits = all(testDir).filter(f => f !== __filename && /\.toBeDefined\(\)/.test(fs.readFileSync(f, 'utf8'))).map(f => path.relative(testDir, f));
    expect(hits).toEqual([]);
  });

  it('B-24: every source file carries the Asymm Systems copyright and @author Fahim Farook', () => {
    const missing = files.filter(f => {
      const head = fs.readFileSync(f, 'utf8').split('\n').slice(0, 6).join('\n');
      return !head.includes('Copyright (c) 2026 Asymm Systems') || !head.includes('@author Fahim Farook');
    }).map(rel);
    expect(missing).toEqual([]);
  });

  it('B-24: no source file uses the any type', () => {
    const uses = files.flatMap(f => fs.readFileSync(f, 'utf8').split('\n')
      .map((line, i) => ({ line, at: `${rel(f)}:${i + 1}` }))
      .filter(({ line }) => /:\s*any\b|<any>|\bas any\b|\bany\[\]/.test(line))
      .map(({ at }) => at));
    expect(uses).toEqual([]);
  });

  it('production code has no NODE_ENV branch', () => {
    expect(files.filter(f => fs.readFileSync(f, 'utf8').includes('NODE_ENV')).map(rel)).toEqual([]);
  });

  it('B-43: outside src/brand/, no source file uses raw Atlassian tokens (color., elevation., space., radius.) or hex colors', () => {
    const rawTokens = files.filter(f => !inside(rel(f), 'brand'))
      .flatMap(f => fs.readFileSync(f, 'utf8').split('\n')
        .map((line, i) => ({ line, at: `${rel(f)}:${i + 1}` }))
        .filter(({ line }) => /(?:['"`](?:color|elevation|space|radius)\.|#[0-9a-fA-F]{3,8}\b)/.test(line))
        .map(({ at }) => at));
    expect(rawTokens).toEqual([]);
  });

  it('no source file contains raw HTML tags (Forge native UI Kit uses Forge components only)', () => {
    const rawHtml = files
      .flatMap(f => fs.readFileSync(f, 'utf8').split('\n')
        .map((line, i) => ({ line, at: `${rel(f)}:${i + 1}` }))
        .filter(({ line }) => /<(strong|b|i|em|span|div|p|h1|h2|h3|h4|h5|h6|table|tr|td|th|ul|li|ol|a)[ >]/.test(line))
        .map(({ at }) => at));
    expect(rawHtml).toEqual([]);
  });
});
