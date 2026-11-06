# FourRealities for Jira

FourRealities is a Forge app for Jira Cloud. For each Jira issue it shows four checks of delivery evidence, each with a state and its source, and a project dashboard:

1. **Intent:** a link to a Confluence page on this site, or to an issue of a decision type.
2. **Process:** the Definition of Done record of DefinitionGuard, or the `checklist` property of Checklists for Jira (HeroCoders).
3. **Code:** pull request count and state from the Jira Development field (a heuristic: apps cannot read review approvals).
4. **Audit:** the approval seal record of LedgerSeal.

DefinitionGuard and LedgerSeal records are scored only when their Ed25519 signature is verified (ADR-012). A Jira administrator chooses the source of each check on the admin page "FourRealities gate authority"; a check that is not in use is not scored (ADR-013). Account ids are stored only where a rule needs them and are reported weekly (ADR-014). The specification is `docs/spec/fourrealities-spec-v3.md`.

## Platform

- Runs on Atlassian Forge (UI Kit, `nodejs22.x`). The manifest declares no external egress.
- Storage: Forge Key-Value Storage (`@forge/kvs`).
- Scopes: `read:jira-work`, `write:jira-work`, `storage:app`, `search:confluence`, `read:confluence-content.summary`, `read:jira-user`, `report:personal-data` (each justified in `docs/marketplace/submission/fourrealities-submission-notes.md`).

## Metrics

- **Reality Alignment Index (RAI):** percent of scored checks with evidence found.
- **M11:** share of rated issues traced to a decision record.
- **M29 (heuristic):** share of rated done issues with a merged pull request.
- **M30:** share of started issues with a rework loop: a status change from a done category back to a not-done category, or from in progress back to to do. A move between two statuses of the same category (for example "In Review" back to "In Progress") is not counted.

## Build and test

Install the shared UI package first, then the app (the same order as `.github/workflows/apps-ci.yml`):

```bash
cd packages/asymm-jira-ui && npm ci
cd ../../apps/fourrealities && npm ci
npx tsc --noEmit
npm test          # Jest with per-file coverage thresholds of 90%
npm run build
npm audit --omit=dev --audit-level=high
```

Live checks and Marketplace screenshots on the development site: `test/live/` (Python and Playwright; needs `CASCADEPLAN_LIVE_COOKIES`).
