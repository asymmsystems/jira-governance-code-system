/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * Security questionnaire question 8: a log line about a failure holds only the place and the HTTP status or
 * the error's name and code (logFailure, src/logger.ts). The frontend places that logged a whole error now
 * log through logFailure too. Each is made to fail with an error whose message holds a secret; no log call
 * may receive that message, the error object or its stack. A source rule then checks every console call in
 * src/.
 */
import * as fs from 'fs';
import * as path from 'path';
import { consoleViolations } from './support/console-rule';

const invoke = jest.fn();
const enable = jest.fn();
jest.mock('@forge/bridge', () => ({
  invoke: (...a: unknown[]) => invoke(...a),
  router: { open: jest.fn() },
  view: { getContext: jest.fn(), theme: { enable: () => enable() } }
}));
jest.mock('../src/frontend/banner', () => ({ showErrorBanner: jest.fn() }));
jest.mock('../src/frontend/changes-panel', () => ({ recordChanges: jest.fn() }));

import { callResolver } from '../src/frontend/bridge';
import { enableTheme } from '../src/frontend/theme';
import { failureSummary, logFailure } from '../src/logger';

const APP = path.join(__dirname, '..');
const SECRET = 'SECRET-LOG 712020:alice ann@example.com summary text';
const secretError = () => Object.assign(new Error(SECRET), { code: 'KVS_DOWN' });

let calls: unknown[][] = [];
beforeEach(() => {
  calls = [];
  invoke.mockReset();
  enable.mockReset();
  for (const level of ['error', 'warn', 'log', 'info'] as const) {
    jest.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      calls.push(args);
    });
  }
});
afterEach(() => jest.restoreAllMocks());

/** Every log call so far has only text arguments and none holds the secret; returns the failure lines. */
function failureLines(): string[] {
  for (const args of calls) {
    for (const arg of args) expect(typeof arg).toBe('string');
    expect(args.join(' ')).not.toContain('SECRET-LOG');
    expect(args.join(' ')).not.toContain('712020:');
  }
  return calls.map(args => args.join(' ')).filter(line => line.endsWith('Error KVS_DOWN'));
}

describe('Q8 the frontend failure log lines', () => {
  it('bridge.ts, a resolver call that throws', async () => {
    invoke.mockRejectedValue(secretError());
    await expect(callResolver('getProjectPlan', {})).resolves.toMatchObject({ ok: false });
    expect(failureLines()).toEqual(['cascadeplan resolver getProjectPlan: Error KVS_DOWN']);
  });

  it('theme.ts, when theming is not available', async () => {
    enable.mockRejectedValue(secretError());
    await expect(enableTheme()).resolves.toBeUndefined();
    expect(failureLines()).toEqual(['cascadeplan theming not available, using light fallbacks: Error KVS_DOWN']);
  });

  const sites: Array<[string, string]> = [
    ['legacy-planner.js', 'router.open failed, using window.open'],
    ['legacy-planner.js', 'empty state drop'],
    ['legacy-planner.js', 'row drop'],
    ['legacy-planner.js', 'wrapper drop'],
    ['legacy-planner.js', 'unschedule task'],
    ['admin.tsx', 'load approver groups'],
    ['admin.tsx', 'save approver groups']
  ];

  it.each(sites)('src/frontend/%s, "%s": logged through logFailure, which drops the secret', (file, where) => {
    const text = fs.readFileSync(path.join(APP, 'src/frontend', file), 'utf8');
    expect(text).toContain("import { logFailure } from '../logger';");
    expect(text).toContain(`logFailure('${where}', err);`);
    logFailure(where, secretError());
    expect(failureLines()).toEqual([`cascadeplan ${where}: Error KVS_DOWN`]);
  });

  it('no frontend file calls console itself', () => {
    const dir = path.join(APP, 'src/frontend');
    for (const file of fs.readdirSync(dir)) expect(fs.readFileSync(path.join(dir, file), 'utf8')).not.toMatch(/console\./);
  });
});

describe('Q8 failureSummary', () => {
  it('keeps only a whole-number status, or a plain error name and a plain code, or the type name', () => {
    expect(failureSummary({ status: 403, message: SECRET })).toBe('HTTP 403');
    expect(failureSummary(Object.assign(new Error(SECRET), { status: 1.5 }))).toBe('Error');
    expect(failureSummary(new TypeError(SECRET))).toBe('TypeError');
    expect(failureSummary(Object.assign(new Error(SECRET), { code: 'RATE_LIMIT_EXCEEDED' }))).toBe('Error RATE_LIMIT_EXCEEDED');
    expect(failureSummary(Object.assign(new Error(SECRET), { code: 429 }))).toBe('Error 429');
    const named = Object.assign(new Error(SECRET), { code: SECRET });
    named.name = SECRET;
    expect(failureSummary(named)).toBe('Error');
    expect(failureSummary(SECRET)).toBe('string');
    expect(failureSummary(undefined)).toBe('undefined');
    expect(failureSummary(null)).toBe('object');
  });
});

const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap(f => (f.isDirectory() ? walk(path.join(d, f.name)) : [path.join(d, f.name)]));

describe('Q8 source rule: no console call is given an error message, String(...) or an error object', () => {
  it('holds for every source file in src/', () => {
    const faults = walk(path.join(APP, 'src'))
      .filter(f => /\.(tsx?|jsx?)$/.test(f))
      .flatMap(f => consoleViolations(fs.readFileSync(f, 'utf8')).map(v => `${path.relative(APP, f)} ${v}`));
    expect(faults).toEqual([]);
  });

  it('finds an unsafe call', () => {
    expect(consoleViolations("try { x(); } catch (oops) { console.error('failed', oops); }")).toEqual(['line 1: console.error is given the error oops']);
    expect(consoleViolations("console.error('Forge resolver error:', fnName, err);")).toEqual(['line 1: console.error is given the error err']);
    expect(consoleViolations("console.warn('failed', String(x));")).toEqual(['line 1: console.warn is given String(...)']);
    expect(consoleViolations('console.error(`x ${errorSummary(err)}`);')).toEqual([]);
  });

  it('is the same file in every app', () => {
    const mine = fs.readFileSync(path.join(__dirname, 'support/console-rule.ts'), 'utf8');
    for (const app of ['cascadeplan', 'definitionguard', 'ledgerseal', 'fourrealities']) {
      expect(fs.readFileSync(path.join(APP, '..', app, 'test/support/console-rule.ts'), 'utf8')).toBe(mine);
    }
  });
});
