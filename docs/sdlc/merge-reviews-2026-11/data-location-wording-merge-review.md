# Data location wording merge review

- Date: 2026-11-07. Reviewer: independent merge review session.
- Repository: `asymmsystems/asymm-corporate-code-pfw` (corporate website). Branch `feature/data-location-wording` at `967a332` (one commit), cut from `develop` `27cf574`. Merged into `develop` with `--no-ff` as `707b109` and pushed. `main` (`72e1ba0`) and the tags are untouched.
- Purpose: fix L-62 of `data-badge-wording-merge-review.md`.

## 1. Verdict

**Merged into `develop`.** L-62 is fixed. No finding.

## 2. Check

- `product/jira-governance.html`, the data storage row: "Persisted in Atlassian Forge Key-Value Storage (KVS) within the customer tenant, ..." becomes "Persisted in Atlassian Forge storage for the customer's installation, and as Jira issue properties on the customer's own issues."
- This matches the listings. Forge storage is kept per app installation on the customer's site, and the apps write their own issue properties.
- `git grep -i tenant src` on the branch finds only `install-docker.html` of the Eliya guide ("multi-tenant production"), which is not about the Jira apps.
- Build `./mvnw -o clean process-resources` (Eliya): exit 0. The rendered page has the new wording, and "customer tenant" nowhere.
- `develop` still contains no Marketplace link commit of `feature/marketplace-live-links`.
