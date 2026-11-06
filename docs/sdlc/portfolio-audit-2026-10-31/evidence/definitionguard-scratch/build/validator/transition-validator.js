"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransitionValidator = void 0;
class TransitionValidator {
    /**
     * Evaluates if an issue satisfies Definition of Done requirements for workflow transition.
     */
    static validate(state) {
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
    static toForgeValidatorResult(validation) {
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
exports.TransitionValidator = TransitionValidator;
