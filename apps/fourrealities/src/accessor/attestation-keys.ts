/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: public keys of the sibling apps, trusted per Forge environment (ADR-012).
 * Development keys are trusted in development and staging only; production trusts only the production keys.
 * A rotated key is added here with a new keyId when its producer publishes it.
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
  },
  {
    // docs/marketplace/definitionguard-public-key-dg-prod-2026-11.pem, published 2026-11-06.
    // SHA-256 (DER): 956589daeeb464de4dd4a3c04659c494d2e2b31e4fc9a06784704539ce91f9fb.
    producer: 'definitionguard',
    keyId: 'dg-prod-2026-11',
    environments: ['PRODUCTION'],
    pem: '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAiZby7ZujEzTGnRBc0StyzcxBjzs9+WCcd6zXfIfnEg8=\n-----END PUBLIC KEY-----\n'
  },
  {
    // apps/ledgerseal/keys/ls-prod-2026-11.pub.pem, published 2026-11-06 (asymmsystems/ledgerseal-verifier v1.3.0).
    // SHA-256 (DER): 09f2b807adc803a7f687e0561e90b8dcadadd6c1d752c66b55980a27b89cc5d3.
    producer: 'ledgerseal',
    keyId: 'ls-prod-2026-11',
    environments: ['PRODUCTION'],
    pem: '-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEATeL77D87DnKc6DSKrt1kAfh0SIW0ok4NoALB371b/VE=\n-----END PUBLIC KEY-----\n'
  }
];
