/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: ADS-style Flags (B-14). A Flag reports a write with one action ("Undo"). It stays at
 * least 10 s, and for as long as the pointer or focus is on it (UP-46, UP-66). An error Flag stays
 * until the user closes it (UP-69). Text goes in through textContent (INV-01).
 */

import { showFlag as hostShowFlag } from '@forge/bridge';

export const FLAG_MS = 10000;
let hostFlagSeq = 0;
const MAX_FLAGS = 3;

export interface FlagOptions {
  text: string;
  action?: { label: string; run: () => void };
  error?: boolean;
}

/**
 * Inside Jira, a Flag is Jira's own flag, shown in the visible part of the Jira page: the planner's
 * frame grows with its content, so a flag drawn at the bottom of the frame can be below the window
 * (owner report). A flag with an action, and an error, stay until closed (UP-46, UP-69); others close
 * by themselves. Where the host has no flags (the test harness), the flag is drawn in the frame.
 */
export function showFlag(opts: FlagOptions): HTMLElement | null {
  if (typeof hostShowFlag === 'function') {
    try {
      let handle: { close: () => Promise<boolean | void> } | undefined;
      handle = hostShowFlag({
        id: `cascadeplan-${Date.now()}-${hostFlagSeq++}`,
        title: opts.error ? 'CascadePlan: not saved' : 'CascadePlan',
        description: opts.text,
        type: opts.error ? 'error' : 'info',
        isAutoDismiss: !opts.error && !opts.action,
        ...(opts.action ? { actions: [{ text: opts.action.label, onClick: () => { if (handle) handle.close(); opts.action!.run(); } }] } : {})
      });
      return null;
    } catch {
      // The host refused the flag: draw it in the frame instead.
    }
  }
  const group = document.getElementById('flagGroup');
  if (!group) return null;
  const flag = document.createElement('div');
  flag.className = 'flag' + (opts.error ? ' flag-error' : '');
  flag.setAttribute('role', opts.error ? 'alert' : 'status');
  const text = document.createElement('span');
  text.className = 'flag-text';
  text.textContent = opts.text;
  flag.appendChild(text);
  if (opts.action) {
    const act = document.createElement('button');
    act.type = 'button';
    act.className = 'btn btn-outline btn-sm flag-action';
    act.textContent = opts.action.label;
    const run = opts.action.run;
    act.addEventListener('click', () => {
      flag.remove();
      run();
    });
    flag.appendChild(act);
  }
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'btn btn-subtle btn-sm flag-close';
  close.setAttribute('aria-label', 'Dismiss');
  close.textContent = '✕';
  close.addEventListener('click', () => flag.remove());
  flag.appendChild(close);

  if (!opts.error) {
    let timer = 0;
    const start = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => flag.remove(), FLAG_MS);
    };
    const hold = () => window.clearTimeout(timer);
    flag.addEventListener('mouseenter', hold);
    flag.addEventListener('focusin', hold);
    flag.addEventListener('mouseleave', () => { if (!flag.contains(document.activeElement)) start(); });
    flag.addEventListener('focusout', (e) => { if (!flag.contains(e.relatedTarget as Node)) start(); });
    start();
  }
  group.appendChild(flag);
  while (group.children.length > MAX_FLAGS) group.firstElementChild!.remove();
  return flag;
}
