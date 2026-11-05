/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/**
 * CascadePlan: values computed at run time in HTML templates (MK-09). The planner has no inline style
 * attributes, so it runs without the 'unsafe-inline' style permission. A template writes such a value
 * as a data-css-* attribute, and this sets it through CSSOM, which the CSP allows.
 */

const PROPERTIES: Array<[attribute: string, property: 'width' | 'left' | 'paddingLeft']> = [
  ['data-css-w', 'width'],
  ['data-css-left', 'left'],
  ['data-css-pl', 'paddingLeft']
];

const SELECTOR = PROPERTIES.map(([a]) => `[${a}]`).join(',');

/** A length the planner writes: a number with px or %, nothing else. */
const LENGTH = /^-?\d+(\.\d+)?(px|%)$/;

/** Sets the data-css-* values of root and of every element under it. */
export function applyDynamicStyles(root: Element): void {
  const below = Array.from(root.querySelectorAll(SELECTOR));
  const elements = root.matches(SELECTOR) ? [root, ...below] : below;
  for (const el of elements as HTMLElement[]) {
    for (const [attribute, property] of PROPERTIES) {
      const value = el.getAttribute(attribute);
      if (value !== null && LENGTH.test(value)) el.style[property] = value;
    }
  }
}
