/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: licensing check tests (B-21).
 */

import { handler, setGlobalStorageProvider } from '../src/index';
import { MemStorage } from './helpers/mem-storage';

const mockRequestJira = jest.fn();
jest.mock('@forge/api', () => ({
  __esModule: true,
  default: {
    asUser: () => ({ requestJira: mockRequestJira }),
    asApp: () => ({ requestJira: mockRequestJira })
  },
  route: (strings: TemplateStringsArray, ...values: any[]) =>
    strings.reduce((acc, str, i) => acc + str + (values[i] !== undefined ? values[i] : ''), '')
}));

describe('licensing check (B-21)', () => {
  let storage: MemStorage;

  beforeEach(() => {
    storage = new MemStorage();
    setGlobalStorageProvider(storage);
    mockRequestJira.mockReset();
  });

  it('returns licence required and performs no write when license.isActive is false', async () => {
    const req = {
      call: {
        functionKey: 'updateWbsTask',
        payload: {
          projectKey: 'TEST',
          taskId: 'TEST-1',
          updates: { summary: 'New Summary' }
        }
      },
      context: {
        license: { isActive: false },
        extension: { project: { key: 'TEST', id: 'TEST' } }
      }
    };

    const res: any = await handler(req);
    expect(res.ok).toBe(false);
    expect(res.error).toBe('license_required');
    expect(res.message).toMatch(/licen[sc]e required/i);
    expect(mockRequestJira).not.toHaveBeenCalled();
    expect(await storage.get('cp:TEST:we:10001')).toBeUndefined();
  });

  it('returns licence required and performs no write when license.active is false', async () => {
    const req = {
      call: {
        functionKey: 'batchUpdateTasks',
        payload: {
          projectKey: 'TEST',
          tasks: [{ taskId: 'TEST-1', updates: { summary: 'Batch Summary' } }]
        }
      },
      context: {
        license: { active: false },
        extension: { project: { key: 'TEST', id: 'TEST' } }
      }
    };

    const res: any = await handler(req);
    expect(res.ok).toBe(false);
    expect(res.error).toBe('license_required');
    expect(res.message).toMatch(/licen[sc]e required/i);
    expect(mockRequestJira).not.toHaveBeenCalled();
  });

  it('returns licence required for getProjectPlan when unlicensed', async () => {
    const req = {
      call: {
        functionKey: 'getProjectPlan',
        payload: { projectKey: 'TEST' }
      },
      context: {
        license: { isActive: false },
        extension: { project: { key: 'TEST', id: 'TEST' } }
      }
    };

    const res: any = await handler(req);
    expect(res.ok).toBe(false);
    expect(res.error).toBe('license_required');
    expect(res.message).toMatch(/licen[sc]e required/i);
    expect(mockRequestJira).not.toHaveBeenCalled();
  });

  it('allows execution when license is active', async () => {
    mockRequestJira.mockResolvedValue({
      status: 200,
      json: async () => ({ issues: [], isLast: true })
    });

    const req = {
      call: {
        functionKey: 'getProjectPlan',
        payload: { projectKey: 'TEST' }
      },
      context: {
        license: { isActive: true, active: true },
        extension: { project: { key: 'TEST', id: 'TEST' } }
      }
    };

    const res: any = await handler(req);
    expect(res.error).toBeUndefined();
    expect(res.projectKey).toBe('TEST');
  });

  it('allows execution when license context is omitted', async () => {
    mockRequestJira.mockResolvedValue({
      status: 200,
      json: async () => ({ issues: [], isLast: true })
    });

    const req = {
      call: {
        functionKey: 'getProjectPlan',
        payload: { projectKey: 'TEST' }
      },
      context: {
        extension: { project: { key: 'TEST', id: 'TEST' } }
      }
    };

    const res: any = await handler(req);
    expect(res.error).toBeUndefined();
    expect(res.projectKey).toBe('TEST');
  });

  it('rejects createInlineTask and creates no issue when unlicensed', async () => {
    const req = {
      call: {
        functionKey: 'createInlineTask',
        payload: {
          projectKey: 'TEST',
          summary: 'Unlicensed Task',
          effortHours: 8
        }
      },
      context: {
        license: { isActive: false },
        extension: { project: { key: 'TEST', id: 'TEST' } }
      }
    };

    const res: any = await handler(req);
    expect(res.ok).toBe(false);
    expect(res.error).toBe('license_required');
    expect(res.message).toMatch(/licen[sc]e required/i);
    expect(mockRequestJira).not.toHaveBeenCalled();
  });

  it('rejects createJiraEpic and creates no epic when unlicensed', async () => {
    const req = {
      call: {
        functionKey: 'createJiraEpic',
        payload: {
          projectKey: 'TEST',
          summary: 'Unlicensed Epic'
        }
      },
      context: {
        license: { active: false },
        extension: { project: { key: 'TEST', id: 'TEST' } }
      }
    };

    const res: any = await handler(req);
    expect(res.ok).toBe(false);
    expect(res.error).toBe('license_required');
    expect(res.message).toMatch(/licen[sc]e required/i);
    expect(mockRequestJira).not.toHaveBeenCalled();
  });

  it('rejects scheduleBacklogTask and modifies nothing when unlicensed', async () => {
    const req = {
      call: {
        functionKey: 'scheduleBacklogTask',
        payload: {
          projectKey: 'TEST',
          taskId: 'TEST-1',
          startWeek: '12-Aug',
          spanWeeks: 2
        }
      },
      context: {
        license: { isActive: false },
        extension: { project: { key: 'TEST', id: 'TEST' } }
      }
    };

    const res: any = await handler(req);
    expect(res.ok).toBe(false);
    expect(res.error).toBe('license_required');
    expect(res.message).toMatch(/licen[sc]e required/i);
    expect(mockRequestJira).not.toHaveBeenCalled();
  });

  it('rejects a dependency change and modifies nothing when unlicensed', async () => {
    const req = {
      call: {
        functionKey: 'updateWbsTask',
        payload: {
          projectKey: 'TEST',
          taskId: 'TEST-2',
          updates: { dependency: { predecessorKey: 'TEST-1', triggerPercent: 30 } }
        }
      },
      context: {
        license: { isActive: false },
        extension: { project: { key: 'TEST', id: 'TEST' } }
      }
    };

    const res: any = await handler(req);
    expect(res.ok).toBe(false);
    expect(res.error).toBe('license_required');
    expect(res.message).toMatch(/licen[sc]e required/i);
    expect(mockRequestJira).not.toHaveBeenCalled();
  });
});
