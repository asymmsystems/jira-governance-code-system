/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: saves a downloaded Blob in the browser. The UI Kit FileCard does not save the Blob that its
 * onDownload returns on this platform (live check of 7.7.0, 2026-11-08: nothing was saved). Atlassian's own
 * Object Store sample app (forge-ui-object-store-example-app, src/frontend/index.tsx) says so in a code comment,
 * "Known bug: FileCard onDownload is () => void; trigger browser save explicitly", and saves the file with an
 * object URL and a clicked anchor, as this function does. No React (B-22).
 */

/** What saveBlob needs of the browser; the default is the real document and URL. */
export interface SaveTarget {
  document?: { createElement: (tag: string) => { href: string; download: string; style: { display: string }; click: () => void; remove: () => void }; body?: { appendChild: (node: unknown) => unknown } };
  url?: { createObjectURL?: (blob: Blob) => string; revokeObjectURL?: (url: string) => void };
  later?: (fn: () => void, ms: number) => void;
}

/** The real browser: the UI Kit frontend runtime has a document (Atlassian's sample app uses it). */
const browser = (): SaveTarget => ({
  document: (globalThis as { document?: SaveTarget['document'] }).document,
  url: (globalThis as { URL?: SaveTarget['url'] }).URL
});

/** Saves the Blob under the name; false when the browser gives no way to do it (the caller then returns the Blob). */
export function saveBlob(blob: Blob, name: string, target: SaveTarget = browser()): boolean {
  const doc = target.document;
  const url = target.url;
  if (!doc?.body || !url?.createObjectURL) return false;
  const href = url.createObjectURL(blob);
  const anchor = doc.createElement('a');
  anchor.href = href;
  anchor.download = name;
  anchor.style.display = 'none';
  doc.body.appendChild(anchor);
  anchor.click();
  (target.later || ((fn: () => void, ms: number) => { setTimeout(fn, ms); }))(() => {
    anchor.remove();
    url.revokeObjectURL?.(href);
  }, 1000);
  return true;
}
