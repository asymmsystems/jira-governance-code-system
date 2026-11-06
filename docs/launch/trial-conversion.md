# Trial Conversion: Jira Governance Suite

How a trial of CascadePlan, LedgerSeal, DefinitionGuard or FourRealities becomes a paid subscription without breaking the Marketplace partner rules: what we may and may not do, which touchpoints we control, what we measure each week, and what we change when trials do not convert.

Prepared 2026-11-07.

## 1. The partner rules

### 1.1 The wording (checked 2026-11-07)

Source: Atlassian Marketplace Partner Agreement, https://www.atlassian.com/licensing/marketplace/partneragreement, "Last Revised: December 1, 2025" (the page also says these terms replace the previous Marketplace Partner Agreement). Fetched 2026-11-07.

Section 8.4(c), End User Communications, verbatim:

> You may use End User Data to communicate directly with end users only where required by Law or as consented to or requested by the end user. Similarly, if Atlassian provides you with access to information about an Atlassian Partner, you may use that information to communicate directly with the Atlassian Partner only where required by Law or as consented to or requested by the Atlassian Partner. You may not send marketing messages to end users within any user experience integrated with Atlassian Apps without Atlassian's express written consent.

Section 8.4(b), Collection and Use, the sentence on contact data:

> If you retrieve End User Data directly from Atlassian (e.g., end user contact information) via Atlassian-provided APIs, portals or other similar means, you must limit your access and processing of such information to that (a) authorized by the end user or (b) necessary for the purposes of providing the functionality of your Marketplace App.

Section 8.3 gives Atlassian sole discretion over payments, refund requests and customer service for its own obligations for Paid-via-Atlassian apps. Section 8.2 forbids reviewing our own apps or a competitor's, and allows only informational answers to support requests in our own app's reviews section.

Our privacy policy cites the same agreement (section 8.4(e)) on `https://asymm.systems/privacy`.

### 1.2 What it means for us

| Situation | Allowed? | Why |
|---|---|---|
| An evaluator writes to `support@asymm.systems` | Yes: answer, and follow up on that thread about that question | Requested by the end user (8.4(c)) |
| An evaluator asks for a call, a security packet or a configuration session | Yes, and send what they asked for | Requested |
| An evaluator ticks an opt-in or says "keep me posted" | Yes, within what they agreed to; keep the record of the consent | Consented |
| A new install or evaluation appears in Marketplace reports, with a contact name or domain | **No contact.** Use it only to count and to understand the market. | 8.4(b) and 8.4(c): not required by law, not consented, not requested |
| A notice the law requires, for example a personal data breach notice | Yes; for a notice that refers to Atlassian, get Atlassian's approval first (8.4, security incidents) | Required by law |
| A marketing or upsell message inside the app's UI in Jira | **No**, without Atlassian's express written consent | 8.4(c), last sentence |
| A review request to a customer | Only to a customer who wrote to us and is in a conversation with us; never offer a reward | 8.4(c); `docs/sdlc/suite-readiness-review-2026-11/README.md`, Phase 3 |
| Public posts, Community answers, outreach to people we find outside Marketplace data | Yes, as for any company (see `docs/launch/launch-day-runbook.md`, step 5). Marketplace data must not be the source of the contact. | Not End User Data |

### 1.3 Parts of `first-sale-playbook.md` that need consent first

`docs/launch/first-sale-playbook.md` was written before this check. These parts are allowed **only** when the evaluator wrote to us first or consented; they must never be triggered by an install or evaluation seen in Marketplace reports:

- Section 3, Step 1 "Detect Qualified Install" and Step 2 "Day 2 Concierge Welcome": the welcome opens with "I saw you recently installed LedgerSeal". Do not send it to an evaluator who has not written to us.
- Section 4, the Day 7, 14, 21 and 28 nurture mails: only on an open thread with an evaluator who asked for help, and only with their consent to follow-ups.
- Section 5, the Day 35 review request: only to a customer in a conversation with us. Its URL `https://marketplace.atlassian.com/apps/ledgerseal/reviews` is not the Marketplace URL pattern; copy the Reviews tab URL from the public listing (`https://marketplace.atlassian.com/apps/1226135152` before the slug is known).
- Section 2 "Check Evaluations ... Note company domain names where visible": noting is fine; contacting is not.
- Section 1 states the revenue share as "typically 15% to 25%". The readiness review (`docs/sdlc/suite-readiness-review-2026-11/README.md`, section 3) records 0% on eligible Forge revenue up to $1 million lifetime from 1 January 2026. The readiness review is the newer source.

`docs/marketplace/suite-launch-and-first-sale-playbook.md`, Phase 5, Step 2 "Proactive Concierge Onboarding (< 24 Hours)" has the same problem ("saw you installed LedgerSeal"). Same rule: only on request or consent.

## 2. Touchpoints we control

Conversion has to come from the product, the listing, the documents and fast support.

| Touchpoint | Where | What it must do | Owner of a change |
|---|---|---|---|
| Listing title, tagline, highlights, screenshots, description | Developer console, from `docs/marketplace/<app>-listing.md` | Use the words buyers search for; show the result, not the setup | Owner approves the wording |
| Listing pricing tab | Developer console | Free 1 to 10, the decided prices, annual 10 x monthly | Owner (price changes follow the Partner Agreement, section 4.1) |
| Listing Privacy & Security tab | Developer console, from `docs/marketplace/submission/<app>-security-questionnaires.md` | Answer a security review without a mail to us | Owner |
| Documentation link on the listing | `https://asymm.systems/product/jira-governance/user-guide/<app>.html` | The quick start works as written | Site branch and release |
| In-product first run | The app's empty states, first-run help, "How CascadePlan works", the next-step lines in the LedgerSeal, DefinitionGuard and FourRealities panels | The evaluator reaches the first value without help: a percent link that moves dependent work; a seal that turns CHANGED; a blocked move into Done; a dashboard with checks | Code change, normal review |
| In-product admin hints | DefinitionGuard Gate coverage; LedgerSeal validator message; FourRealities "Not used on this site"; licence messages | The admin step that gives the value (adding the validator) is named where the admin looks | Code change |
| In-product messages | Every panel | Help and status only. **No marketing or upsell** (8.4(c)). | |
| Site | Suite page, guides, FAQ, compliance page, signing keys, verifier | Answer the questions in `docs/launch/support-playbook.md` before they are asked | Site branch |
| Support | `support@asymm.systems` | First answer within 24 business hours, 4 hours for a production blocker | Owner |
| Public answers | Atlassian Community, Reddit, Hacker News threads | One honest answer per real question | Owner |
| Review replies | Listing reviews | Informational answers only (8.2) | Owner |

## 3. Weekly metrics checklist

Every Monday, about 30 minutes. Marketplace reports: log in to the Marketplace, profile menu, **Manage partner account**, **Reports** (https://developer.atlassian.com/platform/marketplace/reports/). The reports are Sales, Evaluations, Feedback, Cloud conversions, Cloud renewals, Cloud churn, and the data tables Licenses, Transactions and Feedback details. Atlassian's definitions (glossary, https://developer.atlassian.com/platform/marketplace/glossary-reports/, fetched 2026-11-07): conversion rate = "(Number of conversions to paid subscriptions) / (Number of evaluations due to expire) in the specified date range"; churn rate = "The number of subscriptions that were not renewed". Reports are not real time: read this week's numbers on Monday for the week before.

Copy the numbers into the table below, one row per app per week.

| Check | Report | Per app |
|---|---|---|
| New evaluations this week | Evaluations | |
| Active evaluations, and how many end in the next 7 days | Licenses (filter: evaluation, end date) | |
| New free-tier sites (1 to 10 users) | Licenses (filter: tier 10 users, active) | |
| New paid licences | Cloud conversions, Sales | |
| Conversion rate, 4-week rolling | Cloud conversions | |
| Uninstalls and unsubscribes, with the reason given | Feedback, Feedback details | |
| Churn rate of paid subscriptions | Cloud churn, Cloud renewals | |
| Revenue this week | Sales, Transactions | |
| Support mails, median time to first answer, any missed 24-hour or 4-hour promise | The support mailbox | |
| Errors a new user would hit | `(cd apps/<app> && forge logs -e production --since 7d)` | |
| New Marketplace reviews, and our reply if a support question is in one | The public listing | |

Log (one row per app per week):

| Week of | App | New evals | Active evals | Ending in 7 days | Free-tier sites | New paid | Conv. rate 4w | Uninstalls (reasons) | Support mails | Errors |
|---|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | | |

Do not copy names or contact details of evaluators into this log or anywhere else.

## 4. When a trial does not convert

Find the reason in data we are allowed to use, then change one thing at a time and watch it for four weeks.

| Signal | Likely cause | What we change |
|---|---|---|
| Few evaluations for the listing views and posts | The listing does not say what the buyer searches for | Title, tagline, first highlight and first screenshot (owner approves the wording). Answer more Community questions where the app fits. |
| Evaluations, then uninstall in the first days | The first value was not reached | The quick start and the in-product first run of that app: empty states, the next step in the panel, the admin hint for the validator. Check `forge logs` for errors on new sites. |
| Feedback reason "app functionality" | A missing or broken feature | Read the free text in Feedback details. A defect goes to the backlog with a test; a missing feature goes to the owner as one decision. |
| Feedback reason "price" | Price above what the site expects | No change before 30 to 50 paying sites (readiness review, section 4). Then the price shape is an owner decision; a price change follows the Partner Agreement, section 4.1. |
| Feedback reason "customer support" | A slow or unclear answer | Check the response times; turn the question into a FAQ entry or a saved reply. |
| The same question in several support mails | Documentation gap | Add it to the guide or FAQ and to `docs/launch/support-playbook.md`. |
| A trial ends with no paid licence and no feedback | Unknown | Nothing about that evaluator. Count it, and look for the pattern across trials. |
| Paid subscription not renewed | Value faded after setup | Cloud churn reasons; check whether the gate apps were ever gated (only visible if the customer tells us). |

Record each change with its date in this file, under "Changes made", so the four-week comparison is fair.

### Changes made

| Date | App | Change | Signal it answers | Result after 4 weeks |
|---|---|---|---|---|
| | | | | |
