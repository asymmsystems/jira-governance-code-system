# Regulated migration site merge review

- Date: 2026-11-08. Reviewer: independent merge review session.
- Repository: `asymmsystems/asymm-corporate-code-pfw` (corporate website). Branch `feature/regulated-migration` at `14f7a98`, from `develop` `f9fed05`. Three commits:
  - `b9c5532`: the LedgerSeal personal-data row on the compliance page;
  - `7fcd97a`: the CascadePlan administrator id (L-64);
  - `14f7a98`: the new page `product/jira-governance/regulated-migration.html` and a link card on the suite page.
- Two reviewer commits on top:
  - `f27b361`: Runs on Atlassian;
  - `71c25cf`: the FAQ's LedgerSeal personal data, as a separate commit.
- Merged into `develop` with `--no-ff` as `0df0c1e` and pushed. `main` (`aa77706`) and the tags are untouched.
- Outputs, not committed: `jira-governance/repository/tmp/review-regulated-out/` (site build log, fetched pages).

## 1. Verdict

**Merged into `develop`.**
- The page's claims match their sources.
- It says "planned" or "waiting for approval" wherever the work is not done.
- It has no Marketplace link.
- The requested fixes are made.

One Low finding (section 4).

## 2. Checks

| Claim | Source | Result |
|---|---|---|
| 16 December 2025 (no new DC apps) | Atlassian developer blog, 2025-09-08: "December 16, 2025: New Data Center apps can no longer be submitted to the Marketplace." | Match |
| 30 March 2026, 30 March 2028, 28 March 2029 (read-only); extended maintenance only by exception | https://www.atlassian.com/licensing/data-center-end-of-life | Match, word for word in substance |
| Data residency regions: US, EU, Germany, Switzerland, UK, Canada, Australia, Japan, Singapore, India, South Korea | https://www.atlassian.com/software/data-residency ("You can choose to pin your data to our US, EU, Australia, Germany, Singapore, Canada, UK, Japan, India, South Korea or Switzerland") | Match, all 11 |
| JCMA alternatives "are not recommended by Atlassian, and are selected based on similarity in functionality" | Atlassian, "Audit apps for your migration to cloud" | Match (gap research note) |
| Part 11 rows: 11.10(e) supported; 11.50 partly met; 11.70 signed by the app, auditor decides; 11.200 and 11.300 not met | compliance page rows | Match |
| SOC 2 and ISO rows: seal, change detection, separation of duties, validators added by a Jira admin, CascadePlan writes as the user | listings; earlier code reviews | Match (see L-66) |
| Isolated Cloud "Planned. Not available yet."; Government Cloud "Planned. Onboarding has not started."; Jira Cloud "Waiting for Atlassian Marketplace approval." | playbook, sections 6.1 and 6.2 | Honest |
| "What the suite does not do" (7 items) | listings, compliance page | Match |
| Compliance page Personal Data (`b9c5532`, `7fcd97a`) | `privacy.html`; `apps/ledgerseal` (`party-repository.ts`, `policy-admin.ts:66`, `personal-data.ts:53`, `:63`); CascadePlan questionnaire | Match. L-64 is fixed. |
| Marketplace links | `grep marketplace.atlassian.com/apps` over the whole build | None |

## 3. Fixes made

- **`f27b361`, Runs on Atlassian.** "The apps are built to Atlassian's Runs on Atlassian criteria ... Check the badge on each listing" becomes "All four apps are eligible for Runs on Atlassian (Forge eligibility check, 8 November 2026) ... Atlassian shows the badge itself on each listing once the app is listed". `forge eligibility -e production`, run by this review, reported each production version eligible: CascadePlan 2.3.0, DefinitionGuard 3.1.0, LedgerSeal 3.1.0, FourRealities 2.2.0.
- **NIS2.** The site has no NIS2 wording, so nothing needed changing (`grep -i nis2` on the page: 0).
- **`71c25cf`, FAQ.** The FAQ said LedgerSeal "store[s] Atlassian account ids to record who did each action ... of who sealed, signed or revoked a seal (as pseudonymous tokens ...)", and left out the approver-groups admin id. It now says, as the privacy policy and the code do:
  - LedgerSeal names people by pseudonymous token;
  - it keeps the account id only in one link record per person who sealed, revoked or changed a sealed issue, and the admin id;
  - it reports these weekly and deletes them when the account is closed;
  - no display name is stored.
- **The LedgerSeal listing's personal-data row** is fixed in the Jira repository (`799817a`, `regulated-migration-gtm-merge-review.md`).

## 4. Finding

- **L-66 (Low).** The page's "SOC 2 CC8.1: testing evidence" row says DefinitionGuard "Requires evidence (a link or a note) on Definition of Done items before an issue can move into Done". DefinitionGuard requires evidence only on items marked "Evidence required" (listing: "An item marked 'Evidence required' is ticked only with a link ..., a note, or both"). Suggested: "Requires evidence (a link or a note) on the Definition of Done items marked Evidence required". This is not fixed here, because the request listed the fixes to make.

## 5. Build

| Check | Result |
|---|---|
| `./mvnw -o clean process-resources` (Eliya) | exit 0 |
| `regulated-migration.html` rendered | yes; "eligible for Runs on Atlassian" once, "built to" nowhere |
| Internal links on the new page, the suite page, the FAQ and the compliance page | 80, none missing |
| External links on the new page | 8 of 8 answer 200 |
| Em or en dashes in the reviewer commits | None |
