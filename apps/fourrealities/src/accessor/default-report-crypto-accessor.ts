/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: SHA-256 and the Ed25519 signature of the report manifest (spec v4 section 4.3), the scheme
 * LedgerSeal uses. The private key is the encrypted Forge variable FOURREALITIES_SIGNING_KEY (PKCS#8 DER,
 * base64) and its id FOURREALITIES_KEY_ID. The key is never logged and never leaves this file.
 */

import * as crypto from 'crypto';
import { ReportCryptoAccessor } from '../contract/reports';

const KEY_ID = /^[a-z0-9-]{1,40}$/;

export class DefaultReportCryptoAccessor implements ReportCryptoAccessor {
  readonly serviceType = 'accessor' as const;
  private readonly key: crypto.KeyObject | null;
  private readonly id: string | null;

  constructor(env: Record<string, string | undefined> = process.env) {
    const raw = env.FOURREALITIES_SIGNING_KEY;
    const id = env.FOURREALITIES_KEY_ID;
    let key: crypto.KeyObject | null = null;
    if (raw && id && KEY_ID.test(id)) {
      try {
        key = crypto.createPrivateKey({ key: Buffer.from(raw, 'base64'), format: 'der', type: 'pkcs8' });
        if (key.asymmetricKeyType !== 'ed25519') key = null;
      } catch {
        key = null;
      }
    }
    this.key = key;
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

  newId(): string {
    return crypto.randomUUID();
  }
}
