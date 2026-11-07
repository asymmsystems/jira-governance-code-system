<!--
Copyright (c) 2026 Asymm Systems. All rights reserved.

@author Fahim Farook
-->
# LedgerSeal regulated build: progress log

Branch `feature/ledgerseal-regulated`, clone `jira-governance/repository/tmp/ls-build`. Every deploy
went to the Forge **development** environment only. Production was not touched. Nothing was merged.

## Phase 0: ADRs accepted, spec v4 (commit `7793b25`)

- ADRs renumbered because FourRealities already owns ADR-015: `adr-00015` to `adr-00016`
  (Part 11 signing), `adr-00016` to `adr-00017` (approval routes), `adr-00017` to `adr-00018`
  (transition signing). Every reference in the three ADRs and the draft delta was changed in reverse
  order (017 to 018 first), so no number was changed twice. No other file named them.
- Status Accepted, with the owner's decisions of 2026-11-08 (Q-01 changed, Q-02, Q-03, Q-05, Q-09)
  and the spec defaults for the other open questions (Q-04, Q-06, Q-07, Q-08, Q-10 to Q-14), each
  recorded in its ADR.
- `docs/spec/ledgerseal-spec-v4.md`: v3 with the accepted deltas, sections 14 to 19 new. v3 frozen
  (md5 `b922d63b4cfbdc356129ffe459bd975e`), the draft delta frozen (md5 `85eb9e70b09c22af03be54a4842939eb`).

## Phase 1: platform spikes (report to the owner)

Full evidence: `spike-results.md`. Development version **6.0.0** (spike build; scope
`send:notification:jira` added, so a major version; installed on the development site with
`forge install --upgrade`).

**Option B/C decision: B (emailed single-use code through Jira's notify API).**

| Owner's condition | Result |
|---|---|
| (1) Reaches the signer themself whatever "notify me about my own changes" says | Pass, as the app: 204 and delivered with the setting off and on. As the user: 400 "No recipients were defined" with it off, 204 with it on, so LedgerSeal calls it as the app |
| (2) Scope not Beta, or acceptable | `send:notification:jira` is Beta in the OpenAPI; accepted as for `write:issue.property:jira`, which is also Beta and already in production; lint, deploy and the Runs on Atlassian check accepted it. `write:jira-work` (Current) not used: it would allow issue edits |
| (3) About 60 s | 1, 1, 1, 2, 1 s over 5 sends (3 s for the first, setting off) |
| (4) Code not in issue history or comments | None of 7 codes in the change log, comments or issue; `updated` unchanged |

Other spikes: S-1 pass (UI Kit field edit view renders and calls its resolver on the new
transition dialog); S-2 pass (`user` and the field in top-level `modifiedFields`, on the issue view
and the board); S-3 pass (history keeps only the intent id); S-4 issue view, board and list view open
the dialog, REST is blocked by the gate, bulk change not tested (fails closed); S-5 pass as the app;
S-6 pass (SVG data URI); S-7 secrets cannot join a transaction, `setSecret` honours `FAIL_IF_EXISTS`,
TTL works on plain keys, secrets and inside transactions.

No spike failed, so no fallback was used and nothing stopped the build.

Live changes and their undo (development site only): LSP workflow transition 41 got a spike screen
(10055) and lost it again; screen 10055 deleted; LSP-4 moved to Done twice by the spike and back to In
Progress; LSP-4's `customfield_10080` keeps the last spike intent id; the owner's preference
`user.notify.own.changes` set to true for the test and back to false; 8 spike emails sent to the
owner's own address; one dummy secret `ls3:spike:secret` in the development secret store.
