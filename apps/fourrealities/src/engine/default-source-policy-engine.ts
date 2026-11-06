/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: which evidence source each check uses on this site (ADR-013). Pure rules: the
 * settings an administrator chose, what FourRealities has seen on the site, and the site
 * configuration give the checks in use. "Detect" (auto) turns a check on only after its source was
 * seen: a verified sibling record, or pull request data.
 */

import {
  AuditMode,
  CodeMode,
  DEFAULT_SOURCE_SETTINGS,
  DetectedSources,
  EvidenceSourceSettings,
  IntentMode,
  IssueFacts,
  ProcessMode,
  SiteConfig,
  SourcesInUse
} from '../contract/data/models';
import { SourcePolicyEngine } from '../contract/engines';

export const MAX_DECISION_ISSUE_TYPES = 20;
export const MAX_ISSUE_TYPE_CHARS = 60;

const INTENT_MODES: IntentMode[] = ['on', 'off'];
const PROCESS_MODES: ProcessMode[] = ['auto', 'definitionguard', 'herocoders', 'off'];
const CODE_MODES: CodeMode[] = ['auto', 'on', 'off'];
const AUDIT_MODES: AuditMode[] = ['auto', 'ledgerseal', 'off'];

const ADMIN_PLACE = 'Jira settings > Apps > FourRealities gate authority';

/** The earlier of two ISO times; the first when only one is set. */
function earliest(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

export class DefaultSourcePolicyEngine implements SourcePolicyEngine {
  readonly serviceType = 'engine' as const;

  resolve(settings: EvidenceSourceSettings, detected: DetectedSources, config: SiteConfig): SourcesInUse {
    const dgDetected = Boolean(detected.definitionguard?.verifiedAt);
    const lsDetected = Boolean(detected.ledgerseal?.verifiedAt);
    const prDetected = config.devFieldId !== null && (config.pullRequestsSeen === true || Boolean(detected.pullRequests));
    const processAuto = settings.process === 'auto';
    const codeAuto = settings.code === 'auto';
    const auditAuto = settings.audit === 'auto';
    const process = settings.process === 'definitionguard' || settings.process === 'herocoders'
      ? settings.process
      : processAuto && dgDetected ? 'definitionguard' : null;
    return {
      intent: settings.intent !== 'off',
      process,
      code: settings.code === 'on' || (codeAuto && prDetected),
      audit: settings.audit === 'ledgerseal' || (auditAuto && lsDetected),
      decisionIssueTypes: settings.decisionIssueTypes.length > 0 ? settings.decisionIssueTypes : DEFAULT_SOURCE_SETTINGS.decisionIssueTypes,
      detected: { process: processAuto && dgDetected, code: codeAuto && prDetected, audit: auditAuto && lsDetected }
    };
  }

  sightings(facts: IssueFacts[], at: string): DetectedSources {
    const seen: DetectedSources = {};
    for (const f of facts) {
      if (f.properties.dod) {
        seen.definitionguard = { seenAt: at, ...(seen.definitionguard?.verifiedAt || f.attestations?.dod === 'VERIFIED' ? { verifiedAt: at } : {}) };
      }
      if (f.properties.ledgerseal) {
        seen.ledgerseal = { seenAt: at, ...(seen.ledgerseal?.verifiedAt || f.attestations?.ledgerseal === 'VERIFIED' ? { verifiedAt: at } : {}) };
      }
      if (f.properties.checklist) seen.herocoders = { seenAt: at };
      if (f.devField.present && f.devField.summary.count > 0) seen.pullRequests = { seenAt: at };
    }
    return seen;
  }

  merge(detected: DetectedSources, seen: DetectedSources): { detected: DetectedSources; changed: boolean } {
    const out: DetectedSources = { ...detected };
    const two = (a?: { seenAt: string; verifiedAt?: string }, b?: { seenAt: string; verifiedAt?: string }) => {
      if (!b) return a;
      const verifiedAt = earliest(a?.verifiedAt, b.verifiedAt);
      return { seenAt: earliest(a?.seenAt, b.seenAt) as string, ...(verifiedAt ? { verifiedAt } : {}) };
    };
    const one = (a?: { seenAt: string }, b?: { seenAt: string }) => (b ? { seenAt: earliest(a?.seenAt, b.seenAt) as string } : a);
    const dg = two(detected.definitionguard, seen.definitionguard);
    const ls = two(detected.ledgerseal, seen.ledgerseal);
    const hc = one(detected.herocoders, seen.herocoders);
    const pr = one(detected.pullRequests, seen.pullRequests);
    if (dg) out.definitionguard = dg;
    if (ls) out.ledgerseal = ls;
    if (hc) out.herocoders = hc;
    if (pr) out.pullRequests = pr;
    return { detected: out, changed: JSON.stringify(out) !== JSON.stringify(detected) };
  }

  notes(settings: EvidenceSourceSettings, detected: DetectedSources, sources: SourcesInUse): string[] {
    const notes: string[] = [];
    if (sources.process === null && settings.process !== 'off') {
      if (detected.definitionguard) {
        notes.push(`DefinitionGuard records were found on this site, but none could be verified, so the Process check is not used. A Jira administrator can turn it on in ${ADMIN_PLACE}.`);
      } else if (detected.herocoders) {
        notes.push(`Checklists for Jira checklists were found on this site. A Jira administrator can use them for the Process check in ${ADMIN_PLACE}.`);
      }
    }
    if (!sources.audit && settings.audit !== 'off' && detected.ledgerseal) {
      notes.push(`LedgerSeal records were found on this site, but none could be verified, so the Audit check is not used. A Jira administrator can turn it on in ${ADMIN_PLACE}.`);
    }
    return notes;
  }

  validate(input: unknown, now: string): { settings?: EvidenceSourceSettings; error?: string } {
    const v = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
    const pick = <T extends string>(value: unknown, allowed: T[], name: string): T | string => (allowed.includes(value as T) ? (value as T) : `Choose a valid ${name} source.`);
    const intent = pick(v.intent, INTENT_MODES, 'Intent');
    const process = pick(v.process, PROCESS_MODES, 'Process');
    const code = pick(v.code, CODE_MODES, 'Code');
    const audit = pick(v.audit, AUDIT_MODES, 'Audit');
    for (const [value, allowed] of [[intent, INTENT_MODES], [process, PROCESS_MODES], [code, CODE_MODES], [audit, AUDIT_MODES]] as Array<[string, string[]]>) {
      if (!allowed.includes(value)) return { error: value };
    }
    if (!Array.isArray(v.decisionIssueTypes)) return { error: 'Give the decision issue types as a list.' };
    const types = Array.from(new Set(v.decisionIssueTypes.map(t => String(t).trim().toLowerCase()).filter(t => t.length > 0)));
    if (types.length === 0) return { error: 'Name at least one decision issue type.' };
    if (types.length > MAX_DECISION_ISSUE_TYPES) return { error: `Name at most ${MAX_DECISION_ISSUE_TYPES} decision issue types.` };
    if (types.some(t => t.length > MAX_ISSUE_TYPE_CHARS)) return { error: `Each decision issue type has at most ${MAX_ISSUE_TYPE_CHARS} characters.` };
    return {
      settings: {
        schemaVersion: 1,
        intent: intent as IntentMode,
        process: process as ProcessMode,
        code: code as CodeMode,
        audit: audit as AuditMode,
        decisionIssueTypes: types,
        updatedAt: now
      }
    };
  }
}
