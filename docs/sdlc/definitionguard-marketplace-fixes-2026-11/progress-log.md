# DefinitionGuard Marketplace fixes: progress log

Branch `feature/definitionguard-marketplace-fixes`, from `7f87747`, in the worktree `/home/fahimfarookme/.cache/jira-suite-fixes/definitionguard`. The review is `docs/sdlc/suite-readiness-review-2026-11/definitionguard-readiness.md` (blockers BL-1 to BL-7, findings H-1 to H-3, M-1 to M-8, L-1 to L-8). One entry per fix, in the order built, with the commit and the proof.

Owner instruction (2026-11-06): "do NOW". The recommendations of the review are adopted without further questions; each adopted decision is recorded below as "[ADOPTED: owner instruction 'do NOW', 2026-11-06]".

Baseline at `7f87747` (clean install of `packages/asymm-jira-ui`, then the app): `tsc --noEmit` exit 0; 28 suites, 347 tests passed; coverage statements 99.16%, branches 96.28%, functions 97.23%, lines 99.17%.

## 2026-11-06

### BL-5. No high or critical advisories in the production dependencies (and L-7 test headers)

- **Decision:** [ADOPTED: owner instruction 'do NOW', 2026-11-06] the same `overrides` entry as CascadePlan.
- **What changed:**
  - `apps/definitionguard/package.json`: `"overrides": { "prosemirror-view": "^1.42.3" }`; `package-lock.json` regenerated with `npm install` (only `prosemirror-view` 1.41.5 to 1.42.9 and its nested `prosemirror-model` 1.25.12 changed).
  - `test/hygiene.test.ts`: new test "(BL-5) pins prosemirror-view ...", and the header test now covers `test/` as well as `src/` (L-7). `test/domain/checklist-engine.test.ts` and `test/domain/hasher.test.ts` got the Asymm Systems header.
- **Proof:**
  - Before: `npm audit --omit=dev --audit-level=high` "13 vulnerabilities (5 moderate, 8 high)", exit 1 (review section 8).
  - After: `npm audit --omit=dev --audit-level=high` exit 0, "7 moderate severity vulnerabilities" (glob and minimatch through `@forge/manifest`; the only offered fix is a breaking downgrade of `@forge/bridge`, so they stay). `npm ls prosemirror-view`: every copy is 1.42.9.
  - `rm -rf node_modules && npm ci`: exit 0. Full suite: 28 suites, 348 tests passed.
- **Left for the main session:** the CI audit step runs only for CascadePlan (`.github/workflows/apps-ci.yml`, `if: matrix.app == 'cascadeplan'`). This session does not edit that file. Change needed: drop the `if:` line of the step "Dependency audit (production, high and critical)" and use `working-directory: apps/${{ matrix.app }}`.

## Site changes needed

(The main session applies these to the asymm.systems site repository. Each: page, old text, new text.)

## Owner commands

(Commands only the owner runs. Nothing here has been run by this session.)
