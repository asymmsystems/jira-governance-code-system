/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: UI Kit and bridge mocks for react-test-renderer tests
 */

import * as React from 'react';

/**
 * Every @forge/react component becomes a host element named `ui-<Component>`,
 * so tests can find elements by type and read their props.
 */
export function reactMock(): any {
  const base: any = { __esModule: true, default: { render: () => undefined } };
  return new Proxy(base, {
    get: (target, prop: string) =>
      prop in target
        ? target[prop]
        : (props: any) => React.createElement('ui-' + String(prop), props, props?.children)
  });
}

export const bridgeState: {
  context: any;
  invoke: jest.Mock;
  routerOpen: jest.Mock;
} = {
  context: {},
  invoke: jest.fn(),
  routerOpen: jest.fn().mockResolvedValue(undefined)
};

export function bridgeMock(): any {
  return {
    invoke: (...args: any[]) => bridgeState.invoke(...args),
    view: { getContext: () => (bridgeState.context instanceof Error ? Promise.reject(bridgeState.context) : Promise.resolve(bridgeState.context)) },
    router: { open: (...args: any[]) => bridgeState.routerOpen(...args) }
  };
}

/** Concatenates every text node in a rendered tree. */
export function textOf(node: any): string {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(textOf).join(' ');
  return textOf(node.children);
}

/** Finds host elements of one UI Kit type, for example 'Button'. */
export function findAll(root: any, type: string, predicate: (props: any) => boolean = () => true): any[] {
  return root.findAll((n: any) => n.type === 'ui-' + type && predicate(n.props));
}

/** Finds a button whose text equals the label, else the first whose text contains it. */
export function findButton(root: any, label: string): any {
  const all = findAll(root, 'Button');
  const exact = all.filter((b: any) => flatText(b.props.children).trim() === label);
  const buttons = exact.length > 0 ? exact : all.filter((b: any) => flatText(b.props.children).includes(label));
  if (buttons.length === 0) throw new Error(`No button with label "${label}"`);
  return buttons[0];
}

export function flatText(children: any): string {
  if (children === null || children === undefined || typeof children === 'boolean') return '';
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(flatText).join('');
  if (children.props) return flatText(children.props.children);
  return '';
}

/** Lets pending promises and state updates settle inside act(). */
export async function settle(act: (cb: () => Promise<void>) => Promise<void>, rounds = 5): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0));
    });
  }
}
