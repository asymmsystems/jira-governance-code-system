/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Readiness finding F-12: an always-visible "Approval seal" entry in the issue's details column shows the seal state
 * without opening the panel, and points to the panel for every action.
 *
 * @author Fahim Farook
 */

import * as fs from 'fs';
import * as path from 'path';
import { buildContextView, CONTEXT_HINT } from '../src/frontend/view-model';

const manifest = fs.readFileSync(path.resolve(__dirname, '../manifest.yml'), 'utf8');

describe('F-12 the issue context entry', () => {
  it('is a native jira:issueContext module on the shared resolver, with its own UI resource and the bundled icon', () => {
    expect(manifest).toContain(`  jira:issueContext:
    # F-12: always visible in the issue's details column; shows the seal state without opening the panel.
    - key: ledgerseal-context
      title: LedgerSeal
      label: Approval seal
      icon: resource:icons;icon.svg
      render: native
      resource: context
      resolver:
        function: resolver`);
    expect(manifest).toMatch(/  - key: context\n    path: src\/frontend\/context\.tsx/);
  });

  it('shows the lozenge and the status sentence of each state, and where to act', () => {
    const sealed = buildContextView({ loading: false, result: { status: 'SEAL_VALID', tamperedFields: [], tamperedAttachments: [] } });
    expect(sealed).toEqual({ state: 'SEALED', lozenge: { text: 'SEALED', appearance: 'success' }, sentence: 'Approval seal: Sealed. No change detected since approval.', hint: CONTEXT_HINT });
    const changed = buildContextView({ loading: false, result: { status: 'SEAL_BROKEN', tamperedFields: [{ fieldId: 'summary', fieldName: 'Summary', sealedValue: 'a', liveValue: 'b' }], tamperedAttachments: [] } });
    expect(changed).toMatchObject({ lozenge: { text: 'CHANGED', appearance: 'removed' }, sentence: 'Approval seal: Changed after approval. 1 item modified.' });
    expect(buildContextView({ loading: false, result: { status: 'NO_SEAL', tamperedFields: [], tamperedAttachments: [] } })).toMatchObject({ lozenge: { text: 'NOT SEALED' } });
    expect(buildContextView({ loading: false, result: null, error: true })).toMatchObject({ state: 'ERROR', lozenge: null });
  });

  it('the entry offers no action: it calls only the verify resolver (which, as for the panel, records a new change) and has no button', () => {
    const ui = fs.readFileSync(path.resolve(__dirname, '../src/frontend/context.tsx'), 'utf8');
    expect(ui).toContain("invoke('verify-issue-api', {})");
    expect(ui).not.toMatch(/seal-issue-api|revoke-seal-api|<Button/);
  });
});
