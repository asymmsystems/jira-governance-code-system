/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: words for the evidence sources in use and for the admin page (ADR-013). Pure functions.
 */

import { AuditMode, CodeMode, DetectedSources, EvidenceSourceSettings, GateName, IntentMode, ProcessMode, SourcesInUse } from '../contract/data/models';
import { GATE_LABEL } from './gate-text';

/** True when the check is in use on this site; true when the view carries no sources (older resolver). */
export function gateInUse(sources: SourcesInUse | undefined, gate: GateName): boolean {
  if (!sources) return true;
  return gate === 'process' ? sources.process !== null : sources[gate];
}

const PROCESS_SOURCE: Record<'definitionguard' | 'herocoders', string> = {
  definitionguard: 'DefinitionGuard',
  herocoders: 'Checklists for Jira'
};

/** One line: which checks are in use, with their source and whether detection turned them on. */
export function sourcesLine(sources: SourcesInUse): string {
  const used: string[] = [];
  const unused: string[] = [];
  if (sources.intent) used.push('Intent'); else unused.push('Intent');
  if (sources.process) used.push(`Process (${PROCESS_SOURCE[sources.process]}${sources.detected.process ? ', detected' : ''})`); else unused.push('Process');
  if (sources.code) used.push(`Code (Jira Development field${sources.detected.code ? ', detected' : ''})`); else unused.push('Code');
  if (sources.audit) used.push(`Audit (LedgerSeal${sources.detected.audit ? ', detected' : ''})`); else unused.push('Audit');
  const parts = [used.length > 0 ? `Checks in use on this site: ${used.join('; ')}.` : 'No check is in use on this site.'];
  if (unused.length > 0) parts.push(`Not used on this site: ${unused.join(', ')}.`);
  return parts.join(' ');
}

export type Option<T extends string> = { label: string; value: T };

export const INTENT_OPTIONS: Option<IntentMode>[] = [
  { label: 'In use', value: 'on' },
  { label: 'Not in use', value: 'off' }
];
export const PROCESS_OPTIONS: Option<ProcessMode>[] = [
  { label: 'Detect (DefinitionGuard, when a signed record is found)', value: 'auto' },
  { label: 'DefinitionGuard', value: 'definitionguard' },
  { label: 'Checklists for Jira (HeroCoders)', value: 'herocoders' },
  { label: 'Not in use', value: 'off' }
];
export const CODE_OPTIONS: Option<CodeMode>[] = [
  { label: 'Detect (when pull request data is found)', value: 'auto' },
  { label: 'In use', value: 'on' },
  { label: 'Not in use', value: 'off' }
];
export const AUDIT_OPTIONS: Option<AuditMode>[] = [
  { label: 'Detect (LedgerSeal, when a signed record is found)', value: 'auto' },
  { label: 'LedgerSeal', value: 'ledgerseal' },
  { label: 'Not in use', value: 'off' }
];

export function optionOf<T extends string>(options: Option<T>[], value: T): Option<T> {
  return options.find(o => o.value === value) || options[0];
}

const day = (iso?: string) => (iso ? iso.slice(0, 10) : '');

/** What FourRealities has seen of each source on this site, for the admin page. */
export function detectionLine(gate: GateName, detected: DetectedSources): string {
  switch (gate) {
    case 'intent':
      return 'Jira issue links and remote links are always available.';
    case 'process': {
      const dg = detected.definitionguard;
      const hc = detected.herocoders;
      const parts: string[] = [];
      if (dg?.verifiedAt) parts.push(`signed DefinitionGuard records found since ${day(dg.verifiedAt)}`);
      else if (dg) parts.push(`DefinitionGuard records found since ${day(dg.seenAt)}, none verified yet`);
      if (hc) parts.push(`Checklists for Jira checklists found since ${day(hc.seenAt)}`);
      return parts.length > 0 ? `Seen on this site: ${parts.join('; ')}.` : 'No Definition of Done record seen on this site yet.';
    }
    case 'code':
      return detected.pullRequests ? `Pull request data found since ${day(detected.pullRequests.seenAt)}.` : 'No pull request data seen on this site yet.';
    case 'audit': {
      const ls = detected.ledgerseal;
      if (ls?.verifiedAt) return `Signed LedgerSeal records found since ${day(ls.verifiedAt)}.`;
      return ls ? `LedgerSeal records found since ${day(ls.seenAt)}, none verified yet.` : 'No LedgerSeal record seen on this site yet.';
    }
  }
}

/** Why Code can be Not applicable: it reads pull requests from Jira's Development field only (FR-1). */
export const CODE_NEEDS_DEV_FIELD =
  "Code needs Jira's Development field. Jira shows it when a development tool, for example Bitbucket, GitHub or GitLab, is connected to this site.";
export const CODE_NOT_APPLICABLE_HERE = 'Not applicable on this site (no Development field)';
const CODE_IN_USE_NO_EFFECT = 'In use (no effect: this site has no Development field)';

/** True unless the admin view says this site has no Development field (null). An older view counts as having it. */
export function siteHasDevField(devFieldId: string | null | undefined): boolean {
  return devFieldId !== null;
}

/** The Code choices. On a site without the Development field, "In use" says that it has no effect. */
export function codeOptions(devFieldId: string | null | undefined): Option<CodeMode>[] {
  if (siteHasDevField(devFieldId)) return CODE_OPTIONS;
  return CODE_OPTIONS.map(o => (o.value === 'on' ? { ...o, label: CODE_IN_USE_NO_EFFECT } : o));
}

/** The helper text under a source control: what was seen, and for Code what it needs. */
export function sourceHelper(gate: GateName, detected: DetectedSources, devFieldId: string | null | undefined): string {
  if (gate !== 'code') return detectionLine(gate, detected);
  return siteHasDevField(devFieldId)
    ? `${CODE_NEEDS_DEV_FIELD} ${detectionLine('code', detected)}`
    : `${CODE_NEEDS_DEV_FIELD} This site has no Development field, so Code is Not applicable on every issue, whatever you choose here.`;
}

/** The "Now:" line under a source control. Code on a site without the Development field is Not applicable. */
export function sourceNowLine(sources: SourcesInUse, gate: GateName, devFieldId: string | null | undefined): string {
  if (gate === 'code' && !siteHasDevField(devFieldId)) return `Now: ${GATE_LABEL.code}: ${CODE_NOT_APPLICABLE_HERE}.`;
  return `Now: ${inUseWord(sources, gate)}.`;
}

/** "In use" or "Not used on this site" for one check. */
export function inUseWord(sources: SourcesInUse, gate: GateName): string {
  return gateInUse(sources, gate) ? `${GATE_LABEL[gate]}: in use` : `${GATE_LABEL[gate]}: not used on this site`;
}

/** Decision issue types typed as one comma-separated line. */
export function parseIssueTypes(text: string): string[] {
  return text.split(',').map(t => t.trim()).filter(t => t.length > 0);
}

/** Settings with one field changed, for the admin form. */
export function withSetting<K extends keyof EvidenceSourceSettings>(settings: EvidenceSourceSettings, key: K, value: EvidenceSourceSettings[K]): EvidenceSourceSettings {
  return { ...settings, [key]: value };
}
