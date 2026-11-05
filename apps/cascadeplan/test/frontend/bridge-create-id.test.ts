/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/** C7: the bridge sends a create id with a create, and the same request made again after an unanswered call sends the same id. */
const invoke = jest.fn();
const showErrorBanner = jest.fn();
jest.mock('@forge/bridge', () => ({ invoke: (...a: any[]) => invoke(...a), router: { open: jest.fn() }, view: { getContext: jest.fn() } }));
jest.mock('../../src/frontend/banner', () => ({ showErrorBanner: (...a: any[]) => showErrorBanner(...a) }));
jest.mock('../../src/frontend/changes-panel', () => ({ recordChanges: jest.fn() }));

import { callResolver, CREATE_RESOLVERS } from '../../src/frontend/bridge';

const sentIds = () => invoke.mock.calls.map(([, p]) => p.createId);

beforeEach(() => { invoke.mockReset(); showErrorBanner.mockReset(); });

describe('bridge create ids', () => {
  it('a create gets a new id each time it is answered', async () => {
    invoke.mockResolvedValue({ ok: true });
    await callResolver('createJiraEpic', { summary: 'A' });
    await callResolver('createJiraEpic', { summary: 'A' });
    const [a, b] = sentIds();
    expect(a).toMatch(/^[A-Za-z0-9-]{8,60}$/);
    expect(b).not.toBe(a);
  });

  it('after an unanswered create, the same request sends the same id, once; another request gets its own id', async () => {
    invoke.mockRejectedValueOnce(new Error('timeout')).mockResolvedValue({ ok: true });
    const res = await callResolver('createInlineTask', { summary: 'B' });
    expect(res).toMatchObject({ ok: false, error: 'unknown' });
    expect(res.message).toContain('will not create the work item twice');
    await callResolver('createInlineTask', { summary: 'C' });
    await callResolver('createInlineTask', { summary: 'B' });
    await callResolver('createInlineTask', { summary: 'B' });
    const [first, other, repeat, fresh] = sentIds();
    expect(other).not.toBe(first);
    expect(repeat).toBe(first);
    expect(fresh).not.toBe(first);
  });

  it('a call that creates nothing has no create id, and its unknown result keeps the old message', async () => {
    expect(CREATE_RESOLVERS.has('reorderWbsTasks')).toBe(false);
    invoke.mockRejectedValueOnce(new Error('timeout'));
    const res = await callResolver('reorderWbsTasks', { order: [] });
    expect(sentIds()).toEqual([undefined]);
    expect(res.message).toBe('The result is unknown. Check the plan before you try again.');
  });
});
