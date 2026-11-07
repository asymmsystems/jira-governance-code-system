# Regulated migration go-to-market merge review

- Date: 2026-11-08. Reviewer: independent merge review session.
- Branch: `feature/regulated-migration-gtm` at `aff3950` (four commits, 16 files, 927 added lines), cut from `762f109`. Merged with current master `fd52e8b`, without conflict, plus two reviewer commits on top:
  - `98e0f89`: the fixes asked for in the request, and source citations;
  - `799817a`: the LedgerSeal listing's personal data row.
- Nothing in these files is published or sent. The partner intro note is marked "DRAFT. NOT SENT."
- Outputs, not committed: `jira-governance/repository/tmp/review-regulated-out/` (eligibility output, fetched vendor, Atlassian and EUR-Lex pages).

## 1. Verdict

**Merge**, with the two reviewer commits.
- The claims about our apps match the code, the listings, the compliance page (including its "Partly met" and "Not met" Part 11 rows) and `/security`.
- The vendor claims I spot-checked match the vendors' own Marketplace records and pages, and are stated without disparagement.
- The fixes asked for are made.

No finding is left open.

## 2. Our apps

| Claim | Source | Result |
|---|---|---|
| Part 11 in the playbook, the briefs and the listing copy: 11.10(e) supported; 11.50 partly met (no printed name after the account closes); 11.70 signed by the app, not the approver; 11.200 and 11.300 not met | compliance page rows "§ 11.10(e)", "§ 11.50 ... Partly met", "§ 11.70", "§ 11.200 / 11.300 ... Not met" | Match |
| No egress, Forge only, no Connect; licensing in each manifest; no arm64, remotes or webtrigger | the four manifests | Match |
| AGC rule 3 (no credentials) and rule 5 (no `child_process`, `eval(`, `new Function(`) | `git grep` over `apps/*/src`: 0 hits for each | Match |
| AGC rule 10 marked "Partly"; rule 11 "To review" | the code: account ids are in ordinary KVS; CascadePlan and FourRealities use `write:jira-work` | Honest as written |
| `write:issue.property:jira` for LedgerSeal and DefinitionGuard | manifests | Match |
| Separation of duties, validator behaviour, waiver reasons of 10 to 500 characters, JSON history export | listings and the code (earlier reviews) | Match |
| Prices in the partner kit | README section 4 | Match |
| Listing copy character counts (8 lines) | counted | All exact; highlights at most 209, under the 250 limit |
| Runs on Atlassian | `forge eligibility -e production`, run by this review on 2026-11-08 | CascadePlan 2.3.0, DefinitionGuard 3.1.0, LedgerSeal 3.1.0, FourRealities 2.2.0: each "eligible for the Runs on Atlassian program" |

## 3. Other vendors (spot checks, 2026-11-08)

The public Marketplace REST API v2 gives hosting (`versions/latest?hosting=`), the migration record and `totalInstalls`:

| App (vendor) | Hosting C / DC / S | Migration record | Installs | Branch says |
|---|---|---|---|---|
| Electronic Signature for Jira (Deviniti) | 404 / 200 / 200 | PRIVATE, UNKNOWN | 56 | DC, S; PRIVATE / UNKNOWN; 56 |
| Approvals - Advanced Issue Acceptance (Deviniti) | 404 / 200 / 200 | PRIVATE, UNKNOWN | 151 | the same, 151 |
| Auditor for Jira (Enhancera) | 404 / 200 / 200 | PRIVATE, UNKNOWN | 148 | the same, 148 |
| Workflow Essentials for Jira (codecentric) | 404 / 200 / 200 | `cloudAddonKey` = `com.fca.jira.plugins.workflowToolbox.workflow-toolbox` (Decadis) | 217 | the same, 217 |
| Electronic Signatures (Appfire) | 200 / 200 / 200 | | 293 | C, DC, S; 293 |
| Checklists for Jira (Enterprise) (HeroCoders) | 200 / 200 / 200 | | 4,496 | the same, 4,496 |
| JMWE (Appfire) | 200 / 200 / 200 | | 16,190 | the same, 16,190 |

Vendor pages:
- HeroCoders' comparison page has the quoted rows "Workflow condition" and "There are limitation for using Checklists on Create and Transition screens", word for word.
- Appfire's ES cloud FAQ could not be read: it serves only a script shell to a plain fetch. That one quote is unchecked by this review.

**Disparagement.** The research note says "We do not say the cloud app is worse"; every gap is in the vendor's own words, with the date where the page shows one. The playbook forbids claims beyond a vendor's own listing or documentation. No wording disparages a vendor.

## 4. Atlassian facts

| Claim | Source | Result |
|---|---|---|
| Data Center end of life 2029-03-28; no new customers from 2026-03-30; buy and expand until 2028-03-30 | https://www.atlassian.com/licensing/data-center-end-of-life | Match |
| No new Data Center apps after 2025-12-16 | Atlassian developer blog "From Data Center to Cloud: The Next Chapter for Marketplace Apps" (2025-09-08): "December 16, 2025: New Data Center apps can no longer be submitted to the Marketplace." | True, but the gap note, the plan section 9.1 and the suite overview cited the end-of-life page, which does not state it. **Fixed** in `98e0f89`: each now cites the blog post. |
| 16 AGC security requirements, in this order | https://developer.atlassian.com/platform/framework/agc/agc-security-requirements/ (last updated 2026-05-22) | 16 requirement items, in the playbook's order |

## 5. Fixes made in `98e0f89` (as asked)

- **Runs on Atlassian.** The procurement pack row no longer says "built to the criteria". It now says "Eligible; the badge shows once listed", with the four eligible versions. The public wording is "eligible for Runs on Atlassian (Forge eligibility check, 2026-11-08)", and the badge is shown only once it appears on the listing.
- **Rule 15 (SAST and SCA): Met in CI.** It names Semgrep CE (`sast.yml`, merged `ea6ae40`), `npm audit` and FSRT. The check line says rule 15 was updated after `ea6ae40`. The procurement pack's SAST row is "Exists, in CI". The DPA row is "Draft for the owner's lawyer" (`docs/legal/dpa-template.md`, merged `0bc2164`). The suggested order of work says the same.
- **Comala.** The Comala Document Management row is removed from the gap table: its only comparison page was archived. Open point 2 says why. No citation of the archived page remains (`git grep` for the page id: 0).
- **NIS2.** The wording now quotes Directive (EU) 2022/2555 from EUR-Lex (CELEX 32022L2555):
  - Article 21(1): Member States "ensure that essential and important entities take" the measures;
  - Article 21(2)(d): "supply chain security, including security-related aspects concerning the relationships between each entity and its direct suppliers or service providers";
  - Article 21(2)(e): "security in network and information systems acquisition, development and maintenance, including vulnerability handling and disclosure";
  - Article 21(3): the supplier assessment.

  The earlier text said "security in system acquisition" and left out that the duty falls on the entities, not on us. The message stays a fact, not a conformity claim.
- **Intro note.** It stays a draft: "DRAFT. NOT SENT.", with an owner checklist before any sending.

## 6. Separate commit `799817a`: LedgerSeal listing, personal data row

The row now matches the privacy policy and the code. It names:
- the account id kept in one link record per person (`apps/ledgerseal/src/storage/party-repository.ts`);
- the account id of the Jira administrator who last saved the approver groups (`apps/ledgerseal/src/service/policy-admin.ts:66`, `setByPartyId: caller`);
- the weekly report and the deletion on account closure (`apps/ledgerseal/src/service/personal-data.ts:53`, `:63`);
- no email address and no display name stored.

## 7. Gate

| Check | Result |
|---|---|
| Changed files | `docs/launch/**`, `docs/marketplace/*-listing.md` |
| `apps/`, `packages/`, `.github/` | Unchanged |
| Listing tests (they read the listing files) | LedgerSeal 18, DefinitionGuard 12, FourRealities 5: all pass with both reviewer commits. CascadePlan has no listing test. |
| Em or en dashes in added lines | None |
