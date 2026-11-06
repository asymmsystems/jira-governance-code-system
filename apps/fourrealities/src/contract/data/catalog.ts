/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: evidence catalog, the Knowledge Level of the gates (ADR-001 Pattern 4).
 * Every rule that names a source, a link type or an issue type is data here; gate code holds none.
 * A per-project override key fr:p:{key}:catalog is reserved; no code writes it yet.
 */

import { GateName, Verification } from './models';

export interface EvidenceSource {
  gate: GateName;
  /**
   * How strongly FourRealities knows a fact from this source when it is found. A sibling record is
   * FOUND only when its signature is verified; an unverified one is REPORTED (ADR-010).
   */
  verification?: Verification;
}

export interface IntentEvidenceRule {
  /** Linked issue types that record a decision or a specification. Compared by exact name, without case. */
  issueTypes: string[];
  /** Remote link application types that are content pages. */
  contentApplicationTypes: string[];
  /** A remote link on this site whose path starts with this prefix is a content page. */
  sameSiteContentPath: string;
}

export interface EvidenceCatalog {
  sources: Record<string, EvidenceSource>;
  intent: IntentEvidenceRule;
}

/** Longest evidence reference stored in an observation. */
export const EVIDENCE_REF_MAX = 200;

export const DEFAULT_CATALOG: EvidenceCatalog = {
  sources: {
    CONFLUENCE_PAGE_LINK: { gate: 'intent', verification: 'VERIFIED' },
    DECISION_ISSUE_LINK: { gate: 'intent', verification: 'VERIFIED' },
    DEFINITIONGUARD_PROPERTY: { gate: 'process', verification: 'VERIFIED' },
    HEROCODERS_CHECKLIST_PROPERTY: { gate: 'process', verification: 'NOT_VERIFIED' },
    DEVELOPMENT_FIELD: { gate: 'code', verification: 'HEURISTIC' },
    GATE_EXCEPTION: { gate: 'code' },
    LEDGERSEAL_PROPERTY: { gate: 'audit', verification: 'VERIFIED' }
  },
  intent: {
    issueTypes: ['adr', 'architecture decision', 'decision', 'decision record', 'spec', 'specification', 'requirement'],
    contentApplicationTypes: ['com.atlassian.confluence'],
    sameSiteContentPath: '/wiki/'
  }
};
