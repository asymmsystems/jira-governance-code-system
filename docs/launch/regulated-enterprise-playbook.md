<!--
Copyright (c) 2026 Asymm Systems. All rights reserved.

@author Fahim Farook
-->
# Regulated enterprise playbook: the cloud governance layer for regulated migrations

Prepared 2026-11-08 for the owner, Fahim Farook. It extends `docs/launch/go-to-market-plan.md` (section 9 there is the summary). Nothing in this playbook has been sent, posted or published. Every contact with a partner or a customer is the owner's decision.

Status of the suite on 2026-11-08: four Forge apps (LedgerSeal, DefinitionGuard, FourRealities, CascadePlan), all pending Atlassian Marketplace approval. None is listed yet. None is available in Atlassian Isolated Cloud or Atlassian Government Cloud.

Sources: the Atlassian facts are from the research note `.tmp/research/atlassian-dc-regulated-2026-11.md` in the parent repository (source numbers [S1] to [S39]) and from `docs/launch/research/dc-migration-gap-2026-11.md` (the competitive gap). Product facts are from the listing files in `docs/marketplace/`. Use the listing wording in anything public.

## 1. The strategy in one paragraph

Atlassian ends Jira Data Center on 2029-03-28 [S1]. Regulated enterprises on Data Center must move to cloud: Cloud Enterprise with data residency, Atlassian Isolated Cloud, or Atlassian Government Cloud. Their change control often runs on Data Center apps or in-house plugins. Some of those apps have no cloud version, and some cloud versions do less (gap note, sections 2 and 3). We offer the cloud answer for four governance steps: an approval bound to the issue content (LedgerSeal), an enforced Definition of Done (DefinitionGuard), delivery evidence per issue (FourRealities) and a planning baseline with reviewed scope changes (CascadePlan). All four are Forge apps that keep data in Atlassian and declare no egress. We say what we do not do as clearly as what we do.

## 2. Segments and the value of each app

The apps support compliance; they do not make a team compliant. The auditor decides. This sentence goes into every segment message.

### 2.1 Pharma and medtech (GxP, FDA 21 CFR Part 11)

| App | Value | Limit to state |
|---|---|---|
| LedgerSeal | A tamper-evident, hash-chained record of seals, changes after approval, approvals of changes and revokes. Supports the audit trail (21 CFR 11.10(e)). Each seal records date, time and meaning (11.50 partly met). The release transition is blocked until another approver approves the changes. | 11.50 is partly met: the printed name is not kept after the account closes. It does not meet 11.200 or 11.300: the signer does not log in again when sealing. 11.70: the attestation is signed by the app, not by the approver; the auditor decides. |
| DefinitionGuard | The Definition of Done is a gate on the move to Done. Evidence-required items, a not-the-assignee rule and waivers with reasons, in a hash-chained history. Fits design control and verification checklists. | A tick is not an electronic signature (listing, "GxP / MedTech Quality Systems"). |
| FourRealities | Per issue: a decision record, a Definition of Done, a pull request and an approval seal. A signed record counts only when the signature is verified. Useful in audit preparation. | It cannot read pull request approvals. |
| CascadePlan | A frozen baseline with a SHA-256 digest; a scope change needs an approver who is not the requester. | A planning tool; its compliance angle is narrow. |

Message: "Your Part 11 audit trail for Jira change records, in cloud, with data that stays in Atlassian. Keep your own signing control for 11.200."

Computerised system validation: a GxP customer validates the cloud system and its apps. The apps are tested (each listing names its tests), but we provide no validation package. That is a gap (section 5).

### 2.2 Finance (SOX IT general controls, SOC 2)

| App | Value | Limit to state |
|---|---|---|
| LedgerSeal | SOC 2 CC8.1: records who approved a change and detects changes after approval. Separation of duties: a user who changed covered content cannot approve those changes or revoke the seal. | A Jira admin must add the validator to each transition. |
| DefinitionGuard | CC8.1: testing, security review and documentation items were completed or waived with a reason before Done. | It checks the link format of evidence, not what the link points to. |
| FourRealities | Shows the changes that lack one of the four kinds of evidence, per project. | Scores only the checks the site uses. |
| CascadePlan | Every Jira write is a normal Jira edit by the signed-in user, in Jira's own history. | Narrow. |

SOX: auditors test change management as an IT general control. We have no SOX-specific mapping page. Say "the same evidence as the SOC 2 CC8.1 mapping"; do not say "SOX compliant".

### 2.3 US government (FedRAMP, Atlassian Government Cloud)

- Atlassian Government Cloud (AGC) is FedRAMP Moderate authorized since March 2025 [S15]. Apps do not need their own FedRAMP authorization; each customer authorizes the app as an external service [S24], and reviews the Runs on Atlassian badge and the Privacy and Security tab [S25].
- Value: the same as 2.1 and 2.2, plus no egress, so the app sends no data outside the AGC environment.
- **Status: not available on AGC. Planned only.** Section 6 gives the steps and our status per rule. Customers cannot install apps themselves in AGC production; Atlassian support installs them [S13].
- Customer minimums: 201 users for Jira [S13].

### 2.4 EU (GDPR, NIS2)

- Data residency for Jira Cloud covers the EU, Germany and Switzerland, among other regions [S31]. App data in Forge-hosted storage follows Atlassian's residency rules; our apps keep all their data in Forge storage and in Jira issue properties.
- GDPR: no egress; people in hashed records are pseudonyms (LedgerSeal, DefinitionGuard); every app reports account ids to Atlassian weekly and removes closed accounts (privacy policy). A data processing agreement is being drafted (section 5).
- NIS2: Article 21(1) of Directive (EU) 2022/2555 requires Member States to ensure that essential and important entities take cybersecurity risk-management measures. Article 21(2) says the measures "shall include at least", among others, "(d) supply chain security, including security-related aspects concerning the relationships between each entity and its direct suppliers or service providers" and "(e) security in network and information systems acquisition, development and maintenance, including vulnerability handling and disclosure". Article 21(3) asks entities to take into account "the overall quality of products and cybersecurity practices of their suppliers and service providers, including their secure development procedures" (EUR-Lex, CELEX 32022L2555, read 2026-11-08). The duty is the customer's, not ours. Our message is a fact, not a claim of conformity: "the app adds no new processor outside Atlassian and no new network path".
- There is no EU sovereign cloud from Atlassian today; Atlassian invites design partners, with no date [S16]. Do not promise one.

## 3. Buyer and influencer roles

| Role | What they need from us | What we give them |
|---|---|---|
| QA or compliance lead (the buyer in pharma, medtech, finance) | The control they had on Data Center, an honest mapping, evidence an auditor accepts | The compliance mapping page, the checklist (partner kit), the offline verifier, the listing's compliance boundary |
| Jira administrator (installs, configures, often decides) | Few scopes, no egress, no new admin burden, a clear validator setup | The security questionnaires (`docs/marketplace/submission/*-security-questionnaires.md`), the quick start in each user guide, Gate coverage (DefinitionGuard) |
| Migration lead (internal or partner; owns the app assessment) | A cloud answer for each "No: This app is not available in cloud" row in JCMA | The gap table (research note, section 2), the per-app brief, what we do not cover |
| Atlassian Solution Partner (runs the migration, often resells apps) | A safe recommendation for their regulated client | The partner kit (`docs/launch/partner-kit/`) |
| Security and procurement (blocks or approves the vendor) | The procurement pack | Section 5 |
| External auditor (influences, never buys) | Evidence they can check without trusting the vendor's word | Exported evidence, the open verifier, the published signing keys. Say that the vendor holds the signing keys. |

## 4. Migration-timeline hooks, 2026 to 2029

| Date | Event | Hook for us | Source |
|---|---|---|---|
| 2025-12-16 | No new Data Center apps on the Marketplace | No DC governance app can arrive from now on; the cloud side is where new apps come | [S3] |
| 2026-03-30 | No new Data Center customers | Every new Jira customer in a regulated industry starts in cloud | [S1] |
| 2026-06 (about) | Isolated Cloud reported generally available | Single-tenant buyers need Forge-only apps (no Connect); ours are Forge-only | [S11], [S28] |
| 2026-12-31 | Cloud Fortified retired; Atlassian Enterprise Certified (AEC) replaces it | Enterprise buyers will ask for AEC; we are not certified (section 5) | [S22] |
| 2027-01-31 | Connect end of support | Apps that still use Connect cannot go to Isolated Cloud; ours do not use Connect | [S7], [S28] |
| 2027 (whole year) | Large regulated customers plan and validate the move. Atlassian says FastShift can cut migration time from 12 to 16 months to 2 to 6 months | The app assessment happens early; we must be listed and have the procurement pack before it | [S2] |
| 2028-03-30 | Existing customers can no longer buy or expand Data Center or DC apps | Last date for a DC "stay a bit longer" budget; migrations peak before it | [S1] |
| 2028-07 | IL5 authorization submission (planned by Atlassian) | Defence buyers; watch only | [S16] |
| 2029-01 | FedRAMP High submission (planned by Atlassian) | Watch only | [S16] |
| 2029-03-28 | Data Center and DC apps become read-only | The hard stop | [S1] |

## 5. The procurement pack

What a regulated buyer's security and procurement team asks for, and where we stand on 2026-11-08.

| Item | Status | Where, or what is missing |
|---|---|---|
| Privacy policy, per app | Exists | https://asymm.systems/privacy |
| Security policy (MFA, review, CI audit, keys, disclosure, incident response) | Exists | https://asymm.systems/security |
| Compliance mapping (SOC 2 CC8.1, ISO 27001 A.8.32, 21 CFR Part 11 with "partly met" and "not met" rows, vendor questionnaire answers) | Exists | https://asymm.systems/product/jira-governance/compliance.html |
| Security questionnaire answers, per app | Exist (internal, for the developer console) | `docs/marketplace/submission/<app>-security-questionnaires.md` |
| Signing keys and the open verifier (Apache-2.0) | Exist | https://asymm.systems/product/jira-governance/signing-keys.html; https://github.com/asymmsystems/jira-governance-code-cli |
| Terms, support policy and response times | Exist | https://asymm.systems/terms, https://asymm.systems/support |
| Penetration test | Exists, in-house only (2026-11-06, development site) | `docs/security/pentest-report-2026-11-06.md`. Not a third-party test. Owner decides whether a summary is shared. |
| Forge security scan (FSRT, Atlassian's scanner) | Exists, in CI | `docs/security/fsrt-scan-2026-11-07.md`, `.github/workflows/fsrt.yml` |
| Dependency scan (SCA) | Exists, in CI | `npm audit --omit=dev --audit-level=high` in `.github/workflows/apps-ci.yml` |
| Static analysis (SAST) | Exists, in CI | Semgrep CE 1.182.1 with stock packs, any finding fails the build: `.github/workflows/sast.yml`, `docs/security/sast.md` (merged `ea6ae40`) |
| Data processing agreement (DPA) | Draft for the owner's lawyer | `docs/legal/dpa-template.md` (merged `0bc2164`). Not offered to customers until the lawyer has reviewed it and the owner has approved it. |
| Privacy and Security tab on each listing | Prepared, filled at submission | `docs/marketplace/submission/developer-console-checklist.md` |
| Runs on Atlassian | Eligible; the badge shows once listed | `forge eligibility -e production` on 2026-11-08 reports all four production versions eligible for the Runs on Atlassian program (CascadePlan 2.3.0, DefinitionGuard 3.1.0, LedgerSeal 3.1.0, FourRealities 2.2.0). Atlassian applies the badge to eligible listed apps [S38]. Public wording: "eligible for Runs on Atlassian (Forge eligibility check, 2026-11-08)"; the badge itself only once it shows on the listing. Run the check again after each production deploy. |
| Status page | Missing | AEC requires a public incident process with a Statuspage [S22] |
| VPAT (accessibility conformance report), per app | Missing | AEC requires a public VPAT per app [S22] |
| Data flow diagram, per app | Missing | AEC requires one [S22] |
| SOC 2 Type II or ISO 27001 for the vendor | Missing | AEC requires one [S22]; real cost and time |
| Third-party penetration test, public bug bounty | Missing | AEC requires both [S22] |
| Validation support pack for GxP customers (intended use, test evidence summary, change history) | Missing | Optional, not an Atlassian requirement; a strong differentiator in pharma and medtech |
| Atlassian Enterprise Certified | Later stage | Needs the items above |

Order of work we suggest (owner decides): SAST is done and the DPA is drafted for the lawyer; then a status page and data flow diagrams (cheap), then VPATs, then the GxP validation pack, then SOC 2 or ISO 27001 and AEC.

## 6. Isolated Cloud and Government Cloud availability

### 6.1 Atlassian Isolated Cloud (AIC)

Steps from "Publish and list Isolated Cloud apps", https://developer.atlassian.com/platform/marketplace/publish-and-list-ic-apps/ (last updated 2026-06-29), and the Forge AIC page, https://developer.atlassian.com/platform/forge/cloud-env/atlassian-isolated-cloud/ (last updated 2026-08-26), read 2026-11-08:

| Step | What Atlassian requires | Our status |
|---|---|---|
| 1 | A public cloud listing already live; the app is pure Forge (no Connect, no Connect-on-Forge) | Pure Forge: yes (manifests have no Connect modules). Public listing: not yet (pending approval). |
| 2 | A separate App ID for Isolated Cloud, created in the developer console | Not done |
| 3 | Distribution set to Sharing | Not done |
| 4 | Licensing in the manifest; `forge deploy -e production` with the AIC App ID | Licensing: present in all four manifests. Deploy: not done. |
| 5 | A separate listing: Partner Portal, the existing cloud app, Create version, "Forge app for Isolated Cloud", Next: Make public, Submit | Not done |
| 6 | A separate Privacy and Security tab for the Isolated Cloud environment ("Copy from Cloud" pre-fills it; answers do not sync) | Not done |
| 7 | Pricing: Standard edition only; no Advanced edition, no multi-instance pricing; an AIC app can never switch between FREE and PAID | Our apps are paid with a free tier for 1 to 10 users. Owner decision: confirm that a paid AIC listing with the same free tier is allowed before listing. |
| 8 | Review: the same as for cloud apps | After step 5 |
| 9 | Forge features not supported in AIC: feature flags, Forge platform pricing and Developer Spaces, global full-page module, export app resource usage API, `api-route` | None of the four apps uses them (manifest and source search, 2026-11-08) |
| 10 | Customer side: egress blocked by default; no email notifications from apps; no smart links for third-party apps [S14], [S30] | No egress and no email notifications in our apps |
| 11 | Testing: a test site by Atlassian Support ticket (two customer-managed keys, in us-east-1 and us-west-2, and identity provider details); `forge deploy -e staging`; install by the GraphQL `installApp` mutation | Not done |

Public wording until done: "Isolated Cloud: planned. The apps are Forge-only with no egress, which Isolated Cloud needs; the separate Isolated Cloud listing is not yet made."

GA status: the Atlassian cloud deployments page still said "Coming in 2026" for Isolated Cloud on 2026-11-08, while the developer pages describe a live Marketplace. Do not state a GA date in public copy.

### 6.2 Atlassian Government Cloud (AGC)

Steps from https://developer.atlassian.com/platform/framework/agc/ (last updated 2025-09-10), "Get access to AGC" (last updated 2025-12-02), the build guide (last updated 2026-05-05) and the publish guide (last updated 2026-03-11), read 2026-11-08:

1. The app is Forge or Connect-on-Forge, and the vendor opts in to AGC. Customers are US agencies and their contractors only.
2. Get a developer licence from the AGC provisioning team.
3. Request an AGC test instance. The form asks for one app ID, the products (Jira, JSM, Confluence), a site name (`<name>.atlassian-us-gov-mod.net`), the identity provider Entity ID, SSO URL and public x509 certificate. The vendor needs its own domain, email and SSO identity provider. Add the DNS TXT record Atlassian sends; add the two URLs to the identity provider; remove the Atlassian support user after the first login.
4. Point the Forge CLI at AGC (`FORGE_GRAPHQL_GATEWAY=https://api.atlassian-us-gov-mod.com/graphql`), `forge login` with the AGC account, register a new AGC app id, `forge deploy` (development or staging) and `forge install` on the test site. `forge tunnel` does not work. Production is installed by Atlassian Product Support from a ticket, not from the CLI.
5. List: in the AGC developer console set Distribution to Sharing; in the Partner Portal open the existing cloud app, Create version, "Forge app for Government Cloud", enter the AGC App ID, Next: Make public, edit the copied listing, Submit. Customers cannot leave reviews on AGC listings.
6. Meet all 16 AGC security requirements during onboarding, in addition to the normal cloud app security requirements (https://developer.atlassian.com/platform/framework/agc/agc-security-requirements/, last updated 2026-05-22).

Forge features not supported on AGC: SQL storage and Object Store, arm64, feature flags, Forge platform pricing and Developer Spaces, global full-page module [S13]. None of the four apps uses them; no manifest sets arm64.

### 6.3 The 16 AGC security requirements: our status

Checked from the code on `origin/master` at `762f109`, 2026-11-08; rule 15 updated after the SAST merge `ea6ae40`. "Met" means the code shows it; it is not Atlassian's verdict. Atlassian decides at onboarding.

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Forge OAuth 2.0; no unauthenticated access to app resources except static content | Met | No `webtrigger` module and no remote in any manifest; every entry is a Jira UI module, a validator, an event trigger or a scheduled trigger |
| 2 | Validate the user's permissions for actions run through `asApp()` | Met as far as the scanner sees | FSRT authorization scan 0 findings for all four apps after the DefinitionGuard fix (`docs/security/fsrt-scan-2026-11-07.md`); section 5 of that report says what FSRT cannot see, and where each check is tested |
| 3 | No Atlassian credentials collected or stored | Met | No API token, password or OAuth secret in any app's source (search for apiToken, password, client_secret, Authorization) |
| 4 | Strict tenant isolation, including runtime artifacts | Likely met; not proven | All data is in Forge storage of the installation. No module-level data cache in backend code was found by search; module-level Maps exist only in CascadePlan's browser code. Needs a review of every module-level variable before onboarding. |
| 5 | No arbitrary code execution, no child processes | Met | No `child_process`, `eval(` or `new Function(` in any app's source |
| 6 | No wildcard egress domains | Met | No `permissions.external` in any manifest: no egress at all |
| 7 | Avoid `unsafe-inline` and `unsafe-eval` | Met | No `permissions.content` in any manifest; CascadePlan notes MK-09 (no inline styles) |
| 8 | HTTPS and TLS 1.2+ for outbound connections | Met (not applicable) | The apps call only Atlassian APIs through Forge |
| 9 | Encrypt egressed data at rest | Not applicable | No egress |
| 10 | Forge encrypted storage for secrets and PII | Partly | Signing keys are encrypted Forge variables (`forge variables set --encrypt`; `LEDGERSEAL_SIGNING_KEY`, `DG_SIGNING_KEY`). Account ids and the LedgerSeal token-to-account map are in ordinary Forge key-value storage, not the secret store. Ask Atlassian whether account ids count as PII under this rule. |
| 11 | Least privilege scopes | To review | LedgerSeal and DefinitionGuard write only issue properties (`write:issue.property:jira`). CascadePlan and FourRealities use `write:jira-work`; each listing gives the reason. Review FourRealities' need before onboarding. |
| 12 | Disclose data handling on the Privacy and Security tab | Prepared | Filled at submission (`docs/marketplace/submission/developer-console-checklist.md`) |
| 13 | No Critical or High dependency vulnerabilities | Met in CI | `npm audit --omit=dev --audit-level=high` fails the build |
| 14 | Supported runtime, maintained libraries | Met today | `nodejs22.x` in all four manifests. Node.js 22 reaches end of life in April 2027 (Node.js release schedule); plan the move to the next runtime |
| 15 | SAST and SCA | Met in CI | SAST: Semgrep CE 1.182.1 (`.github/workflows/sast.yml`, merged `ea6ae40`, `docs/security/sast.md`); SCA: `npm audit --omit=dev --audit-level=high` (`.github/workflows/apps-ci.yml`); Forge scan: FSRT (`.github/workflows/fsrt.yml`) |
| 16 | A security contact with an ecosystem.atlassian.net account for Marketplace Security tickets | Partly | `security@asymm.systems` is published; the ecosystem.atlassian.net account is the owner's to confirm (ticket AMS-76722 was received, so an account exists for at least one contact) |

Public wording until done: "Government Cloud: planned. The apps have no egress and no Connect modules. AGC onboarding has not started."

## 7. The Solution Partner channel

Why partners: a regulated migration is usually run by an Atlassian Solution Partner. The partner fills in the app assessment with the customer, and picks the cloud alternatives. The partner's word carries more weight with a QA lead than our listing does.

What we prepare (done, in `docs/launch/partner-kit/`):

- a suite overview and one brief per app, each with "what it does not do";
- the governance checklist for regulated migrations;
- a list of 20 target partners from Atlassian's public partner directory, with the reason for each;
- a draft intro note for the owner. It is not sent.

Rules:

- The owner decides on every contact. The partner-led sales rule for Eliya and Dial does not apply to this suite.
- Partners come from the public directory and their public pages. Marketplace evaluator data is never a source (Marketplace Partner Agreement, section 8.4(c)).
- We give partners the listing wording only. No claim that Atlassian recommends our apps.
- No reward for reviews. Any referral or reseller terms need the owner's decision and must follow the Marketplace partner rules; check them before any offer.

First steps after the first listing is public (owner):

1. Pick five partners from the list: two with life sciences or GxP evidence, two with government cloud work, one EU.
2. Send the intro note, edited to the partner. One partner at a time; record the date and the answer in the table in `docs/launch/partner-kit/target-partners.md`.
3. Offer a 30-minute technical demo on the partner's own test site.

## 8. Metrics

Read monthly, with the weekly log in `docs/launch/trial-conversion.md`, section 3.

| Number | Source | Target for the first 6 months after listing (our assumption, to review) |
|---|---|---|
| Evaluations from sites with 101 or more users | Marketplace partner reports, Evaluations and Licenses (user tier) | 10 |
| Paid licences at 101 or more users | Licenses, Sales | 3 |
| Security questionnaire, DPA or procurement pack requests received | Support mailbox | 5 |
| Partner conversations the owner started, and replies | `docs/launch/partner-kit/target-partners.md` contact table | 5 started, 2 replies |
| Partner-sourced evaluations (the partner tells us) | Partner contact table | 2 |
| Procurement pack items done (section 5) | This playbook | DPA, SAST, status page, data flow diagrams |
| Isolated Cloud listing live | Partner Portal | Within 3 months of the first cloud listing, if the owner approves |
| Visits to the regulated migration page | Site analytics, if enabled | No target; trend only |

## 9. Claims we do not make

From `docs/launch/go-to-market-plan.md`, section 2, plus these for the regulated message:

- "Atlassian recommends" or "JCMA suggests" our apps. Atlassian says JCMA alternatives are "not recommended by Atlassian".
- "Available in Isolated Cloud" or "available in Government Cloud". Both are planned only.
- "FedRAMP authorized", "SOC 2 certified", "ISO 27001 certified", "Atlassian Enterprise Certified". None is true.
- "Part 11 compliant" or "Part 11 electronic signatures". LedgerSeal supports the audit trail; it does not meet 11.200 or 11.300.
- "SOX compliant", "GDPR compliant", "NIS2 compliant". We state facts about data flows and controls.
- "Replaces app X". Say "covers the need for an approval bound to the issue content", and name what we do not cover.
- Anything about another vendor beyond its own Marketplace listing or documentation, with the date checked.

## 10. Open questions for the owner

1. Isolated Cloud pricing: AIC allows Standard edition only and no FREE to PAID switch. Is a paid AIC listing with our 1 to 10 user free tier acceptable, or do we list AIC as paid only?
2. In-house penetration test: may a summary go into the procurement pack, clearly marked as in-house?
3. Order of the missing pack items (section 5): agree with DPA and SAST first, then status page and data flow diagrams?
4. AGC: start the developer licence request now (it needs an SSO identity provider of our own), or wait for the first regulated customer who asks?
5. Partner list: which five partners first (section 7)?
