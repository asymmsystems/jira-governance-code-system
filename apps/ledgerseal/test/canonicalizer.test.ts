/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

import { canonicalizeIssueState, canonicalizeValue } from '../src/domain/canonicalizer';

describe('Canonicalizer', () => {
  describe('canonicalizeValue', () => {
    it('keeps typed spaces and normalizes newlines (canonical form v2, LS-11)', () => {
      expect(canonicalizeValue('  hello world  ')).toBe('  hello world  ');
      expect(canonicalizeValue('line1\r\nline2\rline3')).toBe('line1\nline2\nline3');
    });

    it('normalizes empty strings, undefined, and null to null', () => {
      expect(canonicalizeValue('')).toBeNull();
      expect(canonicalizeValue('   ')).toBe('   ');
      expect(canonicalizeValue(undefined)).toBeNull();
      expect(canonicalizeValue(null)).toBeNull();
    });

    it('handles booleans correctly', () => {
      expect(canonicalizeValue(true)).toBe(true);
      expect(canonicalizeValue(false)).toBe(false);
    });

    it('handles numbers and non-finite values', () => {
      expect(canonicalizeValue(42)).toBe(42);
      expect(canonicalizeValue(42.5)).toBe(42.5);
      expect(canonicalizeValue(NaN)).toBeNull();
      expect(canonicalizeValue(Infinity)).toBeNull();
    });

    it('sorts object keys lexicographically', () => {
      const obj1 = { z: 1, a: 2, m: 3 };
      const obj2 = { a: 2, m: 3, z: 1 };
      expect(canonicalizeValue(obj1)).toEqual({ a: 2, m: 3, z: 1 });
      expect(JSON.stringify(canonicalizeValue(obj1))).toBe(JSON.stringify(canonicalizeValue(obj2)));
    });

    it('drops empty items, keeps order, and sorts only when asked for a set', () => {
      const arr = ['banana', 'apple', ''];
      expect(canonicalizeValue(arr)).toEqual(['banana', 'apple']);
      expect(canonicalizeValue(arr, true)).toEqual(['apple', 'banana']);
    });
  });

  describe('canonicalizeIssueState', () => {
    it('produces identical canonical snapshots for issues with fields in different order', () => {
      const rawIssue1 = {
        id: '10001',
        key: 'PROD-42',
        fields: {
          project: { key: 'PROD' },
          issuetype: { name: 'Bug' },
          status: { name: 'Done' },
          summary: 'Fix memory leak in parser',
          description: 'Detailed description\r\nwith windows newlines',
          priority: { name: 'High' },
          labels: ['security', 'regulated'],
          components: [{ name: 'Backend' }, { name: 'API' }],
          attachment: [
            { id: 'att-2', filename: 'log.txt', size: 1024, created: '2026-10-28T10:00:00Z', author: { accountId: 'acc-1' } },
            { id: 'att-1', filename: 'audit.pdf', size: 2048, created: '2026-10-28T09:00:00Z', author: { accountId: 'acc-1' } }
          ]
        }
      };

      const rawIssue2 = {
        id: '10001',
        key: 'PROD-42',
        fields: {
          description: 'Detailed description\nwith windows newlines',
          status: { name: 'Done' },
          summary: 'Fix memory leak in parser', // v2 keeps typed spaces, so equal content means equal text
          issuetype: { name: 'Bug' },
          project: { key: 'PROD' },
          priority: { name: 'High' },
          attachment: [
            { id: 'att-1', filename: 'audit.pdf', size: 2048, created: '2026-10-28T09:00:00Z', author: { accountId: 'acc-1' } },
            { id: 'att-2', filename: 'log.txt', size: 1024, created: '2026-10-28T10:00:00Z', author: { accountId: 'acc-1' } }
          ],
          components: [{ name: 'API' }, { name: 'Backend' }],
          labels: ['regulated', 'security']
        }
      };

      const snapshot1 = canonicalizeIssueState(rawIssue1, '2026-10-28T12:00:00Z');
      const snapshot2 = canonicalizeIssueState(rawIssue2, '2026-10-28T12:00:00Z');

      expect(snapshot1).toEqual(snapshot2);
      expect(JSON.stringify(snapshot1)).toBe(JSON.stringify(snapshot2));
    });

    it('handles empty or missing raw issue structure gracefully', () => {
      const snapshot = canonicalizeIssueState(null, '2026-10-28T12:00:00Z');
      expect(snapshot.issueId).toBe('');
      expect(snapshot.fields).toHaveLength(0);
      expect(snapshot.attachments).toHaveLength(0);
    });

    it('sorts attachments by ID deterministically', () => {
      const rawIssue = {
        id: '10002',
        key: 'PROD-43',
        fields: {
          project: { key: 'PROD' },
          issuetype: { name: 'Story' },
          status: { name: 'In Progress' },
          attachment: [
            { id: 'att-99', filename: 'z.txt', size: 10, created: '2026-10-28T00:00:00Z', author: { accountId: 'acc-2' } },
            { id: 'att-01', filename: 'a.txt', size: 10, created: '2026-10-28T00:00:00Z', author: { accountId: 'acc-1' } }
          ]
        }
      };

      const snapshot = canonicalizeIssueState(rawIssue, '2026-10-28T12:00:00Z');
      expect(snapshot.attachments[0].id).toBe('att-01');
      expect(snapshot.attachments[1].id).toBe('att-99');
    });

    it('skips Rank, Sprint and Development by schema type, and Resolution with the status rule (NF-05)', () => {
      const rawIssue = {
        id: '10003',
        key: 'PROD-44',
        fields: {
          summary: 'Issue with volatile custom fields',
          customfield_10019: '0|i0001b:',
          customfield_10020: [{ id: 1, name: 'Sprint 1', state: 'active' }],
          customfield_10000: '{"pullrequest":{"dataType":"pullrequest"}}',
          resolution: { id: '1', name: 'Done' },
          resolutiondate: '2026-10-29T10:00:00Z'
        }
      };
      const schemas = [
        { id: 'customfield_10019', name: 'Rank', schema: { custom: 'com.pyxis.greenhopper.jira:gh-lexo-rank' } },
        { id: 'customfield_10020', name: 'Sprint', schema: { custom: 'com.pyxis.greenhopper.jira:gh-sprint' } },
        { id: 'customfield_10000', name: 'Development', schema: { custom: 'com.atlassian.jira.plugins.jira-development-integration-plugin:devsummarycf' } }
      ];

      const snapshot = canonicalizeIssueState(rawIssue, '2026-10-28T12:00:00Z', schemas);
      expect(snapshot.fields.map(f => f.id)).toEqual(['summary']);
      expect(snapshot.excluded?.map(e => e.name)).toEqual(['Development', 'Rank', 'Sprint', 'resolution', 'resolutiondate']);
    });

    it('normalizes assignee, issuelinks, and subtasks to stable values without mutable status or avatars', () => {
      const rawIssue = {
        id: '10004',
        key: 'PROD-45',
        fields: {
          summary: 'Entity test',
          assignee: { accountId: 'acc-1', displayName: 'Alice', avatarUrls: { '48x48': 'https://avatar/1' } },
          issuelinks: [
            { id: '1', type: { name: 'Blocks' }, outwardIssue: { key: 'PROJ-5', fields: { status: { name: 'In Progress' } } } }
          ],
          subtasks: [
            { id: '10', key: 'PROD-46', fields: { status: { name: 'To Do' } } }
          ]
        }
      };

      const snapshot = canonicalizeIssueState(rawIssue, '2026-10-28T12:00:00Z');
      const assigneeField = snapshot.fields.find(f => f.id === 'assignee');
      expect(assigneeField?.value).toEqual({ accountId: 'acc-1' });
      expect(assigneeField?.display).toBe('Alice');

      const linksField = snapshot.fields.find(f => f.id === 'issuelinks');
      expect(linksField?.value).toEqual([{ direction: 'outward', issue: 'PROJ-5', type: 'Blocks' }]);

      const subtasksField = snapshot.fields.find(f => f.id === 'subtasks');
      expect(subtasksField?.value).toEqual([{ id: '10' }]);
    });

    it('preserves whitespace inside ADF text nodes', () => {
      const adf = {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Release ' },
              { type: 'text', text: 'approved by CAB.' }
            ]
          }
        ]
      };

      const rawIssue1 = { id: '1', key: 'P-1', fields: { description: adf } };
      const rawIssue2 = {
        id: '1',
        key: 'P-1',
        fields: {
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Releaseapprovedby CAB.' }]
              }
            ]
          }
        }
      };

      const snap1 = canonicalizeIssueState(rawIssue1, '2026-10-28T12:00:00Z');
      const snap2 = canonicalizeIssueState(rawIssue2, '2026-10-28T12:00:00Z');
      expect(JSON.stringify(snap1.fields)).not.toEqual(JSON.stringify(snap2.fields));
    });

    it('strips volatile localId attributes on ADF nodes across re-saves', () => {
      const raw1 = {
        id: '1',
        key: 'P-1',
        fields: {
          description: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                attrs: { localId: 'uuid-1111-2222' },
                content: [{ type: 'text', text: 'Clean documentation' }]
              }
            ]
          }
        }
      };

      const raw2 = {
        id: '1',
        key: 'P-1',
        fields: {
          description: {
            type: 'doc',
            content: [
              {
                type: 'paragraph',
                attrs: { localId: 'uuid-9999-8888' },
                content: [{ type: 'text', text: 'Clean documentation' }]
              }
            ]
          }
        }
      };

      const snap1 = canonicalizeIssueState(raw1, '2026-10-28T12:00:00Z');
      const snap2 = canonicalizeIssueState(raw2, '2026-10-28T12:00:00Z');
      expect(JSON.stringify(snap1.fields)).toEqual(JSON.stringify(snap2.fields));
    });

    it('excludes statuscategory and statusCategory to prevent transition tamper alerts', () => {
      const raw = {
        id: '1',
        key: 'P-1',
        fields: {
          summary: 'Transition test',
          statuscategory: { id: 3, key: 'done', name: 'Done' },
          statusCategory: { id: 3, key: 'done', name: 'Done' }
        }
      };

      const snap = canonicalizeIssueState(raw, '2026-10-28T12:00:00Z');
      expect(snap.fields.map(f => f.id)).toEqual(['summary']);
    });

    it('excludes JSM SLA timers, satisfaction, participants and approvals by schema type, not by value (Fixes D-03, LS-05)', () => {
      const raw = {
        id: '1',
        key: 'DEMO-5',
        fields: {
          summary: 'JSM ticket',
          customfield_10027: { ongoingCycle: { breached: false } },
          customfield_10037: { rating: 5 },
          customfield_10031: [{ accountId: 'acc-2' }],
          customfield_10032: [{ id: '1', finalDecision: 'pending' }],
          customfield_10001: 'Approved budget 1000',
          customfield_branch: 'branch={main}'
        }
      };
      const schemas = [
        { id: 'customfield_10027', name: 'Time to first response', schema: { custom: 'com.atlassian.servicedesk:sd-sla-field' } },
        { id: 'customfield_10037', name: 'Satisfaction', schema: { custom: 'com.atlassian.servicedesk:sd-request-feedback' } },
        { id: 'customfield_10031', name: 'Request participants', schema: { custom: 'com.atlassian.servicedesk:sd-request-participants' } },
        { id: 'customfield_10032', name: 'Approvals', schema: { custom: 'com.atlassian.servicedesk.approvals-plugin:sd-approvals' } },
        { id: 'customfield_10001', name: 'Budget notes', schema: { custom: 'com.atlassian.jira.plugin.system.customfieldtypes:textarea' } }
      ];

      const snap = canonicalizeIssueState(raw, '2026-10-28T12:00:00Z', schemas);
      expect(snap.fields.map(f => f.id)).toEqual(['customfield_10001', 'customfield_branch', 'summary']);
      expect(snap.excluded?.map(e => e.id)).toEqual(['customfield_10027', 'customfield_10031', 'customfield_10032', 'customfield_10037']);
    });

    it('normalizes empty arrays and null identically (Fixes D-03 components: null vs [])', () => {
      const raw1 = {
        id: '1',
        key: 'P-1',
        fields: {
          summary: 'Comp test',
          components: null
        }
      };
      const raw2 = {
        id: '1',
        key: 'P-1',
        fields: {
          summary: 'Comp test',
          components: []
        }
      };

      const snap1 = canonicalizeIssueState(raw1, '2026-10-28T12:00:00Z');
      const snap2 = canonicalizeIssueState(raw2, '2026-10-28T12:00:00Z');
      expect(JSON.stringify(snap1.fields)).toEqual(JSON.stringify(snap2.fields));
    });

    it('extracts and sorts comments deterministically (Fixes D-10)', () => {
      const raw = {
        id: '1',
        key: 'P-1',
        fields: {
          summary: 'Comment test',
          comment: {
            comments: [
              { id: 'c-2', author: { accountId: 'acc-2' }, body: 'Second comment', created: '2026-10-29T10:00:00Z' },
              { id: 'c-1', author: { accountId: 'acc-1' }, body: 'First comment', created: '2026-10-29T09:00:00Z' }
            ]
          }
        }
      };

      const snap = canonicalizeIssueState(raw, '2026-10-28T12:00:00Z');
      expect(snap.comments).toBeDefined();
      expect(snap.comments![0].id).toBe('c-1');
      expect(snap.comments![1].id).toBe('c-2');
    });

    it('normalizes fixVersions, environment, duedate, priority, labels, and components', () => {
      const raw = {
        id: '1',
        key: 'P-1',
        fields: {
          summary: 'All fields',
          priority: { id: '1', name: 'High' },
          components: [{ name: 'Auth' }],
          labels: ['backend'],
          fixVersions: [{ name: 'v1.0' }],
          environment: 'Staging AWS',
          duedate: '2026-11-01',
          issuelinks: [{ type: { name: 'blocks' }, outwardIssue: { key: 'P-2' } }],
          subtasks: [{ key: 'P-1.1' }]
        }
      };

      const snap = canonicalizeIssueState(raw, '2026-10-28T12:00:00Z');
      const fieldIds = snap.fields.map(f => f.id);
      expect(fieldIds).toContain('priority');
      expect(fieldIds).toContain('components');
      expect(fieldIds).toContain('labels');
      expect(fieldIds).toContain('fixVersions');
      expect(fieldIds).toContain('environment');
      expect(fieldIds).toContain('duedate');
      expect(fieldIds).toContain('issuelinks');
      expect(fieldIds).toContain('subtasks');
    });

    it('handles empty lists and objects normalizing to null', () => {
      expect(canonicalizeValue([])).toBeNull();
      expect(canonicalizeValue({})).toBeNull();
      expect(canonicalizeValue('')).toBeNull();
      expect(canonicalizeValue({ emptyList: [] })).toBeNull();
      expect(canonicalizeValue([null, ''])).toBeNull();
      expect(canonicalizeValue([null, '   '])).toEqual(['   ']);
    });
  });
});


