/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: SHA-256 and the Ed25519 signature of the report manifest (spec v4 section 4.3), the scheme
 * LedgerSeal uses. The private key is the encrypted Forge variable FOURREALITIES_SIGNING_KEY (PKCS#8 DER,
 * base64) and its id FOURREALITIES_KEY_ID. The key is never logged and never leaves this file.
 */

import * as crypto from 'crypto';
import { ReportCryptoAccessor } from '../contract/reports';
import { REPORT_SIGNING_KEYS } from './report-signing-keys';

const KEY_ID = /^[a-z0-9-]{1,40}$/;

export class DefaultReportCryptoAccessor implements ReportCryptoAccessor {
  readonly serviceType = 'accessor' as const;
  private readonly key: crypto.KeyObject | null;
  private readonly id: string | null;
  private readonly wrongKey: boolean;

  /**
   * environment: the Forge environment the report is made in. A development key ("-dev-") never signs a
   * production report, and a production key ("-prod-") never signs a development or staging one (review L-7).
   * published: the public key of each key id. A private key whose public half is not the published key of its
   * id is refused (release review REL-3), so a report is never signed with a key the verifier cannot check.
   */
  constructor(env: Record<string, string | undefined> = process.env, environment?: string, published: Readonly<Record<string, string>> = REPORT_SIGNING_KEYS) {
    const raw = env.FOURREALITIES_SIGNING_KEY;
    const id = env.FOURREALITIES_KEY_ID;
    let key: crypto.KeyObject | null = null;
    let wrongKey = false;
    const fits = !environment || (environment === 'production' ? !String(id).includes('-dev-') : !String(id).includes('-prod-'));
    if (raw && id && KEY_ID.test(id) && fits) {
      try {
        key = crypto.createPrivateKey({ key: Buffer.from(raw, 'base64'), format: 'der', type: 'pkcs8' });
        if (key.asymmetricKeyType !== 'ed25519') key = null;
      } catch {
        key = null;
      }
      if (key && !matches(key, published[id])) {
        key = null;
        wrongKey = true;
      }
    }
    this.key = key;
    this.wrongKey = wrongKey;
    this.id = key ? String(id) : null;
  }

  digest(text: string): { sha256: string; bytes: number } {
    const bytes = Buffer.from(text, 'utf8');
    return { sha256: crypto.createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length };
  }

  sign(text: string): { keyId: string; sig: string } | null {
    if (!this.key || !this.id) return null;
    return { keyId: this.id, sig: crypto.sign(null, Buffer.from(text, 'utf8'), this.key).toString('base64') };
  }

  keyId(): string | null {
    return this.id;
  }

  keyRefused(): boolean {
    return this.wrongKey;
  }

  newId(): string {
    return crypto.randomUUID();
  }
}

/** True when the public half of the private key is the published SPKI PEM (compared as DER bytes). */
function matches(key: crypto.KeyObject, pem: string | undefined): boolean {
  if (!pem) return false;
  try {
    const mine = crypto.createPublicKey(key).export({ format: 'der', type: 'spki' });
    const theirs = crypto.createPublicKey(pem).export({ format: 'der', type: 'spki' });
    return mine.length === theirs.length && crypto.timingSafeEqual(mine, theirs);
  } catch {
    return false;
  }
}
