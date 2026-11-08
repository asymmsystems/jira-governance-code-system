# FourRealities for Jira

FourRealities is a Forge app for Jira Cloud. For each Jira issue it shows four checks of delivery evidence, each with a state and its source, and a project dashboard:

1. **Intent:** a link to a Confluence page on this site, or to an issue of a decision type.
2. **Process:** the Definition of Done record of DefinitionGuard, or the `checklist` property of Checklists for Jira (HeroCoders).
3. **Code:** pull request count and state from the Jira Development field (a heuristic: apps cannot read review approvals).
4. **Audit:** the approval seal record of LedgerSeal.

DefinitionGuard and LedgerSeal records are scored only when their Ed25519 signature is verified (ADR-012). A Jira administrator chooses the source of each check on the admin page "FourRealities gate authority"; a check that is not in use is not scored (ADR-013). Account ids are stored only where a rule needs them and are reported weekly (ADR-014). The specification is `docs/spec/fourrealities-spec-v4.md` (v3 and earlier are frozen).

## Evidence reports (ADR-015)

Evidence reports for change-management audits: for one project and one date range, a signed record of the issues in scope with their four checks, the DefinitionGuard and LedgerSeal records FourRealities verified, its Code exceptions and rework notes, and who changed which field and when (Jira's changelog). FourRealities is not an administrative audit log: Jira's audit log and Atlassian Guard keep that.

- Project page, tab "Evidence reports": made on request (project or Jira administrators, or a member of an evidence report group) or on a weekly or monthly schedule (project or Jira administrators). Each report has `report.json`, `report.csv` and a `manifest.json` signed with Ed25519 (key `fr-dev-2026-11` in development, `keys/`); a manifest holds the SHA-256 of the previous report's manifest. A download needs Browse projects and every issue of the report visible to the user. People are party tokens in the signed files; an unsigned people file maps them to names at download.
- Built by a queue consumer as the app, for the issue ids that a search as the requesting user returned. Files are kept in Forge Object Store (Preview) and removed after the retention a Jira administrator sets (default 400 days, 90 days to 7 years); a Jira administrator may delete a report early, with a reason, leaving a tombstone. At most 10,000 issues, 50 MB per file and 200 reports per project.
- Check a report offline: `tools/verifier/verify-fourrealities-report.mjs` (the public `jira-governance-code-cli`).
- Spike results and the changes they made: `docs/sdlc/fourrealities-evidence-reports-2026-11/spike-results.md`.

## Platform

- Runs on Atlassian Forge (UI Kit, `nodejs22.x`). The manifest declares no external egress.
- Storage: Forge Key-Value Storage (`@forge/kvs`) and, for evidence report files, Forge Object Store (`@forge/object-store`, Preview). Report jobs run in a Forge async events consumer (`@forge/events`).
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
