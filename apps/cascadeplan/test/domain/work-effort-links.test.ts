/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: time-bound precedency links, contributors by account id, Jira link import, parent
 * roll-up dates and the migration of old entries (B-28).
 */

import { applyLinkUpdate, dependenciesFromJira, contributorsFromNames, contributorNames, rollUpParentDates, migrateEntry } from '../../src/domain/work-effort-links';

const dep = (k: string, pct: number, extra: any = {}) => ({ predecessorId: k, predecessorKey: k, triggerPercent: pct, isTriggerSatisfied: false, ...extra });
const T = '2026-11-01';

describe('applyLinkUpdate (B-28 criteria 2 and 3)', () => {
  const current = [dep('A-1', 30, { since: '2026-10-01', jiraLinkId: '7' }), dep('B-2', 100, { since: '2026-10-05' })];

  it('no update keeps everything', () => {
    expect(applyLinkUpdate(current, [], undefined, T)).toEqual({ dependencies: current, endedLinks: [], removed: [] });
  });

  it('removal ends every active link with its trigger and Jira link id', () => {
    expect(applyLinkUpdate(current, [], null, T)).toEqual({
      dependencies: [],
      endedLinks: [{ predecessorKey: 'A-1', triggerPercent: 30, since: '2026-10-01', until: T, jiraLinkId: '7' },
        { predecessorKey: 'B-2', triggerPercent: 100, since: '2026-10-05', until: T }],
      removed: current
    });
  });

  it('setting a link keeps the same predecessor (new trigger, old start date) and ends the others', () => {
    const r = applyLinkUpdate(current, [], dep('A-1', 50), T);
    expect(r.dependencies).toEqual([dep('A-1', 50, { since: '2026-10-01', jiraLinkId: '7' })]);
    expect(r.endedLinks).toEqual([{ predecessorKey: 'B-2', triggerPercent: 100, since: '2026-10-05', until: T }]);
    expect(r.removed.map(d => d.predecessorKey)).toEqual(['B-2']);
  });

  it('a new predecessor starts today; re-adding an ended predecessor clears its ended record; one ended record per predecessor', () => {
    const ended = [{ predecessorKey: 'C-3', until: '2026-10-20' }, { predecessorKey: 'B-2', until: '2026-10-10' }];
    const r = applyLinkUpdate([dep('B-2', 100, { since: '2026-10-11' })], ended, dep('C-3', 40, { jiraLinkId: '9' }), T);
    expect(r.dependencies).toEqual([dep('C-3', 40, { jiraLinkId: '9', since: T })]);
    expect(r.endedLinks).toEqual([{ predecessorKey: 'B-2', triggerPercent: 100, since: '2026-10-11', until: T }]);
  });
});

describe('dependenciesFromJira (ADR-006, N-11 L3 to L5)', () => {
  const blocked = [{ key: 'A-1', id: '1', linkId: '71' }, { key: 'B-2', id: '2', linkId: '72' }, { key: 'C-3', id: '3' }];
  it('one dependency per Jira link: the percent from the property, else a stored percent, else 100', () => {
    const out = dependenciesFromJira(blocked, { '2': 60, '3': 'x' }, [dep('A-1', 30)]);
    expect(out.map(d => [d.predecessorKey, d.triggerPercent, d.jiraLinkId])).toEqual([['A-1', 30, '71'], ['B-2', 60, '72'], ['C-3', 100, undefined]]);
    expect(dependenciesFromJira([], {}, [])).toEqual([]);
  });
  it('a stored link with no Jira link is kept, marked planOnly (L5); an out-of-range percent is ignored', () => {
    const out = dependenciesFromJira([{ key: 'A-1', id: '1' }], { '1': 150 }, [dep('A-1', 30), dep('Z-9', 45)]);
    expect(out.map(d => [d.predecessorKey, d.triggerPercent, !!d.planOnly])).toEqual([['A-1', 30, false], ['Z-9', 45, true]]);
  });
});

describe('contributors (B-28 criterion 4)', () => {
  const users = [{ accountId: 'acc-1', displayName: 'Ann Lee' }, { accountId: 'acc-2', displayName: 'Bo Chen' }, { accountId: 'acc-3', displayName: 'Bo Chen' }];

  it('a name with one matching user becomes its account id; no match or two matches keep the name as legacyName', () => {
    expect(contributorsFromNames(['Ann Lee', 'Bo Chen', 'Cy Dee'], users, [], T)).toEqual([
      { accountId: 'acc-1', since: T }, { legacyName: 'Bo Chen', since: T }, { legacyName: 'Cy Dee', since: T }
    ]);
  });

  it('keeps the start date of a person already assigned', () => {
    expect(contributorsFromNames(['Ann Lee'], users, [{ accountId: 'acc-1', since: '2026-10-01' }], T)).toEqual([{ accountId: 'acc-1', since: '2026-10-01' }]);
    expect(contributorsFromNames(['X'], users, [{ legacyName: 'X', since: '2026-09-01' }], T)).toEqual([{ legacyName: 'X', since: '2026-09-01' }]);
  });

  it('names are read live from the users; a legacy name is shown as stored; an unknown account id is left out', () => {
    expect(contributorNames([{ accountId: 'acc-2' }, { legacyName: 'Cy Dee' }, { accountId: 'gone' }], users)).toEqual(['Bo Chen', 'Cy Dee']);
    expect(contributorNames(undefined, users)).toEqual([]);
  });
});

describe('rollUpParentDates (B-28 criterion 5)', () => {
  it('a parent spans its dated children; a task without dated children keeps its own dates', () => {
    const tasks: any[] = [
      { key: 'E-1', startDate: '2026-01-01', endDate: '2026-01-02' },
      { key: 'S-2', parentKey: 'E-1', startDate: '2026-11-04', endDate: '2026-11-13' },
      { key: 'S-3', parentKey: 'E-1', startDate: '2026-11-10', endDate: '2026-12-01' },
      { key: 'S-4', parentKey: 'E-1', startDate: '' },
      { key: 'L-5', startDate: '2026-11-04', endDate: '2026-11-05' }
    ];
    const out = rollUpParentDates(tasks);
    expect([...out.entries()]).toEqual([['E-1', { startDate: '2026-11-04', endDate: '2026-12-01' }]]);
  });
});

describe('migrateEntry (B-28 criterion 6)', () => {
  const users = [{ accountId: 'acc-1', displayName: 'Ann Lee' }];

  it('an old link becomes an active link from the migration day; old names become contributors', () => {
    expect(migrateEntry({ dependency: dep('A-1', 30), contributingResources: ['Ann Lee', 'Zed'] } as any, users, [], T)).toEqual({
      dependencies: [dep('A-1', 30, { since: T })], endedLinks: [],
      contributors: [{ accountId: 'acc-1', since: T }, { legacyName: 'Zed', since: T }]
    });
  });

  it('an old "removed" flag becomes ended links for the Jira links it suppressed; an entry with nothing keeps nothing', () => {
    expect(migrateEntry({ dependency: null } as any, users, ['B-2', 'C-3'], T)).toEqual({
      dependencies: [], endedLinks: [{ predecessorKey: 'B-2', triggerPercent: 100, until: T }, { predecessorKey: 'C-3', triggerPercent: 100, until: T }], contributors: []
    });
    expect(migrateEntry({} as any, users, ['B-2'], T)).toEqual({ dependencies: [], endedLinks: [], contributors: [] });
  });
});
