# Data badge wording merge review

- Date: 2026-11-07. Reviewer: independent merge review session.
- Repository: `asymmsystems/asymm-corporate-code-pfw` (corporate website). Branch `feature/data-badge-wording` at `473b00e` (one commit), cut from `develop` `23226e3`. Merged into `develop` with `--no-ff` as `27cf574` and pushed. `main` (`72e1ba0`) and the tags are untouched: the coordinator releases.
- Change: `src/main/jbake/content/product/jira-governance.html`, one badge label. "Customer Tenant Data Residency" becomes "Data stays in Atlassian".

## 1. Verdict

**Merged into `develop`.** The new label is true. One Low finding remains on the same page, outside this change.

## 2. Check

- "Data stays in Atlassian" matches what the listings say:
  - each app keeps its data in Forge storage of the customer's site and in issue properties of the customer's own issues;
  - each calls only Atlassian APIs (the site, Confluence for FourRealities, and personal data reporting);
  - no manifest declares external egress.
- It also matches the data-handling sentence of `/security`, section 7, and the suite page data storage line, merged at `23226e3`.
- Build `./mvnw -o clean process-resources` (Eliya): exit 0. The rendered `product/jira-governance.html` has the new label once, and the old one nowhere.
- `develop` still contains no Marketplace link commit of `feature/marketplace-live-links`.

## 3. Finding

- **L-62 (Low).** The same page still says "Persisted in Atlassian Forge Key-Value Storage (KVS) within the customer tenant" (line 121, data storage row). Forge storage is Atlassian's platform storage for the site, not a customer tenant. This is the wording L-32 (`distribution-kit-ledgerseal-post-merge-review.md`) removed from the posts, and the badge change removes it here. Suggested: "Persisted in Atlassian Forge storage for the customer's site, and as Jira issue properties on the customer's own issues."
