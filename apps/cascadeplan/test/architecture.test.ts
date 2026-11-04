/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * CascadePlan: UI architecture rules and @asymm/jira-ui adoption verification.
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
const tsxFiles = files.filter(f => f.endsWith('.tsx'));

describe('UI architecture and design system rules (@asymm/jira-ui)', () => {
  it('has no local src/brand directory (shared @asymm/jira-ui is used)', () => {
    expect(fs.existsSync(path.join(SRC, 'brand'))).toBe(false);
  });

  it('no tsx UI file in CascadePlan uses raw Atlassian tokens or raw hex colors', () => {
    const rawTokens = tsxFiles
      .flatMap(f => fs.readFileSync(f, 'utf8').split('\n')
        .map((line, i) => ({ line, at: `${rel(f)}:${i + 1}` }))
        .filter(({ line }) => /(?:['"`](?:color|elevation|space|radius)\.|#[0-9a-fA-F]{3,8}\b)/.test(line))
        .map(({ at }) => at));
    expect(rawTokens).toEqual([]);
  });

  it('UI frontend components import directly from @asymm/jira-ui', () => {
    const frontendTsx = tsxFiles.filter(f => rel(f).startsWith('frontend/'));
    expect(frontendTsx.length).toBeGreaterThan(0);
    const importsJiraUi = frontendTsx.some(f =>
      fs.readFileSync(f, 'utf8').includes('@asymm/jira-ui')
    );
    expect(importsJiraUi).toBe(true);
  });

  it('all Text components inside UI views specify as="span" (typography alignment rule)', () => {
    const textWithoutSpan = tsxFiles
      .flatMap(f => fs.readFileSync(f, 'utf8').split('\n')
        .map((line, i) => ({ line, at: `${rel(f)}:${i + 1}` }))
        .filter(({ line }) => /<Text\b(?![^>]*\bas="span")/.test(line))
        .map(({ at }) => at));
    expect(textWithoutSpan).toEqual([]);
  });

  it('no tsx source file contains raw HTML tags (Forge native UI Kit uses Forge components only)', () => {
    const rawHtml = tsxFiles
      .flatMap(f => fs.readFileSync(f, 'utf8').split('\n')
        .map((line, i) => ({ line, at: `${rel(f)}:${i + 1}` }))
        .filter(({ line }) => /<(strong|b|i|em|span|div|p|h1|h2|h3|h4|h5|h6|table|tr|td|th|ul|li|ol|a)[ >]/.test(line))
        .map(({ at }) => at));
    expect(rawHtml).toEqual([]);
  });

  it('no source file contains em-dashes or en-dashes', () => {
    const dashes = files
      .flatMap(f => fs.readFileSync(f, 'utf8').split('\n')
        .map((line, i) => ({ line, at: `${rel(f)}:${i + 1}` }))
        .filter(({ line }) => /[\u2013\u2014]/.test(line))
        .map(({ at }) => at));
    expect(dashes).toEqual([]);
  });
});
