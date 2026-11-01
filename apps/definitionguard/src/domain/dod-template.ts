/**
 * Conversion between the template payload the settings page edits and the stored DodTemplate.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * The settings payload (name, items with id, title, isMandatory, category, evidenceRequired,
 * notAssignee, requiredPermission) is a frozen contract (spec v3 section 8). The stored form is a
 * DOD_TEMPLATE WorkEffort with DOD_CRITERION children (spec v3 section 3).
 */
import { ChecklistTemplate, DodTemplate, TemplateCriterion } from './models';
import { DEFAULT_WAIVER_ROLE, permissionKeyOf, roleOfPermission } from './roles';

export function toDodTemplate(t: ChecklistTemplate, workEffortId: string = t.id): DodTemplate {
  return {
    workEffortId,
    workEffortTypeId: 'DOD_TEMPLATE',
    workEffortName: t.name,
    description: t.description || '',
    revisionNumber: t.version || 1,
    waiverRoleTypeId: t.waiverPermission ? roleOfPermission(t.waiverPermission) : DEFAULT_WAIVER_ROLE,
    criteria: t.items.map((i, idx) => {
      const c: TemplateCriterion = {
        templateItemId: i.id,
        workEffortName: i.title,
        sequenceNum: idx + 1,
        purposeTypeId: i.category,
        isMandatory: i.isMandatory,
        evidenceRequired: Boolean(i.evidenceRequired)
      };
      if (i.description) c.description = i.description;
      if (i.requiredPermission) c.requiredRoleTypeId = roleOfPermission(i.requiredPermission);
      if (i.notAssignee) c.excludedRoleTypeId = 'ASSIGNEE';
      return c;
    })
  };
}

/** The settings-page view of a stored template (the frozen payload shape). */
export function toTemplateView(t: DodTemplate): ChecklistTemplate {
  const view: ChecklistTemplate = {
    id: t.workEffortId,
    name: t.workEffortName,
    description: t.description,
    version: t.revisionNumber,
    items: [...t.criteria].sort((a, b) => a.sequenceNum - b.sequenceNum).map(c => {
      const item: any = { id: c.templateItemId, title: c.workEffortName, isMandatory: c.isMandatory, category: c.purposeTypeId };
      if (c.description) item.description = c.description;
      if (c.evidenceRequired) item.evidenceRequired = true;
      if (c.excludedRoleTypeId === 'ASSIGNEE') item.notAssignee = true;
      if (c.requiredRoleTypeId) item.requiredPermission = permissionKeyOf(c.requiredRoleTypeId);
      return item;
    })
  };
  if (t.waiverRoleTypeId !== DEFAULT_WAIVER_ROLE) view.waiverPermission = permissionKeyOf(t.waiverRoleTypeId);
  return view;
}
