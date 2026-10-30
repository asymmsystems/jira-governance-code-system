import { TransitionValidator } from '../../src/validator/transition-validator';
import { IssueChecklistState } from '../../src/domain/models';

describe('TransitionValidator', () => {
  it('blocks transition when checklist state is undefined', () => {
    const result = TransitionValidator.validate(undefined);

    expect(result.canTransition).toBe(false);
    expect(result.reasons[0]).toContain('has not been initialized');
    expect(result.incompleteMandatoryItems).toHaveLength(0);

    const forgeResult = TransitionValidator.toForgeValidatorResult(result);
    expect(forgeResult.result).toBe(false);
    expect(forgeResult.errorMessage).toContain('has not been initialized');
  });

  it('blocks transition when mandatory items remain uncompleted', () => {
    const state: IssueChecklistState = {
      issueId: '101',
      issueKey: 'PROJ-101',
      items: [
        {
          id: 'item-1',
          title: 'Mandatory Unit Tests',
          isMandatory: true,
          isCompleted: false,
          category: 'TESTING'
        },
        {
          id: 'item-2',
          title: 'Optional Docs',
          isMandatory: false,
          isCompleted: false,
          category: 'DOCUMENTATION'
        }
      ],
      lastModifiedAt: '2026-10-29T10:00:00Z',
      lastModifiedBy: 'user',
      isFullySatisfied: false,
      checklistHash: 'hash'
    };

    const result = TransitionValidator.validate(state);

    expect(result.canTransition).toBe(false);
    expect(result.incompleteMandatoryItems).toEqual(['Mandatory Unit Tests']);
    expect(result.reasons[0]).toContain('1 mandatory item(s) must be satisfied');

    const forgeResult = TransitionValidator.toForgeValidatorResult(result);
    expect(forgeResult.result).toBe(false);
    expect(forgeResult.errorMessage).toContain('Pending items: Mandatory Unit Tests');
  });

  it('allows transition when all mandatory items are completed, even if optional items are incomplete', () => {
    const state: IssueChecklistState = {
      issueId: '102',
      issueKey: 'PROJ-102',
      items: [
        {
          id: 'item-1',
          title: 'Mandatory Security Review',
          isMandatory: true,
          isCompleted: true,
          category: 'SECURITY',
          completedBy: 'sec-lead'
        },
        {
          id: 'item-2',
          title: 'Optional Wiki Update',
          isMandatory: false,
          isCompleted: false,
          category: 'DOCUMENTATION'
        }
      ],
      lastModifiedAt: '2026-10-29T10:00:00Z',
      lastModifiedBy: 'sec-lead',
      isFullySatisfied: true,
      checklistHash: 'hash'
    };

    const result = TransitionValidator.validate(state);

    expect(result.canTransition).toBe(true);
    expect(result.reasons).toHaveLength(0);
    expect(result.incompleteMandatoryItems).toHaveLength(0);

    const forgeResult = TransitionValidator.toForgeValidatorResult(result);
    expect(forgeResult.result).toBe(true);
    expect(forgeResult.errorMessage).toBeUndefined();
  });
});
