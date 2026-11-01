/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: real ADS tokens, no invented --ds-* names, AA contrast in light and dark (B-17, UR-10).
 * Token values: Forge CDN token sheets fetched 2026-11-01 (test/fixtures/ads-tokens.json).
 */

import * as fs from 'fs';
import * as path from 'path';
import { contrastRatio, blend } from '../../src/ui/contrast';

const ROOT = path.join(__dirname, '..', '..');
const css = fs.readFileSync(path.join(ROOT, 'static/frontend/build/style.css'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'static/frontend/build/index.html'), 'utf8');
const legacy = fs.readFileSync(path.join(ROOT, 'src/frontend/legacy-planner.js'), 'utf8');
const tokens = JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/ads-tokens.json'), 'utf8'));

describe('ADS tokens only (B-17)', () => {
  it('style.css defines no --ds-* custom property', () => {
    expect(css.match(/--ds-[a-z0-9-]+\s*:/g) || []).toEqual([]);
  });

  it('every --cp alias points to a real ADS token from the CDN sheet', () => {
    const used = [...css.matchAll(/--cp-[a-z-]+:\s*var\((--ds-[a-z0-9-]+),/g)].map(m => m[1]);
    expect(used.length).toBeGreaterThan(30);
    for (const t of used) expect(tokens.light[t]).toBeDefined();
  });

  it('index.html has no CSP meta tag', () => {
    expect(html).not.toMatch(/http-equiv=["']Content-Security-Policy/i);
  });

  it('no hex colour literal remains in the page, the planner code or the stylesheet rules', () => {
    const rules = css.slice(css.indexOf('}', css.indexOf(':root')) + 1);
    const hex = /#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}(?![0-9A-Za-z])/g;
    expect(rules.match(hex) || []).toEqual([]);
    expect(legacy.match(hex) || []).toEqual([]);
    expect(html.match(/(?:color|background|border|fill|stroke)[^;"]*#[0-9A-Fa-f]{3,6}\b/g) || []).toEqual([]);
  });

  it('motion is under 150 ms and off with reduced motion', () => {
    const durations = [...css.matchAll(/(?:transition|animation):[^;]*?(\d*\.?\d+)s/g)].map(m => Number(m[1]));
    expect(durations.filter(d => d >= 0.15 && d !== 1.2)).toEqual([]);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation: none !important/);
  });
});

describe('contrast of the token pairs the planner uses (WCAG 2.2 AA)', () => {
  const pairs: Array<[string, string, number]> = [
    ['--ds-text', '--ds-surface', 4.5], ['--ds-text-subtle', '--ds-surface', 4.5], ['--ds-text-subtlest', '--ds-surface', 4.5],
    ['--ds-text', '--ds-surface-sunken', 4.5], ['--ds-text-subtle', '--ds-surface-sunken', 4.5],
    ['--ds-text-brand', '--ds-surface', 4.5], ['--ds-text-danger', '--ds-surface', 4.5], ['--ds-text-success', '--ds-surface', 4.5],
    ['--ds-text-inverse', '--ds-background-brand-bold', 4.5], ['--ds-text-inverse', '--ds-background-neutral-bold', 4.5],
    ['--ds-text-danger', '--ds-background-danger', 4.5], ['--ds-text-success', '--ds-background-success', 4.5], ['--ds-text-brand', '--ds-background-selected', 4.5],
    ['--ds-background-accent-blue-bolder', '--ds-surface', 3], ['--ds-background-accent-purple-bolder', '--ds-surface', 3],
    ['--ds-background-accent-green-bolder', '--ds-surface', 3], ['--ds-background-accent-red-bolder', '--ds-surface', 3],
    ['--ds-border-bold', '--ds-surface', 3], ['--ds-border-focused', '--ds-surface', 3], ['--ds-border-danger', '--ds-surface', 3]
  ];
  for (const mode of ['light', 'dark']) {
    it.each(pairs)(`${mode}: %s on %s reaches %s:1`, (fg, bg, min) => {
      const bgHex = tokens[mode][bg].length > 7 ? '#' + blend(tokens[mode][bg], tokens[mode]['--ds-surface']).map((v: number) => v.toString(16).padStart(2, '0')).join('') : tokens[mode][bg];
      expect(contrastRatio(tokens[mode][fg], bgHex)).toBeGreaterThanOrEqual(min);
    });
  }

  it('contrastRatio matches known WCAG values and rejects bad input', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBe(21);
    expect(contrastRatio('#FFF', '#FFF')).toBe(1);
    expect(contrastRatio('#00000080', '#FFFFFF')).toBeGreaterThan(3);
    expect(() => contrastRatio('red', '#FFF')).toThrow('Not a hex colour');
  });
});

describe('no reference to a removed --ds-* name (B-17)', () => {
  it('outside the alias table, every var() uses a --cp alias', () => {
    const rules = css.slice(css.indexOf('}', css.indexOf(':root')) + 1);
    expect(rules.match(/var\(--ds-[a-z0-9-]+\)/g) || []).toEqual([]);
    expect(html.match(/var\(--ds-[a-z0-9-]+\)/g) || []).toEqual([]);
    expect(legacy.match(/var\(--ds-[a-z0-9-]+\)/g) || []).toEqual([]);
  });
});
