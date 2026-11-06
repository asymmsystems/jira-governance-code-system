#!/usr/bin/env python3
# Mutation runner for the FourRealities follow-ups review. Each mutation edits one source file in
# the clone, runs the full test suite on the host, reports the failing count, and restores the file.
import subprocess, sys, re, pathlib

APP = pathlib.Path('/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/fourrealities-followups/checkout/apps/fourrealities')
SM = 'src/manager/default-snapshot-manager.ts'
GE = 'src/engine/default-gate-engine.ts'
HA = 'src/accessor/default-kvs-attestation-history-accessor.ts'
IM = 'src/manager/default-issue-evidence-manager.ts'

M = {
  'no-time-limit': (SM, 'i < pending.length && Date.now() < until;', 'i < pending.length;'),
  'no-grace': (SM, 'deadline + HISTORY_GRACE_MS)', 'deadline)'),
  'sequential': (SM, 'await Promise.all(pending.slice(i, i + HISTORY_BATCH).map(p => this.d.history.raise(p.id, p.seen, p.current)));',
                 'for (const p of pending.slice(i, i + HISTORY_BATCH)) await this.d.history.raise(p.id, p.seen, p.current);'),
  'history-before-save': (SM, '    await this.d.snapshots.saveSnapshot(meta, rows, summary);\n',
                          '    await this.raiseHistory(search.facts, history, deadline + HISTORY_GRACE_MS);\n    await this.d.snapshots.saveSnapshot(meta, rows, summary);\n'),
  'snapshot-no-history': (SM, '    await this.raiseHistory(search.facts, history, deadline + HISTORY_GRACE_MS);\n    return', '    return'),
  'panel-no-history': (IM, 'await this.d.history.raise(issueId, seenVersions, attestationHistory);', 'void 0;'),
  'isOlder-stateVersion-first': (GE, '  if (record.issuedAt && seen.issuedAt) return record.issuedAt < seen.issuedAt;\n  if (typeof record.stateVersion === \'number\' && typeof seen.stateVersion === \'number\') {\n    return record.stateVersion < seen.stateVersion;\n  }\n  return false;',
                                 '  if (typeof record.stateVersion === \'number\' && typeof seen.stateVersion === \'number\') {\n    return record.stateVersion < seen.stateVersion;\n  }\n  return Boolean(record.issuedAt && seen.issuedAt && record.issuedAt < seen.issuedAt);'),
  'newer-stateVersion-first': (HA, '  if (a.issuedAt && b.issuedAt) return b.issuedAt > a.issuedAt ? b : a;\n  if (typeof a.stateVersion === \'number\' && typeof b.stateVersion === \'number\') return b.stateVersion > a.stateVersion ? b : a;\n  return b.issuedAt ? b : a;',
                               '  if (typeof a.stateVersion === \'number\' && typeof b.stateVersion === \'number\' && a.stateVersion !== b.stateVersion) {\n    return a.stateVersion > b.stateVersion ? a : b;\n  }\n  return (b.issuedAt || \'\') > (a.issuedAt || \'\') ? b : a;'),
  'isOlder-and-both': (GE, '  if (record.issuedAt && seen.issuedAt) return record.issuedAt < seen.issuedAt;\n',
                       '  if (record.issuedAt && seen.issuedAt && typeof record.stateVersion === \'number\' && typeof seen.stateVersion === \'number\') return record.issuedAt < seen.issuedAt && record.stateVersion < seen.stateVersion;\n  if (record.issuedAt && seen.issuedAt) return record.issuedAt < seen.issuedAt;\n'),
}

names = sys.argv[1:] or list(M)
for name in names:
    rel, old, new = M[name]
    p = APP / rel
    src = p.read_text()
    if src.count(old) != 1:
        print(f'{name}: pattern found {src.count(old)} times, skipped'); continue
    p.write_text(src.replace(old, new))
    try:
        r = subprocess.run(['flatpak-spawn', '--host', 'bash', '-lc', f'cd {APP} && npx jest --silent 2>&1 | grep -E "^Tests:"'], capture_output=True, text=True)
        print(f'{name}: {r.stdout.strip()}')
    finally:
        p.write_text(src)
