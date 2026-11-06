/*
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 *
 * @author Fahim Farook
 */

/* Harness stub of @forge/resolver: definitions are kept for the bridge stub. */
export default class Resolver {
  private defs: Record<string, (req: any) => any> = {};
  define(name: string, fn: (req: any) => any): void { this.defs[name] = fn; (globalThis as any).__resolvers = this.defs; }
  getDefinitions(): any { return async (event: any) => this.defs[event.call.functionKey](event); }
}
