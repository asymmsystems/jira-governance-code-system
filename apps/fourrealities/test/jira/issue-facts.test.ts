/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Jira issue parsing unit tests
 */

import { analyzeIssueChangelog, factsFromIssue, normalizeException, statusCategoryOf } from '../../src/accessor/issue-facts';

describe('analyzeIssueChangelog', () => {
  it('counts status changes and rework loops', () => {
    expect(analyzeIssueChangelog(null)).toEqual({ statusChanges: 0, reworkLoops: 0 });
    expect(analyzeIssueChangelog({ histories: [{ items: null }] })).toEqual({ statusChanges: 0, reworkLoops: 0 });
    const changelog: any = {
      histories: [
        { items: [{ field: 'status', fromString: 'To Do', toString: 'In Progress' }] },
        { items: [{ field: 'status', fromString: 'In Review', toString: 'In Progress' }] },
        { items: [{ field: 'status', fromString: 'Done', toString: 'Reopened' }, { field: 'summary' }] }
      ]
    };
    expect(analyzeIssueChangelog(changelog)).toEqual({ statusChanges: 3, reworkLoops: 2 });
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
