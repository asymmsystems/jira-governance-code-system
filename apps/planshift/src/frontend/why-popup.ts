/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: the "Why this date?" popup (B-12). A non-modal popup (ADS Popup pattern, UP-48):
 * no aria-modal, Escape or the close button dismisses it, and the driving bars get a dashed
 * outline plus a "Driver" text label so the chain is not shown by colour alone (WCAG 1.4.1).
 */

import { buildWhyModel, WhyModel } from '../ui/why';

export interface WhyHandlers {
  apply: (taskKey: string, updates: Record<string, unknown>) => Promise<void>;
  focusTask: (taskKey: string) => void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function clearDriverMarks(): void {
  document.querySelectorAll('.gantt-bar.is-driver').forEach(bar => {
    bar.classList.remove('is-driver');
    bar.querySelectorAll('.driver-label').forEach(l => l.remove());
  });
}

function markDrivers(model: WhyModel): void {
  for (const k of model.driverKeys) {
    const bar = document.querySelector(`.gantt-bar[data-task-id="${CSS.escape(k)}"]`);
    if (!bar) continue;
    bar.classList.add('is-driver');
    bar.appendChild(el('span', 'Driver', 'driver-label'));
  }
}

export function closeWhyPopup(): void {
  const pop = document.getElementById('whyPopup');
  if (pop) pop.hidden = true;
  clearDriverMarks();
}

export function isWhyPopupOpen(): boolean {
  const pop = document.getElementById('whyPopup');
  return !!pop && !pop.hidden;
}

/**
 * Opens the popup for a task next to the anchor rectangle. Returns false for an unknown task.
 */
export function openWhyPopup(tasks: any[], taskKey: string, anchor: DOMRect | null, handlers: WhyHandlers): boolean {
  const model = buildWhyModel(tasks, taskKey);
  const pop = document.getElementById('whyPopup');
  if (!model || !pop) return false;
  closeWhyPopup();

  (document.getElementById('whyTitle') as HTMLElement).textContent = model.title;
  (document.getElementById('whyReason') as HTMLElement).textContent = model.reason;

  const chain = document.getElementById('whyChain') as HTMLElement;
  chain.replaceChildren();
  for (const step of model.chain) {
    const li = el('li');
    const link = el('button', step.text, 'why-chain-link');
    link.type = 'button';
    link.addEventListener('click', () => handlers.focusTask(step.key));
    li.appendChild(link);
    chain.appendChild(li);
  }

  const violation = document.getElementById('whyViolation') as HTMLElement;
  violation.hidden = !model.violation;
  violation.textContent = model.violation || '';

  const fixes = document.getElementById('whyFixes') as HTMLElement;
  fixes.replaceChildren();
  for (const fix of model.fixes) {
    const btn = el('button', fix.label, 'btn btn-outline btn-sm why-fix');
    btn.type = 'button';
    btn.addEventListener('click', async () => {
      closeWhyPopup();
      await handlers.apply(taskKey, fix.updates);
    });
    fixes.appendChild(btn);
  }

  pop.hidden = false;
  if (anchor) {
    pop.style.top = `${Math.min(window.innerHeight - pop.offsetHeight - 8, anchor.bottom + 6)}px`;
    pop.style.left = `${Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, anchor.left))}px`;
  }
  markDrivers(model);
  (document.getElementById('btnCloseWhy') as HTMLElement).focus();
  return true;
}

export function initWhyPopup(): void {
  const close = document.getElementById('btnCloseWhy');
  if (close) close.addEventListener('click', closeWhyPopup);
}
