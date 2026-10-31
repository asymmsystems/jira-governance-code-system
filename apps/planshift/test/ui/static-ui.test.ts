/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: static checks on the Custom UI resource and manifest (B-01, INV-02).
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.join(__dirname, '..', '..');
const BUILD = path.join(ROOT, 'static', 'frontend', 'build');
const FRONTEND = path.join(ROOT, 'src', 'frontend');

function frontendSources(): string[] {
  return fs.readdirSync(FRONTEND)
    .filter(f => /\.(ts|js)$/.test(f) && !f.endsWith('.d.ts'))
    .map(f => path.join(FRONTEND, f));
}

describe('Custom UI resource (B-01)', () => {
  const html = fs.readFileSync(path.join(BUILD, 'index.html'), 'utf8');

  it('index.html has no inline script body', () => {
    const inline = html.match(/<script(?![^>]*\bsrc=)[^>]*>/gi) || [];
    expect(inline).toEqual([]);
  });

  it('index.html loads the bundled app script', () => {
    expect(html).toMatch(/<script src="\.\/app\.js"><\/script>/);
  });

  it('index.html has no inline event handler attributes', () => {
    expect(html.match(/\son[a-z]+\s*=/gi) || []).toEqual([]);
  });

  it('no frontend source references the private bridge global', () => {
    const offenders = frontendSources().filter(f => fs.readFileSync(f, 'utf8').includes('__bridge'));
    expect(offenders).toEqual([]);
  });

  it('the frontend calls resolvers through invoke from @forge/bridge', () => {
    const all = frontendSources().map(f => fs.readFileSync(f, 'utf8')).join('\n');
    expect(all).toMatch(/import\s*\{[^}]*\binvoke\b[^}]*\}\s*from\s*'@forge\/bridge'/);
  });

  it('manifest grants no scripts unsafe-inline permission', () => {
    const manifest = fs.readFileSync(path.join(ROOT, 'manifest.yml'), 'utf8');
    expect(manifest).not.toMatch(/scripts\s*:/);
  });
});
