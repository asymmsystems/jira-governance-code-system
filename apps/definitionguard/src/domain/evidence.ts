/**
 * Per-item evidence: a link, a note, or both, recorded on the TICK event.
 *
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 */
export interface Evidence {
  url?: string;
  note?: string;
}

export const MAX_EVIDENCE_URL = 2000;
export const MAX_EVIDENCE_NOTE = 500;

export const EVIDENCE_REQUIRED = 'Add a link or a note. This item needs evidence before it counts as done.';

export type EvidenceCheck = { ok: true; evidence: Evidence | undefined } | { ok: false; error: string };

/** Trims and checks evidence. Links must be http or https, so the panel never renders another scheme. */
export function validateEvidence(input: any): EvidenceCheck {
  if (input === undefined || input === null) return { ok: true, evidence: undefined };
  if (typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Evidence must be a link, a note, or both.' };
  const out: Evidence = {};
  if (input.url !== undefined && input.url !== '') {
    if (typeof input.url !== 'string') return { ok: false, error: 'The evidence link must be text.' };
    const url = input.url.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) return { ok: false, error: 'The evidence link must start with http:// or https://.' };
    if (url.length > MAX_EVIDENCE_URL) return { ok: false, error: `The evidence link is longer than ${MAX_EVIDENCE_URL} characters.` };
    out.url = url;
  }
  if (input.note !== undefined) {
    if (typeof input.note !== 'string') return { ok: false, error: 'The evidence note must be text.' };
    const note = input.note.trim();
    if (note.length > MAX_EVIDENCE_NOTE) return { ok: false, error: `The evidence note is longer than ${MAX_EVIDENCE_NOTE} characters.` };
    if (note) out.note = note;
  }
  return { ok: true, evidence: out.url || out.note ? out : undefined };
}
