/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: merge review H-1 (an unverified sibling record scores exactly like no record) and
 * M-1 (an older signed record put back over a newer one is a rollback and counts as missing).
 */

import * as crypto from 'crypto';
import { DEFAULT_SOURCE_SETTINGS, IssueFacts, SiteConfig } from '../../src/contract/data/models';
import { DefaultSourcePolicyEngine } from '../../src/engine/default-source-policy-engine';
import { DefaultGateEngine, evaluateGates, isOlder, verifiedVersions } from '../../src/engine/default-gate-engine';
import { DefaultMetricsEngine } from '../../src/engine/default-metrics-engine';
import { DEFAULT_CATALOG } from '../../src/contract/data/catalog';
import { factsFromIssue } from '../../src/accessor/issue-facts';
import { attestationChecker, canonicalJson } from '../../src/accessor/attestation-verifier';
import { TrustedKey } from '../../src/accessor/attestation-keys';
import { DefaultKvsAttestationHistoryAccessor } from '../../src/accessor/default-kvs-attestation-history-accessor';
import { MemoryStorage } from '../storage/memory-storage';
import { auditReadiness } from '../../src/ui/pipeline';
import { detailText } from '../../src/ui/gate-text';

const CONFIG: SiteConfig = { devFieldId: null, siteHost: 'x.atlassian.net', statusCategories: {}, pullRequestsSeen: false, readAt: 't' };
const sources = new DefaultSourcePolicyEngine().resolve({ ...DEFAULT_SOURCE_SETTINGS, process: 'definitionguard', audit: 'ledgerseal' }, {}, CONFIG);
const hcSources = new DefaultSourcePolicyEngine().resolve({ ...DEFAULT_SOURCE_SETTINGS, process: 'herocoders', audit: 'ledgerseal' }, {}, CONFIG);
const metrics = new DefaultMetricsEngine();
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const KEYS: TrustedKey[] = [
  { producer: 'definitionguard', keyId: 'dg-t', environments: ['PRODUCTION'], pem: publicKey.export({ type: 'spki', format: 'pem' }).toString() },
  { producer: 'ledgerseal', keyId: 'ls-t', environments: ['PRODUCTION'], pem: publicKey.export({ type: 'spki', format: 'pem' }).toString() }
];
const verify = attestationChecker(KEYS);
const sign = (body: Record<string, unknown>, keyId: string) => {
  const b = { ...body, keyId };
  return { ...b, sig: crypto.sign(null, Buffer.from(canonicalJson(b)), privateKey).toString('base64') };
};

const DG = (o: Record<string, unknown> = {}) => ({ schemaVersion: 3, issueId: '10042', mandatoryTotal: 1, mandatoryCompleted: 1, isFullySatisfied: true, headHash: 'a'.repeat(64), stateVersion: 3, issuedAt: '2026-11-06T09:00:00.000Z', ...o });
const LS = (o: Record<string, unknown> = {}) => ({ schemaVersion: 3, issueId: '10042', status: 'SEAL_VALID', certificateId: '3f0c2a52-7d1b-4c47-9a51-0d6e3b8a9f10', snapshotHash: 'b'.repeat(64), sealedAt: '2026-11-06T09:00:00.000Z', issuedAt: '2026-11-06T09:00:00.000Z', ...o });
const PAGE = { url: 'https://x.atlassian.net/wiki/spaces/A/pages/1/ADR', title: 'ADR one', applicationType: 'com.atlassian.confluence', pageId: '1', pageExists: true };

function facts(props: Record<string, unknown>, status = 'done'): IssueFacts {
  const f = factsFromIssue({ id: '10042', key: 'PAY-1', fields: { summary: 's', status: { name: 'S', statusCategory: { key: status } }, issuelinks: [] }, properties: props }, { verify, siteHost: 'x.atlassian.net' });
  return { ...f, remoteLinks: [PAGE] };
}
const row = (f: IssueFacts, s = sources) => metrics.buildRow(f, evaluateGates(f, DEFAULT_CATALOG, s));

describe('H-1: an unverified record scores exactly like no record when its check is in use', () => {
  const forgedDod = { isFullySatisfied: true, mandatoryCompleted: 1, mandatoryTotal: 1, headHash: 'a'.repeat(64) };
  const forgedSeal = { status: 'SEAL_VALID', certificateId: '3f0c2a52-7d1b-4c47-9a51-0d6e3b8a9f10', snapshotHash: 'b'.repeat(64), sealedAt: '2026-11-06T09:00:00.000Z' };
  const cases: Array<[string, Record<string, unknown>]> = [
    ['unsigned', { 'definitionguard-dod': forgedDod, 'ledgerseal-cert': forgedSeal }],
    ['signed with an unknown key', { 'definitionguard-dod': sign(DG(), 'other'), 'ledgerseal-cert': sign(LS(), 'other') }]
  ];

  it.each(cases)('gives the same issue score as no record (%s), on a Done issue and before Done', (_label, props) => {
    for (const status of ['done', 'indeterminate']) {
      const none = row(facts({}, status));
      const forged = row(facts(props, status));
      expect(forged.rai).toBe(none.rai);
      expect(forged.risk).toBe(none.risk);
      expect(forged.applicableGates).toBe(none.applicableGates);
    }
    expect(row(facts({})).rai).toBe(33);
  });

  it('gives the same dashboard summary and audit readiness as no record', () => {
    const none = [row(facts({})), row(facts({}, 'indeterminate'))];
    const forged = [row(facts(cases[0][1])), row(facts(cases[0][1], 'indeterminate'))];
    const a = metrics.summarize(none);
    const b = metrics.summarize(forged);
    expect([b.averageRAI, b.dodRate, b.sealRate, b.riskDistribution]).toEqual([a.averageRAI, a.dodRate, a.sealRate, a.riskDistribution]);
    expect(auditReadiness(forged).statusWord).toBe('Incomplete');
    expect(auditReadiness(forged).summary).toBe(auditReadiness(none).summary);
  });

  it('does not let an unsigned "complete" record replace a verified "open" one', () => {
    const open = row(facts({ 'definitionguard-dod': sign(DG({ isFullySatisfied: false, mandatoryCompleted: 0 }), 'dg-t') }));
    const forged = row(facts({ 'definitionguard-dod': forgedDod }));
    expect(forged.rai).toBe(open.rai);
  });

  it('applies the same rule to a Checklists for Jira checklist, and says why in the text', () => {
    const none = row(facts({}), hcSources);
    const checklist = row(facts({ checklist: { uncheckedMandatoryItems: 0 } }), hcSources);
    expect(checklist.rai).toBe(none.rai);
    expect(detailText(checklist.gates.process)).toBe('Checklists for Jira reports no open mandatory items. FourRealities could not verify this record (Checklists for Jira records are not signed), so it counts as missing.');
  });

  it('still scores a verified record', () => {
    const signed = row(facts({ 'definitionguard-dod': sign(DG(), 'dg-t'), 'ledgerseal-cert': sign(LS(), 'ls-t') }));
    expect(signed.rai).toBe(100);
  });
});

describe('M-1: an older signed record is a rollback', () => {
  const brokenLater = sign(LS({ status: 'SEAL_BROKEN', issuedAt: '2026-11-06T10:00:00.000Z' }), 'ls-t');
  const validEarlier = sign(LS(), 'ls-t');

  it('treats an old SEAL_VALID put back over a newer SEAL_BROKEN as missing', () => {
    const first = facts({ 'ledgerseal-cert': brokenLater });
    const history = verifiedVersions(first);
    expect(history).toEqual({ ledgerseal: { issuedAt: '2026-11-06T10:00:00.000Z' } });
    const replayed = { ...facts({ 'ledgerseal-cert': validEarlier }), attestationHistory: history };
    expect(evaluateGates(replayed, DEFAULT_CATALOG, sources).audit).toMatchObject({ state: 'MISSING', reason: 'SEAL_SIGNATURE_INVALID', args: { why: 'older than a record already seen' } });
    expect(verifiedVersions(replayed)).toEqual({});
    expect(evaluateGates({ ...facts({ 'ledgerseal-cert': validEarlier }), attestationHistory: {} }, DEFAULT_CATALOG, sources).audit.state).toBe('FOUND');
  });

  it('treats an old DefinitionGuard "complete" put back over a newer "open" as missing', () => {
    const history = { dod: { stateVersion: 5, issuedAt: '2026-11-06T09:30:00.000Z' } };
    const old = { ...facts({ 'definitionguard-dod': sign(DG({ stateVersion: 3, issuedAt: '2026-11-06T09:00:00.000Z' }), 'dg-t') }), attestationHistory: history };
    expect(evaluateGates(old, DEFAULT_CATALOG, sources).process.reason).toBe('DOD_SIGNATURE_INVALID');
    const same = { ...facts({ 'definitionguard-dod': sign(DG({ stateVersion: 5, issuedAt: '2026-11-06T09:30:00.000Z' }), 'dg-t') }), attestationHistory: history };
    expect(evaluateGates(same, DEFAULT_CATALOG, sources).process.state).toBe('FOUND');
    expect(new DefaultGateEngine().verifiedVersions(same)).toEqual({ dod: { stateVersion: 5, issuedAt: '2026-11-06T09:30:00.000Z' } });
  });

  it('N-2: accepts a genuine new record after DefinitionGuard starts counting again (lower stateVersion, later issuedAt)', () => {
    const history = { dod: { stateVersion: 7, issuedAt: '2026-11-06T09:00:00.000Z' } };
    const restarted = { ...facts({ 'definitionguard-dod': sign(DG({ stateVersion: 1, issuedAt: '2026-11-07T09:00:00.000Z' }), 'dg-t') }), attestationHistory: history };
    expect(evaluateGates(restarted, DEFAULT_CATALOG, sources).process).toMatchObject({ state: 'FOUND', verification: 'VERIFIED' });
    expect(verifiedVersions(restarted)).toEqual({ dod: { stateVersion: 1, issuedAt: '2026-11-07T09:00:00.000Z' } });
  });

  it('compares by issuedAt when both records carry it, else by stateVersion', () => {
    expect(isOlder({ stateVersion: 2 }, { stateVersion: 3 })).toBe(true);
    expect(isOlder({ stateVersion: 3 }, { stateVersion: 3 })).toBe(false);
    expect(isOlder({ stateVersion: 1, issuedAt: '2026-11-07' }, { stateVersion: 7, issuedAt: '2026-11-06' })).toBe(false);
    expect(isOlder({ stateVersion: 9, issuedAt: '2026-11-05' }, { stateVersion: 7, issuedAt: '2026-11-06' })).toBe(true);
    expect(isOlder({ issuedAt: '2026-01-01' }, { issuedAt: '2026-01-02' })).toBe(true);
    expect(isOlder({ issuedAt: '2026-01-02' }, { issuedAt: '2026-01-02' })).toBe(false);
    expect(isOlder({}, { issuedAt: 'x' })).toBe(false);
    expect(isOlder({ issuedAt: 'x' }, undefined)).toBe(false);
  });

  it('keeps the newest version per issue and producer in storage, and writes only when it changes', async () => {
    const storage = new MemoryStorage();
    const h = new DefaultKvsAttestationHistoryAccessor(storage);
    expect(h.serviceType).toBe('accessor');
    expect(await h.get('1')).toEqual({});
    expect(await h.raise('1', { ledgerseal: { issuedAt: 'b' }, dod: { stateVersion: 2 } }, {})).toBe(true);
    expect(await h.raise('1', { ledgerseal: { issuedAt: 'a' }, dod: { stateVersion: 1 } }, await h.get('1'))).toBe(false);
    expect(await h.raise('1', { dod: { stateVersion: 4, issuedAt: 'z' } }, await h.get('1'))).toBe(true);
    // N-2: a later issuedAt with a lower stateVersion (DefinitionGuard reinstalled) replaces the history.
    expect(await h.raise('7', { dod: { stateVersion: 1, issuedAt: '2026-11-07' } }, { dod: { stateVersion: 7, issuedAt: '2026-11-06' } })).toBe(true);
    expect(await h.get('7')).toEqual({ dod: { stateVersion: 1, issuedAt: '2026-11-07' } });
    expect(await h.raise('8', { dod: { stateVersion: 2 } }, { dod: { stateVersion: 1 } })).toBe(true);
    expect(await h.get('1')).toEqual({ ledgerseal: { issuedAt: 'b' }, dod: { stateVersion: 4, issuedAt: 'z' } });
    await h.raise('2', { ledgerseal: { issuedAt: 'd' } }, {});
    expect(await h.raise('2', { ledgerseal: { issuedAt: 'c' } }, await h.get('2'))).toBe(false);
    expect((await h.listAll()).get('2')).toEqual({ ledgerseal: { issuedAt: 'd' } });
    expect(Array.from((await h.listAll()).keys()).sort()).toEqual(['1', '2', '7', '8']);
    expect(await h.raise('4', { dod: { stateVersion: 2 } }, { dod: { stateVersion: 2, issuedAt: 'x' } })).toBe(false);
    expect(await h.raise('5', { ledgerseal: {} }, { ledgerseal: {} })).toBe(false);
    expect(await h.raise('6', { ledgerseal: { issuedAt: 'b' } }, { ledgerseal: {} })).toBe(true);
    await storage.set('fr:att:3', null);
    expect((await h.listAll()).get('3')).toEqual({});
  });
});
