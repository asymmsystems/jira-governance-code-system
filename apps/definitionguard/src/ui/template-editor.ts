/**
 * Pure editor logic for the project settings page. No UI and no Forge calls, so it is unit-tested.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { ChecklistCategory, ChecklistTemplate, ChecklistItemTemplate } from '../domain/models';

export const CATEGORY_OPTIONS: Array<{ label: string; value: ChecklistCategory }> = [
  { label: 'Testing', value: 'TESTING' },
  { label: 'Code quality', value: 'CODE_QUALITY' },
  { label: 'Security', value: 'SECURITY' },
  { label: 'Compliance', value: 'COMPLIANCE' },
  { label: 'Documentation', value: 'DOCUMENTATION' }
];

/** Extra Jira permission an item can require, besides Edit issues. '' means none. */
export const PERMISSION_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'No extra permission', value: '' },
  { label: 'Resolve issues', value: 'RESOLVE_ISSUES' },
  { label: 'Transition issues', value: 'TRANSITION_ISSUES' },
  { label: 'Administer projects', value: 'ADMINISTER_PROJECTS' }
];

/** The Jira permission that lets a user waive an item, when that user is not an approver. */
export const DEFAULT_WAIVER_PERMISSION = 'ADMINISTER_PROJECTS';

/**
 * Waiver permission choices: the permission keys the item choices offer (a waiver always needs one,
 * so "No extra permission" is not a choice). Administer projects is the default.
 */
export const WAIVER_PERMISSION_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'Administer projects (default)', value: DEFAULT_WAIVER_PERMISSION },
  ...PERMISSION_OPTIONS.filter(o => o.value !== '' && o.value !== DEFAULT_WAIVER_PERMISSION)
];

/**
 * The choices for one template. A saved permission that is not in the list (set before this page
 * offered the choice) is added with its key in plain words, so the page shows it and a save keeps it.
 */
export function waiverPermissionOptions(current: string): Array<{ label: string; value: string }> {
  if (!current || WAIVER_PERMISSION_OPTIONS.some(o => o.value === current)) return WAIVER_PERMISSION_OPTIONS;
  const words = current.toLowerCase().split('_').join(' ');
  return [...WAIVER_PERMISSION_OPTIONS, { label: words.charAt(0).toUpperCase() + words.slice(1), value: current }];
}

export interface EditorItem extends ChecklistItemTemplate {
  key: string; // stable React key, not saved
}

export interface EditorState {
  name: string;
  description: string;
  /** Jira permission key of the template's waiver permission; always sent, so a save never resets it (DG-1). */
  waiverPermission: string;
  items: EditorItem[];
}

let counter = 0;
const newKey = () => `row-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** A free id derived from the title: lower case, letters and digits joined by "-", unique in the list. */
export function itemIdFor(title: string, taken: string[]): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 56) || 'item';
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
}

export function editorFromTemplate(t?: ChecklistTemplate): EditorState {
  if (!t) return { name: '', description: '', waiverPermission: DEFAULT_WAIVER_PERMISSION, items: [] };
  return {
    name: t.name,
    description: t.description || '',
    waiverPermission: t.waiverPermission || DEFAULT_WAIVER_PERMISSION,
    items: t.items.map(i => ({ ...i, key: newKey() }))
  };
}

export function addItem(state: EditorState, title: string): EditorState {
  const id = itemIdFor(title, state.items.map(i => i.id));
  return { ...state, items: [...state.items, { key: newKey(), id, title, isMandatory: true, category: 'TESTING' }] };
}

export function removeItem(state: EditorState, key: string): EditorState {
  return { ...state, items: state.items.filter(i => i.key !== key) };
}

export function updateItem(state: EditorState, key: string, patch: Partial<ChecklistItemTemplate>): EditorState {
  return { ...state, items: state.items.map(i => (i.key === key ? { ...i, ...patch } : i)) };
}

export function setWaiverPermission(state: EditorState, value: string): EditorState {
  return { ...state, waiverPermission: value || DEFAULT_WAIVER_PERMISSION };
}

export function moveItem(state: EditorState, key: string, delta: -1 | 1): EditorState {
  const idx = state.items.findIndex(i => i.key === key);
  const to = idx + delta;
  if (idx < 0 || to < 0 || to >= state.items.length) return state;
  const items = state.items.slice();
  [items[idx], items[to]] = [items[to], items[idx]];
  return { ...state, items };
}

/** The template payload for saveTemplate: the editor keys are dropped, empty optional fields are left out. */
export function toTemplatePayload(state: EditorState) {
  return {
    name: state.name,
    description: state.description,
    waiverPermission: state.waiverPermission || DEFAULT_WAIVER_PERMISSION,
    items: state.items.map(({ key: _key, ...item }) => {
      const out: any = { id: item.id, title: item.title, isMandatory: item.isMandatory, category: item.category };
      if (item.description) out.description = item.description;
      if (item.evidenceRequired) out.evidenceRequired = true;
      if (item.notAssignee) out.notAssignee = true;
      if (item.requiredPermission) out.requiredPermission = item.requiredPermission;
      return out;
    })
  };
}
