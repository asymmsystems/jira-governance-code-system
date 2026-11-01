/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: canvas colours reach WCAG contrast in light and dark mode, and labels never sit on a
 * bar fill (B-13 criteria 7 and 9). Token values: test/fixtures/ads-tokens.json (Forge CDN sheets).
 */

import * as fs from 'fs';
import * as path from 'path';
import { contrastRatio, blend } from '../../src/ui/contrast';
import { CANVAS_PAIRS, CANVAS_TOKENS, FORCED_COLOURS, barStyle, labelPlacement, LABEL_PAD, isInProgressZero } from '../../src/ui/canvas-palette';

const ROOT = path.join(__dirname, '..', '..');
const css = fs.readFileSync(path.join(ROOT, 'static/frontend/build/style.css'), 'utf8');
const tokens = JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/ads-tokens.json'), 'utf8'));
const alias = new Map([...css.matchAll(/(--cp-[a-z-]+):\s*var\((--ds-[a-z0-9-]+),/g)].map(m => [m[1], m[2]]));

const hex = (rgb: number[]) => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
/** Token value for a mode; a translucent background is blended over the surface first. */
function solid(mode: string, cp: string): string {
  const v = tokens[mode][alias.get(cp)!];
  return v.length > 7 ? hex(blend(v, tokens[mode]['--ds-surface'])) : v;
}

describe('canvas colour contrast (B-13 criterion 7)', () => {
  it('every canvas token is a --cp alias of a real ADS token', () => {
    const used = new Set([...Object.values(CANVAS_TOKENS), ...CANVAS_PAIRS.flatMap(p => [p.fg, p.bg])]);
    for (const t of used) {
      expect(typeof alias.get(t)).toBe('string');
      expect(typeof tokens.light[alias.get(t)!]).toBe('string');
    }
  });

  for (const mode of ['light', 'dark']) {
    it.each(CANVAS_PAIRS.map(p => [p.name, p.fg, p.bg, p.min] as [string, string, string, number]))(
      `${mode}: %s (%s on %s) reaches %s:1`, (_name, fg, bg, min) => {
        expect(contrastRatio(tokens[mode][alias.get(fg)!], solid(mode, bg))).toBeGreaterThanOrEqual(min);
      });
  }

  it('covers every bar fill barStyle can return', () => {
    const fills = new Set(CANVAS_PAIRS.map(p => p.fg));
    const states = [{ status: 'COMPLETED' }, { progress: 10, targetProgress: 50 }, { isEpic: true }, { hierarchyLevel: 1 }, {}];
    for (const s of states) expect(fills.has(barStyle(s).fill)).toBe(true);
  });
});

describe('bar style and label placement (B-13 criterion 9)', () => {
  it('barStyle picks done, late, epic or normal', () => {
    expect(barStyle({ status: 'COMPLETED', progress: 0, targetProgress: 80 })).toEqual({ fill: '--cp-bar-done', track: '--cp-bar-planned' });
    expect(barStyle({ progress: 10, targetProgress: 50 })).toEqual({ fill: '--cp-bar-late', track: '--cp-bar-planned' });
    expect(barStyle({ isEpic: true, progress: 60, targetProgress: 50 })).toEqual({ fill: '--cp-bar-epic-fill', track: '--cp-bar-epic' });
    expect(barStyle({ hierarchyLevel: 1 })).toEqual({ fill: '--cp-bar-epic-fill', track: '--cp-bar-epic' });
    expect(barStyle({})).toEqual({ fill: '--cp-bar-fill', track: '--cp-bar-planned' });
  });

  it('a label goes on a chip inside the bar when it fits, else to the right of the bar', () => {
    expect(labelPlacement(100, 200, 80)).toEqual({ x: 100 + LABEL_PAD, inside: true });
    expect(labelPlacement(100, 80 + LABEL_PAD * 2, 80)).toEqual({ x: 100 + LABEL_PAD, inside: true });
    expect(labelPlacement(100, 60, 80)).toEqual({ x: 160 + LABEL_PAD, inside: false });
  });
});

describe('forced colours (B-15 criterion 12)', () => {
  it('every canvas token and bar colour has a CSS system colour', () => {
    const system = new Set(['Canvas', 'CanvasText', 'Highlight', 'HighlightText', 'LinkText', 'GrayText']);
    const used = new Set([...Object.values(CANVAS_TOKENS), ...CANVAS_PAIRS.flatMap(p => [p.fg]),
      ...[{ status: 'COMPLETED' }, { progress: 1, targetProgress: 2 }, { isEpic: true }, {}].flatMap(s => Object.values(barStyle(s)))]);
    for (const t of used) expect(system.has(FORCED_COLOURS[t])).toBe(true);
    expect(FORCED_COLOURS[CANVAS_TOKENS.labelChip]).toBe('Canvas');
  });
});

describe('in-progress zero progress detection', () => {
  it('returns true when status is in-progress and progress is zero or unset', () => {
    expect(isInProgressZero({ status: 'IN_PROGRESS', progress: 0 })).toBe(true);
    expect(isInProgressZero({ status: 'IN_PROGRESS' })).toBe(true);
    expect(isInProgressZero({ status: 'In Progress', progress: 0 })).toBe(true);
    expect(isInProgressZero({ status: 'inprogress' })).toBe(true);
  });

  it('returns false when status is in-progress but progress is greater than zero', () => {
    expect(isInProgressZero({ status: 'IN_PROGRESS', progress: 10 })).toBe(false);
    expect(isInProgressZero({ status: 'In Progress', progress: 100 })).toBe(false);
  });

  it('returns false for other statuses', () => {
    expect(isInProgressZero({ status: 'COMPLETED', progress: 0 })).toBe(false);
    expect(isInProgressZero({ status: 'NOT_STARTED', progress: 0 })).toBe(false);
    expect(isInProgressZero({})).toBe(false);
  });
});
