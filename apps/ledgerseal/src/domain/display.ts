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

/** Values longer than this show a "Show full value" toggle in the panel. */
export const LONG_VALUE_CHARS = 200;

const BLOCK_NAMES: Record<string, string> = {
  paragraph: 'Paragraph',
  heading: 'Heading',
  bulletList: 'List',
  orderedList: 'List',
  table: 'Table',
  codeBlock: 'Code block',
  panel: 'Panel',
  blockquote: 'Quote'
};

function isDoc(value: unknown): value is { type: 'doc'; content: any[] } {
  return Boolean(value && typeof value === 'object' && (value as any).type === 'doc' && Array.isArray((value as any).content));
}

/**
 * Says which top-level blocks of a rich text value changed, for example "Paragraph 1 changed. Paragraph 4 added.".
 * Returns null unless at least one side is a rich text document.
 */
export function richTextSummary(was: unknown, now: unknown): string | null {
  if (!isDoc(was) && !isDoc(now)) return null;
  const before = isDoc(was) ? was.content : [];
  const after = isDoc(now) ? now.content : [];
  const parts: string[] = [];
  for (let i = 0; i < Math.max(before.length, after.length); i++) {
    const block = after[i] ?? before[i];
    const name = `${BLOCK_NAMES[block?.type] ?? 'Block'} ${i + 1}`;
    if (i >= before.length) parts.push(`${name} added`);
    else if (i >= after.length) parts.push(`${name} removed`);
    else if (JSON.stringify(before[i]) !== JSON.stringify(after[i])) parts.push(`${name} changed`);
  }
  return parts.length > 0 ? parts.join('. ') + '.' : null;
}
