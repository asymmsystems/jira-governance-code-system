/**
 * Settings page editor logic (B-06).
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { itemIdFor, editorFromTemplate, addItem, removeItem, updateItem, moveItem, toTemplatePayload, setWaiverPermission, waiverPermissionOptions, CATEGORY_OPTIONS, PERMISSION_OPTIONS, WAIVER_PERMISSION_OPTIONS, DEFAULT_WAIVER_PERMISSION } from '../../src/ui/template-editor';
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
    expect(editorFromTemplate()).toEqual({ name: '', description: '', waiverPermission: 'ADMINISTER_PROJECTS', items: [] });
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

  it('DG-1: the editor keeps the template\'s waiver permission, and the payload always sends it', () => {
    const e = editorFromTemplate({ ...BUG_DEFINITION_OF_DONE, waiverPermission: 'RESOLVE_ISSUES' });
    expect(e.waiverPermission).toBe('RESOLVE_ISSUES');
    expect(toTemplatePayload(e).waiverPermission).toBe('RESOLVE_ISSUES');
    // A template with no stored value shows and sends the default.
    expect(toTemplatePayload(editorFromTemplate(BUG_DEFINITION_OF_DONE)).waiverPermission).toBe(DEFAULT_WAIVER_PERMISSION);
    expect(toTemplatePayload({ ...e, waiverPermission: '' }).waiverPermission).toBe(DEFAULT_WAIVER_PERMISSION);
    expect(setWaiverPermission(e, 'TRANSITION_ISSUES').waiverPermission).toBe('TRANSITION_ISSUES');
    expect(setWaiverPermission(e, '').waiverPermission).toBe(DEFAULT_WAIVER_PERMISSION);
  });

  it('DG-1: waiver choices start with the default, accept only valid keys, and keep a saved key that is not listed', () => {
    expect(WAIVER_PERMISSION_OPTIONS[0]).toEqual({ label: 'Administer projects (default)', value: 'ADMINISTER_PROJECTS' });
    expect(WAIVER_PERMISSION_OPTIONS.map(o => o.value)).toEqual(['ADMINISTER_PROJECTS', 'RESOLVE_ISSUES', 'TRANSITION_ISSUES']);
    for (const o of WAIVER_PERMISSION_OPTIONS) {
      expect(validateTemplate({ name: 'n', waiverPermission: o.value, items: [{ id: 'a', title: 'a', isMandatory: true, category: 'TESTING' }] })).toEqual([]);
    }
    expect(waiverPermissionOptions('RESOLVE_ISSUES')).toBe(WAIVER_PERMISSION_OPTIONS);
    expect(waiverPermissionOptions('')).toBe(WAIVER_PERMISSION_OPTIONS);
    expect(waiverPermissionOptions('SCHEDULE_ISSUES').slice(-1)).toEqual([{ label: 'Schedule issues', value: 'SCHEDULE_ISSUES' }]);
  });
});
