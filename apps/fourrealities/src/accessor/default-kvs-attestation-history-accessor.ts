/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: the newest verified DefinitionGuard and LedgerSeal record seen on each issue, at
 * fr:att:{issueId} (ADR-012). A record older than this one is a rollback: someone put back an
 * earlier signed record. The values are version numbers and dates only, no personal data.
 */

import { AttestationHistory, AttestationVersion } from '../contract/data/models';
import { AttestationHistoryAccessor, StorageProvider } from '../contract/accessors';
import { queryAll } from './kvs-v2-exception';

const PREFIX = 'fr:att:';

/** The newer of two versions: the higher stateVersion, else the later issuedAt. */
function newer(a: AttestationVersion | undefined, b: AttestationVersion | undefined): AttestationVersion | undefined {
  if (!a) return b;
  if (!b) return a;
  if (typeof a.stateVersion === 'number' && typeof b.stateVersion === 'number' && a.stateVersion !== b.stateVersion) {
    return a.stateVersion > b.stateVersion ? a : b;
  }
  return (b.issuedAt || '') > (a.issuedAt || '') ? b : a;
}

export class DefaultKvsAttestationHistoryAccessor implements AttestationHistoryAccessor {
  readonly serviceType = 'accessor' as const;

  constructor(private readonly storage: StorageProvider) {}

  async get(issueId: string): Promise<AttestationHistory> {
    return (await this.storage.get<AttestationHistory>(PREFIX + issueId)) || {};
  }

  async listAll(): Promise<Map<string, AttestationHistory>> {
    return new Map((await queryAll(this.storage, PREFIX)).map(r => [r.key.slice(PREFIX.length), (r.value || {}) as AttestationHistory]));
  }

  async raise(issueId: string, seen: AttestationHistory, current: AttestationHistory): Promise<boolean> {
    const next: AttestationHistory = {};
    const dod = newer(current.dod, seen.dod);
    const ledgerseal = newer(current.ledgerseal, seen.ledgerseal);
    if (dod) next.dod = dod;
    if (ledgerseal) next.ledgerseal = ledgerseal;
    if (JSON.stringify(next) === JSON.stringify(current)) return false;
    await this.storage.set(PREFIX + issueId, next);
    return true;
  }
}
