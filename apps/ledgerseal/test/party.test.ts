/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * ADR-010 (readiness review B1): hashed records name people by party token, the token-to-account map is one key
 * per account outside the records, and a closed account (its map key deleted) leaves every seal valid and names
 * no one.
 *
 * @author Fahim Farook
 */

import * as crypto from 'crypto';
import { isPartyToken, partyFunction, pseudonymise } from '../src/domain/party';
import { PARTY_PREFIX, PartyRepository, PartyResolver, SITE_KEY } from '../src/storage/party-repository';
import { getSealEvidence, sealIssue, verifyIssue } from '../src/index';
import { FakeJira, MemoryStore, model, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '' }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

const KEY = Buffer.alloc(32, 7);
const party = partyFunction(KEY);

function setup(issue: any = sampleIssue()) {
  const jira = new FakeJira(issue);
  jira.approvers = new Set(['ann', 'bob']);
  const storage = new MemoryStore();
  const as = (user: string | null) => {
    jira.currentUser = user;
    return { jira, storage };
  };
  return { jira, storage, as };
}

/** Everything the app stored, except the token-to-account map itself. */
function recordsText(storage: MemoryStore): string {
  return JSON.stringify([...storage.map.entries()].filter(([k]) => !k.startsWith(PARTY_PREFIX) && k !== SITE_KEY));
}

describe('party tokens (ADR-010 decisions 1 and 2)', () => {
  it('is HMAC-SHA-256 of the account id under the site key, cut to 128 bits, with the pty_ prefix', () => {
    const expected = 'pty_' + crypto.createHmac('sha256', KEY).update('557058:abc', 'utf8').digest('hex').slice(0, 32);
    expect(party('557058:abc')).toBe(expected);
    expect(isPartyToken(expected)).toBe(true);
    expect(party('557058:abc')).toBe(expected);
    expect(partyFunction(Buffer.alloc(32, 8))('557058:abc')).not.toBe(expected);
    expect(isPartyToken('557058:abc')).toBe(false);
    expect(isPartyToken('pty_123')).toBe(false);
  });

  it('replaces every user object and mention, and keeps the rest of the data', () => {
    const raw = {
      assignee: { accountId: 'a1', displayName: 'Alice', emailAddress: 'alice@example.com', avatarUrls: { x: 'u' } },
      list: [{ accountId: 'b2', displayName: 'Bob' }, 'text', 5],
      nested: { owner: { accountId: 'a1' }, amount: 10 },
      empty: { accountId: '' },
      description: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'mention', attrs: { id: 'c3', text: '@Carol', accessLevel: '' } }] }] }
    };
    const { value, seen } = pseudonymise(raw, party);
    expect(value.assignee).toEqual({ accountId: party('a1'), displayName: party('a1') });
    expect(value.list).toEqual([{ accountId: party('b2'), displayName: party('b2') }, 'text', 5]);
    expect(value.nested).toEqual({ owner: { accountId: party('a1'), displayName: party('a1') }, amount: 10 });
    expect(value.empty).toEqual({ accountId: '' });
    expect((value.description as any).content[0].content[0].attrs).toEqual({ id: party('c3'), text: party('c3'), accessLevel: '' });
    expect(JSON.stringify(value)).not.toMatch(/Alice|Bob|Carol|alice@|"a1"|"b2"|"c3"/);
    expect(seen.get(party('a1'))).toEqual({ accountId: 'a1', displayName: 'Alice' });
    expect(seen.get(party('c3'))).toEqual({ accountId: 'c3', displayName: 'Carol' });
    expect(raw.assignee.displayName).toBe('Alice');
  });

  it('gives a mention without text no name', () => {
    const { seen } = pseudonymise({ type: 'mention', attrs: { id: 'd4' } }, party);
    expect(seen.get(party('d4'))).toEqual({ accountId: 'd4', displayName: null });
  });
});

describe('the token-to-account map (ADR-010 decision 4)', () => {
  it('creates the site key once; a writer that loses the race uses the stored key', async () => {
    const storage = new MemoryStore();
    const repo = new PartyRepository(storage);
    expect(await repo.partyForRead()).toBeNull();
    const first = await repo.partyForWrite();
    const again = await repo.partyForWrite();
    expect(again('x')).toBe(first('x'));
    const racing = new MemoryStore();
    const winner = Buffer.alloc(32, 1);
    racing.createIfAbsent = async (key: string) => {
      racing.map.set(key, { key: winner.toString('base64') });
      return false;
    };
    expect((await new PartyRepository(racing).partyForWrite())('x')).toBe(partyFunction(winner)('x'));
    const broken = new MemoryStore();
    broken.createIfAbsent = async () => false;
    await expect(new PartyRepository(broken).partyForWrite()).rejects.toThrow('site key');
  });

  it('registers, resolves, lists and forgets accounts; an old record id resolves to itself', async () => {
    const storage = new MemoryStore();
    const repo = new PartyRepository(storage);
    const p = await repo.partyForWrite();
    await repo.register(['ann', 'ann', '', 'bob'], p, '2026-11-06T00:00:00.000Z');
    expect((await repo.all()).map(r => r.entry.accountId).sort()).toEqual(['ann', 'bob']);
    storage.map.set(`${PARTY_PREFIX}not-a-token`, { accountId: 'x' });
    storage.map.set(`${PARTY_PREFIX}${p('broken')}`, { nothing: true });
    expect(await repo.all()).toHaveLength(2);
    const resolver = new PartyResolver(repo);
    expect(await resolver.resolve(p('ann'))).toBe('ann');
    expect(await resolver.resolve(p('ann'))).toBe('ann');
    expect(await resolver.resolve('557058:old-record')).toBe('557058:old-record');
    expect(await resolver.resolve(null)).toBeNull();
    await repo.forget(p('ann'));
    expect(await new PartyResolver(repo).resolve(p('ann'))).toBeNull();
  });
});

describe('records hold no account id and no name (B1)', () => {
  function namedIssue() {
    const issue = sampleIssue();
    issue.fields.assignee = { accountId: 'dev-1', displayName: 'Dana Developer', emailAddress: 'dana@example.com' };
    issue.fields.reporter = { accountId: 'rep-1', displayName: 'Rita Reporter' };
    issue.fields.comment = {
      comments: [{ id: '1', author: { accountId: 'dev-1', displayName: 'Dana Developer' }, created: '2026-11-01T00:00:00.000Z', body: 'Ready' }]
    };
    return issue;
  }

  it('seals with tokens only; the map names the signer alone', async () => {
    const { storage, as } = setup(namedIssue());
    await expect(sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'))).resolves.toMatchObject({ ok: true });
    expect(recordsText(storage)).not.toMatch(/"ann"|"dev-1"|"rep-1"|Dana|Rita|example\.com/);
    const snapshot = await model.sealedSnapshot(storage);
    expect(snapshot.fields.find((f: any) => f.id === 'assignee')).toMatchObject({ value: { accountId: await model.token(storage, 'dev-1') } });
    expect(snapshot.comments[0].authorAccountId).toBe(await model.token(storage, 'dev-1'));
    const map = [...storage.map.entries()].filter(([k]) => k.startsWith(PARTY_PREFIX)).map(([, v]) => v.accountId);
    expect(map).toEqual(['ann']);
  });

  it('a failed or refused first seal writes nothing, not even the site key', async () => {
    const { jira, storage, as } = setup();
    jira.failIssueGet = true;
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    expect(storage.sets).toEqual([]);
  });

  it('two first seals in a race: the loser gets CONFLICT and writes no record', async () => {
    const { storage, as } = setup();
    const real = storage.createIfAbsent.bind(storage);
    storage.createIfAbsent = async (key: string, value: any) => (key === SITE_KEY ? false : real(key, value));
    await expect(sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'))).resolves.toMatchObject({ ok: false, code: 'CONFLICT' });
    expect(await model.workEffort(storage)).toBeNull();
  });

  it('after the signer account is closed the seal stays valid, the panel says "a closed account", and no record changes', async () => {
    const { storage, as } = setup(namedIssue());
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    await new PartyRepository(storage).forget(await model.token(storage, 'ann'));
    const before = recordsText(storage);
    const view: any = await verifyIssue({}, panelContext('viewer'), as('viewer'));
    expect(view.status).toBe('SEAL_VALID');
    expect(view.seal).toMatchObject({ sealedByAccountId: '', sealedByClosed: true });
    expect(recordsText(storage)).toBe(before);
  });

  it('names people in the change list from the live issue, the map or Jira, and a closed account otherwise', async () => {
    const { jira, storage, as } = setup(namedIssue());
    jira.users = { 'dev-1': 'Dana Developer' };
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    jira.edit('bob', '2099-01-01T00:00:00.000Z', 'assignee', { accountId: 'new-1', displayName: 'Nina New' });
    let view: any = await verifyIssue({}, panelContext('viewer'), as('viewer'));
    let row = view.tamperedFields.find((f: any) => f.fieldId === 'assignee');
    // Dana is no longer on the issue as assignee but still a comment author, so the live issue names her
    expect(row).toMatchObject({ sealedValue: 'Dana Developer', liveValue: 'Nina New', changedBy: ['bob'] });

    // The comment goes, so Dana is named nowhere on the issue, and the map does not know her
    jira.issue.fields.comment = { comments: [] };
    jira.edit('bob', '2099-01-01T00:01:00.000Z', 'summary', 'other');
    view = await verifyIssue({}, panelContext('viewer'), as('viewer'));
    row = view.tamperedFields.find((f: any) => f.fieldId === 'assignee');
    expect(row.sealedValue).toBe('a user no longer on this issue');

    // A person the map knows is named through Jira; once the map key is gone the change shows a closed account
    const bob = await model.token(storage, 'bob');
    expect(storage.map.get(PARTY_PREFIX + bob)).toMatchObject({ accountId: 'bob' });
    await new PartyRepository(storage).forget(bob);
    view = await verifyIssue({}, panelContext('viewer'), as('viewer'));
    row = view.tamperedFields.find((f: any) => f.fieldId === 'summary');
    expect(row).toMatchObject({ changedBy: [], changedByClosed: 1 });
  });

  it('resolves a sealed user through the map and Jira when the live issue no longer names them', async () => {
    const issue = sampleIssue();
    issue.fields.customfield_1 = { accountId: 'ann', displayName: 'Ann' };
    const { jira, storage, as } = setup(issue);
    jira.users = { ann: 'Ann Approver' };
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    jira.edit('bob', '2099-01-01T00:00:00.000Z', 'customfield_1', null);
    const view: any = await verifyIssue({}, panelContext('viewer'), as('viewer'));
    expect(view.tamperedFields.find((f: any) => f.fieldId === 'customfield_1').sealedValue).toBe('Ann Approver');
  });

  it('exports the evidence with an unsigned parties map, null for a closed account', async () => {
    const { jira, storage, as } = setup();
    await sealIssue({ signature: validSignature() }, panelContext('ann'), as('ann'));
    jira.edit('bob', '2099-01-01T00:00:00.000Z', 'summary', 'changed');
    await verifyIssue({}, panelContext('viewer'), as('viewer'));
    const ann = await model.token(storage, 'ann');
    const bob = await model.token(storage, 'bob');
    let evidence: any = await getSealEvidence({}, panelContext('viewer'), as('viewer'));
    expect(evidence.parties).toEqual({ [ann]: 'ann', [bob]: 'bob' });
    await new PartyRepository(storage).forget(bob);
    evidence = await getSealEvidence({}, panelContext('viewer'), as('viewer'));
    expect(evidence.parties[bob]).toBeNull();
    expect(JSON.stringify(evidence.attestation)).not.toContain('ann');
  });
});
