/**
 * Pure view model for the issue panel. No UI and no Forge calls, so it is unit-tested.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
import { IssueChecklistState, ItemState, ChecklistAuditEvent } from '../domain/models';

/** Who completed an item, for rendering: a Jira user from the accountId, or v1 text. */
export type Attribution = { kind: 'user'; accountId: string } | { kind: 'text'; text: string };

/**
 * The panel renders `user` with the UI Kit User component, so names are resolved at view time
 * and never stored. A v1 display name is shown as text only when no accountId was recorded.
 */
export function attributionOf(item: Pick<ItemState, 'byAccountId' | 'legacyName'>): Attribution | undefined {
  if (item.byAccountId) return { kind: 'user', accountId: item.byAccountId };
  if (item.legacyName) return { kind: 'text', text: item.legacyName };
  return undefined;
}

export interface GateStatusText {
  satisfied: boolean;
  title: string;
  body: string;
  scope?: string;
}

/**
 * The panel status, from the same gate rule the validator uses (isFullySatisfied and
 * openMandatoryTitles come from evaluateGate). It never claims a block: whether a move is
 * blocked depends on the workflow, so the scope line says where the gate applies.
 */
export function gateStatusText(response: Pick<IssueChecklistState, 'isFullySatisfied' | 'openMandatoryTitles'>): GateStatusText {
  if (response.isFullySatisfied) {
    return { satisfied: true, title: 'Definition of Done satisfied', body: 'This issue can be moved to Done.' };
  }
  return {
    satisfied: false,
    title: 'Definition of Done incomplete',
    body: `Moving to Done is blocked while these items are open: ${(response.openMandatoryTitles || []).join(', ')}.`,
    scope: 'This applies on workflows where your Jira admin added the DefinitionGuard validator.'
  };
}

export type LozengeAppearance = 'default' | 'success' | 'removed' | 'inprogress' | 'new' | 'moved';

export interface Lozenge {
  text: string;
  appearance: LozengeAppearance;
}

export interface PanelItemView {
  id: string;
  title: string;
  label: string;               // accessible name of the checkbox
  checked: boolean;
  lozenges: Lozenge[];
  attribution?: Attribution;
  doneText?: 'Completed by' | 'Waived by';
  when?: string;
  needsEvidence: boolean;
  canAddEvidence: boolean;
  canShowEvidence: boolean;
  canWaive: boolean;
}

export interface PanelViewModel {
  status: GateStatusText & { appearance: 'success' | 'warning'; lozenge: Lozenge };
  progress: Lozenge;
  items: PanelItemView[];
}

/** Local date and time, for example "1 Nov 2026, 09:30". Unparseable text is shown as is. */
export function formatLocal(iso?: string, locale?: string, timeZone?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone })
    .format(d)
    .replace(/[  ]/g, ' ');
}

/** Builds everything the panel shows from the resolver response. Null before the first load. */
export function buildPanelViewModel(response: IssueChecklistState | null, format: (iso?: string) => string = formatLocal): PanelViewModel | null {
  if (!response) return null;
  const gate = gateStatusText(response);
  const items = response.items.map((i): PanelItemView => {
    const state = i.waived ? 'waived' : i.isCompleted ? 'done' : 'open';
    const needsEvidence = Boolean(i.evidenceRequired && !i.isCompleted);
    const lozenges: Lozenge[] = [{ text: i.isMandatory ? 'Mandatory' : 'Optional', appearance: 'default' }];
    if (i.waived) lozenges.push({ text: 'Waived', appearance: 'inprogress' });
    if (needsEvidence) lozenges.push({ text: 'Needs evidence', appearance: 'new' });
    if (i.isCompleted && i.hasEvidence) lozenges.push({ text: 'Evidence attached', appearance: 'success' });
    const view: PanelItemView = {
      id: i.id,
      title: i.title,
      label: `${i.title} (${i.isMandatory ? 'mandatory' : 'optional'}, ${state}${needsEvidence ? ', needs evidence' : ''})`,
      checked: i.isCompleted,
      lozenges,
      needsEvidence,
      canAddEvidence: !i.isCompleted && !i.evidenceRequired,
      canShowEvidence: Boolean(i.isCompleted && i.hasEvidence),
      canWaive: !i.isCompleted && i.isMandatory
    };
    if (i.isCompleted) {
      view.attribution = attributionOf({ byAccountId: i.completedByAccountId, legacyName: i.completedByLegacyName });
      view.doneText = i.waived ? 'Waived by' : 'Completed by';
      view.when = format(i.completedAt);
    }
    return view;
  });
  const done = response.items.filter(i => i.isCompleted).length;
  return {
    status: {
      ...gate,
      appearance: gate.satisfied ? 'success' : 'warning',
      lozenge: gate.satisfied ? { text: 'Ready for Done', appearance: 'success' } : { text: 'Blocked', appearance: 'removed' }
    },
    progress: { text: `${done} of ${response.items.length} done`, appearance: done > 0 && done === response.items.length ? 'success' : 'default' },
    items
  };
}

// Messages written by DefinitionGuard resolvers. Each one already says what to do next.
const OWN_MESSAGES = [
  'You need ',
  'Only a project admin ',
  'Only users with ',
  'Someone else changed this checklist',
  'Add a link or a note.',
  'The assignee cannot complete this item',
  'Your DefinitionGuard licence is not active',
  'Give a reason of 10 to 500 characters',
  'The evidence link ',
  'The evidence note ',
  'Evidence must be ',
  'DefinitionGuard could not ',
  'A template needs ',
  'The template ',
  'Item ',
  'This issue type is not in the project.',
  'Only Done-category statuses'
];

/**
 * The text for a failed panel action. Shows a DefinitionGuard message (each has a next step),
 * even when the platform wraps it. Any other text is replaced by a generic next step.
 */
export function panelErrorText(err: unknown, action: string): string {
  const message = typeof (err as any)?.message === 'string' ? (err as any).message : '';
  for (const prefix of OWN_MESSAGES) {
    const at = message.indexOf(prefix);
    if (at >= 0) return message.slice(at);
  }
  return `DefinitionGuard could not ${action}. Refresh the page and try again. If it keeps failing, ask your Jira admin.`;
}

export interface HistoryRow {
  key: string;
  when: string;
  accountId: string;
  text: string;
  evidence?: { url?: string; note?: string };
}

const ACTION_TEXT: Record<ChecklistAuditEvent['eventType'], string> = {
  TEMPLATE_CONFIGURED: 'Checklist created',
  CHECK: 'Completed',
  UNCHECK: 'Reopened',
  WAIVE: 'Waived',
  RESET: 'Checklist reset'
};

/** One row per event, oldest first: the action in words, the item title, and any waiver reason. */
export function historyRows(trail: ChecklistAuditEvent[] | undefined, format: (iso?: string) => string = formatLocal): HistoryRow[] {
  return (trail || []).map(ev => {
    let text = ACTION_TEXT[ev.eventType];
    if (ev.itemTitle) text += `: ${ev.itemTitle}`;
    if (ev.details) text += ` (reason: ${ev.details})`;
    const row: HistoryRow = { key: ev.id, when: format(ev.timestamp), accountId: ev.actorAccountId, text };
    if (ev.evidence) row.evidence = ev.evidence;
    return row;
  });
}
