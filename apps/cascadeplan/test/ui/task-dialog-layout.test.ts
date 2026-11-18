/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: every row of the task dialog stays inside the dialog (TASK-00003).
 *
 * The proof in a browser is the harness probe test/e2e/e2e_task_dialog_layout_probe.py, at 1366 px
 * and at 390 px, with short and with long work item titles. These checks keep the style rules the
 * probe passes with, and the markup the rules name.
 */

import * as fs from 'fs';
import * as path from 'path';

const BUILD = path.join(__dirname, '..', '..', 'static', 'frontend', 'build');
const css = fs.readFileSync(path.join(BUILD, 'style.css'), 'utf8');
const html = fs.readFileSync(path.join(BUILD, 'index.html'), 'utf8');

/** The declarations of the rule with exactly this selector text. */
function declarations(sheet: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = sheet.match(new RegExp(`(?:^|[}\\n])\\s*${escaped}\\s*\\{([^}]*)\\}`));
  return found ? found[1] : '';
}

/** The rules inside the media block that starts with this text. */
function mediaBlock(sheet: string, start: string): string {
  const from = sheet.indexOf(start);
  if (from === -1) return '';
  const open = sheet.indexOf('{', from);
  let depth = 0;
  for (let i = open; i < sheet.length; i++) {
    if (sheet[i] === '{') depth++;
    if (sheet[i] === '}' && --depth === 0) return sheet.slice(open + 1, i);
  }
  return '';
}

/** The markup of the task dialog: from its backdrop to the next dialog. */
const dialog = html.slice(html.indexOf('id="taskDetailModal"'), html.indexOf('id="createTaskModal"'));
const GRIDS = '#taskDetailModal .ix-grid2-10, #taskDetailModal .ix-grid2-12, #taskDetailModal .ix-grid2-16';
const GRID_CELLS = '#taskDetailModal .ix-grid2-10 > *, #taskDetailModal .ix-grid2-12 > *, #taskDetailModal .ix-grid2-16 > *';

describe('the task dialog keeps its rows inside the dialog (TASK-00003)', () => {
  it('the parent row holds the parent list and Apply', () => {
    expect(dialog).toMatch(/<div class="hierarchy-row">\s*<select id="parentSelect"[^>]*><\/select>\s*<button[^>]*id="btnApplyParent"[^>]*>Apply<\/button>\s*<\/div>/);
  });

  it('the parent list takes the width of its row, not of its longest choice, and Apply keeps its width', () => {
    const list = declarations(css, '.hierarchy-row select');
    expect(list).toMatch(/flex:\s*1\b/);
    expect(list).toMatch(/min-width:\s*0\b/);
    expect(declarations(css, '.hierarchy-row .btn')).toMatch(/flex:\s*none\b/);
  });

  it('a cell of a two-column row can be narrower than a long choice in its list', () => {
    expect(declarations(css, GRID_CELLS)).toMatch(/min-width:\s*0\b/);
    expect(declarations(css, '#taskDetailModal .form-input')).toMatch(/max-width:\s*100%/);
    expect(declarations(css, '#taskDetailModal #multiResourceSelect')).toMatch(/min-width:\s*0\b/);
  });

  it('the rules name every two-column row the dialog uses', () => {
    const used = [...new Set(dialog.match(/\bix-grid2-[a-z0-9-]+/g) || [])].sort();
    expect(used).toEqual(['ix-grid2-10', 'ix-grid2-12', 'ix-grid2-16']);
  });

  it('below 600 px the two-column rows are one column and the rows that end in a button wrap', () => {
    const narrow = mediaBlock(css, '@media (max-width: 600px)');
    expect(declarations(narrow, GRIDS)).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\)/);
    const wrapping = declarations(narrow, '#taskDetailModal .ix-row-8-mb6, #taskDetailModal .ix-row-8-mb12, #taskDetailModal .modal-footer');
    expect(wrapping).toMatch(/flex-wrap:\s*wrap\b/);
    expect(dialog).toMatch(/class="ix-row-8-mb6"/);
    expect(dialog).toMatch(/class="ix-row-8-mb12"/);
  });

  it('the dialog is 520 px wide, so it is narrower than that only below 600 px', () => {
    // .modal-card is 520 px with max-width 90vw: from 578 px up the dialog has its full width, and
    // there the two-column rows fit (the probe checks 1366 px). The narrow rules start at 600 px.
    expect(declarations(css, '.modal-card')).toMatch(/width:\s*520px;\s*max-width:\s*90vw/);
  });
});
