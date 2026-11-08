/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the evidence report Manager end to end (ADR-015, spec v4 section 11): permission refusals,
 * creation and its caps, the job as the app, the signed manifest and the hash chain, pseudonymous tokens and
 * the people file, the download rule, early deletion with a tombstone, schedules, retention, clean-up and
 * the licence rule (owner decisions Q2, Q3, Q4, Q6, Q8, Q9).
 */

import * as crypto from 'crypto';
import { ADMIN, BROWSER, NOBODY, PROJECT, PROJECT_ADMIN, caller, change, harness } from './report-harness';
import { BROWSE_DENIED_TEXT, CHECK_FAILED_TEXT, LICENCE_TEXT, NOT_AUTHOR_TEXT, objectKey } from '../../src/manager/default-evidence-report-manager';
import { canonicalJson } from '../../src/engine/default-report-engine';
import { DefaultReportPolicyEngine } from '../../src/engine/default-report-policy-engine';
import { DEFAULT_REPORT_SETTINGS, ReportManifest, ReportsView } from '../../src/contract/data/reports';

const sha = (t: string) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');
const RANGE = { from: '2026-10-01', to: '2026-11-01' };
const ok = <T>(r: { ok: boolean } & Partial<T>) => {
  expect(r.ok).toBe(true);
  return r as T;
};

/** Three issues: one with a status change and a description change, one assigned, one created in the range. */
function seeded(o: Parameters<typeof harness>[0] = {}) {
  const h = harness(o);
  h.issues.push(
    { id: '101', created: '2026-09-01T00:00:00.000Z', changes: [change('1', '2026-10-03T10:00:00.000Z', 'acc-ana', 'status', '1', '3', 'To Do', 'Done'), change('2', '2026-10-04T10:00:00.000Z', 'acc-ana', 'description', null, null, 'secret plan text', 'more secret text')] },
    { id: '102', created: '2026-09-01T00:00:00.000Z', changes: [change('3', '2026-10-06T10:00:00.000Z', 'acc-bo', 'assignee', 'acc-ana', 'acc-bo', 'Ana Person', 'Bo Person')] },
    { id: '103', created: '2026-10-20T00:00:00.000Z' },
    { id: '104', created: '2026-09-01T00:00:00.000Z', changes: [change('4', '2026-09-03T10:00:00.000Z', 'acc-ana', 'status', '1', '3')] }
  );
  h.names['acc-ana'] = { displayName: 'Ana Person', active: true };
  h.names['acc-bo'] = { displayName: 'Bo Person', active: false };
  return h;
}

async function makeReport(h: ReturnType<typeof harness>, payload: Record<string, unknown> = RANGE, who = caller()) {
  const created = await h.manager.create(who, ADMIN, payload);
  if (!created.ok) throw new Error(created.error.message);
  await h.drain();
  return created.reportId;
}

const filesOf = (h: ReturnType<typeof harness>, reportId: string) => ({
  manifest: h.objects.objects.get(objectKey(PROJECT.projectId, reportId, 'manifest.json'))!,
  json: h.objects.objects.get(objectKey(PROJECT.projectId, reportId, 'report.json'))!,
  csv: h.objects.objects.get(objectKey(PROJECT.projectId, reportId, 'report.csv'))!
});

describe('refusals before anything is read (HLD 7.1)', () => {
  it.each(['list', 'create', 'detail', 'saveSchedule', 'deleteSchedule', 'deleteReport'] as const)('%s refuses without a project, without an answer from Jira, or without Browse projects, and reads no storage', async method => {
    const h = harness();
    const run = (c: ReturnType<typeof caller>, p: typeof ADMIN) => (h.manager[method] as (c: unknown, p: unknown, x: unknown) => Promise<{ ok: boolean; error?: { code: string; message: string } }>)(c, p, {});
    expect((await run({ ...caller(), projectId: undefined }, ADMIN)).error?.code).toBe('INVALID_INPUT');
    expect((await run(caller(), { ...ADMIN, status: 500 })).error).toEqual({ code: 'JIRA_ERROR', message: CHECK_FAILED_TEXT, status: 500 });
    expect((await run(caller(), { ...ADMIN, status: 0 })).error).toEqual({ code: 'JIRA_ERROR', message: CHECK_FAILED_TEXT });
    expect((await run(caller(), NOBODY)).error).toEqual({ code: 'FORBIDDEN', message: BROWSE_DENIED_TEXT });
    expect(h.storage.ops).toEqual([]);
    expect(h.appJira.calls).toEqual([]);
  });

  it('downloadUrls gives nothing without Browse projects, and asks nothing else', async () => {
    const h = harness();
    expect(await h.manager.downloadUrls(caller(), NOBODY, { keys: ['x'] })).toEqual({});
    expect(h.storage.ops).toEqual([]);
    expect(h.appJira.calls).toEqual([]);
  });
});

describe('who may create a report (owner decision Q2)', () => {
  it('refuses a viewer with Browse projects only, before any search', async () => {
    const h = seeded();
    expect(await h.manager.create(caller('acc-x'), BROWSER, RANGE)).toEqual({ ok: false, error: { code: 'NOT_REPORT_AUTHOR', message: NOT_AUTHOR_TEXT } });
    expect(h.userJira.calls).toEqual([]);
    expect(h.people.myGroupIds).not.toHaveBeenCalled();
  });

  it('lets a member of a configured report group create, after the Tier 1 check failed', async () => {
    const h = seeded();
    await h.store.saveSettings({ ...DEFAULT_REPORT_SETTINGS, reportGroups: [{ partyId: 'g-audit', partyTypeId: 'GROUP', name: 'auditors' }] });
    h.groups.groupIds = ['g-other'];
    expect((await h.manager.create(caller('acc-x'), BROWSER, RANGE)).ok).toBe(false);
    h.groups.groupIds = ['g-audit'];
    expect((await h.manager.create(caller('acc-x'), BROWSER, RANGE)).ok).toBe(true);
    h.groups.status = 500;
    expect((await h.manager.create(caller('acc-x'), BROWSER, RANGE)).ok).toBe(false);
  });

  it('makes no report when the licence is inactive, but still lists (Q9)', async () => {
    const h = seeded();
    expect(await h.manager.create(caller('acc-admin', false), ADMIN, RANGE)).toEqual({ ok: false, error: { code: 'LICENSE_INACTIVE', message: LICENCE_TEXT } });
    expect(h.storage.ops).toEqual([]);
    const view = ok<ReportsView>(await h.manager.list(caller('acc-admin', false), ADMIN, {}));
    expect(view.canCreate).toBe(false);
    expect(view.licenceActive).toBe(false);
  });
});

describe('creation and its caps (Q6)', () => {
  it('searches as the user, stores the job, its ids and its index entry, and queues it', async () => {
    const h = seeded();
    const r = await h.manager.create(caller(), PROJECT_ADMIN, { ...RANGE, fieldIds: ['status'], actorAccountIds: ['acc-ana'] });
    expect(r).toEqual({ ok: true, reportId: expect.stringMatching(/^[0-9a-f-]{36}$/), state: 'QUEUED' });
    const id = (r as { reportId: string }).reportId;
    expect(h.userJira.calls[1]).toBe('search:project = 10000 AND updated >= "2026-09-30" AND created < "2026-11-02" ORDER BY created ASC');
    expect(h.appJira.calls).toEqual([]);
    const job = (await h.store.getJob(id))!;
    expect(job).toMatchObject({ state: 'QUEUED', projectKey: 'PAY', projectId: '10000', range: { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' }, progress: { issuesTotal: 4 } });
    expect(job.filters.actors).toEqual([expect.stringMatching(/^pty_[0-9a-f]{32}$/)]);
    expect(job.requestedBy).toMatch(/^pty_/);
    expect(JSON.stringify(job)).not.toContain('acc-');
    expect(await h.store.loadIds(id, job.idChunks)).toEqual(['101:PAY-101', '102:PAY-102', '103:PAY-103', '104:PAY-104']);
    expect((await h.store.getIndex('10000'))[0]).toMatchObject({ reportId: id, state: 'QUEUED' });
    expect(h.pushes).toEqual([{ reportId: id }]);
    expect(await h.store.projects()).toEqual(['10000']);
  });

  it('stores nothing when more than 10,000 issues may be in scope (TOO_MANY_ISSUES)', async () => {
    const h = seeded();
    h.userJira.extraIds = Array.from({ length: 10_000 }, (_, i) => String(20_000 + i));
    const before = h.storage.store.size;
    const r = await h.manager.create(caller(), ADMIN, RANGE);
    expect(r.ok === false && r.error.code).toBe('TOO_MANY_ISSUES');
    expect(h.storage.store.size - before).toBeLessThanOrEqual(2); // only the party key and the caller's token entry
    expect(Array.from(h.storage.store.keys()).filter(k => k.startsWith('fr:rj:') || k.includes(':reports'))).toEqual([]);
    expect(h.pushes).toEqual([]);
  });

  it('refuses a fourth queued job (JOB_LIMIT) and a full index (REPORT_LIMIT)', async () => {
    const h = seeded();
    for (let i = 0; i < 3; i++) expect((await h.manager.create(caller(), ADMIN, RANGE)).ok).toBe(true);
    expect((await h.manager.create(caller(), ADMIN, RANGE) as { error: { code: string } }).error.code).toBe('JOB_LIMIT');
    const full = Array.from({ length: 200 }, (_, i) => ({ reportId: `r${i}`, state: 'DONE' as const, range: { from: 'a', to: 'b' }, filters: { fieldIds: [], actors: [] }, trigger: 'user' as const, requestedBy: 'x', createdAt: 't' }));
    await h.store.saveIndex('10000', full);
    expect((await h.manager.create(caller(), ADMIN, RANGE) as { error: { code: string } }).error.code).toBe('REPORT_LIMIT');
  });

  it('passes on validation errors, a failed field read and a failed search', async () => {
    const h = seeded();
    expect((await h.manager.create(caller(), ADMIN, { from: '2026-11-01', to: '2026-10-01' }) as { error: { code: string } }).error.code).toBe('RANGE_INVALID');
    h.userJira.fieldsStatus = 503;
    expect((await h.manager.create(caller(), ADMIN, RANGE) as { error: { code: string } }).error.code).toBe('JIRA_ERROR');
    h.userJira.fieldsStatus = 200;
    h.userJira.searchStatus = 400;
    expect(await h.manager.create(caller(), ADMIN, RANGE)).toMatchObject({ ok: false, error: { code: 'JIRA_ERROR', status: 400 } });
    expect(await h.manager.create({ ...caller(), accountId: undefined }, ADMIN, RANGE)).toMatchObject({ ok: false });
  });
});

describe('the job (as the app, the stored ids only) and the files', () => {
  it('builds a signed report: hashes in the manifest, the header in report.json, tokens not account ids, free text omitted', async () => {
    const h = seeded();
    const id = await makeReport(h);
    const job = (await h.store.getJob(id))!;
    expect(job.state).toBe('DONE');
    const f = filesOf(h, id);
    const manifest = JSON.parse(f.manifest) as ReportManifest;
    expect(manifest).toMatchObject({ format: 'fourrealities-evidence-report/1', reportId: id, projectKey: 'PAY', projectId: '10000', siteHost: 'example.atlassian.net', environment: 'development', appVersion: '9.0.0', keyId: 'fr-test-key', previous: null, counts: { issues: 3, changes: 3, missingSincePrevious: 0 } });
    expect(manifest.files).toEqual([
      { name: 'report.json', mediaType: 'application/json', bytes: Buffer.byteLength(f.json), sha256: sha(f.json) },
      { name: 'report.csv', mediaType: 'text/csv; charset=utf-8', bytes: Buffer.byteLength(f.csv), sha256: sha(f.csv) }
    ]);
    const { sig, ...signed } = manifest;
    expect(crypto.verify(null, Buffer.from(canonicalJson(signed)), h.publicKey, Buffer.from(String(sig), 'base64'))).toBe(true);
    const data = JSON.parse(f.json);
    const { files, keyId, sig: _s, ...header } = manifest;
    expect(data.header).toEqual(header);
    expect(data.issues.map((i: { issueId: string }) => i.issueId)).toEqual(['101', '102', '103']); // 104 has no change in the range
    for (const text of [f.manifest, f.json, f.csv]) {
      expect(text).not.toMatch(/acc-ana|acc-bo|Ana Person|Bo Person|secret plan/);
    }
    expect(f.json).toContain('"omitted":{"fromLength":16,"reason":"FREE_TEXT","toLength":16}');
    expect(f.csv).toContain('FREE_TEXT (16 -> 16 characters)');
    expect(job.manifestSha256).toBe(sha(f.manifest));
    expect(await h.store.getHead('10000')).toEqual({ reportId: id, manifestSha256: sha(f.manifest) });
    expect(await h.store.loadIds(id, job.idChunks)).toEqual(['101:PAY-101', '102:PAY-102', '103:PAY-103']);
    expect(await h.store.loadTokens(id, job.tokenChunks || 0)).toHaveLength(3);
    expect(Array.from(h.objects.objects.keys()).filter(k => k.startsWith('tmp/'))).toEqual([]);
    expect(h.appJira.calls.some(c => c.startsWith('facts:101,102,103,104'))).toBe(true);
    expect(h.appJira.calls.some(c => c.startsWith('search'))).toBe(false);
    const entry = (await h.store.getIndex('10000'))[0];
    expect(entry).toMatchObject({ state: 'DONE', issues: 3, changes: 3, reportSha256: sha(f.json), manifestSha256: sha(f.manifest), keyId: 'fr-test-key' });
  });

  it('links each report to the previous manifest, and lists issues of the previous report that are gone', async () => {
    const h = seeded();
    const first = await makeReport(h);
    h.issues.find(i => i.id === '102')!.deleted = true;
    const second = await makeReport(h);
    const m1 = filesOf(h, first).manifest;
    const m2 = JSON.parse(filesOf(h, second).manifest) as ReportManifest;
    expect(m2.previous).toEqual({ reportId: first, manifestSha256: sha(m1) });
    expect(m2.counts.missingSincePrevious).toBe(1);
    expect(JSON.parse(filesOf(h, second).json).missingSincePrevious).toEqual([{ issueId: '102', issueKey: 'PAY-102' }]);
  });

  it('marks a report unsigned when no key is set', async () => {
    const h = seeded({ keys: false });
    const id = await makeReport(h);
    const manifest = JSON.parse(filesOf(h, id).manifest);
    expect(manifest.warning).toBe('UNSIGNED');
    expect(manifest).not.toHaveProperty('sig');
    expect(manifest).not.toHaveProperty('keyId');
    expect(JSON.parse(filesOf(h, id).json).warnings).toEqual([{ code: 'UNSIGNED' }]);
    expect((await h.store.getIndex('10000'))[0].unsigned).toBe(true);
  });

  it('counts remote links that could not be read, and reads them as needs re-check', async () => {
    const h = seeded();
    h.links.set('miss:101', true);
    const id = await makeReport(h);
    const data = JSON.parse(filesOf(h, id).json);
    expect(data.warnings).toEqual([{ code: 'REMOTE_LINKS_NOT_READ', count: 1 }]);
    expect(data.issues[0].gates.intent.state).toBe('NEEDS_RECHECK');
  });

  it('stores no file when a cap is passed (complete or not stored, D-15)', async () => {
    class TinyPolicy extends DefaultReportPolicyEngine {
      tooLarge(_bytes: number[], changes: number) {
        return changes > 1 ? { code: 'REPORT_TOO_LARGE' as const, message: 'too large' } : undefined;
      }
    }
    const h = seeded({ policy: new TinyPolicy() });
    const id = await makeReport(h);
    expect(await h.store.getJob(id)).toBeUndefined();
    expect((await h.store.getIndex('10000'))[0]).toMatchObject({ state: 'FAILED', error: { code: 'REPORT_TOO_LARGE', message: 'too large' } });
    expect(Array.from(h.objects.objects.keys())).toEqual([]);
    expect(await h.store.getHead('10000')).toBeUndefined();
  });

  it('fails the job after three failed reads, retrying after 30 s', async () => {
    const h = seeded();
    h.appJira.failFacts = 3;
    const r = await h.manager.create(caller(), ADMIN, RANGE) as { reportId: string };
    h.pushes.length = 0;
    await h.manager.work(r.reportId, Date.now() + 780_000);
    expect(h.pushes).toEqual([{ reportId: r.reportId, delay: 30 }]);
    await h.drain();
    expect((await h.store.getIndex('10000'))[0]).toMatchObject({ state: 'FAILED', error: { code: 'JIRA_ERROR', message: 'FourRealities could not read Jira for this report three times (Jira search failed with HTTP 500.) Make the report again.' } });
  });

  it('fails a report whose files cannot be stored, and leaves no file', async () => {
    const h = seeded();
    h.objects.failWrites = /manifest\.json$/;
    await makeReport(h);
    expect((await h.store.getIndex('10000'))[0]).toMatchObject({ state: 'FAILED', error: { code: 'STORE_FAILED' } });
    expect(Array.from(h.objects.objects.keys())).toEqual([]);
    const h2 = seeded();
    h2.objects.failWrites = /part-0/;
    await makeReport(h2);
    expect((await h2.store.getIndex('10000'))[0].error?.code).toBe('STORE_FAILED');
  });

  it('pauses when the event budget is nearly used, and goes on in the next event from the cursor', async () => {
    const h = seeded();
    for (let i = 0; i < 150; i++) h.issues.push({ id: String(2000 + i), created: '2026-10-10T00:00:00.000Z' });
    const r = await h.manager.create(caller(), ADMIN, RANGE) as { reportId: string };
    h.pushes.length = 0;
    let now = Date.now();
    const spy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    h.appJira.onFacts = () => { now += 100_000; };
    await h.manager.work(r.reportId, now + 150_000);
    expect((await h.store.getJob(r.reportId))).toMatchObject({ state: 'RUNNING', cursor: 1, parts: 1 });
    expect(h.pushes).toEqual([{ reportId: r.reportId }]);
    h.appJira.onFacts = null;
    spy.mockRestore();
    await h.drain();
    expect((await h.store.getJob(r.reportId))?.state).toBe('DONE');
    expect((await h.store.getIndex('10000'))[0].issues).toBe(153);
  });

  it('waits while another job of the project runs, and ignores unknown or finished jobs', async () => {
    const h = seeded();
    const a = await h.manager.create(caller(), ADMIN, RANGE) as { reportId: string };
    const b = await h.manager.create(caller(), ADMIN, RANGE) as { reportId: string };
    h.pushes.length = 0;
    await h.manager.work(b.reportId, Date.now() + 780_000);
    expect(h.pushes).toEqual([{ reportId: b.reportId, delay: 60 }]);
    expect((await h.store.getJob(b.reportId))?.state).toBe('QUEUED');
    await h.manager.work(a.reportId, Date.now() + 780_000);
    expect((await h.store.getJob(a.reportId))?.state).toBe('DONE');
    const ops = h.storage.ops.length;
    await h.manager.work(a.reportId, Date.now() + 780_000);
    await h.manager.work('not-a-uuid', Date.now() + 780_000);
    await h.manager.work('00000000-0000-4000-8000-000000000000', Date.now() + 780_000);
    expect(h.storage.ops.length - ops).toBe(2);
  });
});

describe('download: visibility, the people file and the split (spec v4 11.3, 11.4)', () => {
  it('lets a viewer who sees every issue download the files, and gives pre-signed URLs per key', async () => {
    const h = seeded();
    const id = await makeReport(h);
    const detail = await h.manager.detail(caller('acc-viewer'), BROWSER, { reportId: id });
    expect(detail).toMatchObject({ ok: true, download: { allowed: true }, manifest: { reportId: id }, report: { state: 'DONE', requestedByText: 'Name not available' } });
    expect((detail as { fileNames: Record<string, string> }).fileNames['report.json']).toBe(`fourrealities-PAY-2026-10-01-2026-10-31-${id.slice(0, 8)}.json`);
    const key = objectKey('10000', id, 'report.csv');
    expect(await h.manager.downloadUrls(caller('acc-viewer'), BROWSER, { keys: [key] })).toEqual({ [`https://os.test/${key}`]: key });
  });

  it('refuses a viewer who cannot see an issue that still exists, with the count', async () => {
    const h = seeded();
    const id = await makeReport(h);
    h.issues.find(i => i.id === '103')!.hidden = true;
    const detail = await h.manager.detail(caller('acc-viewer'), ADMIN, { reportId: id }) as { download: { allowed: boolean; code: string; count: number; message: string } };
    expect(detail.download).toMatchObject({ allowed: false, code: 'NOT_ALL_VISIBLE', count: 1 });
    expect(detail.download.message).toContain('You cannot see 1 of the 3 issues in this report');
    expect(await h.manager.downloadUrls(caller('acc-viewer'), ADMIN, { keys: [objectKey('10000', id, 'report.json')] })).toEqual({});
  });

  it('lets only Tier 1 download a report that holds an issue deleted since', async () => {
    const h = seeded();
    const id = await makeReport(h);
    h.issues.find(i => i.id === '101')!.deleted = true;
    expect((await h.manager.detail(caller('acc-viewer'), BROWSER, { reportId: id }) as { download: { code: string } }).download.code).toBe('FORBIDDEN');
    expect((await h.manager.detail(caller('acc-viewer'), PROJECT_ADMIN, { reportId: id }) as { download: { allowed: boolean } }).download.allowed).toBe(true);
  });

  it('builds the unsigned people file at download, as the downloading user; the signed files never name anyone', async () => {
    const h = seeded();
    const id = await makeReport(h);
    const signedBefore = filesOf(h, id);
    const urls = await h.manager.downloadUrls(caller('acc-viewer'), BROWSER, { keys: [`people:${id}:csv`, `people:${id}:json`] });
    expect(Object.values(urls)).toEqual([`people:${id}:csv`, `people:${id}:json`]);
    const tmp = Array.from(h.objects.objects.keys()).filter(k => k.startsWith(`tmp/${id}/`));
    expect(tmp).toHaveLength(2);
    const people = JSON.parse(h.objects.objects.get(tmp.find(k => k.endsWith('.json'))!)!);
    expect(people.format).toBe('fourrealities-evidence-report-people/1');
    expect(people.people.map((p: { accountId: string; displayName: string; active: boolean }) => [p.accountId, p.displayName, p.active])).toEqual(expect.arrayContaining([['acc-ana', 'Ana Person', true], ['acc-bo', 'Bo Person', false]]));
    expect(h.objects.objects.get(tmp.find(k => k.endsWith('.csv'))!)).toContain('"acc-ana","Ana Person","true"');
    expect(h.people.people).toHaveBeenCalled();
    expect((await h.store.listTmp())).toHaveLength(1);
    // Erasure of a closed account (ADR-014): the token map entry closes; the signed files are byte for byte the same.
    const anaToken = people.people.find((p: { accountId: string }) => p.accountId === 'acc-ana').token;
    await h.storage.set(`fr:party:${anaToken}`, { closed: true, closedAt: 'c' });
    await h.manager.downloadUrls(caller('acc-viewer'), BROWSER, { keys: [`people:${id}:json`] });
    const second = Array.from(h.objects.objects.keys()).filter(k => k.startsWith(`tmp/${id}/`) && k.endsWith('.json') && !tmp.includes(k))[0];
    const after = JSON.parse(h.objects.objects.get(second)!);
    expect(after.people.find((p: { token: string }) => p.token === anaToken)).toEqual({ token: anaToken, accountId: null, displayName: null, active: null });
    expect(filesOf(h, id)).toEqual(signedBefore);
  });

  it('gives nothing for keys of another project, another report or a bad shape, and none for a report not ready', async () => {
    const h = seeded();
    const id = await makeReport(h);
    const other = '00000000-0000-4000-8000-000000000000';
    for (const keys of [[objectKey('99999', id, 'report.json')], [objectKey('10000', id, 'report.json'), objectKey('10000', other, 'report.json')], ['reports/10000/x/report.json'], [], 'k', Array(6).fill(objectKey('10000', id, 'report.json')), [objectKey('10000', other, 'report.json')]]) {
      expect(await h.manager.downloadUrls(caller(), ADMIN, { keys })).toEqual({});
    }
    const queued = await h.manager.create(caller(), ADMIN, RANGE) as { reportId: string };
    expect((await h.manager.detail(caller(), ADMIN, { reportId: queued.reportId }) as { download: { code: string } }).download.code).toBe('REPORT_NOT_READY');
    expect(await h.manager.downloadUrls(caller(), ADMIN, { keys: [objectKey('10000', queued.reportId, 'report.json')] })).toEqual({});
    expect((await h.manager.detail(caller(), ADMIN, { reportId: other }) as { error: { code: string } }).error.code).toBe('NOT_FOUND');
  });
});

describe('early deletion (owner decision Q8)', () => {
  it('lets only a Jira administrator delete, with a reason; the tombstone is written first and the chain stays', async () => {
    const h = seeded();
    const id = await makeReport(h);
    const reason = 'Made with the wrong field filter.';
    expect((await h.manager.deleteReport(caller(), PROJECT_ADMIN, { reportId: id, reason }) as { error: { code: string } }).error.code).toBe('FORBIDDEN');
    expect((await h.manager.deleteReport(caller(), ADMIN, { reportId: id, reason: 'short' }) as { error: { code: string } }).error.code).toBe('INVALID_INPUT');
    const ops = h.storage.ops.length;
    const deleteObject = h.objects.delete.bind(h.objects);
    h.objects.delete = async (key: string) => { h.storage.ops.push({ op: 'delete', key: `object:${key}` }); await deleteObject(key); };
    const r = await h.manager.deleteReport(caller(), ADMIN, { reportId: id, reason });
    expect(r).toEqual({ ok: true, tombstone: { reportId: id, deletedAt: expect.any(String), by: expect.stringMatching(/^pty_/), reason } });
    const writes = h.storage.ops.slice(ops).filter(o => o.op !== 'get' && o.op !== 'query').map(o => o.key);
    const tombstoneAt = writes.findIndex(k => k.startsWith('fr:rt:10000:'));
    expect(tombstoneAt).toBeGreaterThanOrEqual(0);
    expect(tombstoneAt).toBeLessThan(writes.findIndex(k => k.startsWith('object:')));
    expect(tombstoneAt).toBeLessThan(writes.findIndex(k => k.includes(':ids:')));
    expect(Array.from(h.objects.objects.keys())).toEqual([]);
    expect(await h.store.getJob(id)).toBeUndefined();
    const view = ok<ReportsView>(await h.manager.list(caller(), ADMIN, {}));
    expect(view.reports[0]).toMatchObject({ reportId: id, state: 'DELETED' });
    expect(view.tombstones).toEqual([(r as { tombstone: unknown }).tombstone]);
    const next = await makeReport(h);
    expect(JSON.parse(filesOf(h, next).manifest).previous.reportId).toBe(id);
    expect((await h.manager.deleteReport(caller(), ADMIN, { reportId: id, reason }) as { error: { code: string } }).error.code).toBe('NOT_FOUND');
  });
});

describe('the list', () => {
  it('shows who asked as the viewer reads it, progress, expiry and the file keys, 25 per page', async () => {
    const h = seeded();
    const mine = await makeReport(h, RANGE, caller('acc-ana'));
    await makeReport(h, RANGE, caller('acc-bo'));
    const queued = await h.manager.create(caller('acc-admin'), ADMIN, RANGE) as { reportId: string };
    const view = ok<ReportsView>(await h.manager.list(caller('acc-ana'), ADMIN, {}));
    expect(view.reports.map(r => r.requestedByText)).toEqual(['Name not available', 'Bo Person', 'by you']);
    expect(view.reports[0]).toMatchObject({ reportId: queued.reportId, state: 'QUEUED', progress: { issuesTotal: 4, issuesDone: 0 } });
    expect(view.reports[2]).toMatchObject({ reportId: mine, expiresAt: expect.any(String), objectKeys: { 'report.json': objectKey('10000', mine, 'report.json') } });
    expect(view).toMatchObject({ canCreate: true, canSchedule: true, canDelete: true, retentionDays: 400, signingKeyId: 'fr-test-key', licenceActive: true });
    expect(view.fields.map(f => f.name)).toEqual(['Assignee', 'Description', 'Status']);
    const browser = ok<ReportsView>(await h.manager.list(caller('acc-x'), BROWSER, {}));
    expect(browser).toMatchObject({ canCreate: false, canSchedule: false, canDelete: false, fields: [] });
    const index = Array.from({ length: 30 }, (_, i) => ({ reportId: `r${i}`, state: 'EXPIRED' as const, range: { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' }, filters: { fieldIds: [], actors: [] }, trigger: 'scheduled' as const, requestedBy: 'scheduled', createdAt: 't' }));
    await h.store.saveIndex('10000', index);
    const page1 = ok<ReportsView>(await h.manager.list(caller(), ADMIN, {}));
    expect(page1.reports).toHaveLength(25);
    expect(page1.next).toBe('25');
    expect(page1.reports[0].requestedByText).toBe('Scheduled');
    const page2 = ok<ReportsView>(await h.manager.list(caller(), ADMIN, { cursor: '25' }));
    expect(page2.reports).toHaveLength(5);
    expect(page2.next).toBeUndefined();
  });

  it('names a closed account "a former user"', async () => {
    const h = seeded();
    const id = await makeReport(h, RANGE, caller('acc-ana'));
    const token = (await h.store.getJob(id))!.requestedBy;
    await h.storage.set(`fr:party:${token}`, { closed: true, closedAt: 'c' });
    expect(ok<ReportsView>(await h.manager.list(caller('acc-x'), ADMIN, {})).reports[0].requestedByText).toBe('a former user');
  });
});

describe('schedules and the daily run', () => {
  const NOW = new Date('2026-11-08T03:00:00.000Z');
  it('lets only Tier 1 set schedules, at most 5, and not when the licence is inactive', async () => {
    const h = seeded({ now: () => NOW });
    expect((await h.manager.saveSchedule(caller(), BROWSER, { cadence: 'WEEKLY' }) as { error: { code: string } }).error.code).toBe('FORBIDDEN');
    expect((await h.manager.saveSchedule(caller('a', false), ADMIN, { cadence: 'WEEKLY' }) as { error: { code: string } }).error.code).toBe('LICENSE_INACTIVE');
    expect((await h.manager.deleteSchedule(caller('a', false), ADMIN, { scheduleId: 'x' }) as { error: { code: string } }).error.code).toBe('LICENSE_INACTIVE');
    const saved = await h.manager.saveSchedule(caller(), PROJECT_ADMIN, { cadence: 'MONTHLY', fieldIds: ['status'], actorAccountIds: ['acc-ana'] }) as { schedules: Array<{ scheduleId: string; filters: { actors: string[] } }> };
    expect(saved.schedules).toHaveLength(1);
    expect(saved.schedules[0].filters.actors[0]).toMatch(/^pty_/);
    const id = saved.schedules[0].scheduleId;
    expect((await h.manager.saveSchedule(caller(), ADMIN, { scheduleId: id, cadence: 'WEEKLY' }) as { schedules: Array<{ cadence: string }> }).schedules[0].cadence).toBe('WEEKLY');
    expect((await h.manager.saveSchedule(caller(), ADMIN, { scheduleId: '00000000-0000-4000-8000-000000000000', cadence: 'WEEKLY' }) as { error: { code: string } }).error.code).toBe('NOT_FOUND');
    for (let i = 0; i < 4; i++) await h.manager.saveSchedule(caller(), ADMIN, { cadence: 'MONTHLY' });
    expect((await h.manager.saveSchedule(caller(), ADMIN, { cadence: 'MONTHLY' }) as { error: { code: string } }).error.code).toBe('INVALID_INPUT');
    expect((await h.manager.saveSchedule(caller(), ADMIN, { cadence: 'YEARLY' }) as { error: { code: string } }).error.code).toBe('INVALID_INPUT');
    expect((await h.manager.deleteSchedule(caller(), BROWSER, { scheduleId: id }) as { error: { code: string } }).error.code).toBe('FORBIDDEN');
    expect((await h.manager.deleteSchedule(caller(), ADMIN, { scheduleId: 'nope' }) as { error: { code: string } }).error.code).toBe('NOT_FOUND');
    expect((await h.manager.deleteSchedule(caller(), ADMIN, { scheduleId: id }) as { schedules: unknown[] }).schedules).toHaveLength(4);
    h.userJira.fieldsStatus = 500;
    expect((await h.manager.saveSchedule(caller(), ADMIN, { cadence: 'MONTHLY' }) as { error: { code: string } }).error.code).toBe('JIRA_ERROR');
  });

  it('makes the scheduled report of an ended period as the app, once, and none when the licence is inactive (Q9)', async () => {
    const h = seeded({ now: () => NOW });
    await h.store.saveSchedules('10000', [{ scheduleId: 's1', cadence: 'MONTHLY', filters: { fieldIds: [], actors: [] }, createdBy: 'pty_x', createdAt: '2026-10-15T00:00:00.000Z' }]);
    await h.store.registerProject('10000', 'PAY');
    expect(await h.manager.daily(Date.now() + 540_000, false)).toEqual({ scheduled: 0, expired: 0, tmpDeleted: 0, stalled: 0, skipped: false });
    expect(await h.manager.daily(Date.now() + 540_000, true)).toMatchObject({ scheduled: 1 });
    expect(h.appJira.calls[0]).toContain('search:project = 10000');
    expect(h.userJira.calls).toEqual([]);
    await h.drain();
    const entry = (await h.store.getIndex('10000'))[0];
    expect(entry).toMatchObject({ state: 'DONE', trigger: 'scheduled', requestedBy: 'scheduled', range: { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' } });
    expect((await h.store.getSchedules('10000'))[0].lastPeriodEnd).toBe('2026-11-01T00:00:00.000Z');
    expect(await h.manager.daily(Date.now() + 540_000, true)).toMatchObject({ scheduled: 0 });
  });

  it('records a scheduled period that is too large as a FAILED row, and keeps a period for later when the queue is full', async () => {
    const h = seeded({ now: () => NOW });
    h.appJira.extraIds = Array.from({ length: 10_001 }, (_, i) => String(30_000 + i));
    await h.store.saveSchedules('10000', [{ scheduleId: 's1', cadence: 'MONTHLY', filters: { fieldIds: [], actors: [] }, createdBy: 'pty_x', createdAt: '2026-10-15T00:00:00.000Z' }]);
    await h.store.registerProject('10000', 'PAY');
    await h.manager.daily(Date.now() + 540_000, true);
    expect((await h.store.getIndex('10000'))[0]).toMatchObject({ state: 'FAILED', trigger: 'scheduled', error: { code: 'TOO_MANY_ISSUES' } });
    const h2 = seeded({ now: () => NOW });
    for (let i = 0; i < 3; i++) await h2.manager.create(caller(), ADMIN, RANGE);
    await h2.store.saveSchedules('10000', [{ scheduleId: 's1', cadence: 'MONTHLY', filters: { fieldIds: [], actors: [] }, createdBy: 'pty_x', createdAt: '2026-10-15T00:00:00.000Z' }]);
    await h2.manager.daily(Date.now() + 540_000, true);
    expect((await h2.store.getSchedules('10000'))[0].lastPeriodEnd).toBeUndefined();
  });

  it('removes reports past the retention (a shorter setting applies at once), temporary files after 24 hours and stalled jobs, licence or not', async () => {
    let now = new Date('2026-11-08T03:00:00.000Z');
    const h = seeded({ now: () => now });
    const old = await makeReport(h);
    await h.manager.downloadUrls(caller(), ADMIN, { keys: [`people:${old}:csv`] });
    const stuck = await h.manager.create(caller(), ADMIN, RANGE) as { reportId: string };
    h.pushes.length = 0;
    now = new Date('2027-01-01T00:00:00.000Z');
    await h.store.saveSettings({ ...DEFAULT_REPORT_SETTINGS, retentionDays: 90 });
    expect(await h.manager.daily(Date.now() + 540_000, false)).toEqual({ scheduled: 0, expired: 0, tmpDeleted: 1, stalled: 1, skipped: false });
    expect((await h.store.getIndex('10000')).find(e => e.reportId === stuck.reportId)).toMatchObject({ state: 'FAILED', error: { code: 'STALLED' } });
    now = new Date('2027-02-10T00:00:00.000Z');
    expect(await h.manager.daily(Date.now() + 540_000, false)).toMatchObject({ expired: 1 });
    expect((await h.store.getIndex('10000')).find(e => e.reportId === old)?.state).toBe('EXPIRED');
    expect(Array.from(h.objects.objects.keys())).toEqual([]);
    expect(await h.store.getJob(old)).toBeUndefined();
    expect(await h.manager.daily(Date.now() - 1, true)).toMatchObject({ skipped: true });
  });

  it('fails an index entry whose job record is missing, and goes on when one project fails', async () => {
    const h = seeded({ now: () => NOW });
    await h.store.registerProject('10000', 'PAY');
    await h.store.registerProject('1', 'BAD');
    await h.store.saveIndex('10000', [{ reportId: 'lost', state: 'RUNNING', range: { from: 'a', to: 'b' }, filters: { fieldIds: [], actors: [] }, trigger: 'user', requestedBy: 'x', createdAt: 't' }]);
    const getIndex = h.store.getIndex.bind(h.store);
    jest.spyOn(h.store, 'getIndex').mockImplementation(async key => { if (key === '1') throw new Error('x'); return getIndex(key); });
    expect(await h.manager.daily(Date.now() + 540_000, true)).toMatchObject({ stalled: 1 });
    expect((await getIndex('10000'))[0]).toMatchObject({ state: 'FAILED', error: { code: 'STALLED' } });
  });
});

describe('robustness: every failure ends in a clear state', () => {
  it('fails closed when the visibility or existence check cannot be made, and when a report has no manifest', async () => {
    const h = seeded();
    const id = await makeReport(h);
    h.userJira.presentFails = true;
    expect((await h.manager.detail(caller(), ADMIN, { reportId: id }) as { download: { code: string } }).download.code).toBe('JIRA_ERROR');
    h.userJira.presentFails = false;
    h.issues.find(i => i.id === '101')!.hidden = true;
    h.appJira.presentFails = true;
    expect((await h.manager.detail(caller(), ADMIN, { reportId: id }) as { download: { code: string } }).download.code).toBe('JIRA_ERROR');
    h.appJira.presentFails = false;
    h.issues.find(i => i.id === '101')!.hidden = false;
    await h.objects.delete(objectKey('10000', id, 'manifest.json'));
    const detail = await h.manager.detail(caller(), ADMIN, { reportId: id });
    expect(detail.ok && 'manifest' in detail).toBe(false);
    expect((await h.manager.detail(caller(), ADMIN, { reportId: '../x' }) as { error: { code: string } }).error.code).toBe('NOT_FOUND');
  });

  it('gives no URL when the people file cannot be stored, and lists no fields when the field read fails', async () => {
    const h = seeded();
    const id = await makeReport(h);
    h.objects.failWrites = /people/;
    expect(await h.manager.downloadUrls(caller(), ADMIN, { keys: [`people:${id}:csv`] })).toEqual({});
    h.userJira.fieldsStatus = 500;
    expect(ok<ReportsView>(await h.manager.list(caller(), ADMIN, {})).fields).toEqual([]);
  });

  it('retries and then fails on a failed field list, changelog read, previous-report check or a lost part', async () => {
    for (const setup of [
      (h: ReturnType<typeof harness>) => { h.appJira.fieldsStatus = 500; },
      (h: ReturnType<typeof harness>) => { h.appJira.changelogStatus = 503; },
      (h: ReturnType<typeof harness>) => { h.appJira.onFacts = () => { throw new Error('network'); }; }
    ]) {
      const h = seeded();
      setup(h);
      await makeReport(h);
      expect((await h.store.getIndex('10000'))[0]).toMatchObject({ state: 'FAILED' });
      expect(Array.from(h.objects.objects.keys())).toEqual([]);
    }
    const h = seeded();
    await makeReport(h);
    h.appJira.presentFails = true;
    await makeReport(h);
    expect((await h.store.getIndex('10000'))[0]).toMatchObject({ state: 'FAILED', error: { code: 'JIRA_ERROR' } });
    const generic = seeded();
    generic.appJira.onFacts = () => { throw new Error('x'); };
    await makeReport(generic);
    expect((await generic.store.getIndex('10000'))[0].error?.message).toBe('FourRealities could not read Jira for this report three times (FourRealities could not finish this report.) Make the report again.');
  });

  it('assembles in the next event when the budget cannot hold the assembly, and fails when a part is lost', async () => {
    const h = seeded();
    const r = await h.manager.create(caller(), ADMIN, RANGE) as { reportId: string };
    h.pushes.length = 0;
    await h.manager.work(r.reportId, Date.now() + 120_000);
    expect(await h.store.getJob(r.reportId)).toMatchObject({ state: 'RUNNING', step: 'PARTS', parts: 1 });
    expect(h.pushes).toEqual([{ reportId: r.reportId }]);
    await h.objects.delete(`tmp/${r.reportId}/part-0.json`);
    await h.drain();
    expect((await h.store.getIndex('10000'))[0]).toMatchObject({ state: 'FAILED', error: { code: 'JOB_FAILED' } });
  });

  it('reads a batch again when its remote links were cut by time', async () => {
    const h = seeded();
    const r = await h.manager.create(caller(), ADMIN, RANGE) as { reportId: string };
    h.pushes.length = 0;
    let now = Date.now();
    const spy = jest.spyOn(Date, 'now').mockImplementation(() => now);
    h.links.set('miss:101', true);
    h.appIssues.remoteLinks.mockImplementationOnce(async (ids: string[]) => { now += 200_000; return new Map(ids.filter(id => id !== '101').map(id => [id, []])); });
    await h.manager.work(r.reportId, now + 250_000);
    spy.mockRestore();
    expect(await h.store.getJob(r.reportId)).toMatchObject({ cursor: 0, parts: 0 });
    h.links.delete('miss:101');
    await h.drain();
    expect(JSON.parse(filesOf(h, r.reportId).json).warnings).toEqual([]);
  });

  it('keeps fresh temporary files, stops at the deadline, and records no refusal row in a full index', async () => {
    const NOW = new Date('2026-11-08T03:00:00.000Z');
    const h = seeded({ now: () => NOW });
    const id = await makeReport(h);
    await h.manager.downloadUrls(caller(), ADMIN, { keys: [`people:${id}:csv`] });
    expect(await h.manager.daily(Date.now() + 540_000, true)).toMatchObject({ tmpDeleted: 0 });
    const spy = jest.spyOn(Date, 'now');
    const t = Date.now();
    spy.mockReturnValueOnce(t).mockReturnValue(t + 10_000_000);
    await h.store.registerProject('10000', 'PAY');
    expect(await h.manager.daily(t + 1_000, true)).toMatchObject({ skipped: true });
    spy.mockRestore();
    const full = Array.from({ length: 200 }, (_, i) => ({ reportId: `r${i}`, state: 'DONE' as const, range: { from: 'a', to: 'b' }, filters: { fieldIds: [], actors: [] }, trigger: 'user' as const, requestedBy: 'x', createdAt: '2026-11-01T00:00:00.000Z', finishedAt: '2026-11-01T00:00:00.000Z' }));
    await h.store.saveIndex('10000', full);
    await h.store.saveSchedules('10000', [{ scheduleId: 's1', cadence: 'MONTHLY', filters: { fieldIds: [], actors: [] }, createdBy: 'pty_x', createdAt: '2026-10-15T00:00:00.000Z' }]);
    await h.manager.daily(Date.now() + 540_000, true);
    expect(await h.store.getIndex('10000')).toHaveLength(200);
    // A full project keeps the period for later, and the schedule says why (review M-3).
    const schedule = (await h.store.getSchedules('10000'))[0];
    expect(schedule.lastPeriodEnd).toBeUndefined();
    expect(schedule.lastRefusal).toMatchObject({ code: 'REPORT_LIMIT', range: { from: '2026-10-01T00:00:00.000Z', to: '2026-11-01T00:00:00.000Z' } });
  });

  it('names an unknown caller "unknown" in a schedule and a tombstone', async () => {
    const h = seeded();
    const id = await makeReport(h);
    const anon = { ...caller(), accountId: undefined };
    expect((await h.manager.saveSchedule(anon, ADMIN, { cadence: 'WEEKLY' }) as { schedules: Array<{ createdBy: string }> }).schedules[0].createdBy).toBe('unknown');
    expect((await h.manager.deleteReport(anon, ADMIN, { reportId: id, reason: 'Removed by the admin for a test.' }) as { tombstone: { by: string } }).tombstone.by).toBe('unknown');
    expect((await h.manager.deleteReport(anon, ADMIN, undefined) as { error: { code: string } }).error.code).toBe('INVALID_INPUT');
  });
});

describe('review round 1', () => {
  it('H-1: an issue the job cannot read, or that moved, is listed with a warning and counted, never left out silently', async () => {
    const h = seeded();
    const r = await h.manager.create(caller(), ADMIN, RANGE) as { reportId: string };
    h.appJira.dropIds.add('102');
    h.appJira.movedIds.add('103');
    await h.drain();
    const f = filesOf(h, r.reportId);
    const data = JSON.parse(f.json);
    expect(data.issues.map((i: { issueId: string }) => i.issueId)).toEqual(['101']);
    expect(data.notReadable).toEqual([{ issueId: '102', issueKey: 'PAY-102', reason: 'NOT_READABLE' }, { issueId: '103', issueKey: 'PAY-103', reason: 'MOVED' }]);
    expect(data.warnings).toEqual([{ code: 'ISSUES_NOT_READ', count: 2 }]);
    expect(JSON.parse(f.manifest).counts).toEqual({ issues: 1, changes: 2, missingSincePrevious: 0, notReadable: 2 });
    expect((await h.store.getJob(r.reportId))?.progress.notReadable).toBe(2);
    expect(h.appJira.calls).toContain('changelog:2'); // only 101 and 104: 102 was not read and 103 moved
  });

  it('M-1: a commit that runs inside a create, between its index read and its write, survives, and so does the create', async () => {
    const h = seeded();
    const a = await h.manager.create(caller(), ADMIN, RANGE) as { reportId: string };
    // The create of B reads the index ([A QUEUED]), then searches Jira; during that search A is built and
    // committed DONE; then B writes. With one value for the whole index (round 1 code), B wrote back
    // [B QUEUED, A QUEUED] and undid A's commit.
    const search = h.userJira.searchIds.bind(h.userJira);
    let inner = false;
    jest.spyOn(h.userJira, 'searchIds').mockImplementation(async (...args: Parameters<typeof search>) => {
      if (!inner) {
        inner = true;
        await h.manager.work(a.reportId, Date.now() + 780_000);
        expect((await h.store.getIndex('10000')).find(e => e.reportId === a.reportId)?.state).toBe('DONE');
      }
      return search(...args);
    });
    const b = await h.manager.create(caller(), ADMIN, RANGE) as { reportId: string };
    const states = Object.fromEntries((await h.store.getIndex('10000')).map(e => [e.reportId, e.state]));
    expect(states).toEqual({ [a.reportId]: 'DONE', [b.reportId]: 'QUEUED' });
    expect((await h.manager.detail(caller(), ADMIN, { reportId: a.reportId }) as { download: { allowed: boolean } }).download.allowed).toBe(true);
  });

  it('M-3: a Jira error keeps the scheduled period and says why on the schedule; the next run makes it', async () => {
    const NOW = new Date('2026-11-08T03:00:00.000Z');
    const h = seeded({ now: () => NOW });
    await h.store.saveSchedules('10000', [{ scheduleId: 's1', cadence: 'MONTHLY', filters: { fieldIds: [], actors: [] }, createdBy: 'pty_x', createdAt: '2026-10-15T00:00:00.000Z' }]);
    await h.store.registerProject('10000', 'PAY');
    h.appJira.searchStatus = 503;
    await h.manager.daily(Date.now() + 540_000, true);
    let schedule = (await h.store.getSchedules('10000'))[0];
    expect(schedule.lastPeriodEnd).toBeUndefined();
    expect(schedule.lastRefusal).toMatchObject({ code: 'JIRA_ERROR', at: NOW.toISOString() });
    expect(await h.store.getIndex('10000')).toEqual([]);
    h.appJira.searchStatus = 200;
    expect(await h.manager.daily(Date.now() + 540_000, true)).toMatchObject({ scheduled: 1 });
    schedule = (await h.store.getSchedules('10000'))[0];
    expect(schedule.lastPeriodEnd).toBe('2026-11-01T00:00:00.000Z');
    expect(schedule.lastRefusal).toBeUndefined();
  });

  it('L-1: a second event for a job that another event holds ends at once; an expired lease is taken over', async () => {
    const h = seeded();
    const r = await h.manager.create(caller(), ADMIN, RANGE) as { reportId: string };
    const job = (await h.store.getJob(r.reportId))!;
    await h.store.saveJob({ ...job, state: 'RUNNING', lease: { owner: 'other', until: new Date(Date.now() + 60_000).toISOString() } });
    const ops = h.storage.ops.length;
    await h.manager.work(r.reportId, Date.now() + 780_000, 'event-2');
    expect(h.storage.ops.slice(ops).filter(o => o.op === 'set')).toEqual([]);
    await h.store.saveJob({ ...job, state: 'RUNNING', lease: { owner: 'other', until: new Date(Date.now() - 1).toISOString() } });
    await h.manager.work(r.reportId, Date.now() + 780_000, 'event-3');
    expect((await h.store.getJob(r.reportId))).toMatchObject({ state: 'DONE' });
    expect((await h.store.getJob(r.reportId))?.lease).toBeUndefined();
  });

  it('L-2: a job that stalled during the assembly leaves no report object behind (token chunks: N-3)', async () => {
    let now = new Date('2026-11-08T03:00:00.000Z');
    const h = seeded({ now: () => now });
    const r = await h.manager.create(caller(), ADMIN, RANGE) as { reportId: string };
    const job = (await h.store.getJob(r.reportId))!;
    await h.objects.putOnce(objectKey('10000', r.reportId, 'report.json'), '{}');
    await h.store.saveJob({ ...job, state: 'RUNNING' });
    now = new Date('2026-11-08T06:00:00.000Z');
    expect(await h.manager.daily(Date.now() + 540_000, false)).toMatchObject({ stalled: 1 });
    expect(Array.from(h.objects.objects.keys())).toEqual([]);
  });

  it('L-3: the hourly sweep removes a people file older than 24 hours and keeps a younger one', async () => {
    let now = new Date('2026-11-08T03:00:00.000Z');
    const h = seeded({ now: () => now });
    const id = await makeReport(h);
    await h.manager.downloadUrls(caller(), ADMIN, { keys: [`people:${id}:csv`] });
    now = new Date('2026-11-09T02:59:00.000Z');
    expect(await h.manager.sweepTmp(Date.now() + 1000)).toEqual({ deleted: 0, skipped: false });
    now = new Date('2026-11-09T03:01:00.000Z');
    expect(await h.manager.sweepTmp(Date.now() + 1000)).toEqual({ deleted: 1, skipped: false });
    expect(Array.from(h.objects.objects.keys()).filter(k => k.startsWith('tmp/'))).toEqual([]);
  });

  it('L-6: a refused create stores no party token for the people filter', async () => {
    const h = seeded();
    h.userJira.extraIds = Array.from({ length: 10_001 }, (_, i) => String(40_000 + i));
    await h.manager.create(caller(), ADMIN, { ...RANGE, actorAccountIds: ['acc-filter'] });
    expect(Array.from(h.storage.store.keys()).filter(k => k.startsWith('fr:party:'))).toEqual([]);
  });

  it('L-8: the list gives no issue or change counts, and the manifest goes only to a viewer who may download', async () => {
    const h = seeded();
    const id = await makeReport(h);
    const row = ok<ReportsView>(await h.manager.list(caller(), BROWSER, {})).reports[0];
    expect(row).not.toHaveProperty('issues');
    expect(row).not.toHaveProperty('changes');
    h.issues.find(i => i.id === '103')!.hidden = true;
    const detail = await h.manager.detail(caller(), BROWSER, { reportId: id });
    expect(detail.ok && 'manifest' in detail).toBe(false);
  });
});

describe('review round 2', () => {
  it('N-2: a renamed project key keeps every issue in the report (MOVED is decided by the project id)', async () => {
    const h = seeded();
    const r = await h.manager.create(caller(), ADMIN, RANGE) as { reportId: string };
    h.appJira.currentKey = 'PAYMENTS';
    await h.drain();
    const data = JSON.parse(filesOf(h, r.reportId).json);
    expect(data.issues.map((i: { issueId: string }) => i.issueId)).toEqual(['101', '102', '103']);
    expect(data.notReadable).toEqual([]);
    // The renamed project sees its reports and schedules by id, and the daily run uses the new key.
    const renamed = { ...caller(), projectKey: 'PAYMENTS' };
    const view = ok<ReportsView>(await h.manager.list(renamed, ADMIN, {}));
    expect(view.reports.map(e => e.reportId)).toEqual([r.reportId]);
    expect((await h.manager.detail(renamed, ADMIN, { reportId: r.reportId }) as { download: { allowed: boolean } }).download.allowed).toBe(true);
    await h.manager.saveSchedule(renamed, ADMIN, { cadence: 'MONTHLY' });
    expect(await h.store.projectKey('10000')).toBe('PAYMENTS');
    expect(await h.store.getSchedules('10000')).toHaveLength(1);
  });

  it('N-1: the not-read issues are counted on the row, named with their keys, and are CSV rows', async () => {
    const h = seeded();
    const r = await h.manager.create(caller(), ADMIN, RANGE) as { reportId: string };
    h.appJira.dropIds.add('102');
    await h.drain();
    expect(ok<ReportsView>(await h.manager.list(caller(), ADMIN, {})).reports[0].notReadable).toBe(1);
    const csv = filesOf(h, r.reportId).csv.split('\r\n');
    expect(csv.find(l => l.includes('"NOT_READ"'))).toContain('"NOT_READ","PAY-102","102"');
    expect(csv.find(l => l.includes('"NOT_READ"'))).toContain('NOT_READABLE: in the scope, but FourRealities could not read it');
  });

  it('N-3: a commit that fails after the tokens were written leaves no token chunk once the job fails', async () => {
    const h = seeded();
    const r = await h.manager.create(caller(), ADMIN, RANGE) as { reportId: string };
    h.pushes.length = 0;
    // An issue not read, so the not-read list is written too, and must go as well (review round 4).
    h.appJira.dropIds.add('104');
    jest.spyOn(h.store, 'commitDone').mockRejectedValueOnce(new Error('kvs down'));
    await h.manager.work(r.reportId, Date.now() + 780_000);
    expect(Array.from(h.storage.store.keys()).filter(k => k.startsWith(`fr:rj:${r.reportId}:tokens:`))).toHaveLength(1);
    expect(Array.from(h.storage.store.keys()).filter(k => k.startsWith(`fr:rj:${r.reportId}:nr:`))).toHaveLength(1);
    await h.drain();
    expect((await h.store.getIndex('10000'))[0]).toMatchObject({ state: 'FAILED', error: { code: 'STORE_FAILED' } });
    expect(Array.from(h.storage.store.keys()).filter(k => k.startsWith(`fr:rj:${r.reportId}`))).toEqual([]);
    expect(Array.from(h.objects.objects.keys())).toEqual([]);
  });

  it('N-5: an event that meets another event\'s lease tries again when the lease ends; the same event takes over', async () => {
    const h = seeded();
    const r = await h.manager.create(caller(), ADMIN, RANGE) as { reportId: string };
    h.pushes.length = 0;
    const job = (await h.store.getJob(r.reportId))!;
    await h.store.saveJob({ ...job, state: 'RUNNING', lease: { owner: 'event-1', until: new Date(Date.now() + 100_000).toISOString() } });
    await h.manager.work(r.reportId, Date.now() + 780_000, 'event-2');
    expect(h.pushes).toEqual([{ reportId: r.reportId, delay: expect.any(Number) }]);
    expect(h.pushes[0].delay).toBeGreaterThanOrEqual(100);
    expect((await h.store.getJob(r.reportId))?.state).toBe('RUNNING');
    await h.manager.work(r.reportId, Date.now() + 780_000, 'event-1');
    expect((await h.store.getJob(r.reportId))?.state).toBe('DONE');
  });

  it('N-7: production with no valid key makes no report: the create is refused, and a job fails with the reason', async () => {
    const h = seeded({ keys: false });
    h.runtime.environment = () => 'production';
    expect(await h.manager.create(caller(), ADMIN, RANGE)).toMatchObject({ ok: false, error: { code: 'NO_SIGNING_KEY' } });
    expect(await h.store.getIndex('10000')).toEqual([]);
    h.runtime.environment = () => 'development';
    const r = await h.manager.create(caller(), ADMIN, RANGE) as { reportId: string };
    h.runtime.environment = () => 'production';
    await h.drain();
    expect((await h.store.getIndex('10000'))[0]).toMatchObject({ state: 'FAILED', error: { code: 'NO_SIGNING_KEY' } });
    expect(Array.from(h.objects.objects.keys())).toEqual([]);
    expect(await h.store.getJob(r.reportId)).toBeUndefined();
  });

  it('N-7: a scheduled period on a production site without a key is kept and the schedule says why', async () => {
    const NOW = new Date('2026-11-08T03:00:00.000Z');
    const h = seeded({ keys: false, now: () => NOW });
    h.runtime.environment = () => 'production';
    await h.store.saveSchedules('10000', [{ scheduleId: 's1', cadence: 'MONTHLY', filters: { fieldIds: [], actors: [] }, createdBy: 'pty_x', createdAt: '2026-10-15T00:00:00.000Z' }]);
    await h.store.registerProject('10000', 'PAY');
    await h.manager.daily(Date.now() + 540_000, true);
    expect((await h.store.getSchedules('10000'))[0]).toMatchObject({ lastRefusal: { code: 'NO_SIGNING_KEY' } });
    expect((await h.store.getSchedules('10000'))[0].lastPeriodEnd).toBeUndefined();
  });

  it('L-5: the previous-report check uses the event deadline', async () => {
    const h = seeded();
    await makeReport(h);
    const spy = jest.spyOn(h.appJira, 'presentAmong');
    const r = await h.manager.create(caller(), ADMIN, RANGE) as { reportId: string };
    const deadline = Date.now() + 700_000;
    await h.manager.work(r.reportId, deadline);
    expect(spy).toHaveBeenCalledWith(expect.any(Array), deadline);
  });
});

describe('review round 3', () => {
  it('R3-1: the download modal data names each missing issue with key and reason, only for a viewer who may download', async () => {
    const h = seeded();
    const r = await h.manager.create(caller(), ADMIN, RANGE) as { reportId: string };
    h.appJira.dropIds.add('102');
    await h.drain();
    const detail = await h.manager.detail(caller(), ADMIN, { reportId: r.reportId }) as { notReadable: unknown[] };
    expect(detail.notReadable).toEqual([{ issueId: '102', issueKey: 'PAY-102', reason: 'NOT_READABLE' }]);
    h.issues.find(i => i.id === '101')!.hidden = true;
    expect(await h.manager.detail(caller(), BROWSER, { reportId: r.reportId })).not.toHaveProperty('notReadable');
    await h.manager.deleteReport(caller(), ADMIN, { reportId: r.reportId, reason: 'Removed for the round 3 test.' });
    expect(Array.from(h.storage.store.keys()).filter(k => k.startsWith(`fr:rj:${r.reportId}`))).toEqual([]);
  });

  it('R3-3: a moved issue the viewer cannot see blocks the download, as an unseen in-scope issue does', async () => {
    const h = seeded();
    const r = await h.manager.create(caller(), ADMIN, RANGE) as { reportId: string };
    h.appJira.movedIds.add('103');
    await h.drain();
    expect((await h.manager.detail(caller('v'), BROWSER, { reportId: r.reportId }) as { download: { allowed: boolean } }).download.allowed).toBe(true);
    h.issues.find(i => i.id === '103')!.hidden = true;
    const refused = await h.manager.detail(caller('v'), BROWSER, { reportId: r.reportId }) as { download: { code: string; count: number }; notReadable?: unknown };
    expect(refused.download).toMatchObject({ code: 'NOT_ALL_VISIBLE', count: 1 });
    expect(refused.notReadable).toBeUndefined();
    expect(await h.manager.downloadUrls(caller('v'), BROWSER, { keys: [objectKey('10000', r.reportId, 'report.csv')] })).toEqual({});
  });

  it('R3-5: a production site with no signing key offers no new report, and says why', async () => {
    const h = seeded({ keys: false });
    h.runtime.environment = () => 'production';
    const view = ok<ReportsView>(await h.manager.list(caller(), ADMIN, {}));
    expect(view.canCreate).toBe(false);
    expect(view.cannotCreateReason).toContain('no valid signing key for this production site');
    const dev = seeded();
    expect(ok<ReportsView>(await dev.manager.list(caller(), ADMIN, {}))).not.toHaveProperty('cannotCreateReason');
  });

  it('R3-6: opening the tab does not add a project to the registry; a known project gets its new key', async () => {
    const h = seeded();
    await h.manager.list(caller(), ADMIN, {});
    expect(await h.store.projects()).toEqual([]);
    await makeReport(h);
    expect(await h.store.projectKey('10000')).toBe('PAY');
    await h.manager.list({ ...caller(), projectKey: 'PAYMENTS' }, ADMIN, {});
    expect(await h.store.projectKey('10000')).toBe('PAYMENTS');
  });
});

describe('review round 4', () => {
  it('R4-1: opening the tab registers a project that has reports or schedules but no registry key', async () => {
    const h = seeded();
    await makeReport(h);
    await h.storage.delete('fr:reports:project:10000');
    expect(await h.store.projects()).toEqual([]);
    await h.manager.list(caller(), ADMIN, {});
    expect(await h.store.projects()).toEqual(['10000']);
    const s2 = seeded();
    await s2.store.saveSchedules('10000', [{ scheduleId: 's', cadence: 'WEEKLY', filters: { fieldIds: [], actors: [] }, createdBy: 'p', createdAt: 't' }]);
    await s2.manager.list(caller(), ADMIN, {});
    expect(await s2.store.projectKey('10000')).toBe('PAY');
  });

  it('R4-1: a create registers the project before it writes the entry', async () => {
    const h = seeded();
    const order: string[] = [];
    const reg = h.store.registerProject.bind(h.store);
    const put = h.store.putEntry.bind(h.store);
    jest.spyOn(h.store, 'registerProject').mockImplementation(async (...a) => { order.push('register'); return reg(...a); });
    jest.spyOn(h.store, 'putEntry').mockImplementation(async (...a) => { order.push('entry'); return put(...a); });
    await h.manager.create(caller(), ADMIN, RANGE);
    expect(order.slice(0, 2)).toEqual(['register', 'entry']);
  });
});

describe('owner decision R4-3: "Name every one"', () => {
  /** A DONE report whose not-read list holds n issues. */
  async function withMissing(h: ReturnType<typeof harness>, n: number, onlyNotReadable = false) {
    const id = await makeReport(h);
    const job = (await h.store.getJob(id))!;
    const list = Array.from({ length: n }, (_, i) => ({ issueId: String(90_000 + i), issueKey: `PAY-${90_000 + i}`, reason: (i % 2 && !onlyNotReadable ? 'MOVED' : 'NOT_READABLE') as 'MOVED' | 'NOT_READABLE' }));
    const chunks = await h.store.saveNotReadable(id, list);
    await h.store.saveJob({ ...job, notReadableChunks: chunks });
    return { id, list };
  }
  const page = async (h: ReturnType<typeof harness>, id: string, notReadPage?: unknown, p = ADMIN) =>
    h.manager.detail(caller(), p, { reportId: id, notReadPage }) as Promise<{ download: { allowed: boolean }; notReadable?: Array<{ issueId: string }>; notReadablePage?: { page: number; pageSize: number; total: number } }>;

  it.each([[0, 0], [1, 1], [50, 1], [51, 2], [1000, 20]])('%i missing issues are named on %i pages of at most 50, every one exactly once', async (n, pages) => {
    const h = seeded();
    const { id, list } = await withMissing(h, n);
    const seen: string[] = [];
    for (let i = 0; i < Math.max(1, pages); i++) {
      const d = await page(h, id, i);
      if (n === 0) {
        expect(d).not.toHaveProperty('notReadable');
        expect(d).not.toHaveProperty('notReadablePage');
        continue;
      }
      expect(d.notReadablePage).toEqual({ page: i, pageSize: 50, total: n });
      expect(d.notReadable!.length).toBe(i < pages - 1 ? 50 : n - 50 * (pages - 1));
      seen.push(...d.notReadable!.map(e => e.issueId));
    }
    expect(seen).toEqual(list.map(e => e.issueId));
  });

  it('clamps a page number out of range or not a number to the nearest page', async () => {
    const h = seeded();
    const { id } = await withMissing(h, 51);
    expect((await page(h, id, 99)).notReadablePage?.page).toBe(1);
    expect((await page(h, id, -3)).notReadablePage?.page).toBe(0);
    expect((await page(h, id, 'two')).notReadablePage?.page).toBe(0);
    expect((await page(h, id, 1.7)).notReadablePage?.page).toBe(1);
  });

  it('checks the download right again for every page: a viewer who cannot see an issue gets no page', async () => {
    const h = seeded();
    // NOT_READABLE only: a moved issue that no longer exists would need Tier 1 (R3-3), which this viewer lacks.
    const { id } = await withMissing(h, 1000, true);
    const spy = jest.spyOn(h.userJira, 'presentAmong');
    for (const i of [0, 1, 19]) expect((await page(h, id, i, BROWSER)).notReadable).toHaveLength(50);
    expect(spy).toHaveBeenCalledTimes(3);
    h.issues.find(e => e.id === '101')!.hidden = true;
    for (const i of [0, 7, 19]) {
      const d = await page(h, id, i, BROWSER);
      expect(d.download.allowed).toBe(false);
      expect(d).not.toHaveProperty('notReadable');
      expect(d).not.toHaveProperty('notReadablePage');
    }
    expect((await page(h, id, 0, NOBODY) as unknown as { ok: boolean }).ok).toBe(false);
  });

  it('names every missing issue of a real job across pages', async () => {
    const h = seeded();
    for (let i = 0; i < 51; i++) h.issues.push({ id: String(5000 + i), created: '2026-10-10T00:00:00.000Z' });
    const r = await h.manager.create(caller(), ADMIN, RANGE) as { reportId: string };
    for (let i = 0; i < 51; i++) h.appJira.dropIds.add(String(5000 + i));
    await h.drain();
    const first = await page(h, r.reportId, 0);
    const second = await page(h, r.reportId, 1);
    expect(first.notReadablePage).toEqual({ page: 0, pageSize: 50, total: 51 });
    expect([...first.notReadable!, ...second.notReadable!].map(e => e.issueId)).toEqual(Array.from({ length: 51 }, (_, i) => String(5000 + i)));
  });
});

