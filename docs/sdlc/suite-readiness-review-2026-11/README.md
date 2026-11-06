# Jira Governance Suite: readiness and the plan to the first paid customer

Date: 2026-11-06. Owner: Fahim Farook. Prepared in the CascadePlan session, which owns all four apps from 2026-11-06.

Files in this folder:

| File | What it is |
|---|---|
| `ledgerseal-readiness.md` | Independent readiness review of LedgerSeal at `1e1318b` |
| `definitionguard-readiness.md` | Independent readiness review of DefinitionGuard at `1e1318b` |
| `fourrealities-readiness.md` | Independent readiness review of FourRealities at `1e1318b` |
| `pricing-research.md` | Competitor prices (Marketplace REST API and vendor pages, 2026-11-06) and a price recommendation |
| `marketplace-commercial-rules.md` | Marketplace rules: listing a paid app, licensing, trials, revenue share, payouts, programmes |
| `README.md` | This file: the verdicts, the suite-wide work and the plan |

The three reviews were static reviews (code, tests, build, `forge lint`); none used the live site. Each lists the live checks it could not run. CascadePlan's state comes from `docs/sdlc/cascadeplan-marketplace-review-2026-11/progress-log.md`.

## 1. Verdicts

| App | Verdict | Blockers | Fix size (my estimate) |
|---|---|---|---|
| CascadePlan | Ready after the owner steps | No code blocker. Left: owner review and merge of `feature/cascadeplan-marketplace-fixes`, production deploy, console submission, licence test MK-08 after approval. Approved 2026-11-06 and being built: progress and status rules (section 6). | 1 day (progress and status), then owner steps |
| DefinitionGuard | Ready after the listed fixes | 7: personal data report, production signing key, screenshots, inactive licence blocks every gated move, 8 high npm advisories, false listing claims, reviewer notes tied to our site | 3 to 4 days |
| LedgerSeal | Not ready | 7: personal data report (ids sit inside hashed, chained records), false separation-of-duties claims, verifier not public, Part 11 boundary missing, no production signing key, screenshots, never deployed to production | 5 to 7 days |
| FourRealities | Not ready | 5: rejects DefinitionGuard's current record, misleading score without the other two apps, personal data report, false claims and media, 8 high npm advisories | 4 to 6 days, after DefinitionGuard |

Findings checked by hand in this session (not only reported by an agent):
- DefinitionGuard's validator returns `result: false` for an inactive licence before any other check (`apps/definitionguard/src/index.ts:120-122`).
- DefinitionGuard writes `mandatoryTotal` and `mandatoryCompleted` (`apps/definitionguard/src/integrity/attestation.ts:29-30`); FourRealities accepts only `completedCount`, `totalCount` and `checklistHash` (`apps/fourrealities/src/engine/default-gate-engine.ts:76-82`).
- LedgerSeal's revoke checks only that the user is an approver (`apps/ledgerseal/src/service/ledger.ts`, `revokeFlow`); the listing says a user who changed the issue cannot revoke.
- Only CascadePlan declares `report:personal-data` (`grep report:personal-data apps/*/manifest.yml`).
- Apps CI run 42134853441 on `1e1318b`: all four apps green.

## 2. Work that is the same in several apps

1. **Personal data reporting** (LedgerSeal, DefinitionGuard, FourRealities). Same pattern as CascadePlan's `reportPersonalData`. In LedgerSeal and DefinitionGuard the account ids sit inside hashed history, so erasing them in place breaks the hash checks. Design: store a per-site pseudonym in hashed records from now on, keep the pseudonym-to-account map in one separate key, delete that key on account closure; existing records get a redaction event. Needs a new canonical form version and verifier support (LedgerSeal).
2. **Production signing keys** (LedgerSeal, DefinitionGuard). Owner runs `forge variables set -e production --encrypt ...`. The public keys go to the public verifier repository and asymm.systems.
3. **Verifier** (owner decision A, 2026-11-06): its own public repository `asymmsystems/ledgerseal-verifier` plus a download on asymm.systems with SHA-256 checksums; Apache-2.0 header on the verifier files; one copy only (the two copies in the monorepo differ); the "without trusting Asymm Systems" sentence corrected.
4. **npm advisories**: the `prosemirror-view` override CascadePlan uses, in DefinitionGuard and FourRealities; the CI audit step for every app.
5. **Screenshots** for LedgerSeal, DefinitionGuard and FourRealities: real captures from a realistic project, cropped to the app, 1840 x 900, like CascadePlan's.
6. **Listing and site claims**: delete the superseded `definitionguard-listing.md` and `fourrealities-listing-v2.md`; remove the per-tier extras on the product page that the support policy does not promise ("designated technical concierge", "compliance review assistance"); the "Open Four Realities panel" button in LedgerSeal and DefinitionGuard that only reloads the issue.
7. **Repository rules**: the Asymm Systems header and `@author Fahim Farook` on the LedgerSeal files that lack them.
8. **Reviewer notes** that do not depend on our own Jira site (DefinitionGuard and the others): the reviewer installs on their own site.

## 3. Commercial facts that shape the plan

Each fact has a source in `marketplace-commercial-rules.md` or `pricing-research.md`; the first one was checked again in this session.

- **Revenue share**: 0% on eligible Forge revenue from 1 January 2026, up to $1 million lifetime per partner (Atlassian blog "Updates to Marketplace revenue share 2026", fetched 2026-11-06). Eligible means Forge-only: no Connect modules, Forge UI. All four apps qualify. Above $1 million: 17% from 1 October 2026.
- **Payouts**: USD by SWIFT wire to a bank account in the company's legal name, within 30 days after the month in which $500 profit has built up. PayPal not found. **Sri Lanka is not confirmed**; Atlassian answers country questions only after a partner profile exists.
- **Tax**: a W-8 form; without one, a 30% default withholding is reported by a vendor. A US-Sri Lanka tax treaty exists; the treatment of app income is unconfirmed.
- **Partner account**: needs a company-domain email (Gmail and similar are refused), the Marketplace Partner Agreement, two-step verification and an identity check. Reported duration: 2 to 3 business days officially, about 3 weeks for one sole trader.
- **Review**: Atlassian pages give 5 to 15 business days; plan for 2 to 4 weeks including one resubmission.
- **Trial**: at least 30 days for cloud apps, then monthly billing. Free-to-paid later is allowed but existing installs become unlicensed until each admin subscribes.
- **Contacting evaluators**: the Partner Agreement allows it only where the law requires it, or when the customer consents or asks. So conversion must come from the product, the documents and fast support, not from cold email.
- **Free tier**: a $0 price for 1 to 10 users is allowed; 76% of the 376 priced top apps use it.
- **Forge platform cost**: usage above a free allowance per app is billed to the developer from 1 January 2026; a payment method must be on file. Four small apps are likely inside the allowance.
- **Bundles**: none for cloud apps. Each app is sold on its own.

## 4. Price

Current plan for all four (owner, 2026-11-06): free 1 to 10 users, $1.50 (11 to 100), $1.20 (101 to 250), $0.90 (251 to 1,000), custom above.

Research recommendation (judgment, not sourced fact):

| App | 11 to 100 | 101 to 250 | 251 to 1,000 | Main reason |
|---|---|---|---|---|
| CascadePlan | $1.50 | $1.10 | $0.55 | At the market for small sites; the current large-site prices are above most Gantt apps |
| LedgerSeal | $1.30 | $1.05 | $0.75 | The current price is above all 9 signature and approval apps |
| DefinitionGuard | $1.10 | $0.80 | $0.40 | The current price is above all 9 checklist apps |
| FourRealities | $1.50 | $1.10 | $0.60 | Least price evidence; review after the first 30 to 50 paying sites |

The main weakness of the current plan is its shape: the median app charges 35% of its 11-100 rate at 251-1,000 users; the current plan charges 60%. This is an owner decision (queued, section 7).

## 5. The plan to the first paid customer

The first paid customer needs four things in a row: a partner account that can be paid, an approved paid listing, an evaluator who finds it, and a trial that converts. The long poles are the partner account and Atlassian's review, so they start first and run in parallel with the code work.

### Phase 0. Owner only, start now (2 to 3 weeks, in parallel)

1. Create the Marketplace partner profile with an `@asymm.systems` address (a personal domain may be refused).
2. Accept the Marketplace Partner Agreement, turn on two-step verification, complete the identity check.
3. Ask Developer and Marketplace support, in writing, whether payouts to a Sri Lankan company bank account are supported, and how app income is treated under the US-Sri Lanka treaty. This is the largest open unknown.
4. Open or confirm a USD account in the company's legal name; submit the W-8 form Atlassian asks for (confirm W-8BEN-E with a tax adviser).
5. Put a payment method on the Forge developer account (platform usage billing).
6. End the live Jira sessions whose cookies were committed in `docs/design/in-jira-automated-testing-guide.md` (N-12).

### Phase 1. CascadePlan to submission (me, then owner; about 1 week)

1. Build and live-check the progress and status rules (approved).
2. Owner reviews the branch; merge `feature/cascadeplan-marketplace-fixes` to `master` on the owner's word.
3. Release the site preview (guide, terms, support, privacy, FAQ, quick starts) on the owner's word.
4. Owner: `forge deploy -e production` for CascadePlan, then the console listing with the prices decided in section 4, using `docs/marketplace/submission/developer-console-checklist.md` and `cascadeplan-security-questionnaires.md`.
5. Atlassian review: 2 to 4 weeks. Licence test MK-08 after approval.

### Phase 2. The other three apps (me, during CascadePlan's review; about 3 weeks)

Order: DefinitionGuard (fewest blockers), then LedgerSeal, then FourRealities (it depends on the other two being fixed). Each: fix the blockers and the High findings, gate (tests, build, lint, audit), deploy to development, live check, new screenshots, listing and notes corrected, then the owner's production deploy and submission. The public verifier repository and the production keys come with LedgerSeal and DefinitionGuard.

### Phase 3. Being found (from the day a listing is live)

Inbound and written only, following the owner's rule: no founder-led cold sales.

1. **Marketplace search**: titles and taglines with the words buyers search for ("Gantt", "timeline", "dependencies", "Definition of Done", "approval", "electronic signature"). Ask satisfied users for a review; never reward reviews.
2. **Atlassian Community answers**: real questions the apps answer, for example "start a task when the previous one is 50% done", "lock a Jira issue after approval", "enforce Definition of Done". One honest answer each, naming the app only where it fits.
3. **One technical article per app** on asymm.systems (the drafts in `docs/launch/` are the start), and the 60 to 90 second videos in `docs/launch/video-scripts.md`.
4. **Partners**: written introductions to Atlassian Solution Partners and to a commercial partner, with the owner giving technical demos only (owner's partner-led rule).

### Phase 4. Trial to paid (30 days per trial)

1. Fast, written support: first answer within 24 business hours, as published.
2. The product does the onboarding: empty states, first-run help, and the admin steps named in each guide's quick start.
3. Watch Vendor Insights for installs and trials; read Forge logs for errors that stop an evaluator.
4. No contact with evaluators unless they ask or consent.

### Realistic dates (if Phase 0 has no surprises)

| Step | Earliest |
|---|---|
| CascadePlan submitted | mid-November 2026 |
| CascadePlan approved and listed | early to mid-December 2026 |
| First trials | December 2026 |
| First paid CascadePlan customer | mid-January 2027 (30-day trial) |
| Other three apps listed | January 2027 |
| First payout | when $500 profit has built up, then within 30 days; with a few small sites (an 11-user site pays $16.50 a month) this can take several months |

## 6. Approved 2026-11-06

- **Progress and status (CascadePlan)**: state comes only from the Jira status category; setting progress above 0% on a To Do item offers "Also move it to In Progress?"; 100% offers "Also move it to Done?" (Jira's transition rules apply); back to 0% changes no status; a Done item always shows 100% and its progress is locked; nothing changes in Jira without the user's choice in the same action (INV-03).
- **Verifier**: option A (section 2, item 3).

## 7. Owner decisions, one at a time

1. Launch order: CascadePlan first on its own, or the four together (asked 2026-11-06).
2. Price per app (section 4).
3. FourRealities on a site without the other apps: hide the two checks it cannot make, or keep them and explain (after the DefinitionGuard and LedgerSeal fixes).
