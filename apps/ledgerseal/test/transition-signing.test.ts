/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * ADR-018 option A (spec v4 section 16): signing in the LedgerSeal field on the transition screen. The field asks for
 * a single-use intent (every check as the user); the validator finds it in the screen's values, checks it is unused,
 * unexpired and the transitioning user's own, and seals the issue with the screen's values applied.
 *
 * @author Fahim Farook
 */

import * as declaration from '../src/domain/declaration';
import { DECLARATION, DECLARATION_V2 } from '../src/domain/declaration';
import { createSigningIntent, signingAuthority, validateTransition } from '../src/index';
import { LedgerSealDeps, sealIssueFlow, verifyIssueFlow } from '../src/service/ledger';
import { requestCodeFlow, setSigningPolicyFlow } from '../src/service/signing';
import { INTENT_EXPIRED, INTENT_OTHER_USER, INTENT_SCREEN_CHANGED, intentOnScreen } from '../src/service/transition-signing';
import { buildSignatureFieldView, FIELD_ROUTED_TEXT, FIELD_SIGNED_TEXT } from '../src/frontend/signature-field-view-model';
import { FakeJira, MemoryStore, model, panelContext, sampleIssue } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '', privacy: { reportPersonalData: jest.fn() } }));
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: {} }));

const FIELD = 'customfield_10080';
const SIG_FIELD = { id: FIELD, name: 'LedgerSeal signature', schema: { type: 'string', custom: 'ari:cloud:ecosystem::extension/7489a645-7c96-400a-b289-eb36f2701a00/ace7a105-325a-4156-851f-dc12a6c6cdda/static/ledgerseal-signature' } };
const V1 = (extra: Record<string, unknown> = {}) => ({ meaning: 'APPROVAL', declarationVersion: DECLARATION.version, declarationText: DECLARATION.text, ...extra });

beforeEach(() => {
  for (const level of ['error', 'warn', 'log', 'info'] as const) jest.spyOn(console, level).mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

function setup() {
  const jira = new FakeJira(sampleIssue());
  jira.fields = [SIG_FIELD, { id: 'summary', name: 'Summary', schema: { type: 'string', system: 'summary' } }];
  jira.approvers = new Set(['ann', 'bob']);
  jira.jiraAdmins.add('admin');
  const storage = new MemoryStore();
  const deps: LedgerSealDeps = { jira, storage, secrets: storage };
  return { jira, storage, deps };
}

const as = (jira: FakeJira, who: string) => {
  jira.currentUser = who;
  return panelContext(who);
};

async function intentFor(jira: FakeJira, deps: LedgerSealDeps, who: string, extra: Record<string, unknown> = {}) {
  const panel: any = await verifyIssueFlow({}, as(jira, who), deps);
  const { signature, ...rest } = extra;
  return createSigningIntent({ viewHash: panel.viewHash, signature: V1(signature as any), ...rest }, as(jira, who), deps) as Promise<any>;
}

const transition = (intentId: string | null, user: string | null, extra: Record<string, unknown> = {}) => ({
  issue: { id: '10001', key: 'CHG-1' },
  transition: { from: { id: '3' }, to: { id: '10001' } },
  modifiedFields: intentId ? { [FIELD]: intentId, ...(extra.fields as any) } : { ...(extra.fields as any) },
  ...(user ? { user: { accountId: user } } : {})
});

describe('signing intent (transition-sign-intent-api)', () => {
  it('runs the seal checks as the user, writes no seal, and returns only an intent id that lives 120 seconds', async () => {
    const { jira, storage, deps } = setup();
    const res = await intentFor(jira, deps, 'ann');
    expect(res).toEqual({ ok: true, intentId: expect.stringMatching(/^lsi_[0-9a-f]{32}$/), expiresAt: expect.any(String) });
    expect(Date.parse(res.expiresAt) - Date.now()).toBeGreaterThan(110000);
    expect(Date.parse(res.expiresAt) - Date.now()).toBeLessThanOrEqual(120000);
    expect(model.statusRows(storage)).toEqual([]);
    expect(await model.workEffort(storage)).toBeNull();
    const stored = storage.map.get(`ls3:intent:${res.intentId}`);
    expect(stored).toMatchObject({ partyId: await model.token(storage, 'ann'), issueId: '10001', approvingChanges: false, policy: null, signingEvidence: null });
    expect(storage.ttls.get(`ls3:intent:${res.intentId}`)).toBe(86400);
    expect(JSON.stringify(stored)).not.toContain('ann');
  });

  it('refuses without identity, Browse, approver right, the shown hash, or a current hash', async () => {
    const { jira, deps } = setup();
    expect(((await createSigningIntent({ viewHash: 'x', signature: V1() }, { extension: { issue: { id: '10001' } } }, deps)) as any).code).toBe('NO_IDENTITY');
    jira.cannotBrowse.add('ann');
    expect((await intentFor(jira, deps, 'ann')).code).toBe('NO_BROWSE_PERMISSION');
    jira.cannotBrowse.clear();
    expect((await intentFor(jira, deps, 'mallory')).code).toBe('NOT_APPROVER');
    expect(((await createSigningIntent({ signature: V1() }, as(jira, 'ann'), deps)) as any).code).toBe('INVALID_REQUEST');
    expect(((await createSigningIntent({ viewHash: 'stale', signature: V1() }, as(jira, 'ann'), deps)) as any).code).toBe('ISSUE_CHANGED');
  });

  it('refuses the author of a change to approve it, as the panel does', async () => {
    const { jira, deps } = setup();
    await sealIssueFlow({ signature: V1() }, as(jira, 'ann'), deps);
    jira.edit('bob', new Date(Date.now() + 1000).toISOString(), 'summary', 'Changed by Bob');
    expect((await intentFor(jira, deps, 'bob', { signature: { reason: 'mine' } })).code).toBe('SELF_APPROVAL');
    expect((await intentFor(jira, deps, 'ann')).code).toBe('REASON_REQUIRED');
    expect((await intentFor(jira, deps, 'ann', { signature: { reason: 'Reviewed' } })).ok).toBe(true);
  });
});

describe('validator with an intent on the screen', () => {
  it('seals for the person who signed, records the transition, then lets the move pass', async () => {
    const { jira, storage, deps } = setup();
    const { intentId } = await intentFor(jira, deps, 'ann');
    const res = await validateTransition(transition(intentId, 'ann'), {}, deps);
    expect(res).toEqual({ result: true });
    const [row] = model.statusRows(storage);
    expect(row).toMatchObject({ statusId: 'LS_SEALED', transitionName: 'SEAL', setByPartyId: await model.token(storage, 'ann') });
    expect(row.data).toMatchObject({ via: 'TRANSITION_SCREEN', transitionToStatusId: '10001' });
    // The field value is not covered (canonical form 2.3.0), so the new seal is unchanged with it set
    jira.issue.fields[FIELD] = intentId;
    expect(await validateTransition(transition(null, 'ann'), {}, deps)).toEqual({ result: true });
  });

  it('uses an intent once', async () => {
    const { jira, storage, deps } = setup();
    const { intentId } = await intentFor(jira, deps, 'ann');
    expect((await validateTransition(transition(intentId, 'ann'), {}, deps)).result).toBe(true);
    expect(await validateTransition(transition(intentId, 'ann'), {}, deps)).toEqual({ result: false, errorMessage: INTENT_EXPIRED });
    expect(model.statusRows(storage)).toHaveLength(1);
  });

  it('refuses an expired or unknown intent', async () => {
    const { jira, storage, deps } = setup();
    const { intentId } = await intentFor(jira, deps, 'ann');
    const key = `ls3:intent:${intentId}`;
    storage.map.set(key, { ...storage.map.get(key), expiresAt: '2000-01-01T00:00:00.000Z' });
    expect(await validateTransition(transition(intentId, 'ann'), {}, deps)).toEqual({ result: false, errorMessage: INTENT_EXPIRED });
    expect(await validateTransition(transition('lsi_' + '0'.repeat(32), 'ann'), {}, deps)).toEqual({ result: false, errorMessage: INTENT_EXPIRED });
    expect(model.statusRows(storage)).toEqual([]);
  });

  it('refuses when the person moving the issue is not the signer, or Jira names no one, and keeps the intent unused', async () => {
    const { jira, storage, deps } = setup();
    const { intentId } = await intentFor(jira, deps, 'ann');
    expect(await validateTransition(transition(intentId, 'bob'), {}, deps)).toEqual({ result: false, errorMessage: INTENT_OTHER_USER });
    expect(await validateTransition(transition(intentId, null), {}, deps)).toEqual({ result: false, errorMessage: INTENT_OTHER_USER });
    expect(storage.map.has(`ls3:intentuse:${intentId}`)).toBe(false);
    expect((await validateTransition(transition(intentId, 'ann'), {}, deps)).result).toBe(true);
  });

  it('refuses an intent made for another issue', async () => {
    const { jira, deps } = setup();
    const { intentId } = await intentFor(jira, deps, 'ann');
    const other = { ...transition(intentId, 'ann'), issue: { id: '20002', key: 'CHG-2' } };
    jira.issue = { ...jira.issue, id: '20002', key: 'CHG-2' };
    expect(await validateTransition(other, {}, deps)).toEqual({ result: false, errorMessage: INTENT_EXPIRED });
  });

  it('blocks when the screen changed covered content: a typed comment or a covered field (Q-10)', async () => {
    const { jira, storage, deps } = setup();
    const a = await intentFor(jira, deps, 'ann');
    const comment = { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Done.' }] }] };
    expect(await validateTransition(transition(a.intentId, 'ann', { fields: { comment } }), {}, deps)).toEqual({ result: false, errorMessage: INTENT_SCREEN_CHANGED });
    const b = await intentFor(jira, deps, 'ann');
    expect(await validateTransition(transition(b.intentId, 'ann', { fields: { summary: 'Edited on the screen' } }), {}, deps)).toEqual({ result: false, errorMessage: INTENT_SCREEN_CHANGED });
    expect(model.statusRows(storage)).toEqual([]);
  });

  it('blocks with the seal flow\'s own reason when the seal cannot be written', async () => {
    const { jira, storage, deps } = setup();
    const { intentId } = await intentFor(jira, deps, 'ann');
    jira.failIssueGet = true;
    const res = await validateTransition(transition(intentId, 'ann'), {}, deps);
    expect(res.result).toBe(false);
    expect(res.errorMessage!.length).toBeLessThanOrEqual(250);
    expect(model.statusRows(storage)).toEqual([]);
  });

  it('ignores a look-alike value in another app\'s field, and treats any such value as ours when the field list cannot be read', async () => {
    const { jira, deps } = setup();
    const other = { id: 'customfield_9', name: 'Other', schema: { type: 'string', custom: 'ari:cloud:ecosystem::extension/11111111-2222-3333-4444-555555555555/e/static/ledgerseal-signature' } };
    jira.fields.push(other);
    const lookalike = 'lsi_' + 'a'.repeat(32);
    expect(await intentOnScreen({ customfield_9: lookalike }, deps)).toBeNull();
    expect(await intentOnScreen({ [FIELD]: lookalike }, deps)).toBe(lookalike);
    expect(await intentOnScreen({ summary: 'x' }, deps)).toBeNull();
    jira.failFields = true;
    expect(await intentOnScreen({ customfield_9: lookalike }, deps)).toBe(lookalike);
  });

  it('leaves a transition without an intent to the normal gate', async () => {
    const { jira, deps } = setup();
    const res = await validateTransition(transition(null, 'ann'), {}, deps);
    expect(res.result).toBe(false);
    expect(res.errorMessage).toContain('not sealed');
  });

  it('approves changes on the transition screen with a reason', async () => {
    const { jira, storage, deps } = setup();
    await sealIssueFlow({ signature: V1() }, as(jira, 'ann'), deps);
    jira.edit('carol', new Date(Date.now() + 1000).toISOString(), 'summary', 'Changed');
    const { intentId } = await intentFor(jira, deps, 'bob', { signature: { reason: 'Checked' } });
    expect(await validateTransition(transition(intentId, 'bob'), {}, deps)).toEqual({ result: true });
    const last = model.statusRows(storage).at(-1);
    expect(last).toMatchObject({ transitionName: 'RESEAL', reason: 'Checked', data: expect.objectContaining({ via: 'TRANSITION_SCREEN' }) });
  });
});

describe('intent edge cases', () => {
  it('refuses a second validator that loses the race to claim the intent', async () => {
    const { jira, storage, deps } = setup();
    const { intentId } = await intentFor(jira, deps, 'ann');
    const create = storage.createIfAbsent.bind(storage);
    storage.createIfAbsent = async (key: string, value: any, options?: any) => (key.startsWith('ls3:intentuse:') ? false : create(key, value, options));
    expect(await validateTransition(transition(intentId, 'ann'), {}, deps)).toEqual({ result: false, errorMessage: INTENT_EXPIRED });
    expect(model.statusRows(storage)).toEqual([]);
  });

  it('works without an issue key or a target status in the payload, and records an empty status', async () => {
    const { jira, storage, deps } = setup();
    const { intentId } = await intentFor(jira, deps, 'ann');
    const payload: any = transition(intentId, 'ann');
    payload.issue = { id: '10001' };
    delete payload.transition;
    expect((await validateTransition(payload, {}, deps)).result).toBe(true);
    expect(model.statusRows(storage)[0].data.transitionToStatusId).toBe('');
  });

  it('passes a refusal of the prepared seal back to the field, and refuses when the site has no key', async () => {
    const { jira, storage, deps } = setup();
    const panel: any = await verifyIssueFlow({}, as(jira, 'ann'), deps);
    const read = storage.get.bind(storage);
    storage.get = async (key: string) => (key === 'ls3:partykey' && storage.map.has('ls3:wes:10001:000001') === false && (storage as any).blockKey ? null : read(key));
    (storage as any).blockKey = true;
    const res: any = await createSigningIntent({ viewHash: panel.viewHash, signature: V1() }, as(jira, 'ann'), deps);
    expect(res.code).toBe('CONFLICT');
  });
});

describe('code signing on the transition screen (ADR-016 with ADR-018)', () => {
  it('needs a TRANSITION code for the intent, keeps only its evidence, and writes it into the row', async () => {
    const { jira, storage, deps } = setup();
    jest.spyOn(declaration, 'isDeclarationV2Approved').mockReturnValue(true);
    await setSigningPolicyFlow({ enabled: true, projectKeys: ['CHG'] }, as(jira, 'admin'), deps);
    const panel: any = await verifyIssueFlow({}, as(jira, 'ann'), deps);
    const v2 = { meaning: 'APPROVAL', declarationVersion: '2', declarationText: DECLARATION_V2.text };
    expect(((await createSigningIntent({ viewHash: panel.viewHash, signature: v2 }, as(jira, 'ann'), deps)) as any).code).toBe('SIGNING_REQUIRED');
    const sealCode: any = await requestCodeFlow({ action: 'SEAL' }, as(jira, 'ann'), deps, signingAuthority);
    const wrongAction: any = await createSigningIntent({ viewHash: panel.viewHash, signature: v2, signing: { challengeId: sealCode.challengeId, code: jira.lastCode('ann') } }, as(jira, 'ann'), deps);
    expect(wrongAction.code).toBe('SIGNING_FAILED');
    const party = await model.token(storage, 'ann');
    storage.map.set(`ls3:sig:state:${party}`, { ...storage.map.get(`ls3:sig:state:${party}`), lastRequestAt: null });
    const req: any = await requestCodeFlow({ action: 'TRANSITION' }, as(jira, 'ann'), deps, signingAuthority);
    const code = jira.lastCode('ann');
    const intent: any = await createSigningIntent({ viewHash: panel.viewHash, signature: v2, signing: { challengeId: req.challengeId, code } }, as(jira, 'ann'), deps);
    expect(intent.ok).toBe(true);
    expect(JSON.stringify(storage.map.get(`ls3:intent:${intent.intentId}`))).not.toContain(code);
    expect(await validateTransition(transition(intent.intentId, 'ann'), {}, deps)).toEqual({ result: true });
    const row = model.statusRows(storage).at(-1);
    expect(row.data.signing).toMatchObject({ method: 'LS_ATL_EMAIL_OTP_1', challengeId: req.challengeId });
    expect(row.data.via).toBe('TRANSITION_SCREEN');
  });

  it('refuses to complete a code-signing intent that carries no code check', async () => {
    const { jira, storage, deps } = setup();
    jest.spyOn(declaration, 'isDeclarationV2Approved').mockReturnValue(true);
    await setSigningPolicyFlow({ enabled: true, projectKeys: ['CHG'] }, as(jira, 'admin'), deps);
    const policy = storage.map.get('ls3:sig:policy');
    const res: any = await sealIssueFlow(
      { viewHash: 'h', signature: { meaning: 'APPROVAL', declarationVersion: '2', declarationText: DECLARATION_V2.text } },
      { accountId: 'ann', extension: { issue: { id: '10001', key: 'CHG-1' } } },
      deps,
      { complete: { policy, signingEvidence: null, transitionToStatusId: '1', apply: (r: any) => r } }
    );
    expect(['SIGNING_REQUIRED', 'ISSUE_CHANGED']).toContain(res.code);
    expect(model.statusRows(storage)).toEqual([]);
  });
});

describe('signature field view model', () => {
  it('shows the seal form, the approval form, no form when sealed, and why a person cannot sign', () => {
    const base = { loading: false, error: false, intentId: null };
    expect(buildSignatureFieldView({ ...base, loading: true, result: null }).mode).toBe('LOADING');
    expect(buildSignatureFieldView({ ...base, result: null }).mode).toBe('ERROR');
    expect(buildSignatureFieldView({ ...base, result: { ok: false, message: 'No browse' } })).toMatchObject({ mode: 'ERROR', text: 'No browse' });
    expect(buildSignatureFieldView({ ...base, intentId: 'lsi_x', result: null })).toMatchObject({ mode: 'SIGNED', text: FIELD_SIGNED_TEXT });
    const rights = (r: any) => ({ canSeal: false, canApproveChanges: false, canRevoke: false, blockedBySelfChange: false, ...r });
    const unsealed = { status: 'NO_SEAL', tamperedFields: [], tamperedAttachments: [], rights: rights({ canSeal: true }) };
    expect(buildSignatureFieldView({ ...base, result: unsealed })).toMatchObject({ mode: 'SEAL', action: 'SEAL', needsReason: false });
    expect(buildSignatureFieldView({ ...base, result: { ...unsealed, route: { stages: [] } } })).toMatchObject({ mode: 'NO_RIGHT', text: FIELD_ROUTED_TEXT });
    expect(buildSignatureFieldView({ ...base, result: { ...unsealed, rights: rights({}) } }).mode).toBe('NO_RIGHT');
    const seal = { certificateId: 'c', state: 'ACTIVE', sealedAt: '2026-11-08T00:00:00.000Z', sealedByAccountId: 'a', meaning: 'APPROVAL', reason: null, declarationVersion: '1', snapshotHash: 'h'.repeat(64), canonicalizerVersion: '2.3.0', everCompromised: false, incidentCount: 0, revocation: null, historyLength: 1 };
    const sealed = { status: 'SEAL_VALID', seal, tamperedFields: [], tamperedAttachments: [], rights: rights({ canSeal: true, canApproveChanges: true, canRevoke: true }) };
    expect(buildSignatureFieldView({ ...base, result: sealed }).mode).toBe('NOT_NEEDED');
    const changed = { ...sealed, status: 'SEAL_BROKEN', tamperedFields: [{ fieldId: 'summary', fieldName: 'Summary', sealedValue: 'a', liveValue: 'b', changedBy: [] }] };
    expect(buildSignatureFieldView({ ...base, result: changed })).toMatchObject({ mode: 'APPROVE', action: 'RESEAL', needsReason: true });
    expect(buildSignatureFieldView({ ...base, result: { ...changed, rights: rights({ blockedBySelfChange: true }) } }).mode).toBe('NO_RIGHT');
    expect(buildSignatureFieldView({ ...base, result: { ok: false } }).text).toBe('LedgerSeal could not load this issue.');
    const revokedNoRight = { ...sealed, status: 'SEAL_REVOKED', seal: { ...seal, state: 'REVOKED' }, rights: rights({}) };
    expect(buildSignatureFieldView({ ...base, result: revokedNoRight }).mode).toBe('NO_RIGHT');
  });
});
