/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Readiness review F-02 and F-03: values typed on the transition screen. A comment typed there is a new comment,
 * never a replacement of the comment list, so a sealed issue with comments is not reported as "Comment removed";
 * screen values record no incident; and modifiedFields is read at the top level and under `transition`.
 *
 * @author Fahim Farook
 */

import { applyTransitionScreen, sealIssue, transitionScreenValues, validateTransition } from '../src/index';
import { FakeJira, MemoryStore, model, panelContext, sampleIssue, validSignature } from './support/fakes';

jest.mock('@forge/api', () => ({ __esModule: true, default: {}, route: () => '' }));
jest.mock('@forge/kvs', () => ({ kvs: {} }));

async function sealed(withComment = true) {
  const issue = sampleIssue();
  if (withComment) issue.fields.comment = { comments: [{ id: '1', author: { accountId: 'ann' }, created: '2026-11-01T00:00:00.000Z', body: 'Approved in CAB' }] };
  const jira = new FakeJira(issue);
  jira.approvers = new Set(['ann']);
  jira.currentUser = 'ann';
  const storage = new MemoryStore();
  await sealIssue({ signature: validSignature() }, panelContext('ann'), { jira, storage });
  jira.currentUser = null;
  return { jira, storage, deps: { jira, storage } };
}

const validate = (deps: any, extra: any) => validateTransition({ issue: { key: 'CHG-1' }, ...extra }, {}, deps);

describe('F-02 a comment on the transition screen', () => {
  it('is a new comment: the gate says "Comment added", never "Comment removed", and records no incident', async () => {
    const { jira, storage, deps } = await sealed();
    const sets = storage.sets.length;
    const writes = jira.propertyWrites.length;
    const res = await validate(deps, { modifiedFields: { comment: 'Deployed to production' } });
    expect(res.result).toBe(false);
    expect(res.errorMessage).toContain('Comment added');
    expect(res.errorMessage).not.toContain('Comment removed');
    expect(storage.sets.length).toBe(sets);
    expect(jira.propertyWrites.length).toBe(writes);
    expect((await model.workEffort(storage)).everCompromised).toBe(false);
  });

  it('is seen on an issue sealed with no comments, in rich text', async () => {
    const { deps } = await sealed(false);
    const doc = { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Shipped' }] }] };
    const res = await validate(deps, { transition: { modifiedFields: { comment: doc } } });
    expect(res).toMatchObject({ result: false });
    expect(res.errorMessage).toContain('Comment added');
  });

  it('lets the transition pass when the screen comment is empty, or the screen sends the whole list', async () => {
    const { deps } = await sealed();
    await expect(validate(deps, { modifiedFields: { comment: '   ' } })).resolves.toEqual({ result: true });
    await expect(validate(deps, { modifiedFields: { comment: { comments: [] } } })).resolves.toEqual({ result: true });
    await expect(validate(deps, { modifiedFields: { comment: null } })).resolves.toEqual({ result: true });
    await expect(validate(deps, { modifiedFields: { attachment: [], worklog: { worklogs: [] } } })).resolves.toEqual({ result: true });
  });

  it('reads a comment body in every shape: a body object, an update list, a plain object and a number', () => {
    const raw = { fields: { comment: { comments: [] } } };
    const body = (value: any) => applyTransitionScreen(raw, { comment: value }, 't').fields.comment.comments[0]?.body;
    expect(body({ body: 'a' })).toBe('a');
    expect(body([{ add: { body: 'b' } }])).toBe('b');
    expect(body({ text: 'c' })).toBe('{"text":"c"}');
    expect(body(7)).toBe('7');
    expect(body({})).toBeUndefined();
    expect(body({ type: 'doc', content: [] })).toBeUndefined();
    expect(applyTransitionScreen({}, { summary: 'x' }, 't')).toEqual({});
    expect(applyTransitionScreen({ fields: { summary: 'a' } }, { comment: 'c' }, 't').fields.comment.comments).toHaveLength(1);
  });
});

describe('F-03 where modifiedFields is', () => {
  it('reads modifiedFields at the top level and under transition, and the top level wins', async () => {
    const { deps } = await sealed();
    const top = await validate(deps, { modifiedFields: { summary: 'Changed on the screen' } });
    expect(top.result).toBe(false);
    expect(top.errorMessage).toContain('Summary');
    expect(transitionScreenValues({ modifiedFields: { a: 1 }, transition: { modifiedFields: { a: 2, b: 3 } } })).toEqual({ a: 1, b: 3 });
    expect(transitionScreenValues({ modifiedFields: [1], transition: { modifiedFields: 'x' } })).toEqual({});
  });

  it('records the incident of a change that is already in Jira when the screen sends nothing', async () => {
    const { jira, storage, deps } = await sealed();
    jira.edit('bob', '2099-01-01T00:00:00.000Z', 'summary', 'changed');
    await validate(deps, {});
    expect((await model.workEffort(storage)).incidentCount).toBe(1);
  });
});
