# Security policy site page merge review

## Round 2 (2026-11-06): merged into `develop`

- Branch `feature/security-policy` at `1b076f1`: round 1's `e4428f3` plus `1b076f1`, which changes two sentences.
- **Verdict: merged.** Merge commit `784f151` on `develop` of `asymmsystems/asymm-corporate-code-pfw`, pushed. Not merged to `main`, no tag: the coordinator releases.

| Round 1 finding | Round 2 |
|---|---|
| M-14 (five unconfirmed controls) | Closed as **owner-confirmed**: the owner confirmed all five controls on 2026-11-06 (relayed by the coordinator). They are quarterly access review, OWASP Top 10 review for all products, customer notice within 72 hours of a confirmed personal-data breach, review plus CI for all products, and a unique strong password per account. They are recorded in `asymm-engineering` `issue/issue-00001-company-security-controls.org` (main `8735fb5`, read 2026-11-06), controls 3, 7, 8, 9 and 16, each "Owner confirmed" with the evidence to keep. Evidence is still owed for 7, 8 (Eliya, Dial), 9 and 15, as that file's next steps say. The page text is unchanged. |
| L-45 (GitHub 2FA not required) | Fixed: `gh api orgs/asymmsystems` gives `two_factor_requirement_enabled: true` |
| L-46 (compliance page said 30 days) | Fixed: `product/jira-governance/compliance.html` now says "Fixes follow Atlassian's Marketplace security bug fix policy for cloud apps: critical within 10 days, high within 4 weeks", matching the policy page (updated Aug 24, 2026), and links `/security` |
| L-47 (data sentence too wide) | Fixed: "the apps call only Atlassian's own APIs: your site's Jira and Confluence, and Atlassian's personal data reporting service". All four apps declare `report:personal-data`; FourRealities uses Confluence. |

Re-check of the page:
- The issue file lists controls that are "Not answered yet": logs (17), backups and continuity (18), SBOM (19), and disk encryption, a pentest and an incident-plan test, which are never claimed. The page states none of them.
- The excluded claims are still absent.
- Build `./mvnw -o clean process-resources` (Eliya 25.0.3): exit 0. The warnings are JVM and JBake runtime notices (`sun.misc.Unsafe`, script engine, OrientDB default password), not page problems. Log, not committed: `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/security-policy-site/build-round2.txt`.
- 37 internal links on `security.html` and `compliance.html`: none missing.
- No em or en dashes added.

Open, outside this branch: the Jira questionnaires (question 16) quote the live compliance page's "critical remediation target within 30 days". They change when the owner releases `develop` to `main`.

## Round 1

- Date: 2026-11-06. Reviewer: independent merge review session.
- Repository: `asymmsystems/asymm-corporate-code-pfw` (corporate website). Branch `feature/security-policy` at `e4428f3` (one commit), cut from `develop` `1b11dd5`.
- Change:
  - A new page, `src/main/jbake/content/security.html` (URL `/security`).
  - A "Security" link in the status bar and in the mobile drawer footer of `src/main/jbake/templates/partial/menu/menu.ftl`.
- Checkout: `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/cp-fixes-scratch/review-site-security` (my own clone). Build log, not committed: `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/security-policy-site/build.txt`.
- Facts I was given as owner-confirmed:
  - About 5 people.
  - MFA on all accounts, including the GitHub organisation.
  - A password manager.
  - ClamAV.
  - Patching.
  - Atlassian's policies have been read.
  - Owner decision: rotate the LedgerSeal and DefinitionGuard signing keys every 12 months, the first in December 2026.

## 1. Verdict

**Do not merge yet.** Not merged into `develop`.
- The build is clean, and every link resolves.
- The page makes none of the excluded claims: no full-disk encryption, no certification, no external audit, no bug bounty and no penetration test.
- The confirmed facts are stated correctly.
- But the page also states security controls that are not among the confirmed facts (M-14). A public security policy is read as a commitment by customers, Atlassian and auditors, so each control must be true before the page is published. Either the owner confirms each item in M-14, or the fixing session removes it. Then ask again. The Low findings can be fixed in the same pass.

## 2. Claims against facts

| Section and line | Claim | Result |
|---|---|---|
| 1, `:16` | Asymm Systems (Pvt) Ltd, Sri Lanka, about 5 people | Confirmed. The legal name matches the other pages. |
| 1, `:18` to `:21` | Products and their detail pages | All four pages exist and build |
| 2, `:31` | MFA on every company account: the GitHub organisation, email, Atlassian, Cloudflare | Confirmed by the owner. GitHub API, 2026-11-06: the organisation has 1 member and 0 members without 2FA. But "Require two-factor authentication" is off (`two_factor_requirement_enabled: false`). See L-45. |
| 2, `:32` | Password manager | Confirmed. "Each password is strong and used for one account only" is not among the confirmed facts (M-14). |
| 2, `:33` | ClamAV on the Linux workstations | Confirmed |
| 2, `:34` | Patching | Confirmed |
| 2, `:35` | Least privilege, and "We review access each quarter and remove what is no longer needed" | **Not confirmed** (M-14) |
| 3, `:42` | "every change is made on a branch, and an independent review of the change is done before it is merged" | True for the Jira repository (the merge reviews in `docs/sdlc/merge-reviews-2026-11/`). Not confirmed for every product and repository, including this website (M-14). |
| 3, `:43` | "automated tests and a dependency audit run in CI"; for the Jira apps `npm audit`, where high or critical fails the build | Jira apps: true (`.github/workflows/apps-ci.yml`, step "Dependency audit (production, high and critical)"). Not confirmed for every product (M-14). |
| 3, `:44` | "changes are reviewed against the OWASP Top 10 risks" | **Not confirmed** (M-14) |
| 3, `:45` | No secrets in code; the Jira apps keep secrets as encrypted Forge variables | LedgerSeal: true (`forge variables list`, quoted in `ledgerseal-security-questionnaires.md` question 13). DefinitionGuard: `DG_SIGNING_KEY` is documented as an encrypted variable. I did not check its console listing. |
| 4, `:53` | Rotate each signing key every 12 months, at once on suspected exposure, the first in December 2026 | Owner decision. Matches `docs/security/signing-key-rotation.md` (merged in the Jira repository, `b922b18`). |
| 4, `:54`, `:55` | Public keys and fingerprints on the signing keys page; retired keys stay published | The page exists. Runbook steps 2.5 and 7 match. |
| 4, `:57` | Eliya GPG fingerprint and channels on the Eliya security page | True (`templates/content/product/eliya/security.html`, section "Release signing & key fingerprint") |
| 5, `:65` | Acknowledgement within 72 hours | Matches `product/jira-governance/compliance.html:176` ("Initial response within 72 hours") |
| 5, `:66` to `:69` | A critical fix targeted within 30 days; for the Jira apps, Atlassian's Security Bug Fix Policy applies where it is shorter | Correct. Atlassian's "Security Bug Fix Policy for Marketplace apps" (https://developer.atlassian.com/platform/marketplace/security-bugfix-policy/, last updated Aug 24, 2026, fetched 2026-11-06) gives cloud apps 10 days for critical and 4 weeks for high. Both are shorter than 30 days. The link resolves. See L-46 for the compliance page. |
| 5, `:71` | OpenJDK vulnerabilities go to the OpenJDK Vulnerability Group, as the Eliya page explains | True (Eliya security page, "Reporting a vulnerability", links `openjdk.org/groups/vulnerability/report`) |
| 6, `:78` to `:85` | Incident steps; notify Atlassian per its incident management guidelines | Consistent with the runbook's section 4. The guidelines link resolves. |
| 6, `:86` | "within 72 hours of confirming a breach of their personal data" | **Not confirmed** (M-14) |
| 7, `:91` | "the apps send no data outside your Atlassian site" | See L-47 |
| Excluded claims | Full-disk encryption, certifications, external audits, bug bounty, pentests | None on the page. "Audit" appears only as `npm audit`. |

## 3. Findings

### Critical, High

None.

### Medium

- **M-14. The page states controls that the owner has not confirmed.** Each needs the owner's confirmation, or must be removed, before publication:
  1. `:35`: "We review access each quarter and remove what is no longer needed."
  2. `:44`: "changes are reviewed against the OWASP Top 10 risks."
  3. `:86`: "within 72 hours of confirming a breach of their personal data."
  4. `:42` and `:43` as written for every product. They are true for the Jira apps. Either confirm them for Eliya, Dial, Asymm Forensics and this website, or limit them to the Jira apps.
  5. `:32`: "Each password is strong and used for one account only."

  Items 1 to 3 are recurring processes or deadlines that a customer or Atlassian can hold the company to.

### Low

- **L-45. GitHub does not enforce 2FA for the organisation.** The claim is true today (1 member, 0 without 2FA). Turning on "Require two-factor authentication for everyone in the organization" keeps it true when people join.
- **L-46. The compliance page still says "critical remediation target within 30 days"** (`product/jira-governance/compliance.html:176`). The page is about the Jira apps, for which Atlassian's policy requires 10 days. The new policy page and `site/vendor-security-assessment.md` in the Jira repository already say so.
- **L-47. The data handling sentence is wider than the facts.** `:91` says "the apps send no data outside your Atlassian site". LedgerSeal reports the account ids it holds to Atlassian's personal data reporting API every week (LedgerSeal listing, Forge Storage). That is an Atlassian service, not the customer's site. Possible wording: "the apps send no data outside Atlassian".

### Considered, no finding

- `/privacy` at `:92` has no `.html`, while the menu uses `/privacy.html`. Both work: the build has `privacy.html`, and the live Cloudflare host answers `https://asymm.systems/privacy` with 200.
- `llms.txt` does not list the new page. It is a curated list that does not include the privacy or terms pages either.

## 4. Build and links

| Check | Result |
|---|---|
| `./mvnw -o clean process-resources`, `JAVA_HOME=/opt/eliya` (OpenJDK 25.0.3) | exit 0. The only warning is OrientDB's internal default-password notice, as in every build. |
| `target/site/security.html` | Rendered, title "Security policy" |
| Menu link | `href="/security.html"` on the rendered pages I checked (`index.html`, `privacy.html`, `product/jira-governance/compliance.html`) |
| Sitemap | `https://asymm.systems/security` listed |
| Internal links on the rendered page | All resolve in `target/site`, including all seven policy links |
| External links | `security-bugfix-policy` and `app-security-incident-management-guidelines` on developer.atlassian.com resolve |
| Em or en dashes in the added text | None |

Not merged, so nothing pushed to `develop`. Nothing released to `main` and no tag, as instructed.
