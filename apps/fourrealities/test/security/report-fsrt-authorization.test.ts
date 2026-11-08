/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the evidence report resolvers through the registered Forge handler (HLD 7.1, as
 * DefinitionGuard's test/security/fsrt-authorization.test.ts). For a user whom Jira grants nothing, every
 * report resolver key refuses, reads and writes no app storage, touches no Object Store object, pushes no
 * queue event, makes no call as the app, and its only Jira call is the permission question as the user. A new
 * resolver key without a case fails the test. Also: the wiring, the licence rule (Q9), and the safe-logging
 * rule for the consumer and the daily run (security questionnaire question 8).
 */

import * as fs from 'fs';
import * as path from 'path';

const mockUser = jest.fn();
const mockApp = jest.fn();
const mockContext: { value: Record<string, unknown> } = { value: {} };
jest.mock('@forge/api', () => ({
  __esModule: true,
  getAppContext: () => mockContext.value,
  default: { asUser: () => ({ requestJira: (...a: unknown[]) => mockUser(...a) }), asApp: () => ({ requestJira: (...a: unknown[]) => mockApp(...a) }) },
  route: (strings: TemplateStringsArray, ...values: unknown[]) => strings.reduce((acc, part, i) => acc + part + (i < values.length ? String(values[i]) : ''), ''),
  assumeTrustedRoute: (p: string) => p
}));
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: { beginsWith: (v: string) => v } }));
jest.mock('@forge/object-store', () => ({ __esModule: true, default: {} }));
jest.mock('@forge/events', () => ({ Queue: class { push = jest.fn(); } }));

import {
  adminHandler,
  composeReports,
  createEvidenceReport,
  getReportSettings,
  handler,
  reportCallerOf,
  reportDaily,
  reportTmp,
  reportWorker,
  runReportTmpSweep,
  runReportDaily,
  setGlobalStorageProvider,
  setReportPlatform,
  setReportSettings
} from '../../src/index';
import { MemoryStorage } from '../storage/memory-storage';
import { DefaultEvidenceReportManager } from '../../src/manager/default-evidence-report-manager';
import { MemoryObjects } from '../manager/report-harness';
import { consoleViolations } from '../support/console-rule';

const json = (status: number, body: unknown) => ({ status, json: async () => body, headers: { get: () => null } });
const NOTHING = { permissions: { BROWSE_PROJECTS: { havePermission: false }, ADMINISTER_PROJECTS: { havePermission: false }, ADMINISTER: { havePermission: false } } };
const CONTEXT = { accountId: '712020:viewer', extension: { project: { key: 'PAY', id: '10000' } }, license: { isActive: true } };
const REPORT_ID = '11111111-2222-4333-8444-555555555555';
/** What Forge passes beside the event: @forge/resolver takes the account id and the licence from it, not from the context. */
const RUNTIME = { principal: { accountId: '712020:viewer' }, license: { isActive: true } };

/** Every resolver key of the project page handler, with a payload; the report keys are checked here. */
const REPORT_CASES: Record<string, unknown> = {
  getEvidenceReports: {},
  createEvidenceReport: { from: '2026-10-01', to: '2026-11-01' },
  getEvidenceReport: { reportId: REPORT_ID },
  generateReportDownloadUrls: { keys: [`reports/10000/${REPORT_ID}/report.json`, `people:${REPORT_ID}:csv`] },
  saveReportSchedule: { cadence: 'WEEKLY' },
  deleteReportSchedule: { scheduleId: REPORT_ID },
  deleteEvidenceReport: { reportId: REPORT_ID, reason: 'A reason of enough length.' }
};
/** The keys that existed before ADR-015; they have their own permission tests (test/manager/viewer-permissions.test.ts and others). */
const OTHER_KEYS = ['getProjectDashboard', 'refreshProjectSnapshot', 'getIssueAlignment', 'linkDecision', 'recordException', 'decideException', 'requestReview', 'searchConfluencePages'];

const source = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'index.ts'), 'utf8');
const handlerKeys = Array.from(source.matchAll(/^resolver\.define\('([^']+)'/gm)).map(m => m[1]);

let storage: MemoryStorage;
let objects: MemoryObjects;
let pushes: string[];
beforeEach(() => {
  mockUser.mockReset();
  mockApp.mockReset();
  storage = new MemoryStorage();
  objects = new MemoryObjects();
  pushes = [];
  setGlobalStorageProvider(storage);
  setReportPlatform({ objects, queue: { serviceType: 'accessor', push: async (id: string) => { pushes.push(id); } } });
});
afterEach(() => {
  setGlobalStorageProvider(null);
  setReportPlatform({});
  jest.restoreAllMocks();
});

describe('HLD 7.1: a user whom Jira grants nothing', () => {
  it('every resolver key of the handler has a case here or is a key from before ADR-015', () => {
    expect(handlerKeys.filter(k => !(k in REPORT_CASES) && !OTHER_KEYS.includes(k))).toEqual([]);
    expect(Object.keys(REPORT_CASES).every(k => handlerKeys.includes(k))).toBe(true);
  });

  it.each(Object.keys(REPORT_CASES))('%s refuses, and asks Jira nothing but the permission question as the user', async key => {
    mockUser.mockResolvedValue(json(200, NOTHING));
    const res = (await (handler as (e: unknown, r: unknown) => Promise<unknown>)({ call: { functionKey: key, payload: REPORT_CASES[key] }, context: CONTEXT }, RUNTIME)) as Record<string, unknown>;
    if (key === 'generateReportDownloadUrls') expect(res).toEqual({});
    else expect(res).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    expect(storage.ops).toEqual([]);
    expect(objects.writes).toEqual([]);
    expect(pushes).toEqual([]);
    expect(mockApp).not.toHaveBeenCalled();
    expect(mockUser.mock.calls.map(c => c[0])).toEqual(['/rest/api/3/mypermissions?projectKey=PAY&permissions=BROWSE_PROJECTS,ADMINISTER_PROJECTS,ADMINISTER']);
  });

  it.each(Object.keys(REPORT_CASES))('%s fails closed when the permission question fails', async key => {
    mockUser.mockRejectedValue(new Error('down'));
    const res = (await (handler as (e: unknown, r: unknown) => Promise<unknown>)({ call: { functionKey: key, payload: REPORT_CASES[key] }, context: CONTEXT }, RUNTIME)) as Record<string, unknown>;
    if (key === 'generateReportDownloadUrls') expect(res).toEqual({});
    else expect(res).toMatchObject({ ok: false });
    expect(storage.ops).toEqual([]);
    expect(mockApp).not.toHaveBeenCalled();
  });

  it('a user with Browse projects only still cannot create a report, and nothing is stored', async () => {
    mockUser.mockImplementation(async (p: string) => (String(p).includes('mypermissions')
      ? json(200, { permissions: { BROWSE_PROJECTS: { havePermission: true } } })
      : json(200, { groups: { items: [] } })));
    const res = await createEvidenceReport({ from: '2026-10-01', to: '2026-11-01' }, CONTEXT as never);
    expect(res).toMatchObject({ ok: false, error: { code: 'NOT_REPORT_AUTHOR' } });
    expect(storage.ops.filter(o => o.op === 'set')).toEqual([]);
    expect(mockApp).not.toHaveBeenCalled();
  });

  it('the admin report settings refuse a user who is not a Jira administrator, and read no storage', async () => {
    mockUser.mockResolvedValue(json(200, { permissions: { ADMINISTER: { havePermission: false } } }));
    for (const key of ['fr-admin-reports-get', 'fr-admin-reports-save']) {
      expect(await (adminHandler as (e: unknown, r: unknown) => Promise<unknown>)({ call: { functionKey: key, payload: { retentionDays: 90 } }, context: CONTEXT }, RUNTIME)).toMatchObject({ ok: false, code: 'NOT_ADMIN' });
    }
    expect(storage.ops).toEqual([]);
    expect(mockApp).not.toHaveBeenCalled();
  });
});

describe('licence (owner decision Q9) and wiring', () => {
  const ADMIN = { permissions: { BROWSE_PROJECTS: { havePermission: true }, ADMINISTER_PROJECTS: { havePermission: true }, ADMINISTER: { havePermission: true } } };

  it('refuses creation and schedules when the licence is inactive, and still lists', async () => {
    mockUser.mockImplementation(async (p: string) => (String(p).includes('mypermissions') ? json(200, ADMIN) : json(200, [])));
    const inactive = { ...CONTEXT, license: { isActive: false } };
    const lapsed = { ...RUNTIME, license: { isActive: false } };
    const call = (key: string, payload: unknown) => (handler as (e: unknown, r: unknown) => Promise<unknown>)({ call: { functionKey: key, payload }, context: CONTEXT }, lapsed);
    for (const key of ['createEvidenceReport', 'saveReportSchedule', 'deleteReportSchedule']) {
      expect(await call(key, REPORT_CASES[key])).toMatchObject({ ok: false, error: { code: 'LICENSE_INACTIVE' } });
    }
    const list = (await call('getEvidenceReports', {})) as { ok: boolean; canCreate: boolean; licenceActive: boolean };
    expect(list).toMatchObject({ ok: true, canCreate: false, licenceActive: false });
    expect(await getReportSettings({}, inactive as never)).toMatchObject({ code: 'LICENSE_INACTIVE' });
    expect(await setReportSettings({}, inactive as never)).toMatchObject({ code: 'LICENSE_INACTIVE' });
  });

  it('passes the inactive licence to the detail and download of an existing report, and refuses neither (fix/fourrealities-licence-tab)', async () => {
    mockUser.mockImplementation(async (p: string) => (String(p).includes('mypermissions') ? json(200, ADMIN) : json(200, [])));
    const lapsed = { ...RUNTIME, license: { active: false } };
    const detail = jest.spyOn(DefaultEvidenceReportManager.prototype, 'detail').mockResolvedValue({ ok: true } as never);
    const urls = jest.spyOn(DefaultEvidenceReportManager.prototype, 'downloadUrls').mockResolvedValue({ 'https://os.test/k': 'k' });
    const call = (key: string) => (handler as (e: unknown, r: unknown) => Promise<unknown>)({ call: { functionKey: key, payload: REPORT_CASES[key] }, context: CONTEXT }, lapsed);
    expect(await call('getEvidenceReport')).toEqual({ ok: true });
    expect(await call('generateReportDownloadUrls')).toEqual({ 'https://os.test/k': 'k' });
    expect(detail.mock.calls[0][0]).toMatchObject({ projectKey: 'PAY', licenceActive: false });
    expect(urls.mock.calls[0][0]).toMatchObject({ projectKey: 'PAY', licenceActive: false });
    expect(await call('createEvidenceReport')).toMatchObject({ ok: false, error: { code: 'LICENSE_INACTIVE' } });
  });

  it('lets a Jira administrator read and save the report settings', async () => {
    mockUser.mockImplementation(async (p: string) => (String(p).includes('mypermissions') ? json(200, ADMIN) : json(200, { values: [{ groupId: 'g1', name: 'auditors' }] })));
    expect(await getReportSettings({}, CONTEXT as never)).toMatchObject({ ok: true, retentionDays: 400, allowedRetentionDays: [90, 180, 400, 730, 1095, 1825, 2555], policy: { parties: [] } });
    expect(await setReportSettings({ retentionDays: 730, reportGroupIds: ['g1'] }, CONTEXT as never)).toMatchObject({ ok: true, retentionDays: 730, policy: { parties: [{ partyId: 'g1', name: 'auditors' }] } });
    expect(await setReportSettings({ retentionDays: 1 }, CONTEXT as never)).toMatchObject({ ok: false, code: 'INVALID_INPUT' });
  });

  it('the daily run makes scheduled reports only with an active licence, or an unknown one outside production (round 5)', async () => {
    await storage.set('fr:reports:project:10000', 'PAY');
    await storage.set('fr:rp:10000:schedules', [{ scheduleId: 's', cadence: 'WEEKLY', filters: { fieldIds: [], actors: [] }, createdBy: 'x', createdAt: '2026-01-01T00:00:00.000Z' }]);
    const runtime = (environment: string, state: boolean | undefined) => ({ serviceType: 'accessor' as const, environment: () => environment, appVersion: () => undefined, licenceActive: () => state, licenceState: async () => state });
    for (const [env, state] of [['production', undefined], ['production', false], ['development', false]] as Array<[string, boolean | undefined]>) {
      setReportPlatform({ objects, runtime: runtime(env, state) });
      expect(await runReportDaily(storage)).toMatchObject({ scheduled: 0 });
      expect(mockApp).not.toHaveBeenCalled();
    }
    // An active licence (or an unknown one in development) lets the run search the scope as the app.
    mockApp.mockResolvedValue(json(200, { issues: [], isLast: true }));
    setReportPlatform({ objects, runtime: runtime('development', undefined) });
    await runReportDaily(storage);
    expect(mockApp).toHaveBeenCalled();
  });

  it('reads the current licence field "active", and the deprecated "isActive" only without it', () => {
    expect(reportCallerOf({ license: { active: false } } as never).licenceActive).toBe(false);
    expect(reportCallerOf({ license: { active: true, isActive: false } } as never).licenceActive).toBe(true);
    expect(reportCallerOf({ license: { isActive: false } } as never).licenceActive).toBe(false);
  });

  it('reads the caller from the context only', () => {
    expect(reportCallerOf(CONTEXT as never)).toEqual({ accountId: '712020:viewer', projectKey: 'PAY', projectId: '10000', licenceActive: true });
    expect(reportCallerOf({ extension: { project: { key: 'PAY', id: '' } } } as never)).toEqual({ accountId: undefined, projectKey: 'PAY', projectId: undefined, licenceActive: true });
    expect(reportCallerOf(undefined)).toEqual({ accountId: undefined, projectKey: undefined, projectId: undefined, licenceActive: true });
    expect(reportCallerOf({ extension: { project: { key: 'PAY', id: 10000 } }, license: { isActive: false } } as never)).toMatchObject({ projectId: '10000', licenceActive: false });
  });

  it('builds the Forge graph when no platform is set, and makes no scheduled report when the licence is inactive', async () => {
    setReportPlatform({});
    expect(composeReports(storage, 1000).reports.serviceType).toBe('manager');
    setReportPlatform({ objects, runtime: { serviceType: 'accessor', environment: () => 'development', appVersion: () => undefined, licenceActive: () => false, licenceState: async () => false } });
    await storage.set('fr:reports:project-ids', { '10000': 'PAY' });
    await storage.set('fr:rp:10000:schedules', [{ scheduleId: 's', cadence: 'WEEKLY', filters: { fieldIds: [], actors: [] }, createdBy: 'x', createdAt: '2026-01-01T00:00:00.000Z' }]);
    expect(await runReportDaily(storage)).toMatchObject({ scheduled: 0 });
    expect(mockApp).not.toHaveBeenCalled();
  });
});

describe('question 8: the consumer and the daily run log no error message, object or account id', () => {
  const SECRET = 'SECRET-LOG 712020:alice summary text';
  let lines: unknown[][];
  beforeEach(() => {
    lines = [];
    for (const level of ['error', 'warn', 'log', 'info'] as const) jest.spyOn(console, level).mockImplementation((...args: unknown[]) => { lines.push(args); });
  });
  const broken = () => {
    const s = new MemoryStorage();
    const fail = async () => { throw Object.assign(new Error(SECRET), { code: 'KVS_DOWN' }); };
    s.get = fail;
    s.set = fail;
    s.queryPrefix = fail;
    return s;
  };

  it('the consumer logs only the error name and code', async () => {
    setGlobalStorageProvider(broken());
    await expect(reportWorker({ body: { reportId: REPORT_ID } })).resolves.toBeUndefined();
    await expect(reportWorker(undefined)).resolves.toBeUndefined();
    expect(lines.map(a => a.join(' '))).toEqual(['FourRealities: report job event failed: Error code=KVS_DOWN']);
  });

  it('the hourly sweep logs its counts, or only the error name and code', async () => {
    setReportPlatform({ objects });
    await reportTmp();
    setGlobalStorageProvider(broken());
    await reportTmp();
    expect(lines.map(a => a.join(' '))).toEqual([
      'FourRealities: report temporary files {"deleted":0,"skipped":false}',
      'FourRealities: report temporary files failed: Error code=KVS_DOWN'
    ]);
    expect(await runReportTmpSweep(new MemoryStorage(), Date.now() - 1)).toEqual({ deleted: 0, skipped: false });
  });

  it('the download resolver logs only how many URLs were asked and given', async () => {
    mockUser.mockResolvedValue(json(200, NOTHING));
    await (handler as (e: unknown, r: unknown) => Promise<unknown>)({ call: { functionKey: 'generateReportDownloadUrls', payload: { keys: ['a', 'b'] } }, context: CONTEXT }, RUNTIME);
    await (handler as (e: unknown, r: unknown) => Promise<unknown>)({ call: { functionKey: 'generateReportDownloadUrls', payload: {} }, context: CONTEXT }, RUNTIME);
    expect(lines.map(a => a.join(' '))).toEqual(['FourRealities: report download URLs {"asked":2,"given":0}', 'FourRealities: report download URLs {"asked":0,"given":0}']);
  });

  it('the daily run logs its counts, or only the error name and code', async () => {
    setReportPlatform({ objects, runtime: { serviceType: 'accessor', environment: () => 'development', appVersion: () => undefined, licenceActive: () => true, licenceState: async () => true } });
    await reportDaily();
    setGlobalStorageProvider(broken());
    await reportDaily();
    expect(lines.map(a => a.join(' '))).toEqual([
      'FourRealities: report daily run {"scheduled":0,"expired":0,"tmpDeleted":0,"stalled":0,"skipped":false}',
      'FourRealities: report daily run failed: Error code=KVS_DOWN'
    ]);
    for (const args of lines) for (const a of args) expect(String(a)).not.toMatch(/SECRET|712020/);
  });

  it('every new report source file passes the console rule', () => {
    const src = path.join(__dirname, '..', '..', 'src');
    const files = ['index.ts', 'manager/default-evidence-report-manager.ts', 'accessor/default-forge-object-store-accessor.ts', 'accessor/default-report-crypto-accessor.ts', 'accessor/default-forge-jira-report-accessor.ts'];
    expect(files.flatMap(f => consoleViolations(fs.readFileSync(path.join(src, f), 'utf8')))).toEqual([]);
    // The signing key is never written to a log or returned by a resolver.
    const all = files.map(f => fs.readFileSync(path.join(src, f), 'utf8')).join('\n');
    expect(all).not.toMatch(/console\.[a-z]+\([^)]*FOURREALITIES_SIGNING_KEY/);
  });
});
