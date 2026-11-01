/**
 * Project templates: validation, storage and resolution for every initialisation path.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 *
 * Key: dg:tmpl:<projectId>:<issueTypeId>. Ids, not keys or names, so a rename keeps the template.
 */
import { StorageProvider } from '../storage/checklist-repository';
import { getTemplateForCategory } from '../domain/checklist-engine';
import { ChecklistCategory, ChecklistTemplate, ChecklistItemTemplate } from '../domain/models';

export const MAX_TEMPLATE_BYTES = 32 * 1024;
export const MAX_ITEMS = 50;

export const templateKey = (projectId: string, issueTypeId: string) => `dg:tmpl:${projectId}:${issueTypeId}`;

export interface StoredTemplate extends ChecklistTemplate {
  version: number;
  projectId: string;
  issueTypeId: string;
  updatedAt: string;
  updatedByAccountId: string;
}

const CATEGORIES: ChecklistCategory[] = ['CODE_QUALITY', 'SECURITY', 'TESTING', 'COMPLIANCE', 'DOCUMENTATION'];
const ITEM_FIELDS = new Set(['id', 'title', 'description', 'isMandatory', 'category', 'evidenceRequired', 'requiredPermission', 'notAssignee']);
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const PERMISSION_PATTERN = /^[A-Z_]{1,64}$/;

/** Returns every problem with the template, each naming the field. An empty list means valid. */
export function validateTemplate(input: any): string[] {
  if (!input || typeof input !== 'object') return ['The template is missing.'];
  const errors: string[] = [];
  if (typeof input.name !== 'string' || input.name.trim().length === 0 || input.name.length > 100) {
    errors.push('The template needs a name.');
  }
  if (input.description !== undefined && (typeof input.description !== 'string' || input.description.length > 500)) {
    errors.push('The template description must be text of 500 characters or less.');
  }
  if (input.waiverPermission !== undefined && (typeof input.waiverPermission !== 'string' || !PERMISSION_PATTERN.test(input.waiverPermission))) {
    errors.push('The waiver permission must be a Jira permission key.');
  }
  const items = input.items;
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_ITEMS) {
    errors.push(`A template needs 1 to ${MAX_ITEMS} items.`);
    return errors;
  }
  const seen = new Set<string>();
  items.forEach((item: any, idx: number) => {
    const n = idx + 1;
    if (!item || typeof item !== 'object') {
      errors.push(`Item ${n} is missing.`);
      return;
    }
    for (const field of Object.keys(item)) {
      if (!ITEM_FIELDS.has(field)) errors.push(`Item ${n} has an unknown field "${field}".`);
    }
    if (typeof item.id !== 'string' || !ID_PATTERN.test(item.id)) {
      errors.push(`Item ${n} id may use only letters, digits, - and _ (1 to 64 characters).`);
    } else if (seen.has(item.id)) {
      errors.push(`Item ${n} uses the id "${item.id}" twice.`);
    } else {
      seen.add(item.id);
    }
    if (typeof item.title !== 'string' || item.title.trim().length === 0) {
      errors.push(`Item ${n} needs a title.`);
    } else if (item.title.length > 200) {
      errors.push(`Item ${n} title is longer than 200 characters.`);
    }
    if (item.description !== undefined && (typeof item.description !== 'string' || item.description.length > 500)) {
      errors.push(`Item ${n} description must be text of 500 characters or less.`);
    }
    if (typeof item.isMandatory !== 'boolean') errors.push(`Item ${n} must say whether it is mandatory.`);
    if (!CATEGORIES.includes(item.category)) errors.push(`Item ${n} has an unknown category.`);
    for (const flag of ['evidenceRequired', 'notAssignee']) {
      if (item[flag] !== undefined && typeof item[flag] !== 'boolean') errors.push(`Item ${n} ${flag} must be true or false.`);
    }
    if (item.requiredPermission !== undefined && (typeof item.requiredPermission !== 'string' || !PERMISSION_PATTERN.test(item.requiredPermission))) {
      errors.push(`Item ${n} required permission must be a Jira permission key.`);
    }
  });
  if (Buffer.byteLength(JSON.stringify(input), 'utf8') > MAX_TEMPLATE_BYTES) {
    errors.push(`The template is larger than ${MAX_TEMPLATE_BYTES / 1024} KiB.`);
  }
  return errors;
}

function normaliseItem(item: any): ChecklistItemTemplate {
  const out: any = { id: item.id, title: item.title.trim(), isMandatory: item.isMandatory, category: item.category };
  if (item.description) out.description = item.description;
  if (item.evidenceRequired) out.evidenceRequired = true;
  if (item.notAssignee) out.notAssignee = true;
  if (item.requiredPermission) out.requiredPermission = item.requiredPermission;
  return out;
}

export class TemplateStore {
  constructor(private readonly storage: StorageProvider) {}

  public async get(projectId: string, issueTypeId: string): Promise<StoredTemplate | undefined> {
    if (!projectId || !issueTypeId) return undefined;
    return await this.storage.get<StoredTemplate>(templateKey(projectId, issueTypeId));
  }

  /** Validates, then saves with version + 1. Throws with every problem when invalid. */
  public async save(projectId: string, issueTypeId: string, input: any, actorAccountId: string): Promise<StoredTemplate> {
    const errors = validateTemplate(input);
    if (errors.length > 0) throw new Error(errors.join(' '));
    const previous = await this.get(projectId, issueTypeId);
    const saved: StoredTemplate = {
      id: `project-${projectId}-${issueTypeId}`,
      name: input.name.trim(),
      description: input.description || '',
      items: input.items.map(normaliseItem),
      version: (previous?.version || 0) + 1,
      projectId,
      issueTypeId,
      updatedAt: new Date().toISOString(),
      updatedByAccountId: actorAccountId
    };
    if (input.waiverPermission) saved.waiverPermission = input.waiverPermission;
    await this.storage.set(templateKey(projectId, issueTypeId), saved);
    return saved;
  }
}

/**
 * The template for an issue: the project template for its issue type when one is saved,
 * else the built-in template matched on the issue type name.
 */
export async function resolveTemplate(
  storage: StorageProvider,
  projectId: string,
  issueTypeId: string,
  issueTypeName?: string
): Promise<ChecklistTemplate> {
  const custom = await new TemplateStore(storage).get(projectId, issueTypeId);
  return custom || getTemplateForCategory(issueTypeName);
}
