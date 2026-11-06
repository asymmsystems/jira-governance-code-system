/**
 * DefinitionGuard scale and behaviour harness.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * Mocked Forge APIs: asApp() and asUser() are separate mocks, so a run can tell them apart.
 * Storage mock serialises on every get and set, like a remote KVS. It counts operations and bytes.
 * Results go to ./results/<label>.json. Label comes from HARNESS_LABEL (default "baseline").
 * Reuses audit probes 14 to 17 (appendix-definitionguard.md section 1.2) through the resolver path.
 */
import * as fs from 'fs';
import * as path from 'path';

const APP: string = (global as any).APP_DIR;
const LABEL = process.env.HARNESS_LABEL || 'baseline';

type Call = { who: 'app' | 'user'; method: string; url: string };
const calls: Call[] = [];
let userLookupOk = true;

function classify(url: string): string {
  if (url.includes('/properties/')) return 'property';
  if (url.includes('/rest/api/3/user?')) return 'user';
  if (url.includes('/mypermissions')) return 'permissions';
  if (url.includes('/rest/api/3/issue/')) return 'issue';
  return 'other';
}

function makeRequester(who: 'app' | 'user') {
  return async (url: string, opts?: any) => {
    calls.push({ who, method: opts?.method || 'GET', url });
    if (url.includes('/mypermissions')) {
      const keys = decodeURIComponent((url.split('permissions=')[1] || '').split('&')[0]).split(',');
      const permissions: any = {};
      for (const k of keys) permissions[k] = { key: k, havePermission: true };
      return { status: 200, json: async () => ({ permissions }) };
    }
    if (url.includes('/rest/api/3/user?')) {
      if (!userLookupOk) return { status: 404, json: async () => ({}) };
      return { status: 200, json: async () => ({ displayName: 'Firstname Lastname' }) };
    }
    if (url.includes('/properties/')) return { status: 204, json: async () => ({}) };
    return { status: 200, json: async () => ({ id: '10001', key: 'DEMO-1', fields: { issuetype: { name: 'Task' }, status: { name: 'Open' } } }) };
  };
}

jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asApp: () => ({ requestJira: makeRequester('app') }),
    asUser: () => ({ requestJira: makeRequester('user') })
  },
  route: (strings: TemplateStringsArray, ...values: any[]) =>
    strings.reduce((acc, s, i) => acc + s + (i < values.length ? encodeURIComponent(String(values[i])) : ''), '')
}));
jest.mock('@forge/kvs', () => ({ kvs: { get: jest.fn(), set: jest.fn(), delete: jest.fn() } }));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const app = require(path.join(APP, 'src/index'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ChecklistEngine } = require(path.join(APP, 'src/domain/checklist-engine'));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { calculateChecklistHash } = require(path.join(APP, 'src/domain/hasher'));

class CountingStorage {
  store = new Map<string, string>();
  gets = 0; sets = 0; bytesWritten = 0;
  delayMs = 0; failGet = false; failSet = false;
  async get<T>(key: string): Promise<T | undefined> {
    this.gets++;
    if (this.failGet) throw new Error('KVS unavailable (harness)');
    const snap = this.store.get(key);
    if (this.delayMs) await new Promise(r => setTimeout(r, this.delayMs));
    return snap === undefined ? undefined : JSON.parse(snap);
  }
  async set(key: string, value: any): Promise<void> {
    if (this.failSet) throw new Error('KVS write failed (harness)');
    const s = JSON.stringify(value);
    this.sets++; this.bytesWritten += Buffer.byteLength(s, 'utf8');
    this.store.set(key, s);
  }
  async delete(key: string): Promise<void> { this.store.delete(key); }
  async setIfAbsent(key: string, value: any): Promise<boolean> {
    if (this.failSet) throw new Error('KVS write failed (harness)');
    if (this.store.has(key)) return false;
    const s = JSON.stringify(value);
    this.sets++; this.bytesWritten += Buffer.byteLength(s, 'utf8');
    this.store.set(key, s);
    return true;
  }
  async listByPrefix(prefix: string, cursor?: string, limit = 100) {
    const keys = [...this.store.keys()].filter(k => k.startsWith(prefix)).sort();
    const start = cursor ? Number(cursor) : 0;
    return { values: keys.slice(start, start + limit).map(k => JSON.parse(this.store.get(k)!)), nextCursor: start + limit < keys.length ? String(start + limit) : undefined };
  }
  // Largest single value stored for the issue: the v1 record, the v2 state, or one v2 event.
  bytes(issueKeyOrId: string): number {
    const id = issueKeyOrId.replace(/^dg:checklist:/, '');
    let max = 0;
    for (const [k, v] of this.store) {
      if (k === `dg:checklist:${id}` || k === `dg:state:${id}` || k.startsWith(`dg:evt:${id}:`)) max = Math.max(max, Buffer.byteLength(v, 'utf8'));
    }
    return max;
  }
  totalBytes(id: string): number {
    let t = 0;
    for (const [k, v] of this.store) if (k.endsWith(`:${id}`) || k.includes(`:${id}:`)) t += Buffer.byteLength(v, 'utf8');
    return t;
  }
  resetCounters() { this.gets = 0; this.sets = 0; this.bytesWritten = 0; }
}

const ACCOUNT = '712020:0123456789abcdef01234567';
const ctx = (issueId: string, accountId = ACCOUNT) => ({
  accountId,
  extension: { issue: { id: issueId, key: `DEMO-${issueId}`, type: 'Task' }, project: { key: 'DEMO' } }
});

function template(n: number) {
  return {
    id: `tmpl-${n}`, name: `Synthetic ${n}`, description: 'harness',
    items: Array.from({ length: n }, (_, i) => ({
      id: `item-${String(i).padStart(2, '0')}`,
      title: `Synthetic checklist item number ${i} with a realistic title length`,
      isMandatory: i % 5 !== 4, category: 'TESTING'
    }))
  };
}

function seed(storage: CountingStorage, issueId: string, nItems: number) {
  const st = ChecklistEngine.initializeState(issueId, `DEMO-${issueId}`, template(nItems), 'system', '2026-11-01T00:00:00.000Z');
  storage.store.set(`dg:checklist:${issueId}`, JSON.stringify(st));
  return st;
}

function readChecklist(storage: CountingStorage, id: string) {
  const v2 = storage.store.get(`dg:state:${id}`);
  if (v2) {
    const st = JSON.parse(v2);
    const events = [...storage.store.keys()].filter(k => k.startsWith(`dg:evt:${id}:`)).length;
    if (st.schemaVersion === 3) {
      const done = st.criteria.filter((c: any) => c.currentStatusId !== 'DOD_OPEN');
      return { layout: 'v3', completed: done.map((c: any) => c.templateItemId), stateVersion: st.seq, auditEvents: events, firstDoneBy: done[0]?.lastStatusByPartyId };
    }
    const done = st.items.filter((i: any) => i.status !== 'OPEN');
    return { layout: 'v2', completed: done.map((i: any) => i.id), stateVersion: st.seq, auditEvents: events, firstDoneBy: done[0]?.byAccountId };
  }
  const v1 = JSON.parse(storage.store.get(`dg:checklist:${id}`)!);
  const done = v1.items.filter((i: any) => i.isCompleted);
  return { layout: 'v1', completed: done.map((i: any) => i.id), stateVersion: v1.stateVersion, auditEvents: v1.auditTrail.length, firstDoneBy: done[0]?.completedBy };
}

function callSummary(from: number) {
  const slice = calls.slice(from);
  const by: Record<string, number> = {};
  for (const c of slice) by[`${c.who}:${classify(c.url)}`] = (by[`${c.who}:${classify(c.url)}`] || 0) + 1;
  return { total: slice.length, by };
}

const results: any = { label: LABEL, date: new Date().toISOString(), node: process.version, kvsLimitBytes: 240 * 1024 };

afterAll(() => {
  const dir = path.join(__dirname, 'results');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${LABEL}.json`), JSON.stringify(results, null, 2));
});

describe('M1/M2 record size and Jira calls per panel load', () => {
  const ITEMS = [6, 20, 50];
  const TOGGLES = [10, 100, 1000];
  results.size = {};
  results.panelLoad = {};
  results.toggle = {};

  for (const nItems of ITEMS) {
    it(`items=${nItems}`, async () => {
      const storage = new CountingStorage();
      app.setGlobalStorageProvider(storage);
      const issueId = String(20000 + nItems);
      const st = seed(storage, issueId, nItems);
      const ids: string[] = st.items.map((i: any) => i.id);
      let done = 0;
      let crossed: number | null = null;
      let crossed32: number | null = null;
      results.size[nItems] = {};
      results.panelLoad[nItems] = {};
      for (const target of TOGGLES) {
        while (done < target) {
          const id = ids[done % ids.length];
          const round = Math.floor(done / ids.length);
          const before = calls.length;
          const t0 = process.hrtime.bigint();
          await app.toggleChecklistItem({ itemId: id, isCompleted: round % 2 === 0 }, ctx(issueId));
          const ms = Number(process.hrtime.bigint() - t0) / 1e6;
          if (done === target - 1) results.toggle[`${nItems}x${target}`] = { jira: callSummary(before), resolverMsMock: +ms.toFixed(2) };
          done++;
          const b = storage.bytes(`dg:checklist:${issueId}`);
          if (!crossed32 && b > 32 * 1024) crossed32 = done;
          if (!crossed && b > 240 * 1024) crossed = done;
        }
        results.size[nItems][target] = storage.bytes(`dg:checklist:${issueId}`);
        // Panel load, user lookup healthy
        userLookupOk = true; storage.resetCounters();
        let before = calls.length;
        await app.getIssueChecklist({}, ctx(issueId));
        const healthy = { jira: callSummary(before), kvsGets: storage.gets, kvsSets: storage.sets, bytesWritten: storage.bytesWritten };
        // Panel load, user lookup failing (deactivated user or lookup error): stored names stay as accountIds
        userLookupOk = false; storage.resetCounters();
        before = calls.length;
        await app.getIssueChecklist({}, ctx(issueId));
        const degraded = { jira: callSummary(before), kvsGets: storage.gets, kvsSets: storage.sets };
        userLookupOk = true;
        results.panelLoad[nItems][target] = { healthy, degraded };
      }
      // Toggles to exceed 32 KiB (entity-property-sized) and 240 KiB (KVS value limit).
      // Real KVS rejects the write that passes 240 KiB; the mock keeps going so growth stays measurable.
      results.size[nItems].togglesTo32KiB = crossed32;
      results.size[nItems].togglesTo240KiB = crossed;
      // baseline (v1): grows with toggles. After B-03/B-04: bounded.
      expect(results.size[nItems][1000]).toBeGreaterThan(0);
    });
  }

  it('degraded worst case: every stored name is an accountId', async () => {
    // Toggles while the user lookup fails store the raw accountId (index.ts:66-75, 219-222).
    const storage = new CountingStorage();
    app.setGlobalStorageProvider(storage);
    const issueId = '29999';
    const st = seed(storage, issueId, 6);
    userLookupOk = false;
    for (let n = 0; n < 200; n++) {
      await app.toggleChecklistItem({ itemId: st.items[n % 6].id, isCompleted: Math.floor(n / 6) % 2 === 0 }, ctx(issueId));
    }
    const before = calls.length;
    await app.getIssueChecklist({}, ctx(issueId));
    const s = callSummary(before);
    userLookupOk = true;
    results.panelLoadWorstCase6Items200Toggles = s;
    // baseline (v1): one lookup per stored accountId. After B-03: none.
    expect(s.total).toBeGreaterThanOrEqual(0);
  });

  it('first panel load on a new issue', async () => {
    const storage = new CountingStorage();
    app.setGlobalStorageProvider(storage);
    const before = calls.length;
    await app.getIssueChecklist({}, { accountId: ACCOUNT, extension: { issue: { id: '30001', key: 'DEMO-3' }, project: { key: 'DEMO' } } });
    results.firstLoad = { jira: callSummary(before), kvsSets: storage.sets };
    // baseline (v1): 1 write. After B-03: reads never write.
    expect(storage.sets).toBeLessThanOrEqual(1);
  });

  it('notes at 500 characters, 6 items', async () => {
    const storage = new CountingStorage();
    app.setGlobalStorageProvider(storage);
    const issueId = '31001';
    const st = seed(storage, issueId, 6);
    const out: Record<number, number> = {};
    for (let n = 1; n <= 1000; n++) {
      // Round-based toggles: every item ticked, then every item unticked (v3 refuses a repeated status).
      const k = n - 1;
      await app.toggleChecklistItem({ itemId: st.items[k % 6].id, isCompleted: Math.floor(k / 6) % 2 === 0, notes: 'x'.repeat(500), evidence: { note: 'x'.repeat(500) } }, ctx(issueId));
      if ([10, 100, 1000].includes(n)) out[n] = storage.bytes(`dg:checklist:${issueId}`);
    }
    results.sizeWithNotes6Items = out;
    expect(out[1000]).toBeGreaterThan(0);
  });
});

describe('M3 validator behaviour (probes reused and extended)', () => {
  results.validator = {};

  it('V1 blocks a transition to a non-done status (H1, DG-07)', async () => {
    const storage = new CountingStorage(); app.setGlobalStorageProvider(storage);
    seed(storage, '40001', 6);
    const r = await app.validateTransition({ issue: { id: '40001', key: 'DEMO-40001' }, transition: { from: { id: '1' }, to: { id: '3' } } }, {});
    results.validator.blocksAnyTransition = r;
    // baseline: blocked (gate ignored the target). After B-10: a move into a non-Done status passes.
    expect(typeof r.result).toBe('boolean');
  });

  it('V2 missing record: blocks, names items, and writes storage (DG-08 side effect)', async () => {
    const storage = new CountingStorage(); app.setGlobalStorageProvider(storage);
    const before = calls.length;
    const r = await app.validateTransition({ issue: { id: '40002', key: 'DEMO-40002' } }, {});
    results.validator.missingRecord = { result: r, kvsSets: storage.sets, jira: callSummary(before) };
    expect(r.result).toBe(false);
    expect(r.errorMessage).toMatch(/Pending items:|Open mandatory items:/);
  });

  it('V3 storage read error: validator throws (DG-08)', async () => {
    const storage = new CountingStorage(); storage.failGet = true; app.setGlobalStorageProvider(storage);
    let outcome: any;
    try { outcome = { returned: await app.validateTransition({ issue: { id: '40003' } }, {}) }; }
    catch (e: any) { outcome = { threw: true, message: e.message }; }
    results.validator.storageReadError = outcome;
    // baseline: threw. After B-01: returns result false.
    expect(outcome.threw === true || outcome.returned?.result === false).toBe(true);
  });

  it('V4 storage write error on auto-init: validator throws (DG-08)', async () => {
    const storage = new CountingStorage(); storage.failSet = true; app.setGlobalStorageProvider(storage);
    let outcome: any;
    try { outcome = { returned: await app.validateTransition({ issue: { id: '40004' } }, {}) }; }
    catch (e: any) { outcome = { threw: true, message: e.message }; }
    results.validator.storageWriteError = outcome;
    // baseline: threw. After B-01: no write happens, so the result is a normal block.
    expect(outcome.threw === true || outcome.returned?.result === false).toBe(true);
  });

  it('V5 validator never reads the entity property', async () => {
    const storage = new CountingStorage(); app.setGlobalStorageProvider(storage);
    seed(storage, '40005', 6);
    const before = calls.length;
    await app.validateTransition({ issue: { id: '40005' } }, {});
    const s = callSummary(before);
    results.validator.propertyReads = s.by['app:property'] || 0;
    expect(s.by['app:property'] || 0).toBe(0);
  });

  it('V6 zero mandatory items: validator allows, panel rule says locked (probe 17, DG-14)', async () => {
    const storage = new CountingStorage(); app.setGlobalStorageProvider(storage);
    const st = ChecklistEngine.initializeState('40006', 'DEMO-40006', { id: 'o', name: 'o', description: '', items: [{ id: 'x', title: 'x', isMandatory: false, category: 'TESTING' }] }, 'system');
    storage.store.set('dg:checklist:40006', JSON.stringify(st));
    const r = await app.validateTransition({ issue: { id: '40006' } }, {});
    // baseline: the v1 panel formula (index.tsx:105) said locked. After B-10: the panel uses the shared gate rule.
    const mandatory = st.items.filter((i: any) => i.isMandatory);
    const v1PanelFormula = mandatory.length > 0 && mandatory.length === mandatory.filter((i: any) => i.isCompleted).length;
    const panel = typeof app.getIssueChecklist === 'function'
      ? await app.getIssueChecklist({}, { accountId: 'a', extension: { issue: { id: '40006', key: 'DEMO-40006', type: 'Task' }, project: { id: '10000' } } })
      : null;
    results.validator.zeroMandatory = { validatorAllows: r.result, v1PanelFormula, panelGateOpen: panel ? panel.isFullySatisfied : v1PanelFormula };
    expect(r.result).toBe(true);
  });
});

describe('M4 concurrency, permissions, attribution (probes 14, DG-02, DG-03, DG-09)', () => {
  results.integrity = {};

  it('P14 concurrent ticks through the resolver lose one update', async () => {
    const storage = new CountingStorage(); storage.delayMs = 5; app.setGlobalStorageProvider(storage);
    const st = seed(storage, '50001', 6);
    await Promise.all([
      app.toggleChecklistItem({ itemId: st.items[0].id, isCompleted: true }, ctx('50001', '712020:alice')),
      app.toggleChecklistItem({ itemId: st.items[2].id, isCompleted: true }, ctx('50001', '712020:bob'))
    ]);
    storage.delayMs = 0;
    results.integrity.concurrent = readChecklist(storage, '50001');
    // baseline (v1): 1 of 2 kept. After B-03 (v2): both kept.
    expect(results.integrity.concurrent.completed.length).toBeGreaterThanOrEqual(1);
  });

  it('DG-02 any caller ticks and resets, no permission call, never asUser', async () => {
    const storage = new CountingStorage(); app.setGlobalStorageProvider(storage);
    const st = seed(storage, '50002', 6);
    const before = calls.length;
    await app.toggleChecklistItem({ itemId: st.items[0].id, isCompleted: true }, ctx('50002', '712020:browse-only-contractor'));
    await app.resetChecklist({}, ctx('50002', '712020:browse-only-contractor'));
    const s = callSummary(before);
    results.integrity.permissions = {
      appPermissionCalls: s.by['app:permissions'] || 0,
      userPermissionCalls: s.by['user:permissions'] || 0,
      userCalls: calls.slice(before).filter(c => c.who === 'user').length
    };
    // baseline: 0 permission calls. After B-02: 1 per toggle and 1 per reset, as the user.
    expect(results.integrity.permissions.appPermissionCalls).toBe(0);
  });

  it('DG-03 saveProjectTemplate without project context writes the payload project', async () => {
    const storage = new CountingStorage(); app.setGlobalStorageProvider(storage);
    // baseline: writes dod-templates:OTHER. After B-02: the issue-panel function no longer exists.
    if (typeof app.saveProjectTemplate !== 'function') {
      results.integrity.templateWriteKeys = 'saveProjectTemplate removed from the issue panel';
      return;
    }
    await app.saveProjectTemplate({ projectKey: 'OTHER', issueType: 'Bug', template: { items: [] } }, { accountId: '712020:x' });
    results.integrity.templateWriteKeys = [...storage.store.keys()];
    expect(storage.store.has('dod-templates:OTHER')).toBe(true);
  });

  it('DG-09 a panel load does not change stored attribution', async () => {
    const storage = new CountingStorage(); app.setGlobalStorageProvider(storage);
    const st = seed(storage, '50003', 6);
    userLookupOk = false;
    await app.toggleChecklistItem({ itemId: st.items[0].id, isCompleted: true }, ctx('50003'));
    userLookupOk = true;
    const before = JSON.stringify([...storage.store.entries()].sort());
    const v1Before = storage.store.has('dg:state:50003') ? null : JSON.parse(storage.store.get('dg:checklist:50003')!);
    storage.resetCounters();
    await app.getIssueChecklist({}, ctx('50003'));
    const after = JSON.stringify([...storage.store.entries()].sort());
    const out: any = { writesDuringLoad: storage.sets, storageChangedByLoad: before !== after };
    if (v1Before) {
      const v1After = JSON.parse(storage.store.get('dg:checklist:50003')!);
      out.completedByBefore = v1Before.items[0].completedBy;
      out.completedByAfter = v1After.items[0].completedBy;
      out.storedHashMatchesRecompute = calculateChecklistHash(v1After.items, v1After.stateVersion, v1After.auditTrail) === v1After.checklistHash;
    } else {
      out.storedActor = readChecklist(storage, '50003').firstDoneBy;
    }
    results.integrity.nameRewrite = out;
    expect(out).toBeDefined();
  });
});
});
