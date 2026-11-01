/**
 * B-13: the panel view model. The UI file renders this and nothing else.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import * as fs from 'fs';
import * as path from 'path';
import { buildPanelViewModel, formatLocal, panelErrorText } from '../../src/ui/panel-view-model';
import { IssueChecklistState } from '../../src/domain/models';

const T = '2026-11-01T09:30:00.000Z';
const fmt = (iso?: string) => formatLocal(iso, 'en-GB', 'UTC');
const vmOf = (r: IssueChecklistState) => buildPanelViewModel(r, fmt)!;

function response(over: Partial<IssueChecklistState> = {}): IssueChecklistState {
  return {
    issueId: '1', issueKey: 'DEMO-1', templateId: 't',
    items: [
      { id: 'a', title: 'Peer review approved', isMandatory: true, category: 'CODE_QUALITY', isCompleted: false },
      { id: 'b', title: 'Docs updated', isMandatory: false, category: 'DOCUMENTATION', isCompleted: true, completedByAccountId: '712020:bob', completedAt: T, hasEvidence: true },
      { id: 'c', title: 'Security scan clear', isMandatory: true, category: 'SECURITY', isCompleted: true, waived: true, completedByAccountId: '712020:lead', completedAt: T },
      { id: 'd', title: 'Release sign-off', isMandatory: true, category: 'COMPLIANCE', isCompleted: false, evidenceRequired: true }
    ],
    lastModifiedAt: T, lastModifiedBy: '712020:bob',
    isFullySatisfied: false,
    openMandatoryTitles: ['Peer review approved', 'Release sign-off'],
    checklistHash: 'f'.repeat(64),
    stateVersion: 7,
    ...over
  } as IssueChecklistState;
}

describe('B-13 buildPanelViewModel', () => {
  it('builds the status from the gate rule, with a blocked lozenge in the ADS danger colour', () => {
    const vm = vmOf(response());
    expect(vm.status).toMatchObject({ satisfied: false, title: 'Definition of Done incomplete', appearance: 'warning', lozenge: { text: 'Blocked', appearance: 'removed' } });
    expect(vm.status.body).toBe('Moving to Done is blocked while these items are open: Peer review approved, Release sign-off.');
  });

  it('uses the success colour when satisfied', () => {
    const vm = vmOf(response({ isFullySatisfied: true, openMandatoryTitles: [] }));
    expect(vm.status).toMatchObject({ satisfied: true, appearance: 'success', lozenge: { text: 'Ready for Done', appearance: 'success' } });
  });

  it('gives each checkbox an accessible name with mandatory or optional and its state', () => {
    const vm = vmOf(response());
    expect(vm.items.map(i => i.label)).toEqual([
      'Peer review approved (mandatory, open)',
      'Docs updated (optional, done)',
      'Security scan clear (mandatory, waived)',
      'Release sign-off (mandatory, open, needs evidence)'
    ]);
  });

  it('never uses the yellow "moved" lozenge for mandatory, and marks state in text', () => {
    const vm = vmOf(response());
    for (const i of vm.items) expect(i.lozenges.map(l => l.appearance)).not.toContain('moved');
    expect(vm.items[0].lozenges).toEqual([{ text: 'Mandatory', appearance: 'default' }]);
    expect(vm.items[2].lozenges).toEqual([{ text: 'Mandatory', appearance: 'default' }, { text: 'Waived', appearance: 'inprogress' }]);
    expect(vm.items[3].lozenges).toEqual([{ text: 'Mandatory', appearance: 'default' }, { text: 'Needs evidence', appearance: 'new' }]);
    expect(vm.items[1].lozenges).toEqual([{ text: 'Optional', appearance: 'default' }, { text: 'Evidence attached', appearance: 'success' }]);
  });

  it('shows who and when, in local time, and offers the right actions', () => {
    const vm = vmOf(response());
    expect(vm.items[1]).toMatchObject({ checked: true, attribution: { kind: 'user', accountId: '712020:bob' }, when: '1 Nov 2026, 09:30', canShowEvidence: true, canWaive: false, canAddEvidence: false });
    expect(vm.items[2].doneText).toBe('Waived by');
    expect(vm.items[1].doneText).toBe('Completed by');
    expect(vm.items[0]).toMatchObject({ checked: false, canWaive: true, canAddEvidence: true, canShowEvidence: false });
    expect(vm.items[3]).toMatchObject({ canAddEvidence: false, needsEvidence: true });
  });

  it('shows progress without internal version, hash or ticket codes', () => {
    const vm = vmOf(response());
    expect(vm.progress).toEqual({ text: '2 of 4 done', appearance: 'default' });
    const all = JSON.stringify(vm);
    expect(all).not.toMatch(/\bv7\b|D-13|ffffffffffffffff/);
    expect(vmOf(response({ items: response().items.map(i => ({ ...i, isCompleted: true })) })).progress.appearance).toBe('success');
    expect(vmOf(response({ items: [] })).progress).toEqual({ text: '0 of 0 done', appearance: 'default' });
  });

  it('builds an empty model when there is no checklist yet', () => {
    expect(buildPanelViewModel(null, fmt)).toBeNull();
  });
});

describe('B-13 formatLocal', () => {
  it('formats in the viewer locale and time zone, and passes unparseable text through', () => {
    expect(fmt(T)).toBe('1 Nov 2026, 09:30');
    expect(formatLocal(T, 'en-US', 'UTC')).toBe('Nov 1, 2026, 9:30 AM');
    expect(fmt('not a date')).toBe('not a date');
    expect(fmt(undefined)).toBe('');
    expect(formatLocal(T)).toBeTruthy();
  });
});

describe('B-13 panelErrorText', () => {
  it('shows our own messages, which carry a next step', () => {
    for (const m of [
      'You need Edit issues permission to change this checklist.',
      'Only a project admin can reset this checklist.',
      'Someone else changed this checklist. Refresh and try again.',
      'Add a link or a note. This item needs evidence before it counts as done.',
      'The assignee cannot complete this item. Ask a reviewer.',
      'Your DefinitionGuard licence is not active. Ask your Jira admin.',
      'Give a reason of 10 to 500 characters for the waiver.',
      'You need the Resolve issues Jira permission to complete this item.',
      'Only users with the Administer projects Jira permission can waive this item.',
      'The evidence link must start with http:// or https://.',
      'Item 3 needs a title.',
      'Only Done-category statuses of this project can be exempt.'
    ]) {
      expect(panelErrorText({ message: m }, 'save the change')).toBe(m);
    }
  });

  it('never shows raw platform text; gives a generic next step instead', () => {
    expect(panelErrorText({ message: 'TypeError: cannot read properties of undefined' }, 'save the change'))
      .toBe('DefinitionGuard could not save the change. Refresh the page and try again. If it keeps failing, ask your Jira admin.');
    expect(panelErrorText(undefined, 'load the checklist')).toContain('could not load the checklist.');
    expect(panelErrorText('plain string', 'load the history')).toContain('could not load the history.');
  });
});

describe('B-13 the panel UI only renders', () => {
  it('no UI text field is controlled (a controlled UI Kit Textfield loses keystrokes, seen live)', () => {
    for (const f of ['index.tsx', 'settings.tsx']) {
      const src = fs.readFileSync(path.join(__dirname, '../../src/frontend', f), 'utf8');
      const fields = src.split('<Textfield').slice(1).map(x => x.slice(0, x.indexOf('/>')));
      expect(fields.length).toBeGreaterThan(0);
      for (const field of fields) expect(field).not.toMatch(/\svalue=\{/);
    }
  });

  it('settings.tsx shows no raw err.message either', () => {
    expect(fs.readFileSync(path.join(__dirname, '../../src/frontend/settings.tsx'), 'utf8')).not.toMatch(/err\??\.message/);
  });

  it('index.tsx has no raw err.message, no internal codes and no gate rule of its own', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../src/frontend/index.tsx'), 'utf8');
    expect(src).not.toMatch(/err\??\.message/);
    expect(src).not.toMatch(/D-13|stateVersion|checklistHash|isMandatory\)|filter\(i => i\.isMandatory/);
    expect(src).toContain('buildPanelViewModel');
  });
});
