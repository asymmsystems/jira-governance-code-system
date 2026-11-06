/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Readiness review B5, F-04, F-08, F-14 and F-15: the missing signing key is never silent; the panel has no
 * button for another product; the validator names the real button and the way out of a lapsed licence; the
 * history names who acted and pages.
 *
 * @author Fahim Farook
 */

import * as fs from 'fs';
import * as path from 'path';
import { getSealEvidence, getSealHistory, LICENCE_INACTIVE_GATE_MESSAGE, sealIssue, validateTransition, verifyIssue } from '../src/index';
import { buildPanelView, historyLabel, UNSIGNED_NOTE } from '../src/frontend/view-model';
import { UNSIGNED_EVIDENCE, UNSIGNED_LOG } from '../src/service/ledger';
import { createSigner } from '../src/domain/attestation';
import { PartyRepository } from '../src/storage/party-repository';
import * as crypto from 'crypto';
import { FakeJira, MemoryStore, model, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '' }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

const pair = crypto.generateKeyPairSync('ed25519');
const signer = createSigner(pair.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'), 'ls-test-1');

function setup(withSigner: boolean) {
  const jira = new FakeJira(sampleIssue());
  jira.approvers = new Set(['ann', 'bob']);
  const storage = new MemoryStore();
  const as = (user: string | null) => {
    jira.currentUser = user;
    return withSigner ? { jira, storage, signer } : { jira, storage };
  };
  return { jira, storage, as };
}

describe('B5 no silent unsigned attestation', () => {
  it('logs each unsigned write and export, flags the panel and marks the evidence', async () => {
    const { as } = setup(false);
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    expect(error).toHaveBeenCalledWith(`${UNSIGNED_LOG} Issue 10001.`);
    const view: any = await verifyIssue({}, panelContext('viewer'), as('viewer'));
    expect(view.signing).toEqual({ signed: false, keyId: null });
    expect(buildPanelView({ loading: false, result: view }).signingNote).toBe(UNSIGNED_NOTE);
    const evidence: any = await getSealEvidence({}, panelContext('viewer'), as('viewer'));
    expect(evidence.warning).toBe(UNSIGNED_EVIDENCE);
    expect(error).toHaveBeenCalledWith(`${UNSIGNED_LOG} Evidence of issue 10001.`);
    error.mockRestore();
  });

  it('says nothing when the key is set', async () => {
    const { as } = setup(true);
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    const view: any = await verifyIssue({}, panelContext('viewer'), as('viewer'));
    expect(view.signing).toEqual({ signed: true, keyId: 'ls-test-1' });
    expect(buildPanelView({ loading: false, result: view }).signingNote).toBeUndefined();
    expect((await getSealEvidence({}, panelContext('viewer'), as('viewer'))) as any).not.toHaveProperty('warning');
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('F-04 and F-14 panel and validator text', () => {
  const ui = fs.readFileSync(path.resolve(__dirname, '../src/frontend/index.tsx'), 'utf8');

  it('has no button for another product and no router call', () => {
    expect(ui).not.toMatch(/Four Realities|FourRealities|router/);
  });

  it('names the button the panel really shows', async () => {
    const { as } = setup(true);
    const res = await validateTransition({ issue: { key: 'CHG-1' } }, {}, as(null));
    expect(res.errorMessage).toContain('click "Seal this issue"');
    expect(fs.readFileSync(path.resolve(__dirname, '../src/frontend/view-model.ts'), 'utf8')).toContain("label: 'Seal this issue'");
  });
});

describe('F-08 a lapsed licence at the gate', () => {
  const inactive = { license: { active: false } };

  it('blocks as before, and says how to get out instead of pointing at a panel that cannot act', async () => {
    const { as } = setup(true);
    const res = await validateTransition({ issue: { key: 'CHG-1' } }, inactive, as(null));
    expect(res).toEqual({ result: false, errorMessage: LICENCE_INACTIVE_GATE_MESSAGE });
    expect(LICENCE_INACTIVE_GATE_MESSAGE.length).toBeLessThanOrEqual(250);
    const viaPayload = await validateTransition({ issue: { key: 'CHG-1' }, context: inactive }, {}, as(null));
    expect(viaPayload.errorMessage).toBe(LICENCE_INACTIVE_GATE_MESSAGE);
  });

  it('keeps a sealed, unchanged issue passing (spec D-8)', async () => {
    const { as } = setup(true);
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    await expect(validateTransition({ issue: { key: 'CHG-1' } }, inactive, as(null))).resolves.toEqual({ result: true });
  });
});

describe('F-15 history', () => {
  it('names who acted, LedgerSeal for a found change, and a closed account', async () => {
    const { jira, storage, as } = setup(true);
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    jira.edit('mallory', '2099-01-01T00:00:00.000Z', 'summary', 'changed');
    await verifyIssue({}, panelContext('viewer'), as('viewer'));
    let page: any = await getSealHistory({}, panelContext('viewer'), as('viewer'));
    expect(page.entries.map((e: any) => [e.transitionName, e.actorAccountId, e.actorClosed])).toEqual([
      ['SEAL', 'ann', false],
      ['CHANGE', '', false]
    ]);
    await new PartyRepository(storage).forget(await model.token(storage, 'ann'));
    page = await getSealHistory({}, panelContext('viewer'), as('viewer'));
    expect(page.entries[0]).toMatchObject({ actorAccountId: '', actorClosed: true });
  });

  it('labels every transition in plain words', () => {
    expect(['SEAL', 'RESEAL', 'CHANGE', 'REVOKE', 'REDACT', 'OTHER'].map(historyLabel)).toEqual([
      'Sealed',
      'Sealed again',
      'Change found',
      'Revoked',
      'Account ids replaced by party tokens',
      'OTHER'
    ]);
  });

  it('pages the history in the panel and handles a failed call', () => {
    const ui = fs.readFileSync(path.resolve(__dirname, '../src/frontend/index.tsx'), 'utf8');
    expect(ui).toContain('Show more history');
    expect(ui).toContain('LedgerSeal could not load the history. Try again.');
    expect(ui).toContain('LedgerSeal could not load the evidence record. Try again.');
  });
});
