# LedgerSeal research and build: round log

One entry per research round and per build item. Dates are 2026-11-01 unless stated.

## Setup checks (Part A)

- `git -C gemini-earning status -s`: no change under `apps/ledgerseal`. Uncommitted changes exist under `apps/planshift` and `loop-engine/agents/` (not made by this research, not touched).
- Repo HEAD `423b9b2`, branch `feature/cascadeplan-research-build` (another session's branch). Part A did not switch branches and made no commit.
- md5 of every LedgerSeal file in the audit snapshot equals the current file (manifest, package, tsconfig, jest config, all `src/` and `test/` files, README, spec, listing). Every LS finding is therefore unchanged at its cited lines.
- `loop-engine/runs/ledgerseal_state.json` says `ALL_LOOPS_COMPLETE` with grade_tdd score 93.26. The graders check section keywords, the presence of two scope strings, banned import names, and global branch coverage (`loop-engine/graders/*.py`). None of them checks permissions, identity, storage growth or claims. A grader pass is not evidence for any verdict in this research.

## Round 1: collect

- Three research agents, run in parallel, each writing one evidence file in `~/.cache/gemini-earning-ledgerseal-research/sources/`:
  - `reg-sources.md`: 109 items (REG-01 to REG-109). The Part 11 text comes from the eCFR API (current to 2026-10-29). The FDA guidance, NIST, PIC/S and EU draft Annex 11 PDFs were extracted verbatim.
  - `native-forge-sources.md`: 107 items (NJ-01 to NJ-45, JAC-01 to JAC-20, FG-01 to FG-42). Ticket votes come from the public jira.atlassian.com API.
  - `marketplace-sources.md`: 15 apps, MP-01 to MP-69. Installs, prices and reviews come from the public Marketplace REST API.
- Rule incidents, recorded:
  - The Marketplace agent opened one third-party vendor page on `werkstack.atlassian.net` by mistake, and a second fetch to `polscheit.atlassian.net` returned a redirect only. No content from either is used.
  - The owner's site (`asymmsystems.atlassian.net`) was not contacted by any agent or probe.
- Probes (T-01 to T-03), written in `~/.cache/gemini-earning-ledgerseal-research/probes/`. They import `apps/ledgerseal/src` read-only, mock `@forge/api` (separate `asApp` and `asUser` entries) and `@forge/kvs`, and run with `NODE_ENV=production`, so the LS-14 bypasses are off except in T-02 A8.
  - Command: `flatpak-spawn --host /home/fahimfarookme/Documents/projects/gemini-earning/apps/ledgerseal/node_modules/.bin/jest -c ~/.cache/gemini-earning-ledgerseal-research/probes/jest.config.js`
  - Result: 3 suites, 16 tests, all pass (the tests record outcomes; they do not assert fixes). Host Node v26.13.0. Time 19.8 s.
  - Part B re-runs the same command with `LS_LABEL=after` to write `results-after*.json`.
  - `git status` after the run: no change under `apps/ledgerseal`. Jest cache is in the probes folder, and no coverage folder was written.

## Round 2: synthesise

- Verdicts H1 to H11, the competitor matrix, the clause map, the USP table and the claims list are in `research-brief.md`.
- UX benchmark, target interactions, baseline numbers and budgets are in `ux-spec.md`.
- New findings from the probes: NF-01 (an issue-type change breaks the seal with no field named), NF-02 (every view writes the property), and NF-03 (the full snapshot and email go to the browser).
- Correction made during synthesis: an early count said 11 of 22 present fields were excluded in T-03. That list included attachments, comments, issue type and project, which are hashed outside `fields`. The correct count is 7 of 22 (status, reporter, resolution and 4 custom fields). Both files were fixed.
- Graders were not run in Part A, because they run jest and tsc inside `apps/ledgerseal` and write `coverage/` there (brief section 14).

## Round 3: refute

One serious attempt per passing or near-passing USP. Searches were run on 2026-11-01.

| USP | Attempt | Result | Verdict change |
|---|---|---|---|
| U1 field diff tied to approval | Search for native Jira approval reset on edit, and for apps that compare approved and current values | Native approvals re-open on status re-entry, not on edit (MP-72). Found Signoff (2 installs, "approval goes stale", side-by-side view, MP-70) and Change Decision Evidence (1 install, "approved and current values side by side", MP-71). Neither states who or when | U1 Gap condition from P to ~. The gap now holds only for "with who and when" |
| U2 separation of duties on reseal | Search for e-signature apps with a different-approver rule after change | eSign: the same user can re-execute; nothing about a different approver (MP-13). JSM excludes listed users at first approval (NJ-15) | No change: gap holds, defensibility fails |
| U3 signed attestation, public key | Search for Jira apps whose approval an auditor verifies with a public key or Ed25519 | None. SealDoc uses HMAC (MP-54). Signoff uses an unnamed "fingerprint" (MP-70) | No change |
| U4 open verifier | Covered by the U3 search and the Vellum listing | Vellum recomputes a history chain, not an approval seal (MP-60) | No change |

Stop rule: in round 3 only U1 condition 1 changed, and no verdict in the hypothesis table changed. No item is still Unknown for a reason that another round of desk research can fix. H3, H8, H9 and the pain condition need buyer interviews. So the research stops after round 3.

## Part A exit checks

- Four output files exist in `docs/sdlc/ledgerseal-usp-ux-research-2026-11/`.
- Every cited source ID resolves to a row in `research-brief.md` section 9 (script check, 0 undefined IDs in the brief and in `ux-spec.md`).
- Every competitor matrix cell holds a source ID, a code reference or the word Unknown.
- `grep -cP '\x{2014}'` returns 0 for each of the four files (recorded at the end of Part A).

## Part B

### Gate and setup
- Owner approval in chat on 2026-11-01: "APPROVED now all". Recorded as the first line of `backlog.md`: B-01 to B-20, with the [MANIFEST], [VAR] and [MIGRATE] flags and the D-1 to D-3 recommendations.
- The main checkout is on another session's branch with its uncommitted work, so Part B uses a separate worktree: `/home/fahimfarookme/Documents/projects/gemini-earning-ls-build`, branch `feature/ledgerseal-research-build` from `master` (`5097bf5`, the audit commit). `apps/ledgerseal/node_modules` there is a symbolic link to the shared folder in the main checkout. No dependency was added.
- The four research files moved from the main checkout into this worktree.

### Baseline (B-00 check)
- `tsc --noEmit -p .`: exit 0.
- `jest --coverage`: 8 of 8 suites, 77 of 77 tests pass. Global: statements 98.01, branches 90.24, functions 100, lines 98.41. Per file branches: `index.ts` 90.9, `canonicalizer.ts` 87.7, `workflow-validator.ts` 90, others 100. `src/frontend/**` is excluded.
- The baseline passes, so no B-00 item is needed.
