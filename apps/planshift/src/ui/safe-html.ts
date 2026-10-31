/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: escaped HTML templates for the planner UI (B-02, INV-01).
 * Every interpolated value is escaped unless it is itself an html fragment.
 */

export class SafeHtml {
  constructor(private readonly markup: string) {}

  toString(): string {
    return this.markup;
  }
}

/**
 * Escapes text for use in HTML text and in quoted attribute values.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function render(value: unknown): string {
  if (value instanceof SafeHtml) return value.toString();
  if (Array.isArray(value)) return value.map(render).join('');
  return escapeHtml(value);
}

/**
 * Tagged template: html`<b>${name}</b>` escapes name. Fragments and arrays of fragments nest.
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    out += render(values[i]) + strings[i + 1];
  }
  return new SafeHtml(out);
}
