/**
 * B-14: the full definitionguard-dod property on every change, signed.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import * as crypto from 'crypto';
import { jira, CountingStorage, JiraCall } from '../helpers/forge-mocks';

jest.mock('@forge/api', () => {
  const m = require('../helpers/forge-mocks');
  const asApp = { requestJira: m.makeRequester('app') };
  const asUser = { requestJira: m.makeRequester('user') };
  return { __esModule: true, default: { asApp: () => asApp, asUser: () => asUser }, route: m.routeImpl };
});
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: { beginsWith: (v: string) => v } }));

import { buildAttestation, signAttestation, verifyAttestation, publishAttestation, retryPolicy, PROPERTY_KEY } from '../../src/integrity/attestation';
import { toggleChecklistItem, waiveChecklistItem, resetChecklist, validateTransition } from '../../src/index';
import { createdEvent, emptyState, applyEvent, makeEvent } from '../../src/domain/event-log';
import { DEFAULT_DEFINITION_OF_DONE } from '../../src/domain/checklist-engine';
import { ChecklistTemplate } from '../../src/domain/models';

const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
const PRIVATE_PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const PUBLIC_PEM = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const T = '2026-11-01T00:00:00.000Z';

function sampleState(template: ChecklistTemplate = DEFAULT_DEFINITION_OF_DONE) {
  let st = emptyState('95001', 'DEMO-95001', '10000');
  st = applyEvent(st, createdEvent(st, template, 'creator', T));
  st = applyEvent(st, makeEvent(st, { type: 'TICK', itemId: template.items[0].id, at: T, actorAccountId: '712020:dev' }));
  return st;
}

describe('B-14 attestation', () => {
  afterEach(() => {
    delete process.env.DG_SIGNING_KEY;
    delete process.env.DG_SIGNING_KEY_ID;
  });

  it('builds schema v2 with counts, open item ids, head hash and issue binding', () => {
    const st = sampleState();
    const att = buildAttestation(st, T);
    const mandatory = DEFAULT_DEFINITION_OF_DONE.items.filter(i => i.isMandatory);
    expect(att).toEqual({
      schemaVersion: 2,
      issueId: '95001',
      templateId: DEFAULT_DEFINITION_OF_DONE.id,
      templateVersion: 1,
      stateVersion: 2,
      mandatoryTotal: mandatory.length,
      mandatoryCompleted: 1,
      openMandatoryItemIds: mandatory.slice(1).map(i => i.id),
      isFullySatisfied: false,
      lastModifiedByAccountId: '712020:dev',
      headHash: st.headHash,
      issuedAt: T
    });
  });

  it('signs with Ed25519 over canonical JSON, and a one-byte change fails verification', () => {
    const att = buildAttestation(sampleState(), T);
    const signed = signAttestation(att, PRIVATE_PEM, 'dg-2026-11');
    expect(signed.keyId).toBe('dg-2026-11');
    expect(typeof signed.sig).toBe('string');
    expect(verifyAttestation(signed, PUBLIC_PEM)).toBe(true);
    expect(verifyAttestation({ ...signed, mandatoryCompleted: signed.mandatoryCompleted + 1 }, PUBLIC_PEM)).toBe(false);
    expect(verifyAttestation({ ...signed, issueId: '95002' }, PUBLIC_PEM)).toBe(false);
    expect(verifyAttestation({ ...signed, sig: null }, PUBLIC_PEM)).toBe(false);
    const other = crypto.generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' }).toString();
    expect(verifyAttestation(signed, other)).toBe(false);
    expect(verifyAttestation({ ...signed, sig: 'not base64 !!' }, PUBLIC_PEM)).toBe(false);
  });

  it('stays at 32,768 characters or less at 50 items', () => {
    const big: ChecklistTemplate = { id: 't50', name: 'n', description: '', items: Array.from({ length: 50 }, (_, i) => ({ id: `${'i'.repeat(60)}${String(i).padStart(4, '0')}`, title: 't', isMandatory: true, category: 'TESTING' as const })) };
    const signed = signAttestation(buildAttestation(sampleState(big), T), PRIVATE_PEM, 'k');
    expect(JSON.stringify(signed).length).toBeLessThanOrEqual(32768);
  });

  describe('publishAttestation', () => {
    let sleeps: number[];

    beforeEach(() => {
      jira.reset();
      sleeps = [];
      retryPolicy.sleep = async (ms: number) => { sleeps.push(ms); };
    });

    it('writes the signed property when the key is set, and an unsigned one when it is not', async () => {
      jira.handler = () => ({ status: 204 });
      await publishAttestation(sampleState(), T);
      expect(jira.calls[0]).toMatchObject({ who: 'app', method: 'PUT', path: `/rest/api/3/issue/95001/properties/${PROPERTY_KEY}` });
      expect(jira.calls[0].body).toMatchObject({ schemaVersion: 2, sig: null, keyId: null });

      process.env.DG_SIGNING_KEY = Buffer.from(PRIVATE_PEM).toString('base64');
      process.env.DG_SIGNING_KEY_ID = 'dg-2026-11';
      await publishAttestation(sampleState(), T);
      expect(verifyAttestation(jira.calls[1].body, PUBLIC_PEM)).toBe(true);
      expect(jira.calls[1].body.keyId).toBe('dg-2026-11');
    });

    it('retries on 429 and 5xx with backoff, honouring Retry-After, then succeeds', async () => {
      const replies = [{ status: 429, retryAfter: '2' }, { status: 503 }, { status: 204 }];
      jira.handler = () => replies.shift() as any;
      expect(await publishAttestation(sampleState(), T)).toEqual({ ok: true, attempts: 3 });
      expect(sleeps).toEqual([2000, 2000]); // Retry-After 2 s, then the 2 s backoff after try 2
    });

    it('gives up after 3 tries without throwing, and does not retry a 4xx', async () => {
      jira.handler = () => ({ status: 500 });
      expect(await publishAttestation(sampleState(), T)).toEqual({ ok: false, attempts: 3, status: 500 });
      jira.calls = [];
      jira.handler = () => ({ status: 400 });
      expect(await publishAttestation(sampleState(), T)).toEqual({ ok: false, attempts: 1, status: 400 });
      jira.handler = () => ({ status: 0, throws: 'down' } as any);
      expect((await publishAttestation(sampleState(), T)).ok).toBe(false);
    });

    it('falls back to an unsigned property when the key is unusable', async () => {
      jira.handler = () => ({ status: 204 });
      process.env.DG_SIGNING_KEY = Buffer.from('not a key').toString('base64');
      await publishAttestation(sampleState(), T);
      expect(jira.calls[0].body).toMatchObject({ sig: null, keyId: null });
    });
  });
});

describe('B-14 every change writes the property, and the validator never reads it', () => {
  const ctx = { accountId: '712020:admin', extension: { issue: { id: '95002', key: 'DEMO-95002', type: 'Task', typeId: '10004' }, project: { id: '10000', key: 'DEMO' } } };

  beforeEach(() => {
    jira.reset();
    retryPolicy.sleep = async () => {};
    jira.handler = (c: JiraCall) => (c.path.includes('/mypermissions')
      ? { status: 200, body: { permissions: { EDIT_ISSUES: { havePermission: true }, ADMINISTER_PROJECTS: { havePermission: true } } } }
      : c.path.startsWith('/rest/api/3/status/') ? { status: 200, body: { statusCategory: { key: 'done' } } } : { status: 204 });
  });

  it('toggle, waive and reset each PUT schema v2 with the new state version', async () => {
    const storage = new CountingStorage();
    await toggleChecklistItem({ itemId: 'item-unit-tests', isCompleted: true }, ctx, storage);
    await waiveChecklistItem({ itemId: 'item-peer-review', reason: 'Pair-programmed, reviewed live.' }, ctx, storage);
    await resetChecklist({}, ctx, storage);
    const puts = jira.callsTo(`/properties/${PROPERTY_KEY}`, 'app').filter(c => c.method === 'PUT');
    expect(puts.map(p => p.body.stateVersion)).toEqual([2, 3, 4]);
    expect(puts.every(p => p.body.schemaVersion === 2 && p.body.issueId === '95002')).toBe(true);
  });

  it('(V-a, V-b) the validator ignores a forged property and still blocks and names items', async () => {
    const storage = new CountingStorage();
    jira.calls = [];
    const res = await validateTransition({ issue: { id: '95002' }, transition: { to: { id: '10001' } } }, { extension: ctx.extension }, storage);
    expect(res.result).toBe(false);
    expect(res.errorMessage).toContain('Open mandatory items:');
    expect(jira.callsTo('/properties/')).toEqual([]);
  });
});
