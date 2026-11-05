/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * F-20 and M3: the bridge continues a cascade from every root a batch names, with one round counter
 * for the whole call, and tells the user when the cascade did not finish.
 */
const invoke = jest.fn();
const showErrorBanner = jest.fn();
jest.mock('@forge/bridge', () => ({ invoke: (...a: any[]) => invoke(...a), router: { open: jest.fn() }, view: { getContext: jest.fn() } }));
jest.mock('../../src/frontend/banner', () => ({ showErrorBanner: (...a: any[]) => showErrorBanner(...a) }));
jest.mock('../../src/frontend/changes-panel', () => ({ recordChanges: jest.fn() }));

import { callResolver } from '../../src/frontend/bridge';

beforeEach(() => { invoke.mockReset(); showErrorBanner.mockReset(); });

describe('bridge cascade continuation', () => {
  it('continues from each root of a batch until nothing remains, in the plan of the first write', async () => {
    const left: Record<string, number> = { 'T-1': 2, 'T-2': 1 };
    invoke.mockImplementation(async (fn: string, payload: any) => {
      if (fn === 'batchUpdateTasks') return { ok: true, tasks: [], cascadeRoots: ['T-1', 'T-2'], cascadeRemaining: ['A', 'B'] };
      left[payload.taskId]--;
      return { ok: true, tasks: [], cascadeRemaining: left[payload.taskId] > 0 ? ['X'] : [] };
    });
    await callResolver('batchUpdateTasks', { planId: 'p1', items: [] });
    const calls = invoke.mock.calls.filter(([fn]) => fn === 'continueCascade').map(([, p]) => `${p.taskId}@${p.planId}`);
    expect(calls).toEqual(['T-1@p1', 'T-1@p1', 'T-2@p1']);
    expect(showErrorBanner).not.toHaveBeenCalled();
  });

  it('stops at 40 rounds for the whole call and says the cascade did not finish', async () => {
    invoke.mockImplementation(async () => ({ ok: true, tasks: [], cascadeRemaining: ['X'] }));
    await callResolver('updateWbsTask', { taskId: 'T-1', planId: 'p1' });
    expect(invoke.mock.calls.filter(([fn]) => fn === 'continueCascade').length).toBe(40);
    expect(showErrorBanner).toHaveBeenCalledWith('The cascade did not finish. Move the task again to continue.');
  });
});
