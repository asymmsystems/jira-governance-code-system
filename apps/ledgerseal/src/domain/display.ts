/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * LedgerSeal: display text for stored values.
 * The panel receives this text, never the stored snapshot (spec v2 section 3.4).
 *
 * @author Fahim Farook
 */

/** Longest diff value text sent to the panel. */
export const MAX_VALUE_CHARS = 2000;

function isNode(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && typeof (value as any).type === 'string');
}

/** Plain text of a field value: rich text paragraphs on separate lines, lists joined by commas. */
export function plainText(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return value.map(plainText).join(value.some(isNode) ? '\n' : ', ');
  const obj = value as Record<string, any>;
  if (obj.type === 'text' && typeof obj.text === 'string') return obj.text;
  if (Array.isArray(obj.content)) return obj.content.map(plainText).join(obj.type === 'paragraph' ? '' : '\n');
  const label = obj.displayName ?? obj.name ?? obj.value ?? obj.key;
  return label !== undefined ? String(label) : JSON.stringify(obj);
}

export function capped(value: unknown, max: number = MAX_VALUE_CHARS): { text: string; truncated: boolean } {
  const text = plainText(value);
  return text.length > max ? { text: text.slice(0, max), truncated: true } : { text, truncated: false };
}
