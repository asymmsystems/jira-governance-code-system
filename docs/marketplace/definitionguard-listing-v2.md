# Atlassian Marketplace Listing v2: DefinitionGuard for Jira

Draft, 2026-11-01. Written from the code on branch `feature/definitionguard-research-build` and the research in `docs/sdlc/definitionguard-usp-ux-research-2026-11/`. `definitionguard-listing.md` (v1) is not changed.

## Tagline

A Definition of Done that Jira enforces: evidence, reviewer rules and waivers for each item, and a history you can check.

## Key Capabilities

- **Your own Definition of Done per issue type.** Project admins list the items on the project settings page: mandatory or optional, and in order. New issues of that type get the list. Open issues keep their version until an admin re-syncs them; ticks on unchanged items are kept.
- **Items that need evidence.** An item can require a link or a note before it counts as done.
- **Reviewer rules.** An item can need a Jira permission (for example Resolve issues), or be closed to the current assignee. The rule is checked again at the moment of the move to Done.
- **Waivers with a reason.** A user with the waiver permission can mark an item as not applicable. The reason is kept in the history.
- **A gate on moves to Done.** The DefinitionGuard validator blocks a move into a Done-category status while a mandatory item is open. The message names every open item. If DefinitionGuard cannot check, the move is blocked. Admins can let chosen statuses through, for example Canceled.
- **A coverage check.** The settings page lists every transition into a Done-category status and shows which ones the gate is not on yet.
- **A history you can check.** Every change is recorded with who, when, the evidence and any reason. The history check shows whether the stored history was edited, removed or reordered. Project admins can export it as JSON.
- **A signed summary for other tools.** The issue property `definitionguard-dod` carries the item counts and the open items, signed with Ed25519.

**How the gate works.** A Jira admin adds the DefinitionGuard validator to each transition in the workflow editor. The app cannot add it for you. The coverage check shows where it is missing. Works in company-managed projects; the validator is also offered in team-managed projects.

DefinitionGuard does not certify your team against any standard. It helps you keep a record that an auditor can read.

### Each capability and its proof

| Capability | Backlog item | Test |
|---|---|---|
| Fails closed: any error blocks the move and writes nothing | B-01 | `test/validator/validate-transition.test.ts` |
| Permission checks as the user on every change | B-02 | `test/security/permissions.test.ts` |
| No lost updates when two people tick at once | B-03 | `test/storage/checklist-store.test.ts` |
| Bounded storage, history in pages | B-04 | `test/storage/size-budget.test.ts` |
| History check with its stated limit | B-05 | `test/domain/chain-verify.test.ts` |
| Project templates for admins | B-06 | `test/settings/project-templates.test.ts` |
| People shown from their Jira account, never stored by name | B-07 | `test/ui/attribution.test.ts` |
| Marketplace licensing | B-09 | `test/security/licence.test.ts` |
| One rule for Done-category moves, exempt statuses | B-10 | `test/validator/gate-rule.test.ts` |
| Evidence and evidence-required items | B-11 | `test/resolvers/evidence.test.ts` |
| Required permission, not the assignee, waivers | B-12 | `test/resolvers/roles-waivers.test.ts` |
| Clear panel text, accessible names, no raw errors | B-13 | `test/ui/panel-view-model.test.ts` |
| Signed issue property on every change | B-14 | `test/integrity/attestation.test.ts` |
| History export | B-15 | `test/resolvers/export.test.ts` |
| Template versions and re-sync | B-16 | `test/settings/resync.test.ts` |
| Coverage check | B-17 | `test/settings/coverage.test.ts` |
| Retry on Jira rate limits | B-18 | `test/jira/jira-client.test.ts` |
| Data model after the Silverston patterns (as Apache OFBiz implements them) | B-21 | `test/domain/event-log.test.ts` |

## Runs on Atlassian

DefinitionGuard runs on Atlassian Forge. The manifest declares no egress, so the app sends no data outside your Atlassian site. Atlassian decides whether an app gets the Runs on Atlassian badge; this listing does not claim it.

## Security

- **Scopes.** The app requests these scopes, and why:
- `read:jira-work`: read issues, statuses and your Jira permissions.
- `write:jira-work`: write the `definitionguard-dod` issue property.
- `storage:app`: keep checklists and their history in Forge storage.
- `read:workflow:jira`: read workflows for the coverage check. Read only.
- **Who can change what.** Ticking needs Edit issues on the issue. Resetting, exporting and settings need Administer projects. Each check runs as the user.
- **Where data lives.** Checklists, history and templates are stored in Forge storage for your site.
- **The signature.** The signature shows that DefinitionGuard wrote the issue property. The app vendor holds the signing key, so the signature does not protect against the vendor. The public key to check it is published in `docs/marketplace/definitionguard-public-key.pem`. Other apps and users can still write the issue property; the gate never reads it.
- **The history check.** It shows edits, removals and reordering of the stored history. It does not stop someone who can rewrite all of the app's stored data and the history check with it, and that includes the app vendor.
- **Tests.** The code has automated tests with at least 90% branch coverage for each source file. The UI files are rendered from tested view models; the UI files themselves are not measured.

## Pricing

- **Up to 10 users:** free.
- **11 to 100 users:** $1.00 per user per month. This is the top of the price band for Jira checklist apps: Checklists for Jira (Enterprise) charges $1.00 and Checklists for Jira (Pro) $0.82 (Atlassian Marketplace, read 2026-11-01). The price assumes the evidence, reviewer and waiver features above.
- **101 to 250 users:** $0.80 per user per month.
- **251 users or more:** volume tiers down to $0.40 per user per month.
