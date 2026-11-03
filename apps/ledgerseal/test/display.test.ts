/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * Display text for stored values.
 *
 * @author Fahim Farook
 */

import { capped, plainText } from '../src/domain/display';

describe('plainText', () => {
  it('writes empty, scalar and list values', () => {
    expect(plainText(null)).toBe('(empty)');
    expect(plainText(undefined)).toBe('(empty)');
    expect(plainText('a')).toBe('a');
    expect(plainText(9.81)).toBe('9.81');
    expect(plainText(false)).toBe('false');
    expect(plainText(['b', 'a'])).toBe('b, a');
  });

  it('writes rich text paragraphs on separate lines and keeps text runs together', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello ' }, { type: 'text', text: 'world' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }
      ]
    };
    expect(plainText(doc)).toBe('Hello world\nSecond');
    expect(plainText([doc.content[0], doc.content[1]])).toBe('Hello world\nSecond');
  });

  it('handles ADF inline nodes like hardBreak, mention, emoji and inlineCard without JSON leakage', () => {
    const docWithBreak = {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Line 1' },
        { type: 'hardBreak' },
        { type: 'text', text: 'Line 2' },
        { type: 'mention', attrs: { text: 'Alice' } },
        { type: 'emoji', attrs: { text: '👍' } },
        { type: 'inlineCard', attrs: { url: 'https://example.com' } }
      ]
    };
    expect(plainText(docWithBreak)).toBe('Line 1\nLine 2@Alice👍https://example.com');

    // Test fallbacks
    expect(plainText({ type: 'mention' })).toBe('@user');
    expect(plainText({ type: 'emoji', attrs: { shortName: ':smile:' } })).toBe(':smile:');
    expect(plainText({ type: 'emoji' })).toBe('');
    expect(plainText({ type: 'inlineCard' })).toBe('');
  });

  it('uses the display name, name, value or key of an object, else its JSON', () => {
    expect(plainText({ accountId: 'a1', displayName: 'Alice' })).toBe('Alice');
    expect(plainText({ id: '2', name: 'High' })).toBe('High');
    expect(plainText({ id: '9', value: 'Class II' })).toBe('Class II');
    expect(plainText({ id: '1', key: 'CHG-2' })).toBe('CHG-2');
    expect(plainText({ originalEstimateSeconds: 28800 })).toBe('{"originalEstimateSeconds":28800}');
  });
});

describe('capped', () => {
  it('cuts long text and says so', () => {
    expect(capped('x'.repeat(10), 4)).toEqual({ text: 'xxxx', truncated: true });
    expect(capped('short')).toEqual({ text: 'short', truncated: false });
  });
});
