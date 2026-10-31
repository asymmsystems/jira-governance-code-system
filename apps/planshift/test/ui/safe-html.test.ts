/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

import * as fs from 'fs';
import * as path from 'path';
import { html, escapeHtml, SafeHtml } from '../../src/ui/safe-html';

const PAYLOAD = '<img src=x onerror=alert(1)>"><b>x</b>';

describe('safe-html (B-02, INV-01)', () => {
  it('escapeHtml escapes markup and both quote characters', () => {
    expect(escapeHtml(PAYLOAD)).toBe('&lt;img src=x onerror=alert(1)&gt;&quot;&gt;&lt;b&gt;x&lt;/b&gt;');
    expect(escapeHtml("a'b&c")).toBe('a&#39;b&amp;c');
  });

  it('escapeHtml turns null and undefined into an empty string and numbers into text', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });

  it('html escapes every interpolated value, in text and in attributes', () => {
    const out = html`<span title="${PAYLOAD}">${PAYLOAD}</span>`;
    expect(String(out)).toBe(`<span title="${escapeHtml(PAYLOAD)}">${escapeHtml(PAYLOAD)}</span>`);
    expect(String(out)).not.toContain('<img');
    expect(String(out)).not.toContain('<b>');
  });

  it('html does not escape nested html fragments or arrays of fragments', () => {
    const inner = html`<b>${'bold'}</b>`;
    const list = [html`<i>1</i>`, html`<i>2</i>`];
    expect(String(html`<p>${inner}${list}</p>`)).toBe('<p><b>bold</b><i>1</i><i>2</i></p>');
  });

  it('html escapes plain strings inside arrays', () => {
    expect(String(html`<p>${['<x>', html`<y></y>`]}</p>`)).toBe('<p>&lt;x&gt;<y></y></p>');
  });

  it('a SafeHtml value reports its markup through toString', () => {
    expect(new SafeHtml('<br>').toString()).toBe('<br>');
  });
});

describe('planner sinks (B-02, INV-01)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'frontend', 'legacy-planner.js'), 'utf8');

  it('every innerHTML assignment is a constant string or an html tagged template', () => {
    const offenders = src.split('\n')
      .map((line, i) => ({ line: line.trim(), n: i + 1 }))
      .filter(({ line }) => /\.innerHTML\s*=/.test(line))
      .filter(({ line }) => {
        const rhs = line.replace(/^.*?\.innerHTML\s*=\s*/, '');
        if (rhs.startsWith('html`')) return false;
        if (/^'[^']*';$/.test(rhs)) return false;
        return true;
      });
    expect(offenders).toEqual([]);
  });

  it('the planner never uses outerHTML or insertAdjacentHTML', () => {
    expect(src).not.toMatch(/outerHTML|insertAdjacentHTML/);
  });
});
