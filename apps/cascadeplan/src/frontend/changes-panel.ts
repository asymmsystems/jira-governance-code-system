/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: the "Changes" panel (B-23). Lists each Jira write of this session with issue key,
 * field, old value, new value and result. Non-modal; Escape or the close button dismisses it.
 * All text goes in through textContent (INV-01).
 */

import { toChangeEntries, ChangeEntry } from '../ui/change-log';

const entries: ChangeEntry[] = [];

function cell(tag: 'td' | 'th', text: string): HTMLElement {
  const c = document.createElement(tag);
  c.textContent = text;
  return c;
}

function render(): void {
  const count = document.getElementById('changesCount');
  if (count) count.textContent = String(entries.length);
  const body = document.getElementById('changesBody');
  if (!body) return;
  body.replaceChildren();
  if (entries.length === 0) {
    const tr = document.createElement('tr');
    const td = cell('td', 'No Jira writes in this session.');
    (td as HTMLTableCellElement).colSpan = 5;
    tr.appendChild(td);
    body.appendChild(tr);
    return;
  }
  // Newest first.
  for (const e of [...entries].reverse()) {
    const tr = document.createElement('tr');
    tr.append(cell('td', e.key), cell('td', e.field), cell('td', e.from ?? 'empty'), cell('td', e.to ?? 'empty'), cell('td', e.result));
    if (!e.result.startsWith('Written')) tr.className = 'change-failed';
    body.appendChild(tr);
  }
}

/** Adds the Jira writes a resolver result reports. */
export function recordChanges(result: any): void {
  const rows = toChangeEntries(result && result.jiraSync);
  if (rows.length === 0) return;
  entries.push(...rows);
  render();
}

export function isChangesPanelOpen(): boolean {
  const panel = document.getElementById('changesPanel');
  return !!panel && !panel.hidden;
}

export function closeChangesPanel(): void {
  const panel = document.getElementById('changesPanel');
  if (panel) panel.hidden = true;
}

export function initChangesPanel(): void {
  const btn = document.getElementById('btnChanges');
  const panel = document.getElementById('changesPanel');
  const close = document.getElementById('btnCloseChanges');
  if (!btn || !panel) return;
  btn.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    btn.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden && close) close.focus();
  });
  if (close) close.addEventListener('click', () => {
    closeChangesPanel();
    btn.setAttribute('aria-expanded', 'false');
    btn.focus();
  });
  render();
}
