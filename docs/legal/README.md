<!--
Copyright (c) 2026 Asymm Systems. All rights reserved.

@author Fahim Farook
-->
# Legal drafts

> **DRAFT, not legal advice, for the owner's lawyer.** Nothing in this folder is published or
> offered to a customer.

| File | What it is |
|---|---|
| `dpa-template.md` | A GDPR Article 28 Data Processing Agreement between a customer (controller) and Asymm Systems (Pvt) Ltd, Sri Lanka (processor), for the four Jira apps |

## What the lawyer needs to confirm, by section

| Section | Question for the lawyer |
|---|---|
| Parties | Asymm Systems' registration number and registered address. |
| 1.5 | How the DPA becomes binding. Section 3.3 of the Bonterms End User Agreement applies a DPA "identified in the Provider-Specific Terms"; the terms page says Asymm Systems adds no provider-specific terms other than its support policy. Should the DPA be named there, or signed separately on request? |
| 2 | That the subject matter, nature and purpose are complete for all four apps. |
| 3 | That "the Customer's configuration and use of the Apps" is an adequate documented instruction. |
| 4 | Whether every person with access has signed a written confidentiality undertaking (the published pages do not say so). |
| 5, Annex II | That the measures are adequate under Article 32 for a company of about 5 people. Annex II copies the security policy; any change there must change Annex II too. |
| 6 | The notice period for a new sub-processor (draft: 30 days) and the remedy on objection (draft: uninstall the app). Whether a refund is needed, given that Atlassian bills the customer. Whether Atlassian's non-negotiable Forge terms meet the Article 28(4) flow-down. |
| 7 | Whether processing is a Chapter V transfer when the data stays in Atlassian's hosting region and Asymm Systems in Sri Lanka writes and deploys the code and reads the app logs. Module 2 or 3 choice. Clause 13 authority, Clause 17 law and Clause 18 forum. Whether the UK Addendum and Swiss amendments are needed. Whether Sri Lanka's Personal Data Protection Act, No. 9 of 2022, adds duties for Asymm Systems. |
| 8 | That a 30-day answer to data subject requests (the privacy policy's target) is enough to let the customer meet its one-month GDPR deadline. |
| 9 | That the documents offered are enough for a customer's DPIA. |
| 10 | That "within 72 hours of confirming the breach" (the security policy's wording) is acceptable. A controller has 72 hours from awareness to notify the supervisory authority, so customers may ask for a shorter processor deadline. Any shorter deadline must change the security policy first. |
| 11 | Whether Asymm Systems can delete or return one site's Forge storage on request, other than by the app functions and Atlassian's 28-day deletion after uninstall. The 60-day period follows the End User Agreement, section 12.4(b). Which app functions export data. |
| 12 | The audit notice (draft: 30 days), frequency (once in 12 months) and costs (each party its own). That pointing to Atlassian's published information is enough for the platform. |
| 13 | That liability by reference to the End User Agreement, section 14, works, and whether the Enhanced Cap for DPA breaches applies. |
| 14.3 | Governing law: the End User Agreement defaults to California law and San Francisco courts; the SCCs need an EU Member State law. |
| Annex III | The contracting Atlassian entity, and where Forge function logs and the personal data reporting service are located. |

## Owner's commercial rule (halal terms)

The draft has no late fee, no interest, no penalty charge, no liquidated damages and no service
credits (section 13.3). It does not require insurance. If the lawyer proposes a clause whose
permissibility scholars dispute, such as a penalty, a forfeited deposit or a required conventional
insurance policy, the owner's rule is to leave it out, not to reword it. This note is a summary of
the owner's rule, not a fatwa.

## Facts that could not be confirmed from the code or the published pages

1. Asymm Systems' company number and registered address.
2. That every person with access is bound by a written confidentiality undertaking (section 4).
3. That the production versions of LedgerSeal and FourRealities include the permission-check
   changes that the questionnaire answers describe (merged to master as 696c763 and 67b6fd6;
   production deploys not checked).
4. How Asymm Systems would delete or return one site's Forge storage on request (section 11.3).
5. Which app functions let a customer export its data before uninstall (section 11.1). The
   compliance page says a LedgerSeal record "can be copied as standalone JSON".
6. The contracting Atlassian entity, and the location of Forge function logs and of the personal
   data reporting service (Annex III).
7. Encryption at rest and in transit: the draft repeats the compliance page, which says Atlassian
   provides it. Atlassian's own documents were not checked.
8. Whether Asymm Systems can read the Forge function logs of a customer's site without the site
   administrator's consent; the draft says only that the logs hold no personal data, as the
   questionnaire answers state.
9. The questionnaire answers for question 8 (logs) were taken as written; the log lines were not
   checked again in the code for this draft.

## Inconsistency to fix on the site

The compliance page (section 4, "Personal Data") says that LedgerSeal stores account ids "to
record who did each action". The privacy policy and the LedgerSeal listing say that LedgerSeal
records name people by a pseudonymous token and keep the account id only in one link record per
person. The DPA follows the privacy policy. The compliance page should say the same.

## Sources read for the draft

- Privacy policy and terms: `asymmsystems/asymm-corporate-code-pfw`, `src/main/jbake/content/privacy.html`
  and `terms.html` (the same on `develop` and `main`, read 2026-11-08).
- Security policy: <https://asymm.systems/security> (read 2026-11-08).
- Compliance page: <https://asymm.systems/product/jira-governance/compliance> (read 2026-11-08).
- Bonterms Standard End User Agreement, Version 1.0:
  <https://www.atlassian.com/licensing/marketplace/end-user-agreement-v1> (sections 3, 12, 14 and
  19 were read through a summary tool; the lawyer should read them in full).
- `docs/marketplace/*-listing.md` and `docs/marketplace/submission/*-security-questionnaires.md`.
- `apps/*/manifest.yml` (scopes, runtime, no `permissions.external`, no `remotes`, scheduled
  triggers) and the `@forge/kvs` imports in `apps/*/src`, on master 762f109.
