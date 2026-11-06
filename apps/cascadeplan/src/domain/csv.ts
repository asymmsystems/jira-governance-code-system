/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: one CSV cell, safe to open in a spreadsheet (ASYMM-SEC-04, CWE-1236). Pure function.
 *
 * Rule for numbers: a value of type `number` is written by the app itself (an estimate it computed or
 * read as a number), so it is written as is and stays numeric, negative values included. Every other
 * value is text and may come from a user (an issue key, a baseline name), even when it looks like a
 * number. Text that starts with `=`, `+`, `-`, `@`, a tab or a carriage return gets a leading single
 * quote, so a spreadsheet shows it as text and does not run it as a formula (OWASP CSV Injection).
 * Then RFC 4180 quoting applies: a cell that holds a comma, a quote, a line feed or a carriage return
 * is wrapped in quotes, with each quote doubled.
 */

const FORMULA_START = /^[=+\-@\t\r]/;
const NEEDS_QUOTES = /[",\n\r]/;

/** The cell for a value: empty for none, a number as is, text neutralised and quoted when needed. */
export function csvCell(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'number') return String(v);
  let s = String(v);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return NEEDS_QUOTES.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One CSV row of cells, joined by `sep` (a comma by default). */
export function csvRow(values: unknown[], sep = ','): string {
  return values.map(csvCell).join(sep);
}
