import { IssueChecklistState, TransitionValidationResult } from '../domain/models';

export class TransitionValidator {
  /**
   * Evaluates if an issue satisfies Definition of Done requirements for workflow transition.
   */
  public static validate(state: IssueChecklistState | undefined): TransitionValidationResult {
    if (!state) {
      return {
        canTransition: false,
        reasons: ['Definition of Done checklist has not been initialized for this issue.'],
        incompleteMandatoryItems: []
      };
    }

    const incompleteMandatory = state.items.filter(item => item.isMandatory && !item.isCompleted);

    if (incompleteMandatory.length > 0) {
      const titles = incompleteMandatory.map(i => i.title);
      return {
        canTransition: false,
        reasons: [
          `Definition of Done incomplete: ${incompleteMandatory.length} mandatory item(s) must be satisfied before transition.`
        ],
        incompleteMandatoryItems: titles
      };
    }

    return {
      canTransition: true,
      reasons: [],
      incompleteMandatoryItems: []
    };
  }

  /**
   * Formats the validation result into the structure required by Jira Forge workflow validators.
   */
  public static toForgeValidatorResult(validation: TransitionValidationResult): { result: boolean; errorMessage?: string } {
    if (validation.canTransition) {
      return { result: true };
    }

    const itemsSummary = validation.incompleteMandatoryItems.length > 0
      ? ` Pending items: ${validation.incompleteMandatoryItems.join('; ')}`
      : '';

    return {
      result: false,
      errorMessage: `${validation.reasons.join(' ')}${itemsSummary}`
    };
  }
}
