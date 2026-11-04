/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: service-type markers (ADR-002, after M360 ADR-029). TypeScript types are
 * structural, so each marker carries a literal discriminant.
 */

/** Engines: all rules, pure input to output, no I/O, no @forge imports, no other Engine. */
export interface Engine {
  readonly serviceType: 'engine';
}

/** Managers: orchestration only, no rules, no I/O. */
export interface Manager {
  readonly serviceType: 'manager';
}

/** Accessors: all I/O (Jira REST, Forge KVS). The only importers of @forge/api and @forge/kvs. */
export interface Accessor {
  readonly serviceType: 'accessor';
}
