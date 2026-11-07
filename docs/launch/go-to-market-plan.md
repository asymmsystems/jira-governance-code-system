# Go-to-Market Plan: Jira Governance Suite

Who we sell CascadePlan, LedgerSeal, DefinitionGuard and FourRealities to, what we tell them, where they find us, how a trial becomes a paid licence within the Marketplace partner rules, and the six weeks from Atlassian's approval to the first paid customer.

Prepared 2026-11-07. Owner: Fahim Farook. It replaces `docs/launch/first-sale-playbook.md`, `docs/marketplace/suite-launch-and-first-sale-playbook.md` and `docs/marketplace/master-suite-launch-prompt.md`, which are kept as dated records.

This plan does not repeat the launch documents. For the detail, read:

| Document | What it holds |
|---|---|
| `docs/launch/launch-day-runbook.md` | The steps on the day Atlassian approves an app, the post order, and the proof of every claim in the posts |
| `docs/launch/distribution-kit.md` | The approved posts and their live variants (section 6) |
| `docs/launch/trial-conversion.md` | The partner rules in full, the touchpoints, the weekly metrics log, and what to change when trials do not convert |
| `docs/launch/support-playbook.md` | Support channels, published promises, triage and saved replies |
| `docs/sdlc/suite-readiness-review-2026-11/README.md` | Readiness verdicts, prices, commercial facts, owner decisions, the phases before launch |

"Owner" in this plan is Fahim. "Assistant" is the AI assistant session that prepares documents, checks and drafts for the owner's approval.

## 1. Who we sell to, and why

The buyer is a Jira Cloud team that must show an auditor that its change control works. That means teams under SOC 2 (CC8.1), ISO/IEC 27001:2022 (A.8.32) and regulated industries: finance, health, medical devices and other GxP work. The people who feel the pain are QA leads, release managers, engineering leads and compliance officers.

LedgerSeal and DefinitionGuard lead. They answer the two questions an auditor asks about a Jira change: was the approved ticket the one that shipped, and was the Definition of Done met before it shipped. FourRealities follows them into the same teams. CascadePlan sells to a wider planning market on its own.

| App | Who buys it | Why they buy it |
|---|---|---|
| LedgerSeal (lead) | Release managers, QA leads and compliance officers in SOC 2, ISO 27001 and Part 11 teams | Jira lets an approved ticket change before release and still move on. LedgerSeal seals the ticket at approval, names every later change and who made it, and blocks the release transition until another approver approves the change. |
| DefinitionGuard (lead) | Engineering and QA leads who must prove a Definition of Done was met; GxP and MedTech quality teams | A checklist in a description does not stop a move to Done. DefinitionGuard blocks the move while a mandatory item is open, asks for evidence on the items that need it, keeps review items away from the assignee, and records waivers with reasons. |
| FourRealities | Teams that already use LedgerSeal or DefinitionGuard, or a Git integration for Jira, and prepare for audits | An auditor asks which Done issues have a decision record, a Definition of Done, a merged pull request and an approval seal. FourRealities shows this per issue and per project. |
| CascadePlan | Planners and project leads who search the Marketplace for a Gantt chart, timeline or dependencies | Work can start at a percent of its predecessor, every Jira write is shown before it happens and can be undone, and baselines show scope change. Its compliance angle is narrow (see its listing). |

## 2. Positioning and the proof points that hold

One line for the suite: **evidence of change control, inside Jira, with no data leaving Atlassian.**

Each proof point below is in the app's listing file in `docs/marketplace/`. Use the listing's wording in every post, answer and mail.

| App | Proof point | Listing row or section |
|---|---|---|
| LedgerSeal | A SHA-256 snapshot of the covered fields, comments and attachments at approval | "Content Snapshot" |
| LedgerSeal | Each changed item is shown with its value at approval, its value now and who changed it | "Post-Approval Change Detection" |
| LedgerSeal | A user who changed the covered content cannot approve those changes, revoke the seal, or seal again after another approver revokes it | "Separation of Duties" |
| LedgerSeal | A tamper-evident, hash-chained history | "Tamper-Evident History Chain" |
| LedgerSeal | The Require Valid LedgerSeal validator blocks the transition, on the transitions where a Jira admin adds it | "Workflow Transition Gate"; `docs/launch/support-playbook.md`, R2 |
| LedgerSeal | Ed25519 signatures with the published key `ls-prod-2026-11`, checked offline by an open-source (Apache-2.0) verifier | "Ed25519 Signed Attestation", "Offline Verifier" |
| DefinitionGuard | Per-issue-type checklists, evidence-required items, the not-the-assignee rule, waivers with a reason | "Per-Issue-Type DoD Checklists", "Evidence on Items", "Not-the-Assignee Rule", "Waivers with Reasons" |
| DefinitionGuard | The validator blocks a move into Done while a mandatory item is open; Gate coverage shows where it is missing | "Move-to-Done Gate", "Gate Coverage Check" |
| DefinitionGuard | A hash-chained history with a JSON export | "Hash-Chained History", "JSON History Export" |
| FourRealities | Four checks per issue; signed DefinitionGuard and LedgerSeal records count only when the signature is verified; only the checks the site uses are scored | "Four Checks per Issue", "Signed Records Are Verified", "Only the Checks Your Site Uses" |
| CascadePlan | Percent-trigger links, "Why this date?", every Jira write listed before the drop, undo and redo, baselines with a SHA-256 digest | "Percent-Trigger Dependencies", "Why-Explanations", "Transparent Jira Writes", "Undo and Redo", "Baselines and Scope Reviews" |
| All four | Runs on Atlassian Forge; the manifest declares no external egress; data in Forge storage of the customer's site | "Data Privacy & Runs on Atlassian Architecture" in each listing |
| All four | Free for 1 to 10 users | "Transparent Pricing" |

Claims we do not make, because the listings do not support them:

- The apps "certify" a team or "make it compliant". They support compliance; the auditor decides.
- The LedgerSeal history is "immutable" or "append-only". It is tamper-evident. Someone who can rewrite the app's storage, the vendor included, can write a new consistent chain.
- The signatures protect against the vendor. Asymm Systems holds the signing keys.
- LedgerSeal gives 21 CFR Part 11 electronic signatures by itself. It supports the audit trail (11.10(e)); it does not meet 11.200 or 11.300.
- A validator blocks without an admin. A Jira admin must add the LedgerSeal or DefinitionGuard validator to each transition.
- The verifier checks DefinitionGuard exports. It checks LedgerSeal evidence only.
- FourRealities reads pull request approvals. It cannot.
- The LedgerSeal app is open source. Only the verifier is.

## 3. Channels

| Channel | What we do there | Detail |
|---|---|---|
| Marketplace listing | The main way buyers find and try the apps. Titles, taglines and highlights use the words buyers search for: "approval", "electronic signature", "Definition of Done", "Gantt", "timeline", "dependencies". | Listing files in `docs/marketplace/`; `docs/launch/trial-conversion.md`, section 2 |
| asymm.systems | The suite page, the user guides with a quick start per app, the compliance mapping, the signing keys and the verifier guide. Every listing links here. | `https://asymm.systems/product/jira-governance.html`; `docs/launch/launch-day-runbook.md`, step 3 |
| Launch posts | One channel a day after the site release: Hacker News, r/devops, r/jira, r/compliance, LinkedIn, then direct LinkedIn messages to people we find outside Marketplace data. | `docs/launch/distribution-kit.md`, section 6; `docs/launch/launch-day-runbook.md`, step 5 |
| Atlassian Community | One article (kit 6.6). Then honest answers to real questions the apps answer, for example "lock a Jira issue after approval", "enforce Definition of Done", "start a task when the previous one is 50% done". Name the app only where it fits. | `docs/sdlc/suite-readiness-review-2026-11/README.md`, Phase 3 |

Before each public post, read the channel's current self-promotion rules and say that we built the app. Every post already says "I built" or "We built".

## 4. Trial to paid, within rule 8.4(c)

### 4.1 The rule

Marketplace Partner Agreement, section 8.4(c) (last revised 1 December 2025, quoted in full in `docs/launch/trial-conversion.md`, section 1.1):

> You may use End User Data to communicate directly with end users only where required by Law or as consented to or requested by the end user. [...] You may not send marketing messages to end users within any user experience integrated with Atlassian Apps without Atlassian's express written consent.

So:

- **No contact with an evaluator** unless the evaluator wrote to us, asked for something, or consented. An install or an evaluation in the Marketplace reports is never a reason to write.
- **No marketing or upsell inside the apps.** In-product text is help and status only.
- People we find outside Marketplace data (public posts, Community threads, LinkedIn) may be contacted as by any company. Marketplace data is never the source of the contact.

The full table of allowed and forbidden cases is in `docs/launch/trial-conversion.md`, section 1.2.

### 4.2 The path

A Jira admin finds a listing, installs the app, and starts the 30-day trial (sites with 11 or more users) or uses the free tier (1 to 10 users). The trial converts when the team reaches the first value without our help:

| App | First value | What gets the evaluator there |
|---|---|---|
| LedgerSeal | A sealed issue turns CHANGED after an edit, and the release transition is blocked | The quick start; the panel's next step; the validator message. The admin must add the validator. |
| DefinitionGuard | A move to Done is blocked with the open items named | The built-in checklist; Gate coverage names the transitions without the validator |
| FourRealities | A project dashboard with checks in use | The first open builds the view; "Not used on this site" explains the rest |
| CascadePlan | A percent link moves dependent work, and the Changes panel shows each write | The planner opens with no setup |

Touchpoints we control, and who changes each, are in `docs/launch/trial-conversion.md`, section 2: the listing, the documentation link, the in-product first run and admin hints, the site, support mail, public answers and review replies.

### 4.3 When an evaluator writes to us

- Answer within the published times: 24 business hours, 4 hours for a production blocker (`docs/launch/support-playbook.md`).
- Follow up only on that thread and about that question. Ask before any further follow-up, and record the consent.
- Send what they ask for: the security questionnaire answers, a configuration session, a call.
- Record the case in the table below with only what the customer wrote to us. No names or contact details of evaluators go anywhere else.

| Opened | App | What they asked | Site tier they told us | Consent to follow-ups (date) | Next step | Status |
|---|---|---|---|---|---|---|
| | | | | | | |

### 4.4 Review requests

Ask for a Marketplace review only from a paying customer who is in a conversation with us, and never offer a reward for a review (our own rule). Copy the Reviews tab URL from the public listing; do not build it by hand.

## 5. Weekly metrics

Every Monday, about 30 minutes, from the Marketplace partner reports (Manage partner account, Reports). Copy the numbers into the log in `docs/launch/trial-conversion.md`, section 3, one row per app per week. The numbers that decide this plan:

| Number | Report | Why it matters |
|---|---|---|
| New evaluations | Evaluations | Are buyers finding the listing |
| Evaluations ending in the next 7 days | Licenses | Which week a conversion can come |
| New free-tier sites | Licenses | Reach among small teams |
| New paid licences, and the 4-week conversion rate | Cloud conversions, Sales | The goal of this plan |
| Uninstalls with their reasons | Feedback, Feedback details | What to change next |
| Support mail and missed promises | The support mailbox | Trust in a compliance buyer |
| Errors a new user would hit | `forge logs -e production --since 7d` per app | A broken first run kills a trial |

Reports are not real time. On Monday, read the week before. When a number points to a problem, use the table in `docs/launch/trial-conversion.md`, section 4, and change one thing at a time.

## 6. Six weeks from approval to the first paid customer

Week 0 is the day Atlassian approves the first listing. The posts need LedgerSeal public. A trial lasts 30 days, so the first trial that starts in week 1 ends in week 5. The first paid licence can show in the reports in week 6.

What must be done before week 0 is in `docs/sdlc/suite-readiness-review-2026-11/README.md`, section 5 (partner account, payouts, fixes, production deploys, submission). Its realistic dates put the listings in mid to late December 2026 and the first paid customer in late January 2027.

| Week | Owner | Assistant | Checkpoint at the end of the week |
|---|---|---|---|
| 0 (approval day) | Runbook steps 1 to 4 for each approved app: check the public listing, check production logs, release the site links, fill in the slugs | Prepare the release branch reverts for apps not yet public; check each listing against its listing file | Each approved listing is public and correct; the site buttons open it |
| 1 | Posts D+1 to D+6 in the runbook order; answer comments the same day; answer support mail | Check `forge logs` daily; check each post against its claim table in the runbook, step 5; draft answers to technical comments for the owner | Six posts out; no post claim found wrong; no support mail past its promise |
| 2 | First Monday metrics; LinkedIn messages (kit 6.7), a few a day, to people found outside Marketplace data; two or three Community answers | Read Feedback and logs for first-run problems; draft Community answers for the owner to approve and post | First evaluations logged; no first-run error left open |
| 3 | Approve one technical article per lead app (LedgerSeal, DefinitionGuard) for asymm.systems; record the LedgerSeal video; write to Atlassian Solution Partners that resell apps | Draft the articles from `docs/launch/approved-ticket-problem.md` and the listings; check `docs/launch/video-scripts.md` against the listings before recording | Articles live; video recorded; active evaluations counted |
| 4 | Monday metrics; pick at most one change from the signals table (`trial-conversion.md`, section 4) and approve it | Prepare that one change (listing text, quick start, empty state or admin hint) for review; log it under "Changes made" | One change made and dated, or a recorded reason for none |
| 5 | Watch the first trials end; answer fast on any thread where an evaluator asks about price, billing or the validator | Count evaluations ending this week and next; check the licence messages on the test site (MK-08) | Every trial end counted; every question answered within the promise |
| 6 | Monday metrics: Cloud conversions and Sales for the week before | Write a one-page review: evaluations, conversions, uninstall reasons, the change made in week 4 | **First paid licence in the reports**, or a review that names the reason and the next single change |

If no listing has a paid licence by week 6, keep the weekly loop. Do not change the prices: our working rule is no price change before 30 to 50 paying sites (from the price research note in the readiness review, section 4).

## 7. Economics

### 7.1 Prices

Decided by the owner on 2026-11-06 (`docs/sdlc/suite-readiness-review-2026-11/README.md`, section 4). Per user per month, free for 1 to 10 users, annual billing at 10 times monthly. Above 1,000 users each app keeps its 251 to 1,000 price.

| App | 11 to 100 | 101 to 250 | 251 to 1,000 and above |
|---|---|---|---|
| CascadePlan | $1.50 | $1.20 | $0.90 |
| FourRealities | $1.40 | $1.10 | $0.80 |
| DefinitionGuard | $0.95 | $0.75 | $0.24 |
| LedgerSeal | $0.95 | $0.75 | $0.24 |

Examples at the 11 to 100 price: an 11-user site pays $10.45 a month for LedgerSeal and $16.50 for CascadePlan. A 50-user site pays $47.50 a month for LedgerSeal.

There are no bundles for cloud apps. Each app is sold on its own.

### 7.2 Revenue share

0% on eligible Forge revenue from 1 January 2026, up to $1 million lifetime per partner. Above $1 million, 17% from 1 October 2026. Eligible means Forge only: no Connect modules, Forge UI. All four apps qualify.

Source: `docs/sdlc/suite-readiness-review-2026-11/README.md`, section 3, which cites the Atlassian blog "Updates to Marketplace revenue share 2026" (https://www.atlassian.com/blog/developer/updates-to-marketplace-revenue-share-2026, fetched 2026-11-06). The details are in `docs/sdlc/suite-readiness-review-2026-11/marketplace-commercial-rules.md`, section 5.

### 7.3 Payouts and costs

- Atlassian pays in USD by SWIFT wire, within 30 days after the month in which $500 profit has built up. One 50-user LedgerSeal site alone takes about 11 months to reach $500.
- A W-8 form is needed; without one, a 30% default withholding is reported.
- Forge usage above a free allowance per app is billed to us. Four small apps are likely inside the allowance.

## 8. Risks

| Risk | Effect | What we do |
|---|---|---|
| Payouts to a Sri Lankan company account are not confirmed | Revenue cannot be received | Owner asks Atlassian in writing as soon as the partner profile exists (readiness review, Phase 0, step 3) |
| Partner account and review take longer than planned | Week 0 moves later | Start Phase 0 first; plan for 2 to 4 weeks of review with one resubmission |
| We contact an evaluator without consent | Breach of rule 8.4(c) | Marketplace data is never a contact source; the support table records consent |
| An admin never adds the validator | LedgerSeal and DefinitionGuard show no value; the trial ends unpaid | The quick start, Gate coverage and the validator hints name the step; support reply R2 and R3 |
| A post or answer overclaims | A compliance buyer stops trusting the suite | Use listing wording only; the claim tables in the runbook, step 5; the "claims we do not make" list above |
| Few evaluations in a narrow market | No conversion within six weeks | Community answers and articles keep running; read the listing signals in `trial-conversion.md`, section 4 |
| Small sites stay on the free tier | Installs without revenue | Accepted: the free tier is reach. Revenue comes from sites with 11 or more users |
| Low prices and a $500 payout threshold | Months before the first payout | Accepted for launch; price shape reviewed after 30 to 50 paying sites |
| FourRealities on a site without the other two apps | A weaker first value | Owner decision 3 in the readiness review, section 7 |
| One person answers support | A missed 4-hour or 24-hour promise | Saved replies in `docs/launch/support-playbook.md`; the weekly check of missed promises |

## 9. Regulated strategy: the cloud governance layer for regulated migrations

Added 2026-11-08. The detail is in `docs/launch/regulated-enterprise-playbook.md`; the competitive gap is in `docs/launch/research/dc-migration-gap-2026-11.md`; partner material is in `docs/launch/partner-kit/`.

### 9.1 Why now

Atlassian stopped new Data Center apps on 2025-12-16 (Atlassian developer blog, "From Data Center to Cloud: The Next Chapter for Marketplace Apps", 2025-09-08) and new Data Center customers on 2026-03-30. Existing customers can buy and expand until 2028-03-30. Data Center becomes read-only on 2029-03-28 (Atlassian, "Data Center end of life", https://www.atlassian.com/licensing/data-center-end-of-life). Regulated enterprises must move to Cloud Enterprise with data residency, Isolated Cloud or Government Cloud. When the Jira Cloud Migration Assistant finds an app with no cloud version, it shows "This app is not available in cloud" and lets the admin choose an alternative.

### 9.2 The wedge

Some governance apps on Data Center have no cloud version, for example Electronic Signature for Jira and Approvals - Advanced Issue Acceptance (both Deviniti), and Auditor for Jira (Enhancera). For some cloud versions, the vendor's own pages list missing features, for example Appfire Electronic Signatures ("Requiring Electronic Signatures on the ticket transition screen" is Data Center only, vendor FAQ updated 2026-11-03). Checked 2026-11-08; the gap note has the URLs. The install counts are small (56 to 293), so the wedge is the message, not the market size: the governance step you had on Data Center has a cloud answer.

### 9.3 Segments

| Segment | Lead app | Message |
|---|---|---|
| Pharma and medtech (GxP, 21 CFR Part 11) | LedgerSeal, then DefinitionGuard | Part 11 audit trail (11.10(e)) for Jira change records in cloud; keep your own signing control for 11.200 and 11.300 |
| Finance (SOX ITGC, SOC 2) | LedgerSeal and DefinitionGuard | SOC 2 CC8.1 evidence: approval bound to content, separation of duties, Definition of Done gate |
| US government (FedRAMP, AGC) | All four, later | No egress, no Connect. AGC availability is planned, not done |
| EU (GDPR, NIS2) | All four | Data stays in Atlassian storage with residency; pseudonyms in hashed records; DPA being drafted |

### 9.4 What must be true before we push this message

1. At least LedgerSeal is listed (week 0 of section 6).
2. The regulated migration page is live on asymm.systems (branch `feature/regulated-migration` of `asymm-corporate-code-pfw`).
3. The procurement pack has the DPA and SAST (playbook, section 5).
4. Isolated Cloud and Government Cloud are always described as planned until the listings exist.

### 9.5 Channel and metrics

Solution Partners with a regulated or migration focus (partner kit, target list). The owner decides on every contact. Metrics in the playbook, section 8: evaluations and paid licences at 101 or more users, procurement pack requests, partner conversations.
