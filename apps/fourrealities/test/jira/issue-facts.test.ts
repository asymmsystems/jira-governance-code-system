/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Jira issue parsing unit tests
 */

import { analyzeIssueChangelog, factsFromIssue, normalizeException, statusCategoryOf } from '../../src/accessor/issue-facts';

describe('analyzeIssueChangelog (B-24: status categories, never status names)', () => {
  // Status ids to category keys, as read from GET /rest/api/3/status.
  const categories = { '1': 'new', '3': 'indeterminate', '10001': 'indeterminate', '10002': 'done', '10003': 'indeterminate' } as const;
  const move = (from: string, to: string, fromString = 'x', toString = 'y') => ({ items: [{ field: 'status', from, to, fromString, toString }] });

  it('counts status changes, and a rework loop for done to not done and for in progress back to to do', () => {
    expect(analyzeIssueChangelog(null, categories)).toEqual({ statusChanges: 0, reworkLoops: 0 });
    expect(analyzeIssueChangelog({ histories: [{ items: null }] }, categories)).toEqual({ statusChanges: 0, reworkLoops: 0 });
    const changelog = {
      histories: [
        move('1', '3'),
        move('10002', '10003'),
        move('3', '1'),
        { items: [{ field: 'summary' }] }
      ]
    };
    expect(analyzeIssueChangelog(changelog, categories)).toEqual({ statusChanges: 3, reworkLoops: 2 });
  });

  it('ignores the status names, so a name with "review" or "reopened" counts nothing by itself', () => {
    const named = { histories: [move('10001', '3', 'In Review', 'In Progress'), move('3', '10003', 'In Progress', 'Reopened')] };
    expect(analyzeIssueChangelog(named, categories)).toEqual({ statusChanges: 2, reworkLoops: 0 });
  });

  it('counts no rework for a status id it does not know', () => {
    expect(analyzeIssueChangelog({ histories: [move('999', '1')] }, categories)).toEqual({ statusChanges: 1, reworkLoops: 0 });
  });
});

describe('statusCategoryOf', () => {
  it('prefers the category key and falls back to the name', () => {
    expect(statusCategoryOf({ statusCategory: { key: 'done' } })).toBe('done');
    expect(statusCategoryOf({ statusCategory: { name: 'Done' } })).toBe('done');
    expect(statusCategoryOf({ statusCategory: { name: 'To Do' } })).toBe('new');
    expect(statusCategoryOf({ statusCategory: { name: 'In Progress' } })).toBe('indeterminate');
    expect(statusCategoryOf(undefined)).toBe('indeterminate');
  });
});

describe('normalizeException', () => {
  it('reads v1 records as code or rework notes and keeps v2 as is', () => {
    expect(normalizeException(undefined)).toBeUndefined();
    expect(normalizeException({ issueId: '1' })).toBeUndefined();
    const v1 = { issueId: '1', issueKey: 'A-1', type: 'CODE', reason: 'Config only', recordedBy: 'u', recordedAt: 't' };
    expect(normalizeException(v1)?.code?.reason).toBe('Config only');
    expect(normalizeException({ ...v1, type: 'REWORK' })?.rework?.reason).toBe('Config only');
    const v2 = { schemaVersion: 2, issueId: '1', issueKey: 'A-1' };
    expect(normalizeException(v2)).toBe(v2);
  });
});

describe('factsFromIssue', () => {
  const iss = {
    id: '10026',
    key: 'DEMO-26',
    fields: {
      summary: 'Sample',
      status: { name: 'Waiting for support', statusCategory: { key: 'indeterminate', name: 'In Progress' } },
      assignee: { displayName: 'Ana Silva' },
      updated: '2026-10-30T16:12:00.000+0000',
      sprint: { name: 'Sprint 3' },
      customfield_10020: [{ name: 'Sprint 3' }, { name: 'Sprint 4' }],
      customfield_10000: '{pullrequest={dataType=pullrequest, state=MERGED, stateCount=1}}',
      issuelinks: [{ type: { inward: 'is implemented by', outward: 'implements' }, outwardIssue: { key: 'DEMO-2', fields: { summary: 'ADR', issuetype: { name: 'Decision' } } } }]
    },
    properties: {
      'ledgerseal-cert': { status: 'SEAL_VALID', valid: true },
      'definitionguard-dod': { isFullySatisfied: true, satisfied: true },
      ledgersealCert: { status: 'SEAL_VALID' }
    },
    changelog: { histories: [] }
  };

  it('parses status, people, sprints, links, properties and the Development field', () => {
    const f = factsFromIssue(iss, { remoteLinks: [{ object: { url: 'https://s.atlassian.net/wiki/x', title: 'ADR-1' }, application: { type: 'com.atlassian.confluence' } }], siteHost: 's.atlassian.net', devFieldId: 'customfield_10000' });
    expect(f.issueKey).toBe('DEMO-26');
    expect(f.statusCategory).toBe('indeterminate');
    expect(f.sprintNames).toEqual(['Sprint 3', 'Sprint 4']);
    expect(f.issueLinks[0]).toEqual({ key: 'DEMO-2', summary: 'ADR', typeName: 'Decision', linkInward: 'is implemented by', linkOutward: 'implements' });
    expect(f.remoteLinks?.[0]).toEqual({ url: 'https://s.atlassian.net/wiki/x', title: 'ADR-1', applicationType: 'com.atlassian.confluence' });
    expect(f.devField).toEqual({ present: true, summary: { count: 1, state: 'MERGED', openCount: 0, mergedCount: 1, declinedCount: 0 } });
    expect(f.started).toBe(true);
    expect(f.properties.ledgerseal).toEqual({ status: 'SEAL_VALID', valid: true });
    expect(f.properties.dod).toEqual({ isFullySatisfied: true, satisfied: true });
    expect(f.updated).toBe('2026-10-30T16:12:00.000+0000');
  });

  it('marks remote links as unread when none were passed, and the Development field as absent', () => {
    const f = factsFromIssue({ id: 1, key: 'A-1', fields: {} }, { devFieldId: null });
    expect(f.remoteLinks).toBeUndefined();
    expect(f.devField).toEqual({ present: false, summary: { count: 0, state: null, openCount: 0, mergedCount: 0, declinedCount: 0 } });
    expect(f.summary).toBe('');
    expect(f.issueLinks).toEqual([]);
    const g = factsFromIssue({ id: 2, key: 'A-2', fields: { customfield_99: { a: 1 } } }, { devFieldId: 'customfield_99', remoteLinks: [{ url: 'u', title: 't' }] });
    expect(g.devField).toEqual({ present: true, summary: { count: 0, state: null, openCount: 0, mergedCount: 0, declinedCount: 0 } });
    expect(g.remoteLinks?.[0]).toEqual({ url: 'u', title: 't', applicationType: undefined });
  });
});
