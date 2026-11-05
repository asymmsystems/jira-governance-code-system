/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: the JQL filter of a plan (F-27).
 *
 * A plan can read only the project's issues that match a JQL filter, for projects with more issues
 * than one plan reads. The filter is always added to the project clause as `project = "X" AND (filter)`,
 * so it can narrow the project but never widen it: the text must have balanced parentheses outside
 * quoted strings, and it must not have its own ORDER BY.
 */

/** The longest filter a plan keeps. */
export const MAX_FILTER_LENGTH = 1000;

export class PlanFilterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanFilterError';
  }
}

/**
 * The filter text to store: trimmed, or '' for no filter. Throws PlanFilterError when the text could
 * change the project clause or is not a filter.
 */
export function cleanPlanFilter(text: unknown): string {
  if (text === undefined || text === null) return '';
  if (typeof text !== 'string') throw new PlanFilterError('The filter must be JQL text.');
  const filter = text.trim();
  if (!filter) return '';
  if (filter.length > MAX_FILTER_LENGTH) throw new PlanFilterError(`The filter is longer than ${MAX_FILTER_LENGTH} characters.`);
  if (/[\r\n]/.test(filter)) throw new PlanFilterError('The filter must be one line.');
  const unquoted = outsideQuotes(filter);
  if (unquoted === null) throw new PlanFilterError('The filter has a quote that is not closed.');
  if (/\border\s+by\b/i.test(unquoted)) throw new PlanFilterError('The filter must not have ORDER BY: the plan sets the order.');
  let depth = 0;
  for (const ch of unquoted) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth < 0) throw new PlanFilterError('The filter closes a parenthesis that it did not open.');
  }
  if (depth !== 0) throw new PlanFilterError('The filter opens a parenthesis that it does not close.');
  return filter;
}

/** The text outside "..." and '...' strings (with backslash escapes), or null when a quote is not closed. */
function outsideQuotes(text: string): string | null {
  let out = '';
  let quote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === '\\') i++;
      else if (ch === quote) { quote = null; out += ' '; }
      continue;
    }
    if (ch === '"' || ch === '\'') { quote = ch; continue; }
    out += ch;
  }
  return quote ? null : out;
}

/** The JQL of the issues a plan reads, without the order. */
export function planJql(projectKey: string, filter?: string): string {
  const project = `project = "${projectKey}"`;
  return filter ? `${project} AND (${filter})` : project;
}
