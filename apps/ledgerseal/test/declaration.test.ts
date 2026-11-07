/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * B-07: the stored declaration is the text the signer saw, with its version. No fake re-authentication.
 *
 * @author Fahim Farook
 */

import * as fs from 'fs';
import * as path from 'path';
import { DECLARATION, MEANINGS } from '../src/domain/declaration';
import { buildSigningForm } from '../src/frontend/signing-view-model';
import { sealIssue } from '../src/index';
import { FakeJira, MemoryStore, panelContext, sampleIssue, model } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '' }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

const UI = fs.readFileSync(path.resolve(__dirname, '../src/frontend/index.tsx'), 'utf8');

function setup() {
  const jira = new FakeJira(sampleIssue());
  jira.approvers = new Set(['ann', 'bob']);
  jira.currentUser = 'ann';
  const storage = new MemoryStore();
  return { jira, storage, deps: { jira, storage } };
}

const signature = (extra: any = {}) => ({
  meaning: 'APPROVAL',
  declarationVersion: DECLARATION.version,
  declarationText: DECLARATION.text,
  ...extra
});

describe('B-07 declaration text and version', () => {
  it('has one declaration with a version, and the panel shows that exact text', () => {
    expect(DECLARATION).toEqual({
      version: '1',
      text: 'I approve this issue as it is now. I agree that this seal records my approval of its covered fields, comments and attachments.'
    });
    expect(UI).toContain("from '../domain/declaration'");
    // The panel shows the declaration the view model chooses: version 1, unless the project needs a signing code (ADR-016)
    expect(UI).toMatch(/\{signingForm\.declaration\.text\}/);
    expect(buildSigningForm({}, { challengeId: null, expiresAt: null, code: '' }).declaration).toEqual(DECLARATION);
    expect(UI).not.toContain('I certify that I am the authorized signer');
    expect(UI).not.toContain('per ' + 'compli' + 'ance guidelines');
  });

  it('adversarial (LS-09, T-02 A6): stores exactly the text and version the signer agreed to', async () => {
    const { storage, deps } = setup();
    await expect(sealIssue({ signature: signature() }, panelContext('ann'), deps)).resolves.toMatchObject({ ok: true });
    const [assignment] = model.assignments(storage);
    expect(assignment.declaration).toEqual(DECLARATION);
    expect(assignment.roleTypeId).toBe('LS_APPROVER');
    expect((await model.workEffort(storage)).attributes.declarationVersion).toBe(DECLARATION.version);
  });

  it('rejects a payload whose declaration differs from the one shown', async () => {
    const { storage, deps } = setup();
    for (const bad of [
      signature({ declarationText: 'I electronically sign and seal this issue per company guidelines.' }),
      signature({ declarationVersion: '0' }),
      signature({ declarationText: undefined })
    ]) {
      await expect(sealIssue({ signature: bad }, panelContext('ann'), deps)).resolves.toMatchObject({ ok: false, code: 'DECLARATION_MISMATCH' });
    }
    expect(storage.sets).toEqual([]);
  });

  it('has no re-authentication field in the payload contract or the UI', async () => {
    expect(UI).not.toMatch(/reauth/i);
    expect(UI).not.toContain('Re-Authentication');
    const { storage, deps } = setup();
    await sealIssue({ signature: signature({ reauthConfirmation: 'x' }) }, panelContext('ann'), deps);
    expect(JSON.stringify([...storage.map.values()])).not.toContain('reauth');
  });

  it('accepts only the listed meanings, and defaults to approval', async () => {
    expect(MEANINGS.map(m => m.value)).toEqual(['APPROVAL', 'REVIEW', 'VERIFICATION']);
    const { storage, deps } = setup();
    await expect(sealIssue({ signature: signature({ meaning: 'Ready for release!!' }) }, panelContext('ann'), deps)).resolves.toMatchObject({
      code: 'INVALID_REQUEST'
    });
    await sealIssue({ signature: signature({ meaning: undefined }) }, panelContext('ann'), deps);
    expect(model.assignments(storage)[0].roleTypeId).toBe('LS_APPROVER');
  });

  it('requires a reason to approve changes, and stores it', async () => {
    const { jira, storage, deps } = setup();
    await sealIssue({ signature: signature() }, panelContext('ann'), deps);
    jira.edit('mallory', '2099-01-01T00:00:00.000Z', 'summary', 'changed');
    jira.currentUser = 'bob';
    await expect(sealIssue({ signature: signature() }, panelContext('bob'), deps)).resolves.toMatchObject({ ok: false, code: 'REASON_REQUIRED' });
    await expect(sealIssue({ signature: signature({ reason: 'x'.repeat(501) }) }, panelContext('bob'), deps)).resolves.toMatchObject({
      code: 'REASON_REQUIRED'
    });
    await expect(sealIssue({ signature: signature({ reason: '  Scope agreed with the CAB  ' }) }, panelContext('bob'), deps)).resolves.toMatchObject({
      ok: true
    });
    const current = model.assignments(storage).find(a => a.thruDate === null);
    expect(current.comments).toBe('Scope agreed with the CAB');
    expect(model.statusRows(storage).pop().reason).toBe('Scope agreed with the CAB');
  });
});

describe('ADR-016 declaration version 2 (owner decision Q-03)', () => {
  it('ships as a draft that is not approved, so code signing cannot be turned on', () => {
    const { DECLARATION_V2, isDeclarationV2Approved, declarationFor } = require('../src/domain/declaration');
    expect(DECLARATION_V2.version).toBe('2');
    expect(DECLARATION_V2.approved).toBe(false);
    expect(isDeclarationV2Approved()).toBe(false);
    expect(declarationFor(true)).toEqual({ version: '2', text: DECLARATION_V2.text });
    expect(declarationFor(false)).toEqual({ version: DECLARATION.version, text: DECLARATION.text });
    expect(DECLARATION_V2.text).toContain('legally binding equivalent of my handwritten signature');
  });
});
