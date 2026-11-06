# FourRealities

FourRealities shows, for each Jira issue, whether four kinds of delivery evidence exist, and where each piece of evidence comes from.

| Check | Evidence | How FourRealities knows |
|---|---|---|
| **Intent** | A link to a Confluence page on this site, or to an issue of a decision type | It reads the link from Jira; a Confluence page is "verified" when Confluence returns it, otherwise "link only" |
| **Process** | The Definition of Done record of DefinitionGuard, or the `checklist` property of Checklists for Jira | A DefinitionGuard record counts when its Ed25519 signature is verified; otherwise it counts like no record |
| **Code** | Pull request count and state from the Jira Development field | A heuristic: apps cannot read review approvals |
| **Audit** | The approval seal record of LedgerSeal | Counts when its Ed25519 signature is verified |

A Jira administrator chooses the source of each check on the admin page **FourRealities gate authority**. A check that is not in use is not scored and shows "Not used on this site", so a site without the other apps is not marked down.

The **Reality Alignment Index (RAI)** is the share of scored checks with evidence found, with risk levels Critical (below 50), High (below 70), Medium (below 85) and Low.

- [Admin Guide](/apps/fourrealities/admin-guide)
- [User Guide](/apps/fourrealities/user-guide)
- [Resolving missing evidence](/apps/fourrealities/resolving-drift)
