# FourRealities research and build: final report

Date: 2026-11-01. Branch `feature/fourrealities-research-build` in the worktree `gemini-earning-fr-build`. Not pushed: the worktree has no git remote. Not merged, not tagged.

## 1. What was done

- **Part A (research):** `research-brief.md`, `ux-spec.md`, `backlog.md`, `round-log.md` in this folder. The owner approved the backlog ("APPROVED now all").
- **Domain review (owner request, "Option A"):** ADR-001 (evidence data model) and ADR-002 (volatility layering), approved with Option C. Backlog items B-29 to B-32 added.
- **Part B (build):** B-01 to B-25 and B-29 to B-32 built test-first, one item per commit, each row in `round-log.md` with tests, results, coverage, graders and commit. B-26 to B-28 stay BLOCKED (they need signed sibling properties). B-23 was built after the owner chose "B".
- **Spec:** `docs/spec/fourrealities-spec-v2.md` (v1 frozen).
- **Loop 3:** `forge lint` clean; deployed to the development environment only (versions 3.2.0, 3.3.0, 3.4.0); read-only live check on DEMO; live write check on AUDT-1 (owner chose "Option B"); listing draft `docs/marketplace/fourrealities-listing-v2.md` (v1 file and live listing unchanged).

## 2. Final state

| Check | Result |
|---|---|
| TypeScript | `tsc` 0 errors |
| Tests | 321 of 321 pass |
| Coverage | at least 90% on every source file; overall statements 99.63%, branches 97.02%, functions 99.03%, lines 99.83% |
| Graders | `grade_tdd` PASS, `grade_security` PASS, `grade_ui` PASS |
| Architecture test | 14 rules (ADR-002 layering, UI logic in plain modules, headers, no `any` type) |
| `forge lint` | no issues |

## 3. "After" benchmark (ux-spec section 3 targets)

| Target | Baseline (original code) | After | Met |
|---|---|---|---|
| Largest KVS value at 1,000 issues, at most 100 KiB, no growth per view | 1,571,971 B | 76,066 B (snapshot chunk); `fr:cfg:site` 168 B | Yes |
| 52 consecutive views at 1,000 issues, 0 failures | not met (value over the KVS limit) | 0 failures | Yes |
| `getIssueAlignment`: at most 3 Jira calls, all as the user, no undocumented endpoint | 5 calls as the app, including 3 to `/rest/dev-status` | 2 calls as the user | Yes |
| Read views at 50, 300, 1,000 issues | not comparable | 4, 6, 13 KVS gets | n/a |
| CPU per dashboard view at 1,000 issues, at most 200 ms | not measured | not measured | Unknown |
| Scheduled snapshot at 1,000 issues within 300 s | not measured | not measured in time; call model bounded (paged search plus one remote-link read per started issue, inside a 540 s budget) | Unknown |
| Live project page on DEMO renders within 10 s | crashed (FR-01) | renders | Yes |

## 4. Live write check (AUDT-1)

Seven writes, all to AUDT-1, each listed in `round-log.md` (Loop 3). Results: the decision link turned Intent to "Evidence found" and the panel updated in place with "Link added. Intent: Evidence found." (B-17); the exception request, the withdrawal and the rework note worked and were read back from the issue property; an approval by the requester was refused before any write. No sealed issue was touched, DEMO-26 was not repaired, and no LedgerSeal or DefinitionGuard key was written.

## 5. Open points for the owner

1. **L3-1, approver rule (decision needed).** The owner is a Jira administrator but does not hold `ADMINISTER_PROJECTS` on AUDT, so FourRealities refuses the owner's approvals there. ADR-001 Option C names the project permission only. Choices: keep it (the project's permission scheme decides), or also accept the global Jira administrator permission.
2. **L3-3, fast text entry (unresolved).** Burst input from the browser tool kept only the last character in UI Kit text fields, before and after making the fields uncontrolled. Single key presses worked. A manual typing test by a person is needed.
3. **L3-4, lozenge width (visual).** With `maxWidth="100%"` the gate lozenges fill their container and look like bars.
4. **B-25.** The HeroCoders property shape comes from vendor documentation; check on a site with the app before release.
5. **B-23.** Marketplace licensing is enabled in `manifest.yml`; it takes effect on the next production deploy, which this run did not do.
6. **B-24 behaviour change.** A move inside one status category (In Review to In Progress) no longer counts as rework (spec v2, D-7).
7. **B-26 to B-28** stay BLOCKED.
8. **Probe data.** AUDT-1 (label `fr-probe`) stays In Progress with its remote link, exception events and rework note. Delete it when no longer needed; this run deletes nothing.
9. **Push.** Add a remote to push the branch.

## 6. Update after the report (2026-11-01, later the same day)

- **Owner decisions applied:** 1B (a Jira administrator may also approve; checked live: the administrator check passes and the requester rule still refuses), the lozenge width fix, the licence check in the daily snapshot, and the benchmark timing (dashboard read view at most 6.9 ms CPU at 1,000 issues; daily run 10 searches and 694 remote-link reads at 1,000 issues).
- **UX redesign B-33 to B-40** (owner approved the consultation review): four-gate pipeline, compact table rows with Alignment and Top finding, reality cards, alignment box with weekly delta, weakest gate and risk filter, "Why n%?", compact issue-context view, Inspect with Previous and Next, preset views. Checked live on DEMO and AUDT-1.
- **Now:** 354 tests pass; graders PASS; development version 3.10.0; ten writes on AUDT-1, all in `round-log.md`.
- **UI polish and unified titles (3.10.0):** module titles unified to "Four Realities" in `manifest.yml`; arrow glyphs removed from `GatePipeline` for clean vertical alignment and natural wrapping; styled card containers and sunken callout boxes added to the issue panel and gate rows.
- **B-42 completed:** "Request retrospective review" in the issue panel when Code is FOUND with reason PR_MERGED, posting an ADF comment to Jira as the user.
- **In-Jira UI Standard, UX Architecture Overhaul, and Deep UX Polish (B-43 to B-48 completed):** implemented and refined the approved standard from `docs/design/asymm-jira-ui-standard.md` inside the standalone-ready `src/brand/` shared UI library (`brand.ts`, `layout.tsx`, `README.md`). Unified all three Jira module titles (`projectPage`, `issuePanel`, `issueContext`) and in-app headers to "Four Realities" with bordered `Refresh` buttons. Replaced the cyan status box and numeric `Badge` with a clean elevated `StatusBanner` carrying a semantic left accent stripe, bold status `Lozenge`, and a full-width borderless `Next step:` callout strip rendered with baseline-locked `KeyValueInline`. Eliminated Jira Cloud `@atlaskit/css-reset` `<p>` 12px top-margin baseline shifts and inflated stack spacing by enforcing `Text as="span"` across all `Inline` and `Stack` trees and wrapping `StatTile` values in `<Box>`. Added reusable `KeyValueInline`, `CardHeader`, `LabeledInline`, and `AttributionLine` primitives, full-width `SubSection` `NoteBox` containers, `isPresetActive` / `togglePreset` preset state, `Issue k of n` step position in `Inspect`, and in-flight `submitting` double-submit protection across all write modals. Architecture and accessibility tests enforce 17 architecture rules plus `Text as="span"`, strict single-border, single-primary-button, and `<= 3` button-row invariants.
- **Monorepo Shared UI Package & RAI Clarity (3.17.0, 2026-11-03):** Extracted canonical `@asymm/jira-ui` monorepo package under `packages/asymm-jira-ui` (`brand.ts`, `layout.tsx`, 22 layout primitives) with tsconfig path mapping. Resolved unexplained acronym jargon by defining Reality Alignment Index (RAI) across trend cards, note boxes, and charts. Deployed as **3.17.0**.
- **Uniform Permission Management Standard & Shared Admin Module (3.18.0, 2026-11-03):** Reviewed LedgerSeal's two-tier authorization model and established the comprehensive Uniform Permission Management Standard (`docs/design/uniform-permission-management-standard.md`) across all four apps (LedgerSeal, FourRealities, DefinitionGuard, PlanShift). Extracted shared admin policy components into `@asymm/jira-ui` (`packages/asymm-jira-ui/src/admin.tsx`) with pure view-model helpers and `AdminPolicyPanel`. Configured Jest module mapping and added unit tests in `apps/fourrealities/test/brand/admin.test.tsx`.
- **Current Status (2026-11-03):** 32 suites, 386 of 386 tests pass; all graders PASS (`grade_tdd: PASS 96.4`, `grade_security: PASS`, `grade_ui: PASS`); `forge lint` clean (0 issues); deployed to development as **3.18.0**; ten writes on AUDT-1, all in `round-log.md`.
- **Next Operational Steps:** B-41 Confluence search in the Link Decision modal, live check on DEMO and AUDT-1, fast human typing test, and second-person approval check.


