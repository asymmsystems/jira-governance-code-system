/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * F-25, spec 3.3 item 9: a leaf's progress is its own time spent over its own estimate; a parent's is
 * the aggregate time spent over the aggregate estimate.
 */
import { mapLiveIssues } from '../src/index';

const issue = (key: string, f: any) => ({ id: key.replace(/\D/g, ''), key, fields: { summary: key, issuetype: { name: 'Task', hierarchyLevel: 0 }, status: { statusCategory: { key: 'indeterminate' } }, ...f } });

describe('F-25: progress source', () => {
  it('a parent with sub-tasks uses the aggregate estimate, not its own', () => {
    const parent = issue('T-1', { timeoriginalestimate: 10 * 3600, aggregatetimeoriginalestimate: 40 * 3600, timespent: 0, aggregatetimespent: 20 * 3600,
      subtasks: [{ id: '2', key: 'T-2', fields: { summary: 's', status: { statusCategory: { key: 'new' } } } }] });
    const res = mapLiveIssues({ issues: [parent], isLive: true } as any, {});
    const t = [...res.tasks, ...res.backlogTasks].find(x => x.key === 'T-1')!;
    expect(t.progress).toBe(50); // 20 h of 40 h, not 20 h of 10 h (capped at 100)
  });

  it('a leaf uses its own time spent and estimate', () => {
    const leaf = issue('T-3', { timeoriginalestimate: 8 * 3600, timespent: 2 * 3600, aggregatetimespent: 2 * 3600 });
    const res = mapLiveIssues({ issues: [leaf], isLive: true } as any, {});
    expect([...res.tasks, ...res.backlogTasks].find(x => x.key === 'T-3')!.progress).toBe(25);
  });
});
