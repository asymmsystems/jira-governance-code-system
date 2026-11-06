/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: public keys of the sibling apps, trusted per Forge environment (ADR-010).
 * A production key is added here when its producer publishes it; until then production trusts no key.
 */

import { SiblingProducer } from '../contract/data/models';

/** Forge environment types, as getAppContext().environmentType reports them. */
export type ForgeEnvironment = 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';

export interface TrustedKey {
  readonly producer: SiblingProducer;
  readonly keyId: string;
  readonly environments: readonly ForgeEnvironment[];
  /** SPKI PEM of the Ed25519 public key. */
  readonly pem: string;
}

export const TRUSTED_KEYS: readonly TrustedKey[] = [
  {
    // docs/marketplace/definitionguard-public-key.pem (DefinitionGuard round log, keyId dg-dev-2026-11).
    producer: 'definitionguard',
    keyId: 'dg-dev-2026-11',
    environments: ['DEVELOPMENT', 'STAGING'],
    pem: '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAoJeSg/k7W6M/7B/arkkxCl2XWk0bQzL6xTntCIRyids=\n-----END PUBLIC KEY-----\n'
  },
  {
    // apps/ledgerseal/keys/ls-dev-2026-11.pub.pem.
    producer: 'ledgerseal',
    keyId: 'ls-dev-2026-11',
    environments: ['DEVELOPMENT', 'STAGING'],
    pem: '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA3tGVQVDUPkk1+tAc9mYyPIAeTY+/qruaXJyTXrFKQpw=\n-----END PUBLIC KEY-----\n'
  }
];
