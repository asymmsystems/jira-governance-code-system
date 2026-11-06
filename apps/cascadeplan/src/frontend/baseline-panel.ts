/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: the baseline panel (ADR-009, DEC-1 Option B). The status button shows the active
 * baseline, whether it is intact, and the scope change since it was frozen. The panel freezes a
 * baseline (plan approvers), lists the versions, compares a version with the current plan or with
 * the active version, exports one as CSV, and handles scope-change requests and their review.
 * All text goes in through textContent (INV-01); the server checks every permission again.
 */

export interface BaselinePanelDeps {
  call: (fn: string, payload?: Record<string, unknown>) => Promise<any>;
  flag: (f: { text: string; error?: boolean }) => void;
  isApprover: () => boolean | null;
  /** Reloads the plan, which brings the new active baseline to the status button. */
  reloadPlan: () => Promise<void>;
}

let deps: BaselinePanelDeps;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}

function button(text: string, onClick: () => void, primary = false): HTMLButtonElement {
  const b = el('button', text, `btn ${primary ? 'btn-primary' : 'btn-outline'} btn-xs`);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
const day = (iso: string) => (iso || '').slice(0, 10);

/** One line of status for the toolbar: name, integrity, change since the baseline. */
export function statusText(report: any): string {
  if (!report || report.ok === false) return 'Baseline: none';
  const c = report.comparison;
  const parts = [`${signed(c.deltaHours)} h (${signed(c.deltaPercent)}%)`];
  if (c.added.length) parts.push(`${c.added.length} added`);
  if (c.removed.length) parts.push(`${c.removed.length} removed`);
  if (c.slipped) parts.push(`${c.slipped} later`);
  return `Baseline: ${report.baseline.name}${report.intact ? '' : ' (changed since frozen!)'} · ${c.grew || c.removed.length || c.changed.length ? parts.join(', ') : 'on scope'}`;
}

function comparisonTable(c: any, summaries: Record<string, string>): HTMLElement {
  const wrap = el('div');
  wrap.appendChild(el('p', `Hours ${c.fromHours} -> ${c.toHours} (${signed(c.deltaHours)} h, ${signed(c.deltaPercent)}%). Items ${c.fromCount} -> ${c.toCount}.`));
  const table = el('table', undefined, 'changes-table');
  const head = el('tr');
  for (const h of ['Change', 'Issue', 'Summary (now)', 'Estimate', 'Start', 'End']) head.appendChild(el('th', h));
  table.appendChild(el('thead')).appendChild(head);
  const body = table.appendChild(el('tbody'));
  const row = (kind: string, key: string, est: string, start: string, end: string) => {
    const tr = el('tr');
    for (const v of [kind, key, summaries[key] || '', est, start, end]) tr.appendChild(el('td', v));
    body.appendChild(tr);
  };
  for (const i of c.added) row('added', i.key, i.hours !== undefined ? `${i.hours} h` : 'none', day(i.start), day(i.end));
  for (const i of c.removed) row('removed', i.key, i.hours !== undefined ? `${i.hours} h` : 'none', day(i.start), day(i.end));
  for (const x of c.changed) {
    const pair = (a: any, b: any, unit = '') => (a === undefined && b === undefined ? '' : `${a ?? 'none'}${unit} -> ${b ?? 'none'}${unit}`);
    row('changed', x.key, 'fromHours' in x || 'toHours' in x ? pair(x.fromHours, x.toHours, ' h') : '',
      'fromStart' in x ? pair(x.fromStart, x.toStart) : '', 'fromEnd' in x ? pair(x.fromEnd, x.toEnd) : '');
  }
  if (!c.added.length && !c.removed.length && !c.changed.length) wrap.appendChild(el('p', 'No change.'));
  else wrap.appendChild(table);
  return wrap;
}

function download(name: string, text: string, type: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = el('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch { return false; }
}

async function refreshStatus(): Promise<any> {
  const btn = document.getElementById('btnBaseline');
  const report = await deps.call('getScopeCreepReport', {});
  if (btn) {
    btn.textContent = statusText(report);
    btn.classList.toggle('is-warning', !!(report && report.ok !== false && (report.comparison.grew || !report.intact)));
  }
  return report;
}

async function render(): Promise<void> {
  const body = document.getElementById('baselineBody');
  if (!body) return;
  body.replaceChildren(el('p', 'Loading...'));
  const [list, report] = await Promise.all([deps.call('getPlanBaselines', {}), refreshStatus()]);
  body.replaceChildren();
  const approver = deps.isApprover() === true;

  // Freeze (plan approvers).
  const freeze = el('div', undefined, 'baseline-freeze');
  const name = el('input');
  name.type = 'text';
  name.className = 'form-input';
  name.placeholder = 'Baseline name, for example Sprint 7 commitment';
  name.setAttribute('aria-label', 'Baseline name');
  name.maxLength = 80;
  const freezeBtn = button('Freeze the plan as a baseline', async () => {
    const res = await deps.call('freezePlanBaseline', { name: name.value });
    if (res && res.ok) { deps.flag({ text: `Froze "${res.baseline.name}": ${res.baseline.itemCount} items, ${res.baseline.totalHours} h.` }); await deps.reloadPlan(); await render(); }
    else deps.flag({ text: (res && (res.message || res.error)) || 'The baseline was not frozen.', error: true });
  }, true);
  name.disabled = freezeBtn.disabled = !approver;
  if (!approver) freezeBtn.title = 'Only plan approvers freeze baselines.';
  freeze.append(name, freezeBtn);
  body.appendChild(freeze);

  // Scope since the active baseline.
  const delta = el('section');
  delta.appendChild(el('h3', 'Scope since the active baseline'));
  if (report && report.ok !== false) {
    if (!report.intact) delta.appendChild(el('p', 'Warning: this baseline no longer matches what was frozen (its SHA-256 digest differs).', 'baseline-warning'));
    delta.appendChild(comparisonTable(report.comparison, report.summaries || {}));
    const reason = el('textarea');
    reason.className = 'form-input';
    reason.placeholder = 'Why the scope changed (sent to plan approvers)';
    reason.setAttribute('aria-label', 'Reason for the scope change');
    reason.maxLength = 1000;
    delta.append(reason, button('Request approval of this scope', async () => {
      const res = await deps.call('requestScopeShift', { reason: reason.value });
      if (res && res.ok) { deps.flag({ text: 'Scope change requested. A plan approver can accept or reject it.' }); await render(); }
      else deps.flag({ text: (res && (res.message || res.error)) || 'The request was not saved.', error: true });
    }));
  } else {
    delta.appendChild(el('p', (report && report.message) || 'No baseline yet.'));
  }
  body.appendChild(delta);

  // Requests.
  const shifts = (list && list.shifts) || [];
  if (shifts.length) {
    const sec = el('section');
    sec.appendChild(el('h3', 'Scope-change requests'));
    for (const s of shifts) {
      const line = el('div', undefined, 'baseline-shift');
      const sum = s.summary || {};
      line.appendChild(el('span', `${day(s.requestedAt)} ${s.requestedByName}: "${s.reason}" (${sum.added} added, ${sum.removed} removed, ${sum.changed} changed, ${signed(sum.deltaHours)} h). ${s.status === 'PENDING' ? 'Waiting.' : `${s.status === 'APPROVED' ? 'Accepted' : 'Rejected'} by ${s.reviewedByName}${s.comment ? `: ${s.comment}` : ''}.`}`));
      if (s.status === 'PENDING' && approver) {
        for (const [status, label] of [['APPROVED', 'Accept'], ['REJECTED', 'Reject']] as const) {
          line.appendChild(button(label, async () => {
            const res = await deps.call('reviewScopeShift', { shiftId: s.id, status });
            if (res && res.ok) { deps.flag({ text: status === 'APPROVED' ? 'Accepted: a new baseline version is active.' : 'Rejected: the baseline stays.' }); await deps.reloadPlan(); await render(); }
            else deps.flag({ text: (res && (res.message || res.error)) || 'The review was not saved.', error: true });
          }, status === 'APPROVED'));
        }
      }
      sec.appendChild(line);
    }
    body.appendChild(sec);
  }

  // Versions.
  const versions = (list && list.baselines) || [];
  if (versions.length) {
    const sec = el('section');
    sec.appendChild(el('h3', 'Baseline versions'));
    const out = el('div');
    for (const b of versions) {
      const line = el('div', undefined, 'baseline-version');
      const active = b.id === list.active;
      line.appendChild(el('span', `${active ? '● ' : ''}${b.name}, ${day(b.frozenAt)} by ${b.frozenByName}: ${b.itemCount} items, ${b.totalHours} h${b.unestimated ? `, ${b.unestimated} unestimated` : ''}.`));
      line.appendChild(button('Compare with now', async () => {
        const r = await deps.call('getScopeCreepReport', { baselineId: b.id });
        out.replaceChildren(el('h4', `${b.name} against the current plan`), r && r.ok ? comparisonTable(r.comparison, r.summaries || {}) : el('p', (r && r.message) || 'Not available.'));
      }));
      if (!active && list.active) {
        line.appendChild(button('Compare with active', async () => {
          const r = await deps.call('compareBaselines', { fromId: b.id, toId: list.active });
          out.replaceChildren(el('h4', `${b.name} against the active version`), r && r.ok ? comparisonTable(r.comparison, r.summaries || {}) : el('p', (r && r.message) || 'Not available.'));
        }));
      }
      line.appendChild(button('Export CSV', async () => {
        const r = await deps.call('exportBaseline', { baselineId: b.id });
        if (!r || !r.ok) { deps.flag({ text: (r && r.message) || 'Export failed.', error: true }); return; }
        if (!download(`${b.name.replace(/[^\w.-]+/g, '_')}.csv`, r.csv, 'text/csv')) {
          const ta = el('textarea');
          ta.className = 'form-input';
          ta.value = r.csv;
          ta.readOnly = true;
          out.replaceChildren(el('p', 'Copy the CSV below:'), ta);
        }
        if (!r.intact) deps.flag({ text: `"${b.name}" no longer matches what was frozen (SHA-256 differs).`, error: true });
      }));
      if (!active && approver) {
        line.appendChild(button('Make active', async () => {
          const res = await deps.call('setActiveBaseline', { baselineId: b.id });
          if (res && res.ok) { await deps.reloadPlan(); await render(); } else deps.flag({ text: (res && res.message) || 'Not changed.', error: true });
        }));
      }
      sec.appendChild(line);
    }
    sec.appendChild(out);
    body.appendChild(sec);
  }
}

export function closeBaselinePanel(): void {
  const panel = document.getElementById('baselinePanel');
  if (panel) panel.hidden = true;
  document.getElementById('btnBaseline')?.setAttribute('aria-expanded', 'false');
}

export function isBaselinePanelOpen(): boolean {
  const panel = document.getElementById('baselinePanel');
  return !!panel && !panel.hidden;
}

/** Refreshes the status button after the plan changed (a move, a load, a plan switch). */
export function refreshBaselineStatus(): void {
  if (deps) refreshStatus().catch(() => undefined);
}

export function initBaselinePanel(d: BaselinePanelDeps): void {
  deps = d;
  const btn = document.getElementById('btnBaseline');
  const panel = document.getElementById('baselinePanel');
  const close = document.getElementById('btnCloseBaseline');
  if (!btn || !panel) return;
  btn.addEventListener('click', async () => {
    panel.hidden = !panel.hidden;
    btn.setAttribute('aria-expanded', String(!panel.hidden));
    if (!panel.hidden) { await render(); close?.focus(); }
  });
  close?.addEventListener('click', () => { closeBaselinePanel(); btn.focus(); });
}
