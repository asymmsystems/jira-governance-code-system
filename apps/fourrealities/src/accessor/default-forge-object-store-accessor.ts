/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: Forge Object Store (Preview, owner decision Q5) for the report files and the temporary
 * part and people objects. An object is written through a pre-signed upload URL with a PUT from the
 * function; spike S-1 proved that the PUT needs no permissions.external and keeps Runs on Atlassian.
 * Object Store accepted a second write to the same key although overwrite was false (spike S-1), so this
 * Accessor makes "written once" true itself: it refuses a key that exists, and checks the stored checksum.
 */

import * as crypto from 'crypto';
import objectStore from '@forge/object-store';
import { ObjectStoreAccessor } from '../contract/reports';

/** The parts of the Object Store client this Accessor uses. */
export interface ObjectStoreClient {
  get(key: string): Promise<{ checksum: string; size: number } | undefined>;
  delete(key: string): Promise<void>;
  createUploadUrl(body: { key: string; length: number; checksum: string; checksumType: 'SHA256'; overwrite?: boolean }): Promise<{ url: string } | undefined>;
  createDownloadUrl(key: string): Promise<{ url: string } | undefined>;
}

export type FetchFn = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: Uint8Array }) => Promise<{ status: number; text: () => Promise<string> }>;

const platformFetch: FetchFn = (url, init) => fetch(url, init as RequestInit);

export class DefaultForgeObjectStoreAccessor implements ObjectStoreAccessor {
  readonly serviceType = 'accessor' as const;

  private readonly send: FetchFn;

  /** send replaces the platform fetch (tests). No default parameter: FSRT 6c821bd's secret-logging scanner stops on a function as one. */
  constructor(private readonly client: ObjectStoreClient = objectStore as unknown as ObjectStoreClient, send?: FetchFn) {
    this.send = send || platformFetch;
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.get(key)) !== undefined;
  }

  async putOnce(key: string, body: string, contentType: string): Promise<boolean> {
    if (await this.exists(key)) return false;
    const bytes = Buffer.from(body, 'utf8');
    const checksum = crypto.createHash('sha256').update(bytes).digest('base64');
    const upload = await this.client.createUploadUrl({ key, length: bytes.length, checksum, checksumType: 'SHA256', overwrite: false });
    if (!upload?.url) return false;
    const res = await this.send(upload.url, { method: 'PUT', headers: { 'content-type': contentType }, body: new Uint8Array(bytes) });
    if (res.status !== 200 && res.status !== 201) return false;
    const stored = await this.client.get(key);
    return stored?.checksum === checksum && stored.size === bytes.length;
  }

  async readText(key: string): Promise<string | undefined> {
    const url = await this.downloadUrl(key);
    if (!url) return undefined;
    const res = await this.send(url, { method: 'GET' });
    return res.status === 200 ? res.text() : undefined;
  }

  async delete(key: string): Promise<void> {
    await this.client.delete(key);
  }

  async downloadUrl(key: string): Promise<string | undefined> {
    return (await this.client.createDownloadUrl(key))?.url;
  }
}
