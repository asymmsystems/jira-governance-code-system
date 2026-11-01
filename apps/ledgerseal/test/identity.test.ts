/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * B-04: identity comes from the Forge context only, and no email is stored or shown.
 *
 * @author Fahim Farook
 */

import * as fs from 'fs';
import * as path from 'path';
import { getSealHistory, sealIssue, verifyIssue } from '../src/index';
import { FakeJira, MemoryStore, panelContext, sampleIssue, validSignature, model } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '' }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

function setup() {
  const jira = new FakeJira(sampleIssue());
  jira.approvers = new Set(['mallory']);
  jira.users = { mallory: 'Mallory' };
  const storage = new MemoryStore();
  const as = (user: string | null) => {
    jira.currentUser = user;
    return { jira, storage };
  };
  return { jira, storage, as };
}

describe('B-04 identity from context only', () => {
  it('adversarial (audit flow.js step 3, LS-03): a spoofed payload signer is ignored', async () => {
    const { storage, as } = setup();
    const spoof = {
      ...validSignature(),
      signerEmail: 'cfo@victim.example',
      signerDisplayName: 'CFO',
      signerAccountId: 'cfo-account'
    };
    await expect(sealIssue({ signature: spoof }, panelContext('mallory'), as('mallory'))).resolves.toMatchObject({ ok: true });
    const stored = JSON.stringify([...storage.map.values()]);
    expect(stored).not.toContain('cfo@victim.example');
    expect(stored).not.toContain('CFO');
    expect(stored).not.toContain('cfo-account');
    const [assignment] = model.assignments(storage);
    expect(assignment.partyId).toBe('mallory');
    expect(model.statusRows(storage)[0].data.signerName).toBe('Mallory');
    expect(Object.keys(assignment).sort()).toEqual(['comments', 'contentId', 'declaration', 'fromDate', 'partyId', 'roleTypeId', 'thruDate', 'workEffortId']);
  });

  it('gives the panel the signer account id and name, and no email', async () => {
    const { storage, as } = setup();
    await sealIssue({ signature: validSignature() }, panelContext('mallory'), as('mallory'));
    const view: any = await verifyIssue({}, panelContext('viewer'), as('viewer'));
    expect(view.seal).toMatchObject({ sealedByAccountId: 'mallory', sealedByName: 'Mallory' });
    const history: any = await getSealHistory({}, panelContext('viewer'), as('viewer'));
    expect(JSON.stringify([view, history, ...storage.map.values()])).not.toMatch(/email/i);
  });

  it('renders the signer with the UI Kit User component and never prints an email', () => {
    const ui = fs.readFileSync(path.resolve(__dirname, '../src/frontend/index.tsx'), 'utf8');
    expect(ui).toMatch(/<User accountId=\{analysis\.seal\.sealedByAccountId\}/);
    expect(ui).not.toMatch(/signerEmail|emailAddress/);
  });
});
