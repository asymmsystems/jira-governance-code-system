# Atlassian Marketplace Listing: FourRealities for Jira (v2 draft)

Status: draft for the owner's review, 2026-11-01. Not published. The live listing and `fourrealities-listing.md` (v1) are unchanged.

## Tagline
Shows, for each Jira issue, which delivery evidence exists and where it comes from: a decision record, a Definition of Done, a pull request and an audit seal.

## What it does
- **Four gates per issue.** Intent (a linked Confluence page or decision issue), Process (a Definition of Done record), Code (pull request state from the Jira Development field) and Audit (a LedgerSeal record). Each gate says "evidence found", "evidence missing" or "not applicable", and names its source.
- **Honest about what it checks.** A link FourRealities reads itself is marked "verified by FourRealities". Records written by other apps are marked "not verified by FourRealities". Pull request state is marked "heuristic": apps cannot read review approvals.
- **Project dashboard.** Gate rates with their counts ("3 of 8 rated issues"), a triage table ordered by missing evidence, filters by assignee, sprint and gate, and a four-week trend with denominators.
- **Code exceptions with separation of duties.** A user can request a Code exception for work with no pull request. A project administrator who is not the requester or the assignee approves, rejects or revokes it. Every step is kept, with who and when.
- **Rework reasons.** Rework loops come from status categories in the changelog. Users can add a reason; reasons are kept as a list and never change a gate.
- **Confluence search.** Users can search Confluence pages directly from the Link Decision dialog to attach architecture decisions without copying and pasting URLs.
- **Uniform admin policy.** Administrators can define allowed groups and permission policies using the uniform Asymm Jira UI administration panel.
- **RAI as a secondary number.** The Reality Alignment Index is the share of rated gates with evidence found. It is always shown after the gates and with its parts. FourRealities never ranks people by it.

## Works with
- LedgerSeal and DefinitionGuard (same publisher): their issue properties are read as hints.
- Checklists for Jira (HeroCoders): its `checklist` issue property is read as a Process hint when no DefinitionGuard record exists.
- The Jira Development field (GitHub, Bitbucket, GitLab integrations): pull request counts and state.
- Atlassian Confluence: in-app page search and remote decision links.

## Limits
- FourRealities does not verify LedgerSeal, DefinitionGuard or HeroCoders records. Issue properties can be changed by any user who can edit the issue.
- It cannot read pull request approvals. A merged pull request is not shown as reviewed.
- It reads at most 2,000 issues per project, newest first, and says so when it stops.
- A move between two statuses in the same category (for example "In Review" back to "In Progress") is not counted as a rework loop.
- Project snapshots refresh daily and on "Refresh". The trend starts after two weekly snapshots.

## Data and permissions
- Runs on Atlassian Forge. The manifest declares no external egress.
- Scopes: `read:jira-work`, `write:jira-work`, `read:jira-user`, `storage:app`, `search:confluence`, `read:confluence-content.summary`.
  - `read:jira-work` and `read:jira-user`: reads issue facts, dev status, permissions and assignees.
  - `write:jira-work`: writes remote links and audit exception properties as the acting user.
  - `storage:app`: stores daily snapshots, audit exception events, and uniform admin policies in Forge KVS.
  - `search:confluence` and `read:confluence-content.summary`: enables in-dialog Confluence page search when linking architecture and intent decisions.
- FourRealities never writes LedgerSeal or DefinitionGuard data.
- App data (snapshots, exception events, rework notes, site settings, admin policies) is kept in Forge storage.
- Marketplace licensing is enabled. With an inactive licence the app shows "Licence not active" and reads nothing.

## Pricing
Set by the owner; unchanged from v1 until the owner decides otherwise.

## Claims removed from v1, and why
| v1 text | Reason |
|---|---|
| "Guarantee that no code bypasses mandatory peer review" | Apps cannot read review approvals (research H11). |
| "cryptographic audit seals" aggregated | Sibling properties are unsigned and were shown forgeable (research T-05). |
| "Executive high-level score ... instant visibility" | A single score invites gaming (research H5); RAI is now secondary. |
| "Complies natively with SOC 2, ISO 27001, and GDPR" | No evidence for an app-level compliance claim. |
| "Restricted to `read:jira-work` and `storage:app`" | The app also needs `write:jira-work` (spec v2, D-8). |
| "100% automated test coverage" | Coverage is at least 90% per file, about 99.8% of lines overall; 100% is not true. |
| "carries the official Runs on Atlassian badge" | Forge reports the app as eligible; the badge is not confirmed. |
| "Cross-Reality ... committed in Git" | Git is read only through the Jira Development field. |
