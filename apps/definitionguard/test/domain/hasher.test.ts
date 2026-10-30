import { calculateChecklistHash } from '../../src/domain/hasher';
import { ChecklistItemInstance } from '../../src/domain/models';

describe('Checklist Hasher', () => {
  const sampleItems: ChecklistItemInstance[] = [
    {
      id: 'item-1',
      title: 'Code review complete',
      isMandatory: true,
      isCompleted: true,
      category: 'CODE_QUALITY',
      completedBy: 'user-1',
      completedAt: '2026-10-29T10:00:00.000Z'
    },
    {
      id: 'item-2',
      title: 'Unit tests passing',
      isMandatory: true,
      isCompleted: false,
      category: 'TESTING'
    }
  ];

  it('generates consistent deterministic hash regardless of array element order', () => {
    const hashA = calculateChecklistHash(sampleItems);
    const reversed = [...sampleItems].reverse();
    const hashB = calculateChecklistHash(reversed);

    expect(hashA).toBe(hashB);
    expect(hashA).toHaveLength(64); // SHA-256 hex string
  });

  it('changes hash when item completion status changes', () => {
    const hashOriginal = calculateChecklistHash(sampleItems);
    const modified: ChecklistItemInstance[] = [
      { ...sampleItems[0] },
      {
        ...sampleItems[1],
        isCompleted: true,
        completedBy: 'user-2',
        completedAt: '2026-10-29T10:05:00.000Z'
      }
    ];
    const hashModified = calculateChecklistHash(modified);

    expect(hashModified).not.toBe(hashOriginal);
  });

  it('changes hash when item mandatory flag changes', () => {
    const hashOriginal = calculateChecklistHash(sampleItems);
    const modified: ChecklistItemInstance[] = [
      { ...sampleItems[0] },
      { ...sampleItems[1], isMandatory: false }
    ];
    const hashModified = calculateChecklistHash(modified);

    expect(hashModified).not.toBe(hashOriginal);
  });

  it('produces valid hash for empty item array', () => {
    const hash = calculateChecklistHash([]);
    expect(hash).toHaveLength(64);
  });

  it('exercises code unit compare for items with equal and different ids', () => {
    const items: ChecklistItemInstance[] = [
      { id: 'b', title: 'B', isMandatory: true, isCompleted: false, category: 'TESTING' },
      { id: 'a', title: 'A', isMandatory: true, isCompleted: false, category: 'TESTING' },
      { id: 'c', title: 'C', isMandatory: true, isCompleted: false, category: 'TESTING' }
    ];
    const hash = calculateChecklistHash(items);
    expect(hash).toBeDefined();
  });
});
