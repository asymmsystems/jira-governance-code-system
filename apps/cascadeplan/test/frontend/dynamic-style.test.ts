/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/** MK-09: data-css-* values are set through CSSOM, and only lengths in px or % are taken. */
import { applyDynamicStyles } from '../../src/frontend/dynamic-style';

/** A small stand-in for an element: attributes, a style object and children. */
function el(attrs: Record<string, string>, children: any[] = []): any {
  const node: any = {
    attrs, style: {} as Record<string, string>, children,
    getAttribute: (a: string) => (a in attrs ? attrs[a] : null),
    matches: (sel: string) => sel.split(',').some(s => s.slice(1, -1) in attrs),
    querySelectorAll: (sel: string): any[] => {
      const out: any[] = [];
      const walk = (n: any) => { for (const c of n.children) { if (c.matches(sel)) out.push(c); walk(c); } };
      walk(node);
      return out;
    }
  };
  return node;
}

describe('applyDynamicStyles', () => {
  it('sets width, left and padding-left on the root and its descendants', () => {
    const fill = el({ 'data-css-w': '40%' });
    const bar = el({ 'data-css-left': '120px', 'data-css-w': '63px' });
    const row = el({ 'data-css-pl': '16px' }, [el({}, [fill]), bar]);
    applyDynamicStyles(row);
    expect(row.style).toEqual({ paddingLeft: '16px' });
    expect(fill.style).toEqual({ width: '40%' });
    expect(bar.style).toEqual({ left: '120px', width: '63px' });
  });

  it('ignores anything that is not a number with px or %', () => {
    const odd = el({ 'data-css-w': 'undefinedpx', 'data-css-left': 'calc(1px)', 'data-css-pl': '12.5px' });
    applyDynamicStyles(el({}, [odd]));
    expect(odd.style).toEqual({ paddingLeft: '12.5px' });
  });
});
