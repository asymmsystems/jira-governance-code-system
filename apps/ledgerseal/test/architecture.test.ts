/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * LedgerSeal: UI architecture rules and @asymm/jira-ui adoption verification.
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

const rel = (file: string) => path.relative(SRC, file);
const files = sourceFiles(SRC);

describe('UI architecture and design system rules', () => {
  it('has no local src/brand directory (shared @asymm/jira-ui is used)', () => {
    expect(fs.existsSync(path.join(SRC, 'brand'))).toBe(false);
  });

  it('no source file in LedgerSeal uses raw Atlassian tokens (color., elevation., space., radius.) or hex colors', () => {
    const rawTokens = files
      .flatMap(f => fs.readFileSync(f, 'utf8').split('\n')
        .map((line, i) => ({ line, at: `${rel(f)}:${i + 1}` }))
        .filter(({ line }) => /(?:['"`](?:color|elevation|space|radius)\.|#[0-9a-fA-F]{3,8}\b)/.test(line))
        .map(({ at }) => at));
    expect(rawTokens).toEqual([]);
  });

  it('UI frontend components import from @asymm/jira-ui', () => {
    const frontendFiles = files.filter(f => rel(f).startsWith('frontend/'));
    const importsJiraUi = frontendFiles.some(f =>
      fs.readFileSync(f, 'utf8').includes("@asymm/jira-ui")
    );
    expect(importsJiraUi).toBe(true);
  });

  it('TextArea components use uncontrolled inputs without value prop (bridge synchronization rule)', () => {
    const textAreaWithValue = files
      .filter(f => f.endsWith('.tsx'))
      .flatMap(f => fs.readFileSync(f, 'utf8').split('\n')
        .map((line, i) => ({ line, at: `${rel(f)}:${i + 1}` }))
        .filter(({ line }) => /<TextArea[^>]*\bvalue=/.test(line))
        .map(({ at }) => at));
    expect(textAreaWithValue).toEqual([]);
  });

  it('all Text components inside UI views specify as="span" (typography alignment rule)', () => {
    const textWithoutSpan = files
      .filter(f => f.endsWith('.tsx'))
      .flatMap(f => fs.readFileSync(f, 'utf8').split('\n')
        .map((line, i) => ({ line, at: `${rel(f)}:${i + 1}` }))
        .filter(({ line }) => /<Text\b(?![^>]*\bas="span")/.test(line))
        .map(({ at }) => at));
    expect(textWithoutSpan).toEqual([]);
  });

  it('no source file contains raw HTML tags (Forge native UI Kit uses Forge components only)', () => {
    const rawHtml = files
      .filter(f => f.endsWith('.tsx'))
      .flatMap(f => fs.readFileSync(f, 'utf8').split('\n')
        .map((line, i) => ({ line, at: `${rel(f)}:${i + 1}` }))
        .filter(({ line }) => /<(strong|b|i|em|span|div|p|h1|h2|h3|h4|h5|h6|table|tr|td|th|ul|li|ol|a)[ >]/.test(line))
        .map(({ at }) => at));
    expect(rawHtml).toEqual([]);
  });
});
