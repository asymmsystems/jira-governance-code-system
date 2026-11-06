/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Repository rule (readiness review F-18): every LedgerSeal source and test file carries the
 * Asymm Systems copyright line and the author tag, and no file uses an em or en dash.
 *
 * @author Fahim Farook
 */

import * as fs from 'fs';
import * as path from 'path';

const APP = path.resolve(__dirname, '..');

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return files(full);
    return /\.(ts|tsx|js|mjs)$/.test(entry.name) ? [full] : [];
  });
}

const SOURCES = [...files(path.join(APP, 'src')), ...files(path.join(APP, 'test')), path.join(APP, 'jest.config.js')];

describe('F-18 file headers', () => {
  it('finds the source and test files', () => {
    expect(SOURCES.length).toBeGreaterThan(40);
  });

  it.each(SOURCES.map(f => [path.relative(APP, f)]))('%s has the copyright line and the author tag', rel => {
    const text = fs.readFileSync(path.join(APP, rel), 'utf8');
    const head = text.slice(0, 2000);
    expect(head).toContain('Copyright (c) 2026 Asymm Systems. All rights reserved.');
    expect(head).toContain('@author Fahim Farook');
  });

  it('has no em or en dash in any source or test file', () => {
    const dashes = new RegExp(`[${String.fromCharCode(0x2013)}${String.fromCharCode(0x2014)}]`);
    const withDash = SOURCES.filter(f => dashes.test(fs.readFileSync(f, 'utf8')));
    expect(withDash.map(f => path.relative(APP, f))).toEqual([]);
  });
});
