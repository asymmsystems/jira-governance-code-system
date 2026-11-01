/**
 * B-11: per-item evidence, and "evidence required" items.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { jira, CountingStorage, JiraCall } from '../helpers/forge-mocks';

jest.mock('@forge/api', () => {
  const m = require('../helpers/forge-mocks');
  const asApp = { requestJira: m.makeRequester('app') };
  const asUser = { requestJira: m.makeRequester('user') };
  return { __esModule: true, default: { asApp: () => asApp, asUser: () => asUser }, route: m.routeImpl };
});
jest.mock('@forge/kvs', () => ({ kvs: {}, WhereConditions: { beginsWith: (v: string) => v } }));

import { toggleChecklistItem, getIssueChecklist, getItemEvidence, getChecklistHistory, validateTransition } from '../../src/index';
import { validateEvidence, EVIDENCE_REQUIRED } from '../../src/domain/evidence';
import { TemplateStore } from '../../src/settings/template-store';
import { eventKey, stateKey } from '../../src/storage/checklist-store';

const project = { id: '10000', key: 'DEMO' };
const issue = { id: '93001', key: 'DEMO-93001', type: 'Task', typeId: '10004' };
const ctx = { accountId: '712020:dev', extension: { issue, project } };
const template = {
  name: 'Evidence DoD',
  items: [
    { id: 'security-scan', title: 'Security scan clear', isMandatory: true, category: 'SECURITY', evidenceRequired: true },
    { id: 'docs', title: 'Docs updated', isMandatory: true, category: 'DOCUMENTATION' }
  ]
};

describe('B-11 validateEvidence', () => {
  it('accepts a http or https link, a note, both, or nothing', () => {
    expect(validateEvidence(undefined)).toEqual({ ok: true, evidence: undefined });
    expect(validateEvidence({ url: 'https://ci.example.com/run/42' })).toEqual({ ok: true, evidence: { url: 'https://ci.example.com/run/42' } });
    expect(validateEvidence({ note: '  Scanned with tool X  ' })).toEqual({ ok: true, evidence: { note: 'Scanned with tool X' } });
    expect(validateEvidence({ url: 'http://x.example', note: 'n' })).toEqual({ ok: true, evidence: { url: 'http://x.example', note: 'n' } });
    expect(validateEvidence({ url: '', note: '   ' })).toEqual({ ok: true, evidence: undefined });
  });

  it.each([
    [{ url: 'javascript:alert(1)' }, 'The evidence link must start with http:// or https://.'],
    [{ url: 'ftp://x' }, 'The evidence link must start with http:// or https://.'],
    [{ url: 'https://' + 'a'.repeat(2000) }, 'The evidence link is longer than 2000 characters.'],
    [{ note: 'n'.repeat(501) }, 'The evidence note is longer than 500 characters.'],
    [{ url: 5 }, 'The evidence link must be text.'],
    [{ note: {} }, 'The evidence note must be text.'],
    ['text', 'Evidence must be a link, a note, or both.']
  ])('rejects %#', (input, message) => {
    expect(validateEvidence(input)).toEqual({ ok: false, error: message });
  });
});

describe('B-11 evidence on ticks', () => {
  let storage: CountingStorage;

  beforeEach(async () => {
    jira.reset();
    jira.handler = (c: JiraCall) => {
      if (c.path.includes('/mypermissions')) return { status: 200, body: { permissions: { EDIT_ISSUES: { havePermission: true } } } };
      if (c.path.startsWith('/rest/api/3/status/')) return { status: 200, body: { statusCategory: { key: 'done' } } };
      return { status: 204 };
    };
    storage = new CountingStorage();
    await new TemplateStore(storage).save('10000', '10004', template, '712020:admin');
  });

  it('stores evidence as Content in the Complete entry and only its id in the state', async () => {
    await toggleChecklistItem({ itemId: 'docs', isCompleted: true, evidence: { url: 'https://wiki.example/page', note: 'Updated' } }, ctx, storage);
    expect(storage.read(eventKey('93001', 2)).rows).toContainEqual({ entity: 'Content', contentId: 'content:93001:2', contentTypeId: 'DOD_EVIDENCE', objectInfo: 'https://wiki.example/page', textData: 'Updated' });
    const c = storage.read(stateKey('93001')).criteria.find((x: any) => x.templateItemId === 'docs');
    expect(c).toMatchObject({ currentStatusId: 'DOD_DONE', evidenceContentId: 'content:93001:2', lastStatusSeq: 2 });
    expect(c.objectInfo).toBeUndefined();
  });

  it('rejects bad evidence and writes nothing', async () => {
    await expect(toggleChecklistItem({ itemId: 'docs', isCompleted: true, evidence: { url: 'javascript:x' } }, ctx, storage))
      .rejects.toThrow('The evidence link must start with http:// or https://.');
    expect(storage.sets.filter(k => !k.startsWith('dg:tmpl:'))).toEqual([]);
  });

  it('refuses to tick an evidence-required item without evidence', async () => {
    await expect(toggleChecklistItem({ itemId: 'security-scan', isCompleted: true }, ctx, storage)).rejects.toThrow(EVIDENCE_REQUIRED);
    expect(EVIDENCE_REQUIRED).toBe('Add a link or a note. This item needs evidence before it counts as done.');
  });

  it('allows an untick without evidence', async () => {
    await toggleChecklistItem({ itemId: 'security-scan', isCompleted: true, evidence: { note: 'clean' } }, ctx, storage);
    const res = await toggleChecklistItem({ itemId: 'security-scan', isCompleted: false }, ctx, storage);
    expect(res.items.find(i => i.id === 'security-scan')!.isCompleted).toBe(false);
  });

  it('(V-a, V-b) the validator treats an evidence-required item ticked without evidence as open', async () => {
    await toggleChecklistItem({ itemId: 'docs', isCompleted: true }, ctx, storage);
    await toggleChecklistItem({ itemId: 'security-scan', isCompleted: true, evidence: { note: 'clean' } }, ctx, storage);
    expect(await validateTransition({ issue: { id: '93001' }, transition: { to: { id: '10001' } } }, {}, storage)).toEqual({ result: true });
    // A stored tick without evidence (for example from before the item required evidence) does not count.
    const st = storage.read(stateKey('93001'));
    delete st.criteria.find((x: any) => x.templateItemId === 'security-scan').evidenceContentId;
    storage.put(stateKey('93001'), st);
    const res = await validateTransition({ issue: { id: '93001' }, transition: { to: { id: '10001' } } }, {}, storage);
    expect(res.result).toBe(false);
    expect(res.errorMessage).toContain('Security scan clear');
  });

  it('the panel marks items that have evidence or need it, and loads the evidence on request', async () => {
    await toggleChecklistItem({ itemId: 'docs', isCompleted: true, evidence: { url: 'https://wiki.example/page' } }, ctx, storage);
    const res = await getIssueChecklist({}, ctx, storage);
    expect(res.items.find(i => i.id === 'docs')).toMatchObject({ hasEvidence: true });
    expect(res.items.find(i => i.id === 'security-scan')).toMatchObject({ evidenceRequired: true, hasEvidence: false });
    expect(await getItemEvidence({ itemId: 'docs' }, ctx, storage)).toEqual({ itemId: 'docs', evidence: { url: 'https://wiki.example/page' } });
    expect(await getItemEvidence({ itemId: 'security-scan' }, ctx, storage)).toEqual({ itemId: 'security-scan', evidence: undefined });
    await expect(getItemEvidence({ itemId: 'nope' }, ctx, storage)).rejects.toThrow("Checklist item with id 'nope' not found");
    expect(await getItemEvidence({ itemId: 'docs' }, { ...ctx, extension: { ...ctx.extension, issue: { ...issue, id: '93999' } } }, storage)).toEqual({ itemId: 'docs', evidence: undefined });
  });

  it('the history shows the evidence with the event', async () => {
    await toggleChecklistItem({ itemId: 'docs', isCompleted: true, evidence: { note: 'Updated' } }, ctx, storage);
    const h: any = await getChecklistHistory({}, ctx, storage);
    expect(h.auditTrail[1]).toMatchObject({ eventType: 'CHECK', itemTitle: 'Docs updated', evidence: { note: 'Updated' } });
  });

  it('keeps a change event with 500-character evidence at 2 KiB or less', async () => {
    await toggleChecklistItem({ itemId: 'docs', isCompleted: true, evidence: { url: 'https://e.example/' + 'p'.repeat(480), note: 'n'.repeat(500) } }, ctx, storage);
    expect(Buffer.byteLength(storage.store.get(eventKey('93001', 2))!, 'utf8')).toBeLessThanOrEqual(2 * 1024);
  });
});
