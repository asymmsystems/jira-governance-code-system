/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Live defect found in Loop 3 on DEMO-34: a controlled TextArea in the UI Kit native panel kept only the last
 * typed character of the revoke reason ("e" for "Loop 3 live check of revoke"). Every keystroke is a bridge
 * round trip, and a re-render with an older `value` overwrote newer input. Text inputs must be uncontrolled.
 *
 * @author Fahim Farook
 */

import * as fs from 'fs';
import * as path from 'path';

const UI = fs.readFileSync(path.resolve(__dirname, '../src/frontend/index.tsx'), 'utf8');

describe('UI Kit text inputs', () => {
  it('uses no controlled value on any TextArea or Textfield', () => {
    const inputs = UI.match(/<(TextArea|Textfield)\b[^>]*>/g) || [];
    expect(inputs.length).toBeGreaterThan(0);
    for (const input of inputs) expect(input).not.toMatch(/\svalue=\{/);
  });

  it('gives the reason box a fresh instance each time a form opens, so an old reason is not shown', () => {
    expect(UI).toMatch(/<TextArea[^>]*\skey=\{/);
  });
});
