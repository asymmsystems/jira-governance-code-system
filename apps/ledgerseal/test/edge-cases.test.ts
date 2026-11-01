import { canonicalizeIssueState, canonicalizeValue } from '../src/domain/canonicalizer';
import { analyzeTamperState } from '../src/domain/tamper-detector';
import { generateSealCertificate } from '../src/domain/crypto';
import { CanonicalIssueSnapshot, ElectronicSignature } from '../src/domain/models';

class EmptyStorage {
  async get(key: string) { return null; }
  async set(key: string, val: any) {}
  async delete(key: string) {}
}

describe('Edge Cases and Branch Coverage', () => {
  it('handles functions and symbols in canonicalizeValue returning null', () => {
    expect(canonicalizeValue(() => {})).toBeNull();
    expect(canonicalizeValue(Symbol('sym'))).toBeNull();
  });

  it('handles excluded fields like comment and worklog in canonicalizer', () => {
    const rawIssue = {
      id: '100',
      key: 'TEST-1',
      fields: {
        comment: { comments: [] },
        worklog: { worklogs: [] },
        summary: 'Test issue'
      }
    };
    const snapshot = canonicalizeIssueState(rawIssue, '2026-10-28T00:00:00Z');
    expect(snapshot.fields.some(f => f.id === 'comment')).toBe(false);
    expect(snapshot.fields.some(f => f.id === 'worklog')).toBe(false);
  });

  it('handles field deletion in live snapshot where field existed in sealed state', () => {
    const baseSnapshot: CanonicalIssueSnapshot = {
      issueId: '1',
      issueKey: 'T-1',
      projectKey: 'T',
      issueType: 'Bug',
      status: 'Open',
      fields: [
        { id: 'custom_1', name: 'Custom One', type: 'string', value: 'Value 1' },
        { id: 'custom_2', name: 'Custom Two', type: 'string', value: 'Value 2' }
      ],
      attachments: [],
      capturedAt: '2026-10-28T00:00:00Z'
    };

    const sig: ElectronicSignature = {
      signerAccountId: '1',
      signerDisplayName: 'Lead',
      signedAt: '2026-10-28T00:00:00Z',
      meaning: 'Approve',
      reasonCode: 'APPROVAL',
      declarationText: 'Legal statement'
    };

    const cert = generateSealCertificate(baseSnapshot, sig);

    // Live snapshot is missing custom_2 completely
    const liveSnapshot: CanonicalIssueSnapshot = {
      ...baseSnapshot,
      fields: [
        { id: 'custom_1', name: 'Custom One', type: 'string', value: 'Value 1' }
      ]
    };

    const analysis = analyzeTamperState(cert, liveSnapshot, '2026-10-28T00:05:00Z');
    expect(analysis.status).toBe('SEAL_BROKEN');
    expect(analysis.tamperedFields.some(f => f.fieldId === 'custom_2' && f.liveValue === null)).toBe(true);
  });

  describe('Canonicalizer entity normalisation', () => {
    it('covers issuelinks, subtasks, priority, labels, components, and undefined values in canonicalizer', () => {
      const complexIssue = {
        id: '2000',
        key: 'PROJ-2000',
        fields: {
          summary: 'Complex summary',
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Hello   world' }]
              }
            ]
          },
          priority: { name: 'High' },
          labels: ['backend', 'security'],
          components: [{ name: 'Auth' }, { name: 'Audit' }],
          assignee: { accountId: 'acc-123', displayName: 'Jane Doe' },
          issuelinks: [
            { type: { name: 'blocks' }, outwardIssue: { key: 'PROJ-2' } },
            { type: { name: 'relates' }, inwardIssue: { key: 'PROJ-1' } }
          ],
          subtasks: [
            { key: 'PROJ-2002' },
            { id: 'sub-2001' }
          ],
          customfield_null: null,
          customfield_undef: undefined
        }
      };

      const snapshot = canonicalizeIssueState(complexIssue, '2026-10-29T10:00:00Z');
      expect(snapshot.fields.some(f => f.name === 'Priority')).toBe(true);
      expect(snapshot.fields.some(f => f.name === 'Labels')).toBe(true);
      expect(snapshot.fields.some(f => f.name === 'Components')).toBe(true);
      expect(snapshot.fields.some(f => f.name === 'Assignee')).toBe(true);
      expect(snapshot.fields.some(f => f.name === 'Linked Issues')).toBe(true);
      expect(snapshot.fields.some(f => f.name === 'Subtasks')).toBe(true);
      expect(snapshot.fields.some(f => f.id === 'customfield_null')).toBe(false);
      expect(snapshot.fields.some(f => f.id === 'customfield_undef')).toBe(false);
    });

  });
});
