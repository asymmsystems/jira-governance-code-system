/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: throwaway spikes S-1 to S-4 of the evidence report HLD (development only, never merged).
 */

import api, { route } from '@forge/api';
import Resolver from '@forge/resolver';
import { Queue } from '@forge/events';
import objectStore from '@forge/object-store';
import { kvs, WhereConditions } from '@forge/kvs';
import * as crypto from 'crypto';

type Rec = Record<string, unknown>;
const queue = new Queue({ key: 'fourrealities-report-jobs' });
const resolver = new Resolver();

const sha256b64 = (b: Buffer) => crypto.createHash('sha256').update(b).digest('base64');
const rssMb = () => Math.round(process.memoryUsage().rss / 1048576);
const nameOf = (e: unknown) => (e && typeof e === 'object' && 'name' in e ? String((e as { name: unknown }).name) : typeof e);
const codeOf = (e: unknown) => (e && typeof e === 'object' ? String((e as { code?: unknown }).code ?? '') + ' ' + String((e as { message?: unknown }).message ?? '').slice(0, 300) : '');

/** Writes one object through a pre-signed upload URL, as the app (backend PUT). */
async function putObject(key: string, body: Buffer, contentType: string): Promise<Rec> {
  const t0 = Date.now();
  const out: Rec = { key, bytes: body.length };
  try {
    const up = await objectStore.createUploadUrl({ key, length: body.length, checksum: sha256b64(body), checksumType: 'SHA256', overwrite: false });
    out.uploadUrlHost = up ? new URL(up.url).host : null;
    if (!up) return { ...out, error: 'no upload url' };
    try {
      const res = await fetch(up.url, { method: 'PUT', headers: { 'content-type': contentType }, body: new Uint8Array(body) });
      out.globalFetchStatus = res.status;
    } catch (e) {
      out.globalFetchError = `${nameOf(e)} ${codeOf(e)}`;
      try {
        const res2 = await api.fetch(up.url, { method: 'PUT', headers: { 'content-type': contentType }, body: body.buffer.slice(body.byteOffset, body.byteOffset + body.length) as ArrayBuffer });
        out.apiFetchStatus = res2.status;
      } catch (e2) {
        out.apiFetchError = `${nameOf(e2)} ${codeOf(e2)}`;
      }
    }
    out.meta = await objectStore.get(key);
  } catch (e) {
    out.error = `${nameOf(e)} ${codeOf(e)}`;
  }
  out.ms = Date.now() - t0;
  return out;
}

resolver.define('spikeWrite', async ({ payload }) => {
  const p = (payload || {}) as Rec;
  const bytes = Math.max(1, Math.min(Number(p.bytes) || 1024, 60_000_000));
  const text = JSON.stringify({ spike: 'S-1', at: new Date().toISOString() });
  const body = Buffer.concat([Buffer.from(text), Buffer.alloc(Math.max(0, bytes - text.length), 0x20)]);
  const key = `spike/${Date.now()}/report.json`;
  const result = await putObject(key, body, 'application/json');
  const list = ((await kvs.get('spike:keys')) as string[] | undefined) || [];
  if (!result.error) await kvs.set('spike:keys', [key, ...list].slice(0, 20));
  return result;
});

resolver.define('spikeKeys', async () => ({ keys: ((await kvs.get('spike:keys')) as string[] | undefined) || [] }));

/** The useObjectStore download contract: { [presignedUrl]: key }. */
resolver.define('generateDownloadUrls', async ({ payload }) => {
  const keys = (((payload || {}) as Rec).keys as string[]) || [];
  const out: Record<string, string> = {};
  for (const key of keys) {
    const res = await objectStore.createDownloadUrl(key);
    if (res?.url) out[res.url] = key;
  }
  return out;
});

/** S-2: issue ids as the app, then the bulk changelog fetch as the app. */
const spikeBulkFn = async ({ payload, context }: { payload?: unknown; context?: unknown }) => {
  const p = (payload || {}) as Rec;
  const projectKey = String((context as Rec & { extension?: { project?: { key?: string } } })?.extension?.project?.key || p.projectKey || 'PAY');
  const ids: string[] = [];
  let token: string | undefined;
  const jql = `project = "${projectKey}" ORDER BY created ASC`;
  do {
    const res = token
      ? await api.asApp().requestJira(route`/rest/api/3/search/jql?jql=${jql}&maxResults=100&fields=id&nextPageToken=${token}`)
      : await api.asApp().requestJira(route`/rest/api/3/search/jql?jql=${jql}&maxResults=100&fields=id`);
    const body = (await res.json()) as { issues?: Array<{ id: string }>; nextPageToken?: string; isLast?: boolean };
    for (const i of body.issues || []) ids.push(String(i.id));
    token = body.isLast ? undefined : body.nextPageToken;
  } while (token && ids.length < 1000);
  const runs: Rec[] = [];
  for (const fieldIds of [undefined, ['status']]) {
    const t0 = Date.now();
    let next: string | undefined;
    let bytes = 0;
    let entries = 0;
    let items = 0;
    let pages = 0;
    let status = 0;
    let keys: string[] = [];
    do {
      const res = await api.asApp().requestJira(route`/rest/api/3/changelog/bulkfetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ issueIdsOrKeys: ids, maxResults: 10000, ...(fieldIds ? { fieldIds } : {}), ...(next ? { nextPageToken: next } : {}) })
      });
      status = res.status;
      const text = await res.text();
      bytes += Buffer.byteLength(text);
      pages++;
      if (res.status !== 200) {
        runs.push({ fieldIds, status, body: text.slice(0, 400) });
        break;
      }
      const body = JSON.parse(text) as { issueChangeLogs?: Array<{ issueId: string; changeHistories?: Array<{ items?: unknown[] }> }>; nextPageToken?: string };
      keys = Object.keys(body);
      for (const icl of body.issueChangeLogs || []) for (const h of icl.changeHistories || []) { entries++; items += (h.items || []).length; }
      next = body.nextPageToken;
    } while (next && pages < 20);
    if (status === 200) runs.push({ fieldIds, status, pages, bytes, entries, items, ms: Date.now() - t0, bytesPerEntry: entries ? Math.round(bytes / entries) : null, topLevelKeys: keys });
  }
  const sample = await api.asApp().requestJira(route`/rest/api/3/changelog/bulkfetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ issueIdsOrKeys: ids.slice(0, 1), maxResults: 2 })
  });
  return { projectKey, issueCount: ids.length, runs, sample: (await sample.text()).slice(0, 1500) };
};
resolver.define('spikeBulk', spikeBulkFn);

/** S-3 part: the download visibility check, as the user: 20 searches of 500 ids. */
resolver.define('spikeVisibility', async ({ context }) => {
  const projectKey = String((context as { extension?: { project?: { key?: string } } })?.extension?.project?.key || 'PAY');
  const first = await api.asUser().requestJira(route`/rest/api/3/search/jql?jql=${`project = "${projectKey}"`}&maxResults=100&fields=id`);
  const own = (((await first.json()) as { issues?: Array<{ id: string }> }).issues || []).map(i => String(i.id));
  const t0 = Date.now();
  const calls: number[] = [];
  let returned = 0;
  for (let c = 0; c < 20; c++) {
    const ids = Array.from({ length: 500 }, (_, i) => own[i % own.length]);
    const s = Date.now();
    let token: string | undefined;
    do {
      const res = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ jql: `id in (${ids.join(',')})`, fields: ['id'], maxResults: 5000, ...(token ? { nextPageToken: token } : {}) })
      });
      const b = (await res.json()) as { issues?: unknown[]; nextPageToken?: string; isLast?: boolean };
      returned += (b.issues || []).length;
      token = b.isLast ? undefined : b.nextPageToken;
    } while (token);
    calls.push(Date.now() - s);
  }
  // A JQL id that does not exist.
  const missing = await api.asUser().requestJira(route`/rest/api/3/search/jql`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ jql: `id in (${own[0]},999999999)`, fields: ['id'] })
  });
  return { distinctIds: own.length, totalMs: Date.now() - t0, perCallMs: calls, returned, missingIdStatus: missing.status, missingIdBody: (await missing.text()).slice(0, 300) };
});

/** S-3 part: remote-link read latency, 8 at a time, as the app. */
const spikeRemoteLinksFn = async ({ context }: { payload?: unknown; context?: unknown }) => {
  const projectKey = String((context as { extension?: { project?: { key?: string } } })?.extension?.project?.key || 'PAY');
  const first = await api.asApp().requestJira(route`/rest/api/3/search/jql?jql=${`project = "${projectKey}"`}&maxResults=100&fields=id`);
  const own = (((await first.json()) as { issues?: Array<{ id: string }> }).issues || []).map(i => String(i.id));
  const ids = Array.from({ length: 160 }, (_, i) => own[i % own.length]);
  const t0 = Date.now();
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const id = ids[next++];
      await api.asApp().requestJira(route`/rest/api/3/issue/${id}/remotelink`);
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  const ms = Date.now() - t0;
  return { reads: ids.length, ms, perReadMs: ms / ids.length, projected10000Ms: Math.round((ms / ids.length) * 10000) };
};
resolver.define('spikeRemoteLinks', spikeRemoteLinksFn);

/** S-4: push an event from a resolver invoked by a user. */
resolver.define('spikeQueue', async ({ payload, context }) => {
  const p = (payload || {}) as Rec;
  const kind = String(p.kind || 's4');
  const accountId = String((context as { accountId?: string })?.accountId || '');
  await kvs.delete(`spike:${kind}`);
  const pushed = await queue.push({ body: { kind, accountId, issues: Number(p.issues) || 10000, changesPer: Number(p.changesPer) || 25, at: new Date().toISOString() } });
  return { jobId: pushed.jobId };
});

resolver.define('spikeResult', async ({ payload }) => ({ result: (await kvs.get(`spike:${String(((payload || {}) as Rec).kind || 's4')}`)) || null }));

export const handler = resolver.getDefinitions();

async function s4(body: Rec, context: Rec): Promise<Rec> {
  const out: Rec = { principal: context?.principal ?? null, contextKeys: Object.keys(context || {}) };
  try {
    const res = await api.asUser().requestJira(route`/rest/api/3/myself`);
    out.asUserStatus = res.status;
    out.asUserBody = (await res.text()).slice(0, 200);
  } catch (e) {
    out.asUserError = `${nameOf(e)} ${codeOf(e)}`;
  }
  try {
    const res = await api.asUser(String(body.accountId)).requestJira(route`/rest/api/3/mypermissions?permissions=BROWSE_PROJECTS`);
    out.asUserIdStatus = res.status;
    out.asUserIdBody = (await res.text()).slice(0, 200);
  } catch (e) {
    out.asUserIdError = `${nameOf(e)} ${codeOf(e)}`;
  }
  try {
    const res = await api.asApp().requestJira(route`/rest/api/3/myself`);
    out.asAppStatus = res.status;
  } catch (e) {
    out.asAppError = `${nameOf(e)} ${codeOf(e)}`;
  }
  return out;
}

/** S-3: a synthetic 10,000-issue report assembled in the consumer: JSON, CSV, hashes, signature, KVS parts, two objects. */
async function s3(body: Rec): Promise<Rec> {
  const t0 = Date.now();
  const marks: Rec = { rssStartMb: rssMb() };
  let peak = rssMb();
  const tick = () => { peak = Math.max(peak, rssMb()); };
  const issues = Number(body.issues) || 10000;
  const per = Number(body.changesPer) || 25;
  const tok = (n: number) => 'pty_' + crypto.createHash('sha256').update(String(n)).digest('hex').slice(0, 32);
  const list: Rec[] = [];
  for (let i = 0; i < issues; i++) {
    const changes: Rec[] = [];
    for (let c = 0; c < per; c++) {
      changes.push({ changelogId: String(100000 + i * per + c), at: new Date(Date.UTC(2026, 9, 1) + c * 3600_000).toISOString(), author: tok(c % 40), fieldId: c % 3 ? 'status' : 'description', field: c % 3 ? 'Status' : 'Description', fieldClass: c % 3 ? 'OTHER' : 'FREE_TEXT', from: c % 3 ? '10001' : null, to: c % 3 ? '10002' : null, fromString: c % 3 ? 'In Progress' : null, toString: c % 3 ? 'In Review' : null, ...(c % 3 ? {} : { omitted: { reason: 'FREE_TEXT', fromLength: 120, toLength: 340 } }) });
    }
    list.push({ issueId: String(20000 + i), issueKey: `PAY-${i + 1}`, issueTypeName: 'Story', summary: 'Synthetic summary text of an issue, cut to 120 characters in the real report so this is about right', created: '2026-10-01T00:00:00.000Z', statusCategory: 'done', statusId: '10002', gates: { intent: { state: 'FOUND', reason: 'INTENT_CONFLUENCE_LINK' }, process: { state: 'FOUND', reason: 'DOD_COMPLETE_DG', verification: 'VERIFIED' }, code: { state: 'NOT_APPLICABLE', reason: 'SOURCE_NOT_IN_USE' }, audit: { state: 'FOUND', reason: 'SEAL_VALID_LS', verification: 'VERIFIED' } }, rai: 100, risk: 'LOW', ledgerseal: { certificateId: 'c'.repeat(36), snapshotHash: 'a'.repeat(64), status: 'SEAL_VALID', sealedAt: '2026-10-20T00:00:00.000Z', keyId: 'ls-dev-2026-11', verification: 'VERIFIED' }, definitionguard: null, codeException: [], reworkNotes: [], changes });
    if (i % 1000 === 0) tick();
  }
  marks.generatedMs = Date.now() - t0; tick();
  // KVS parts: write the issues in 200,000-byte parts, then read them back (the PARTS and ASSEMBLE steps).
  const tParts = Date.now();
  const parts: string[] = [];
  let cur: Rec[] = [];
  let curBytes = 0;
  for (const it of list) {
    const b = Buffer.byteLength(JSON.stringify(it));
    if (curBytes + b > 190_000 && cur.length) { parts.push(JSON.stringify(cur)); cur = []; curBytes = 0; }
    cur.push(it); curBytes += b;
  }
  if (cur.length) parts.push(JSON.stringify(cur));
  const store = String(body.store || 'os');
  const back: Rec[] = [];
  if (store === 'kvs') {
    for (let i = 0; i < parts.length; i++) await kvs.set(`spike:part:${i}`, parts[i]);
    for (let i = 0; i < parts.length; i++) back.push(...(JSON.parse(String(await kvs.get(`spike:part:${i}`))) as Rec[]));
    for (let i = 0; i < parts.length; i++) await kvs.delete(`spike:part:${i}`);
  } else {
    const base = `tmp/spike-${Date.now()}`;
    for (let i = 0; i < parts.length; i++) {
      const r = await putObject(`${base}/part-${i}.json`, Buffer.from(parts[i]), 'application/json');
      if (r.error || r.globalFetchStatus !== 201) throw new Error(`part ${i} ${JSON.stringify(r)}`);
    }
    for (let i = 0; i < parts.length; i++) {
      const dl = await objectStore.createDownloadUrl(`${base}/part-${i}.json`);
      const res = await fetch(String(dl?.url));
      back.push(...(JSON.parse(await res.text()) as Rec[]));
    }
    for (let i = 0; i < parts.length; i++) await objectStore.delete(`${base}/part-${i}.json`);
  }
  parts.length = parts.length;
  marks.store = store;
  marks.parts = parts.length; marks.partsMs = Date.now() - tParts; tick();
  const tJson = Date.now();
  const json = Buffer.from(JSON.stringify({ format: 'fourrealities-evidence-report-data/1', issues: back }));
  marks.jsonBytes = json.length; marks.jsonMs = Date.now() - tJson; tick();
  const tCsv = Date.now();
  const q = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows: string[] = ['"reportId","rowType","issueKey","issueId","changeAt","changelogId","author","fieldId","field","fieldClass","from","to","fromString","toString","omitted","intent","process","code","audit","sealStatus","sealCertificateId","sealSnapshotHash","dodHeadHash","dodComplete","codeExceptionStatus"'];
  for (const it of back) for (const c of it.changes as Rec[]) rows.push([q('r'), q('CHANGE'), q(it.issueKey), q(it.issueId), q(c.at), q(c.changelogId), q(c.author), q(c.fieldId), q(c.field), q(c.fieldClass), q(c.from), q(c.to), q(c.fromString), q(c.toString), q(c.omitted ? 'FREE_TEXT (120 -> 340 characters)' : ''), q('FOUND VERIFIED'), q('FOUND VERIFIED'), q('NOT_APPLICABLE'), q('FOUND VERIFIED'), q('SEAL_VALID'), q('c'.repeat(36)), q('a'.repeat(64)), q(''), q(''), q('')].join(','));
  const csv = Buffer.from(rows.join('\r\n') + '\r\n');
  marks.csvBytes = csv.length; marks.csvMs = Date.now() - tCsv; tick();
  const tSig = Date.now();
  const h1 = crypto.createHash('sha256').update(json).digest('hex');
  const h2 = crypto.createHash('sha256').update(csv).digest('hex');
  const { privateKey } = crypto.generateKeyPairSync('ed25519');
  const sig = crypto.sign(null, Buffer.from(h1 + h2), privateKey).toString('base64');
  marks.hashSignMs = Date.now() - tSig; marks.sigLength = sig.length; tick();
  const tUp = Date.now();
  marks.jsonPut = await putObject(`spike/s3/${Date.now()}/report.json`, json, 'application/json'); tick();
  marks.csvPut = await putObject(`spike/s3/${Date.now()}/report.csv`, csv, 'text/csv'); tick();
  marks.uploadMs = Date.now() - tUp;
  marks.totalMs = Date.now() - t0;
  marks.peakRssMb = peak;
  marks.heapLimitMb = Math.round(((process as unknown as { memoryUsage: () => { heapTotal: number } }).memoryUsage().heapTotal) / 1048576);
  return marks;
}

export const worker = async (event: { body?: Rec }, context: Rec): Promise<void> => {
  const body = (event?.body || {}) as Rec;
  const kind = String(body.kind || 's4');
  let result: Rec;
  try {
    result = kind === 's3' ? await s3(body) : await s4(body, context);
  } catch (e) {
    result = { failed: `${nameOf(e)} ${codeOf(e)}`, rssMb: rssMb() };
  }
  await kvs.set(`spike:${kind}`, { ...result, finishedAt: new Date().toISOString() });
};


/** Web trigger for the app-side spikes when no user session is available (spike only). */
export const web = async (request: { queryParameters?: Record<string, string[]> }): Promise<{ statusCode: number; headers: Record<string, string[]>; body: string }> => {
  const q = request?.queryParameters || {};
  const s = (q.s || [''])[0];
  const arg = (k: string) => (q[k] || [''])[0];
  let out: unknown;
  try {
    if (s === 'roundtrip') {
      const bytes = Number(arg('bytes')) || 2048;
      const text = JSON.stringify({ spike: 'S-1', at: new Date().toISOString() });
      const body = Buffer.concat([Buffer.from(text), Buffer.alloc(Math.max(0, bytes - text.length), 0x20)]);
      const key = `spike/${Date.now()}/report.json`;
      const put = await putObject(key, body, 'application/json');
      const dl = await objectStore.createDownloadUrl(key);
      let back: Rec = {};
      if (dl?.url) {
        try {
          const r = await fetch(dl.url);
          const buf = Buffer.from(await r.arrayBuffer());
          back = { status: r.status, bytes: buf.length, same: buf.equals(body), host: new URL(dl.url).host, contentDisposition: r.headers.get('content-disposition'), contentType: r.headers.get('content-type') };
        } catch (e) {
          back = { error: `${nameOf(e)} ${codeOf(e)}` };
        }
      }
      const list = ((await kvs.get('spike:keys')) as string[] | undefined) || [];
      await kvs.set('spike:keys', [key, ...list].slice(0, 20));
      const tDel = Date.now();
      const extraKey = `spike/${Date.now()}/delete-me.json`;
      await putObject(extraKey, Buffer.from('{}'), 'application/json');
      await objectStore.delete(extraKey);
      const afterDelete = await objectStore.get(extraKey);
      let overwrite: Rec = {};
      try {
        const again = await objectStore.createUploadUrl({ key, length: 2, checksum: sha256b64(Buffer.from('{}')), checksumType: 'SHA256', overwrite: false });
        overwrite = { urlGiven: Boolean(again?.url) };
        if (again?.url) { const r = await fetch(again.url, { method: 'PUT', body: '{}' }); overwrite.putStatus = r.status; overwrite.metaAfter = await objectStore.get(key); }
      } catch (e) { overwrite = { error: `${nameOf(e)} ${codeOf(e)}` }; }
      out = { put, back, deleteMs: Date.now() - tDel, afterDelete: afterDelete ?? null, overwrite };
    } else if (s === 'bulk') {
      out = await spikeBulkFn({ payload: { projectKey: arg('project') || 'PAY' }, context: {} });
    } else if (s === 'links') {
      out = await spikeRemoteLinksFn({ payload: {}, context: { extension: { project: { key: arg('project') || 'PAY' } } } });
    } else if (s === 's3') {
      await kvs.delete('spike:s3');
      out = await queue.push({ body: { kind: 's3', issues: Number(arg('issues')) || 10000, changesPer: Number(arg('per')) || 25, store: arg('store') || 'os' } });
    } else if (s === 's4app') {
      await kvs.delete('spike:s4');
      out = await queue.push({ body: { kind: 's4', accountId: arg('account') } });
    } else if (s === 'result') {
      out = await kvs.get(`spike:${arg('kind')}`);
    } else if (s === 'jqlmissing') {
      const probe = async (jql: string) => {
        const r = await api.asApp().requestJira(route`/rest/api/3/search/jql`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ jql, fields: ['id'], maxResults: 5000 }) });
        return { status: r.status, body: (await r.text()).slice(0, 400) };
      };
      const f = await api.asApp().requestJira(route`/rest/api/3/search/jql?jql=${'project = "DEMO"'}&maxResults=3&fields=id`);
      const ids = (((await f.json()) as { issues?: Array<{ id: string }> }).issues || []).map(i => i.id);
      const many = Array.from({ length: 1000 }, (_, i) => String(Number(ids[0]) + i));
      out = { ids, existingAndMissing: await probe(`id in (${ids[0]},999999999)`), allMissing: await probe('id in (999999998,999999999)'), thousand: await probe(`id in (${many.join(',')})`) };
    } else if (s === 'visapp') {
      const f = await api.asApp().requestJira(route`/rest/api/3/search/jql?jql=${'project = "DEMO"'}&maxResults=3&fields=id`);
      const ids = (((await f.json()) as { issues?: Array<{ id: string }> }).issues || []).map(i => i.id);
      const t0 = Date.now();
      const per: number[] = [];
      for (let c = 0; c < 20; c++) {
        const many = Array.from({ length: 500 }, (_, i) => String(Number(ids[0]) - 60 + c * 500 + i));
        const s0 = Date.now();
        const r = await api.asApp().requestJira(route`/rest/api/3/search/jql`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ jql: `id in (${many.join(',')})`, fields: ['id'], maxResults: 5000 }) });
        await r.text();
        per.push(Date.now() - s0);
      }
      out = { calls: 20, idsPerCall: 500, totalMs: Date.now() - t0, per };
    } else if (s === 'cleanup') {
      const keys = [...(((await kvs.get('spike:keys')) as string[] | undefined) || []), ...arg('keys').split(',').filter(Boolean)];
      const done: Rec = {};
      for (const k of keys) { await objectStore.delete(k); done[k] = (await objectStore.get(k)) ?? 'deleted'; }
      await kvs.delete('spike:keys'); await kvs.delete('spike:s3'); await kvs.delete('spike:s4');
      let parts = 0;
      for (let cursor: string | undefined, first = true; first || cursor; first = false) {
        let qy = kvs.query().where('key', WhereConditions.beginsWith('spike:')).limit(100);
        if (cursor) qy = qy.cursor(cursor);
        const page = await qy.getMany();
        for (const r of page.results) { await kvs.delete(r.key); parts++; }
        cursor = page.nextCursor;
      }
      out = { ...done, kvsKeysDeleted: parts };
    } else if (s === 'projects') {
      const r = await api.asApp().requestJira(route`/rest/api/3/project/search?maxResults=50`);
      const b = (await r.json()) as { values?: Array<{ key: string; id: string }> };
      const counts: Rec = {};
      for (const p of b.values || []) {
        const c = await api.asApp().requestJira(route`/rest/api/3/search/approximate-count`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jql: `project = "${p.key}"` }) });
        counts[p.key] = ((await c.json()) as { count?: number }).count;
      }
      out = counts;
    } else {
      out = { error: 'unknown spike' };
    }
  } catch (e) {
    out = { failed: `${nameOf(e)} ${codeOf(e)}` };
  }
  return { statusCode: 200, headers: { 'Content-Type': ['application/json'] }, body: JSON.stringify(out) };
};
