# FourRealities fixes: progress log

Branch `feature/fourrealities-marketplace-fixes`, from `master` at `7f87747`. One entry per fix, in the order built, with the commit and the proof. The review is `docs/sdlc/suite-readiness-review-2026-11/fourrealities-readiness.md` (blockers BL-1 to BL-5, findings F-H1 to F-L7). The owner's instruction (2026-11-06) was "do NOW": every recommendation of the review is adopted, and each adopted decision is recorded here and in its ADR.

Gate for every fix: `npx tsc --noEmit` with no errors, `npm test` green with the per-file coverage thresholds in `jest.config.js`, `npm run build` clean, `forge lint` clean. Node v26.13.0 and npm 11.20.0 on the host.

## 2026-11-06

### BL-5. No high or critical advisory in the production dependencies

- **What changed:** `apps/fourrealities/package.json` has `"overrides": { "prosemirror-view": "^1.42.3" }`, the same override CascadePlan uses; `package-lock.json` regenerated (`prosemirror-view` 1.42.9, deduped under `@atlaskit/editor-prosemirror`).
- **Proof:** `npm audit --omit=dev --audit-level=high`: exit 1 before (13 advisories, 8 high), exit 0 after (7 moderate, none high or critical). `tsc --noEmit` no errors; `npm test` 403 of 403 passed, thresholds met.
- **Not done here:** the CI audit step runs for CascadePlan only (`if: matrix.app == 'cascadeplan'` in `.github/workflows/apps-ci.yml`). That file is shared with the sessions that fix DefinitionGuard and LedgerSeal, so this session does not edit it. See "Owner commands".
