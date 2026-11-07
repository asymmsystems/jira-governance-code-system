/**
 * Copyright (c) 2026 Asymm Systems. All rights reserved.
 * @author Fahim Farook
 * FourRealities: evidence report rules (ADR-015, HLD sections 3.3 to 3.5): field classes, the changes in
 * scope, report rows, the JSON and CSV files, the manifest body and the people file. Pure: no I/O, no
 * crypto; hashes and party tokens come in as data (ADR-002).
 */

import { ERASED_ACCOUNT, GATE_NAMES, GateExceptionEvent, IssueFacts, ReworkNote, SourcesInUse } from '../contract/data/models';
import {
  ChangelogEntry,
  DefinitionGuardRef,
  FieldClass,
  FieldInfo,
  LedgerSealRef,
  ManifestHeader,
  PeopleRow,
  REPORT_LIMITS,
  ReportChange,
  ReportData,
  ReportFilters,
  ReportIssue,
  ReportManifest,
  ReportRange,
  ReportWarning
} from '../contract/data/reports';
import { ReportEngine } from '../contract/reports';

/** Built-in fields whose values can hold any text (owner decision Q4). */
const FREE_TEXT_FIELDS = new Set(['summary', 'description', 'environment']);
const FREE_TEXT_CUSTOM = new Set(['com.atlassian.jira.plugin.system.customfieldtypes:textfield', 'com.atlassian.jira.plugin.system.customfieldtypes:textarea']);
const DAY_MS = 86_400_000;

export const CSV_COLUMNS = [
  'reportId', 'rowType', 'issueKey', 'issueId', 'issueType', 'changeAt', 'changelogId', 'author', 'fieldId', 'field', 'fieldClass',
  'from', 'to', 'fromString', 'toString', 'omitted', 'intent', 'process', 'code', 'audit', 'sealStatus', 'sealCertificateId',
  'sealSnapshotHash', 'dodHeadHash', 'dodComplete', 'codeExceptionStatus'
];

type Rec = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** The value cut to 500 characters, and whether it was cut. */
function cut(value: string | null): { value: string | null; cut: boolean } {
  if (value === null || value.length <= REPORT_LIMITS.valueMaxChars) return { value, cut: false };
  return { value: value.slice(0, REPORT_LIMITS.valueMaxChars), cut: true };
}

/**
 * One CSV cell (RFC 4180, every cell quoted). A cell that a spreadsheet would read as a formula (it starts
 * with =, +, -, @, a tab or a carriage return) gets a leading apostrophe; the JSON keeps the value.
 */
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function csvRows(rows: unknown[][]): string {
  return rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

/** Canonical JSON (ADR-012 decision 2): keys sorted at every level, no white space, undefined left out. */
export function canonicalJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const obj = value as Rec;
    const keys = Object.keys(obj).filter(k => obj[k] !== undefined).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${keys.map(k => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const numericOrder = (a: string, b: string) => (a.length - b.length) || (a < b ? -1 : a > b ? 1 : 0);
const dateOf = (iso: string) => iso.slice(0, 10);
const shiftDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * DAY_MS).toISOString().slice(0, 10);

function ledgersealRef(facts: IssueFacts): LedgerSealRef | null {
  const r = facts.properties.ledgerseal;
  if (!r || typeof r !== 'object') return null;
  const p = r as Rec;
  return {
    certificateId: str(p.certificateId),
    snapshotHash: str(p.snapshotHash),
    status: str(p.status),
    sealedAt: str(p.sealedAt),
    issuedAt: str(p.issuedAt),
    keyId: str(p.keyId),
    verification: facts.attestations?.ledgerseal || 'UNSIGNED'
  };
}

function definitionguardRef(facts: IssueFacts): DefinitionGuardRef | null {
  const r = facts.properties.dod;
  if (!r || typeof r !== 'object') return null;
  const p = r as Rec;
  return {
    headHash: str(p.headHash) ?? str(p.checklistHash),
    stateVersion: num(p.stateVersion),
    issuedAt: str(p.issuedAt),
    mandatoryCompleted: num(p.mandatoryCompleted) ?? num(p.completedCount),
    mandatoryTotal: num(p.mandatoryTotal) ?? num(p.totalCount),
    keyId: str(p.keyId),
    verification: facts.attestations?.dod || 'UNSIGNED'
  };
}

export class DefaultReportEngine implements ReportEngine {
  readonly serviceType = 'engine' as const;

  classifyField(fieldId: string, fields: FieldInfo[]): FieldClass {
    if (FREE_TEXT_FIELDS.has(fieldId)) return 'FREE_TEXT';
    const field = fields.find(f => f.id === fieldId);
    if (!field) return 'OTHER';
    if (field.custom && FREE_TEXT_CUSTOM.has(field.custom)) return 'FREE_TEXT';
    if (field.schemaType === 'user' || (field.schemaType === 'array' && field.schemaItems === 'user')) return 'USER';
    return 'OTHER';
  }

  reportChanges(entries: ChangelogEntry[], range: ReportRange, filters: ReportFilters, fields: FieldInfo[], tokenOf: Record<string, string>): ReportChange[] {
    const from = Date.parse(range.from);
    const to = Date.parse(range.to);
    const fieldFilter = new Set(filters.fieldIds);
    const actorFilter = new Set(filters.actors);
    const out: ReportChange[] = [];
    for (const entry of entries) {
      const at = Date.parse(entry.at);
      if (!(at >= from && at < to)) continue;
      const author = entry.authorAccountId ? tokenOf[entry.authorAccountId] ?? ERASED_ACCOUNT : null;
      if (actorFilter.size > 0 && (author === null || !actorFilter.has(author))) continue;
      for (const item of entry.items) {
        if (fieldFilter.size > 0 && !fieldFilter.has(item.fieldId)) continue;
        const fieldClass = this.classifyField(item.fieldId, fields);
        const base = { changelogId: entry.changelogId, at: new Date(at).toISOString(), author, fieldId: item.fieldId, field: item.field, fieldClass };
        if (fieldClass === 'FREE_TEXT') {
          out.push({ ...base, from: null, to: null, fromString: null, toString: null, omitted: { reason: 'FREE_TEXT', fromLength: (item.fromString ?? item.from ?? '').length, toLength: (item.toString ?? item.to ?? '').length } });
        } else if (fieldClass === 'USER') {
          const tok = (id: string | null) => (id ? tokenOf[id] ?? ERASED_ACCOUNT : null);
          out.push({ ...base, from: tok(item.from), to: tok(item.to), fromString: null, toString: null });
        } else {
          const parts = [cut(item.from), cut(item.to), cut(item.fromString), cut(item.toString)];
          const change: ReportChange = { ...base, from: parts[0].value, to: parts[1].value, fromString: parts[2].value, toString: parts[3].value };
          if (parts.some(p => p.cut)) change.truncated = true;
          out.push(change);
        }
      }
    }
    return out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : numericOrder(a.changelogId, b.changelogId)));
  }

  inScope(created: string, changes: ReportChange[], range: ReportRange): boolean {
    const at = Date.parse(created);
    return changes.length > 0 || (at >= Date.parse(range.from) && at < Date.parse(range.to));
  }

  reportIssue(input: Parameters<ReportEngine['reportIssue']>[0]): ReportIssue {
    const { facts, basics, tokenOf } = input;
    const tok = (id: string) => tokenOf[id] ?? ERASED_ACCOUNT;
    return {
      issueId: basics.issueId,
      issueKey: basics.issueKey,
      issueTypeName: basics.issueTypeName,
      summary: facts.summary.slice(0, REPORT_LIMITS.summaryMaxChars),
      created: basics.created,
      statusCategory: facts.statusCategory,
      statusId: basics.statusId,
      gates: input.gates,
      rai: input.rai,
      risk: input.risk,
      ledgerseal: ledgersealRef(facts),
      definitionguard: definitionguardRef(facts),
      codeException: input.events.map(e => ({ status: e.status, at: e.at, by: tok(e.byAccountId), asRole: e.asRole, reason: e.reason, ...(e.migrated ? { migrated: true } : {}) })),
      reworkNotes: input.notes.map(n => ({ recordedAt: n.recordedAt, by: tok(n.recordedBy), reason: n.reason, ...(n.notes ? { notes: n.notes } : {}) })),
      changes: input.changes
    };
  }

  accountIdsOf(entries: ChangelogEntry[], fields: FieldInfo[], events: GateExceptionEvent[], notes: ReworkNote[]): string[] {
    const ids = new Set<string>();
    const add = (id: string | null | undefined) => {
      if (id && id !== ERASED_ACCOUNT && id !== 'unknown-user') ids.add(id);
    };
    for (const e of entries) {
      add(e.authorAccountId);
      for (const item of e.items) {
        if (this.classifyField(item.fieldId, fields) === 'USER') {
          add(item.from);
          add(item.to);
        }
      }
    }
    for (const e of events) add(e.byAccountId);
    for (const n of notes) add(n.recordedBy);
    return Array.from(ids).sort();
  }

  tokensOf(issues: ReportIssue[], filters: ReportFilters, requestedBy: string): string[] {
    const tokens = new Set<string>(filters.actors);
    const add = (t: string | null) => {
      if (t && t.startsWith('pty_')) tokens.add(t);
    };
    add(requestedBy);
    for (const issue of issues) {
      for (const c of issue.changes) {
        add(c.author);
        if (c.fieldClass === 'USER') {
          add(c.from);
          add(c.to);
        }
      }
      for (const e of issue.codeException) add(e.by);
      for (const n of issue.reworkNotes) add(n.by);
    }
    return Array.from(tokens).sort();
  }

  canonicalJson(value: unknown): string {
    return canonicalJson(value);
  }

  reportJson(data: { header: ManifestHeader; sourcesInUse: SourcesInUse; issues: ReportIssue[]; missingSincePrevious: Array<{ issueId: string; issueKey: string }>; linksNotRead: number }): string {
    const warnings: ReportWarning[] = [];
    if (data.header.warning === 'UNSIGNED') warnings.push({ code: 'UNSIGNED' });
    if (data.linksNotRead > 0) warnings.push({ code: 'REMOTE_LINKS_NOT_READ', count: data.linksNotRead });
    const report: ReportData = {
      format: 'fourrealities-evidence-report-data/1',
      header: data.header,
      sourcesInUse: data.sourcesInUse,
      decisionIssueTypes: data.sourcesInUse.decisionIssueTypes,
      issues: [...data.issues].sort((a, b) => numericOrder(a.issueId, b.issueId)),
      missingSincePrevious: [...data.missingSincePrevious].sort((a, b) => numericOrder(a.issueId, b.issueId)),
      warnings
    };
    return canonicalJson(report);
  }

  reportCsv(reportId: string, issues: ReportIssue[]): string {
    const rows: unknown[][] = [CSV_COLUMNS];
    for (const issue of [...issues].sort((a, b) => numericOrder(a.issueId, b.issueId))) {
      const gate = (name: (typeof GATE_NAMES)[number]) => [issue.gates[name]?.state, issue.gates[name]?.verification].filter(Boolean).join(' ');
      const dg = issue.definitionguard;
      const dodComplete = dg && dg.mandatoryTotal !== null && dg.mandatoryCompleted !== null ? (dg.mandatoryCompleted >= dg.mandatoryTotal ? 'yes' : 'no') : '';
      const tail = [
        gate('intent'), gate('process'), gate('code'), gate('audit'),
        issue.ledgerseal?.status ?? '', issue.ledgerseal?.certificateId ?? '', issue.ledgerseal?.snapshotHash ?? '',
        dg?.headHash ?? '', dodComplete, issue.codeException[issue.codeException.length - 1]?.status ?? ''
      ];
      const head = [reportId];
      if (issue.changes.length === 0) {
        rows.push([...head, 'ISSUE', issue.issueKey, issue.issueId, issue.issueTypeName, '', '', '', '', '', '', '', '', '', '', '', ...tail]);
      }
      for (const c of issue.changes) {
        const omitted = c.omitted ? `FREE_TEXT (${c.omitted.fromLength} -> ${c.omitted.toLength} characters)` : '';
        rows.push([...head, 'CHANGE', issue.issueKey, issue.issueId, issue.issueTypeName, c.at, c.changelogId, c.author ?? '', c.fieldId, c.field, c.fieldClass, c.from ?? '', c.to ?? '', c.fromString ?? '', c.toString ?? '', omitted, ...tail]);
      }
    }
    return csvRows(rows);
  }

  manifest(header: ManifestHeader, files: ReportManifest['files'], keyId: string | null): { manifest: ReportManifest; signedText: string } {
    const manifest: ReportManifest = { ...header, files, ...(keyId ? { keyId } : {}) };
    return { manifest, signedText: canonicalJson(manifest) };
  }

  peopleCsv(rows: PeopleRow[]): string {
    return csvRows([
      ['token', 'accountId', 'displayName', 'active'],
      ...rows.map(r => [r.token, r.accountId ?? '', r.accountId === null ? 'a former user' : r.displayName ?? '', r.active === null ? '' : String(r.active)])
    ]);
  }

  fileName(projectKey: string, range: ReportRange, reportId: string, file: string): string {
    const base = `fourrealities-${projectKey}-${dateOf(range.from)}-${dateOf(range.to)}-${reportId.slice(0, 8)}`;
    if (file === 'report.json') return `${base}.json`;
    if (file === 'report.csv') return `${base}.csv`;
    return `${base}-${file}`;
  }

  scopeJql(projectId: string, range: ReportRange): string {
    return `project = ${projectId} AND updated >= "${shiftDays(range.from, -1)}" AND created < "${shiftDays(range.to, 1)}" ORDER BY created ASC`;
  }

  idsJql(ids: string[]): string {
    return `id in (${ids.filter(id => /^\d+$/.test(id)).join(',')})`;
  }
}
