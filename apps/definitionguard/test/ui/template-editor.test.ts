/**
 * Settings page editor logic (B-06).
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { itemIdFor, editorFromTemplate, addItem, removeItem, updateItem, moveItem, toTemplatePayload, CATEGORY_OPTIONS, PERMISSION_OPTIONS } from '../../src/ui/template-editor';
import { validateTemplate } from '../../src/settings/template-store';
import { BUG_DEFINITION_OF_DONE } from '../../src/domain/checklist-engine';

describe('template editor', () => {
  it('derives a unique id from the title', () => {
    expect(itemIdFor('Security sign-off!', [])).toBe('security-sign-off');
    expect(itemIdFor('Security sign-off', ['security-sign-off'])).toBe('security-sign-off-2');
    expect(itemIdFor('Security sign-off', ['security-sign-off', 'security-sign-off-2'])).toBe('security-sign-off-3');
    expect(itemIdFor('!!!', [])).toBe('item');
  });

  it('starts empty, or from a template', () => {
    expect(editorFromTemplate()).toEqual({ name: '', description: '', items: [] });
    const e = editorFromTemplate(BUG_DEFINITION_OF_DONE);
    expect(e.items.map(i => i.id)).toEqual(BUG_DEFINITION_OF_DONE.items.map(i => i.id));
    expect(new Set(e.items.map(i => i.key)).size).toBe(e.items.length);
    expect(editorFromTemplate({ ...BUG_DEFINITION_OF_DONE, description: undefined as any }).description).toBe('');
  });

  it('adds a mandatory item, updates, moves and removes it', () => {
    let e = addItem(editorFromTemplate(), 'Peer review');
    e = addItem(e, 'Docs');
    expect(e.items.map(i => i.id)).toEqual(['peer-review', 'docs']);
    expect(e.items[0]).toMatchObject({ isMandatory: true, category: 'TESTING' });
    e = updateItem(e, e.items[1].key, { isMandatory: false });
    expect(e.items[1].isMandatory).toBe(false);
    e = moveItem(e, e.items[1].key, -1);
    expect(e.items.map(i => i.id)).toEqual(['docs', 'peer-review']);
    expect(moveItem(e, e.items[0].key, -1)).toBe(e);
    expect(moveItem(e, 'no-such-key', 1)).toBe(e);
    e = removeItem(e, e.items[0].key);
    expect(e.items.map(i => i.id)).toEqual(['peer-review']);
  });

  it('builds a payload that passes validation, with editor keys dropped and flags kept', () => {
    let e = { ...addItem(editorFromTemplate(), 'Peer review'), name: 'Team DoD' };
    e = updateItem(e, e.items[0].key, { evidenceRequired: true, notAssignee: true, requiredPermission: 'RESOLVE_ISSUES', description: 'PR link' });
    const payload = toTemplatePayload(e);
    expect(payload.items[0]).toEqual({ id: 'peer-review', title: 'Peer review', isMandatory: true, category: 'TESTING', description: 'PR link', evidenceRequired: true, notAssignee: true, requiredPermission: 'RESOLVE_ISSUES' });
    expect(validateTemplate(payload)).toEqual([]);
  });

  it('offers only permission keys the validator accepts', () => {
    for (const o of PERMISSION_OPTIONS.filter(x => x.value)) {
      expect(validateTemplate({ name: 'n', items: [{ id: 'a', title: 'a', isMandatory: true, category: 'TESTING', requiredPermission: o.value }] })).toEqual([]);
    }
  });

  it('offers every category the validator accepts', () => {
    expect(CATEGORY_OPTIONS.map(o => o.value).sort()).toEqual(['CODE_QUALITY', 'COMPLIANCE', 'DOCUMENTATION', 'SECURITY', 'TESTING']);
  });
});
