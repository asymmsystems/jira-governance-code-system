# Atlassian Marketplace commercial rules for a small Forge vendor (Jira Cloud)

Vendor: Asymm Systems (one-person company, Sri Lanka), four Forge apps.
Research date: 2026-11-06.
Method: public pages only (developer.atlassian.com, atlassian.com, support.atlassian.com, community.developer.atlassian.com, irs.gov). No email address or personal data was sent to any site.

How to read this file:
- "Doc" means an official Atlassian page. "Community" means a post in the developer community. Community posts by Atlassian Marketplace staff are marked "staff reply". Posts by other vendors are second-hand and are marked "vendor report".
- Quotes are one short phrase, as returned by the page fetch tool.
- Anything I could not confirm is marked "unconfirmed".
- Pages disagree in places. Where they do, both numbers are shown.

---

## 1. Steps and prerequisites to list a PAID Forge app

Steps in order (as the docs describe them):

1. Create an Atlassian account and organisation, and verify the organisation.
   Source (doc): https://developer.atlassian.com/platform/marketplace/onboarding-hub/plan/register-as-an-atlassian-marketplace-partner/
   Enrolment is "a prerequisite for listing any app".
2. Create the Marketplace partner profile. A developer without a parent company can use their own name. A published Forge developer space also creates the public partner profile, and a published space cannot be unpublished.
   Sources (doc): https://developer.atlassian.com/platform/marketplace/become-a-partner/ and https://developer.atlassian.com/platform/forge/developer-space/publish-developer-space/ (the second page was only seen in search results; its content is not fetched, so the "cannot be unpublished" point is unconfirmed on the page itself).
3. Accept the Marketplace Partner Agreement (at enrolment and at submission), enable 2-step verification, and pass partner due diligence.
   Source (doc): https://developer.atlassian.com/platform/marketplace/onboarding-hub/plan/register-as-an-atlassian-marketplace-partner/
   Source (doc, approval): https://developer.atlassian.com/platform/marketplace/app-approval-guidelines says the agreement "must be accepted at submission".
4. Partner Verification (one time). A ticket opens in the Developer and Marketplace Support project. You submit an Identity Information Collection form and a Partner Security Questionnaire within 14 days, then do a Stripe Identity check (ID document, selfie, phone). Business verification runs by itself afterwards. Only "Verified" partners can get app approval.
   Source (doc): https://developer.atlassian.com/platform/marketplace/partner-due-diligence/
   Documents named: business name, address, "registration number and/or tax identification number", and the contact's passport or ID.
5. Technical prerequisites for a paid Forge app: set `app.licensing.enabled: true` in manifest.yml, deploy to production, enable sharing for the app in the developer console, publish the developer space, then submit.
   Source (doc): https://developer.atlassian.com/platform/marketplace/listing-forge-apps/
   "you won't be able to install the app from the production environment until your Marketplace listing is approved".
6. Legal and privacy items before submitting (doc, same page as step 5):
   - Accurate Privacy and Security tab: "It is your legal responsibility to provide accurate privacy and security information".
   - End User Terms for cloud transactions, and a DPA if you process personal data as a processor.
   - Flows to report and erase personal data (Forge user privacy guidelines).
   - List every API scope and why you need it, plus every remote host or IP, what data goes there, and why.
7. Submit the listing, choosing "Paid via Atlassian". Cloud apps cannot be "paid via vendor".
   Source (doc): https://developer.atlassian.com/platform/marketplace/selling-on-marketplace/
   Paid listings need logo, banner and screenshots, and "Personal or generic domains (like Gmail or Yahoo) are not permitted for paid-via-Atlassian apps" (so Asymm needs a company-domain email on the partner account).
   Source (doc): https://developer.atlassian.com/platform/marketplace/app-approval-guidelines
8. Payout setup (bank, tax form). See section 5.

Security questionnaires and self-assessment:
- App questionnaire: Forge has its own set of 17 questions. A "Fail" answer "Blocks the app from listing"; "Warning" and "Informational" do not. Source (doc): https://developer.atlassian.com/platform/marketplace/app-security-questionnaires/
- Partner Security Questionnaire: informational only, does not block approval. Automated vulnerability scanning also runs. "Critical or certain high-severity vulnerabilities" must be fixed before onboarding completes. Source (doc): https://developer.atlassian.com/platform/marketplace/app-approval-security-workflow/
- Old partner-level "Security Self Assessment": the Privacy and Security tab page says it was being deprecated on 13 August 2023. Source (doc): https://developer.atlassian.com/platform/marketplace/security-privacy-tab/
- Privacy and Security tab: this page says "It is not mandatory to answer the Privacy & Security questionnaire", but the approval guidelines list the tab among prerequisites whose absence "can delay review", and the Forge listing page treats accurate answers as a legal duty. Treat it as required in practice. A privacy policy is "a requirement for all partners". Sources: https://developer.atlassian.com/platform/marketplace/security-privacy-tab/ and https://developer.atlassian.com/platform/marketplace/app-approval-guidelines
- "Data Security and Privacy statement" as a separate named document: not found on any fetched page. Unconfirmed. The closest items are the Privacy and Security tab, End User Terms, DPA, and privacy policy.
- Bug Bounty: not required for listing a new app. The program page presents it as optional ("Apply to participate"), needs at least one publicly listed app, a pool of at least $5,000 USD, and "a minimum of 3 weeks" to launch. Source (doc): https://developer.atlassian.com/platform/marketplace/marketplace-security-bug-bounty-program/

Approval timelines (the pages disagree):
- "we aim to provide a decision within one week" (Forge listing page): https://developer.atlassian.com/platform/marketplace/listing-forge-apps/
- New app security workflow: 5-10 business days for new submissions, partner verification 2-3 business days: https://developer.atlassian.com/platform/marketplace/app-approval-security-workflow/
- Approval guidelines: "10-15 business days", chronological queue, "Several rounds of review are common": https://developer.atlassian.com/platform/marketplace/app-approval-guidelines
- Vendor report (community): partner verification for a sole trader took about three weeks end to end: https://community.developer.atlassian.com/t/individual-developer-no-registered-company-whats-the-minimum-verification-needed-to-publish-a-paid-via-atlassian-app/102404

What reviewers commonly reject (doc: https://developer.atlassian.com/platform/marketplace/app-approval-guidelines):
- "If the UI breaks, your app will be rejected."
- "Trademark infringement is an automatic rejection." Use "App X for Jira", not "Jira App X".
- App does not do what the listing says, or slows the host product.
- Promoting unrelated apps or services in the listing or product.
- Missing documentation, privacy policy, security steps, or a registered Developer Community contact.
- Basic authentication to product REST APIs.
- Submission errors and missing prerequisites (privacy tab, verification ticket, open vulnerability tickets).

---

## 2. Free first, paid later

- No rule found that forces a paid listing from day one. The payment-model page only says you can set initial pricing at submission. Unconfirmed as a negative (absence of a rule on the fetched pages). Source (doc): https://developer.atlassian.com/platform/marketplace/why-cant-i-change-the-payment-model
- Moving free to Paid via Atlassian is a blocked change in the UI, but is allowed by shipping a new version: "You'll need to release a new version with this change in place", with `app.licensing.enabled` set in manifest.yml. The change also "requires re-approval". Sources (doc): https://developer.atlassian.com/platform/marketplace/why-cant-i-change-the-payment-model and https://developer.atlassian.com/platform/marketplace/app-approval-guidelines
- Allowed without that route: Free to Paid via Vendor, but cloud apps cannot be paid via vendor, so this does not help a Forge cloud app.
- Existing installs: "Forge treats existing installations of a previously free app as unlicensed" until the site admin subscribes in the Admin Hub. Atlassian suggests a deprecation policy, a grace period with existing features free, and new features behind a license check. Source (doc): https://developer.atlassian.com/platform/marketplace/listing-forge-apps/
- Reverse move (Paid via Atlassian to Free) is also blocked in the UI. Same payment-model page.
- Revenue note: the Forge 0% incentive counts only revenue "earned after the first Forge-only version of the app is listed". A free period earns nothing, so it costs no incentive. Source (community, quoting the Atlassian blog): https://community.developer.atlassian.com/t/marketplace-revenue-share-updates-2026/91727
- Forge usage charges apply to free listings too ("Apps listed as free on the Marketplace are still charged for usage above the free tier"). Source (doc blog): https://www.atlassian.com/blog/developer/updates-to-forge-pricing-effective-january-2026

Practical reading: listing free first is allowed, but the later switch needs a new version, licensing code, and re-approval, and old installs start unlicensed until each admin subscribes. A free-first plan therefore gives little advantage. List as paid with a $0 or low 1-10 tier if the aim is early installs.

---

## 3. Licensing in Forge

- Enable: add `app.licensing.enabled` to manifest.yml, set `true`, run `forge deploy -e production`. Source (doc): https://developer.atlassian.com/platform/marketplace/listing-forge-apps/
- Checking the license:
  - UI Kit or Custom UI front end: `license.active` from `view.getContext()`.
  - Back end: `license.active` from the resolver `context`.
  - Triggers: `filter.appIsLicensed` skips unlicensed invocations.
  - Enabling licensing "does not do anything else than provide a property" (community): the app must enforce it. https://community.developer.atlassian.com/t/forge-app-licensing-with-paid-via-atlassian/72633
- context.license by environment (doc, same page): front end "only present for paid apps in the production environment"; back end "only present for apps in the production environment"; `license` is `undefined` for free apps, unlisted apps, and custom environments. The page does not say what development and staging return. Unconfirmed. A community search summary said it is undefined there, which fits, but I did not fetch a page that says so.
- Testing before release:
  - `forge install --environment development --license active` (values `active`, `inactive`, `trial`). Source (doc): https://developer.atlassian.com/platform/marketplace/listing-forge-apps/ (section "Testing your app with different license states").
  - A `LICENSE_OVERRIDE` environment variable is your own convention: "not interpreted by the Forge platform". Your code must read it.
  - Community advice: do the license check in a back-end resolver, where the override works, and have the front end call it. https://community.developer.atlassian.com/t/testing-license-for-new-forge-app/99111
  - Forge has no private listings (community, Sept 2025 reply): "We don't support private listings for Forge apps." The `--license` flag does not work for production (May 2026 vendor report). https://community.developer.atlassian.com/t/do-forge-apps-support-private-listings-in-the-marketplace/50135
  - Never test a paid app by installing it in production: "Production installs of paid apps are billed" (doc, listing page). Use development or staging.
  - The page title "Atlassian Marketplace: testing licensing" was not found as a separate page. The testing section above is the nearest. Unconfirmed that a separate page exists.
- Making a paid app installable for evaluation, in order:
  1. Licensing enabled in manifest, deployed to production.
  2. Sharing enabled, developer space published.
  3. Listing submitted as Paid via Atlassian and approved. Before approval, "you won't be able to install the app from the production environment".
  4. After approval, an admin starts "Free trial" / "Try it free" from the listing. Source (doc): https://developer.atlassian.com/platform/marketplace/selling-on-marketplace/ says "Customers start with a 30-day free trial that converts to a paid subscription".
  5. For your own dogfooding in production: a 100% promo code (vendor report: Atlassian must apply it on annual plans). 100% promotions create a $0 sale and do not show in sales reports. Sources: https://developer.atlassian.com/platform/marketplace/sales-promotions/ and the private-listings thread above.

---

## 4. Evaluation and trial

- Length: "Monthly Cloud app trials last 30 days." Evaluations stay active for a minimum of 30 days and, because checks happen on the billing date, can last up to 59 days. Source (doc): https://developer.atlassian.com/platform/marketplace/knowledge-base/licensing-faq/ (the 59-day figure was in the page fetch; the "next billing cycle after 30 days" rule is also in https://developer.atlassian.com/market/add-on-licensing-for-developers/licensing-and-paid-via-atlassian-listings).
- Conversion: with a valid payment method the trial becomes "a full commercial license (billed monthly)". Same licensing FAQ. Monthly subscriptions convert at the next bill unless the admin unsubscribes (Atlassian purchasing FAQ summary in search results; the page text itself was truncated on fetch, so unconfirmed on the page).
- Annual plans cannot be trialled, only purchased (vendor report): https://community.developer.atlassian.com/t/when-does-a-customer-pay-for-an-app/63170
- Credit card to start a trial: unconfirmed. The licensing FAQ says conversion needs "a valid payment method on your account" but does not say a card is needed at the start. A vendor report says "Customer can start an eval with no card"; another community report says a site without payment details failed to start a trial. Treat as unconfirmed and test it on a real site.
- Who can start it: the cloud site admin. Non-admins use "Request this app" (vendor documentation seen in search results; unconfirmed on an Atlassian page).
- Extensions: Atlassian does not extend cloud trials normally. Exceptions are mostly migrations, and "All Cloud trial extensions require Marketplace Partner approval". Source: licensing FAQ above.
- If the customer's payment fails or they do not pay, "their site will be shut down" and "You will not be notified of this event" (doc): https://developer.atlassian.com/platform/marketplace/selling-on-marketplace/
- What the customer sees: the "Try it free" button on the listing, then the app in Manage apps, with the license state your code reads (`trial`). A customer-facing screenshot flow for Forge was not found on an Atlassian page. Unconfirmed.
- What the vendor sees: customer email addresses appear in the sales, licenses and evaluation reports and in the REST API, for paid apps only. Data lags up to 24 hours. Contact fields show "RTBF" when a person used the GDPR right to be forgotten. Source (doc): https://developer.atlassian.com/market/faqs/sales-and-evaluations-reports-for-paid-via-atlassian-listings
- Rules for using that data: the Partner Agreement says you may contact end users with End User Data "only where required by Law or as consented to or requested by the end user" (clause 8.4(c)). Source (doc): https://www.atlassian.com/licensing/marketplace/partneragreement . So the evaluator email is for support and licensing, not for cold marketing, unless the user consents.
- $0 tier: the free 1-10 tier report supplies "customer name, contact email, user count, and parent product edition" (community announcement, 2021): https://community.developer.atlassian.com/t/introducing-a-new-0-price-point-for-your-1-10-cloud-app-user-tier/54225

---

## 5. Revenue share, payouts, tax

Revenue share for Forge apps (Atlassian keeps):
- Standard Forge rate rises from 15% to 16% on 1 April 2026 and to 17% on 1 October 2026. Source (doc blog): https://www.atlassian.com/blog/developer/extended-timelines-for-marketplace-revenue-share-changes
- The pricing page states the partner share as "Forge apps: 84%" from 1 April 2026 and 83% from 1 October 2026 (Connect 80% then 75%, Data Center 75%). Source (doc): https://developer.atlassian.com/platform/marketplace/pricing-payment-and-billing/
- Older community thread gave 1 January and 1 July 2026 dates. They were superseded by the "extended timelines" post. https://community.developer.atlassian.com/t/marketplace-revenue-share-updates-2026/91727
- Forge 0% incentive: from 1 January 2026, 0% revenue share "until lifetime Forge revenue reaches $1 million". Counted per partner company across all its Forge apps, from the first Forge version listed, no reset. Revenue earned before 1 January 2026 does not get the 0% rate. Atlassian calls it temporary and promises "at least 6 months' notice before changes to standard rates". Sources (doc blogs): https://www.atlassian.com/blog/developer/updates-to-marketplace-revenue-share-2026 and https://www.atlassian.com/blog/development/runs-on-atlassian-apps-can-now-take-home-100-of-marketplace-revenue
- Eligibility for the 0% rate: no Connect modules, Forge authentication (OAuth 2.0), Forge UI (Custom UI or UI Kit); Forge remotes are allowed. Same blog.
- Net for Asymm: while lifetime Forge revenue is under $1M, Asymm keeps 100% of eligible revenue. After that, 83%.

Payment schedule and minimum:
- "We pay you within 30 days after the end of the month in which you accrue $500+ USD in profit." Remittance report and payment between the 17th and 20th of the payment month. Atlassian may pay early. Source (doc): https://developer.atlassian.com/platform/marketplace/pricing-payment-and-billing/
- Partner Agreement clause 4.4: about 30 days after the end of the calendar month of the sale, and Atlassian may hold payments until at least US$500. Source (doc): https://www.atlassian.com/licensing/marketplace/partneragreement
- Practical delay: roughly 30 to 60 days after a sale, longer if the $500 threshold is not reached.

Payout method:
- Agreement clause 4.3 and 4.4: paid "in USD", by electronic funds transfer to "a valid bank account in your name". Same agreement page.
- Staff replies: USD by international wire (SWIFT), monthly, to a local bank account in the exact legal name; Atlassian recommends a USD account to avoid conversion fees. Sources (community, staff replies): https://community.developer.atlassian.com/t/can-a-company-registered-in-guatemala-become-a-marketplace-partner-and-receive-usd-payouts/103074 and https://community.developer.atlassian.com/t/is-canada-a-supported-payout-country-for-marketplace-partners/103113 and https://community.developer.atlassian.com/t/marketplace-payouts-for-a-partner-based-in-ukraine-sole-proprietor/103157
- PayPal as a payout method: not found. Unconfirmed (and the agreement text points to bank transfer).

Can a Sri Lankan vendor be paid?
- Unconfirmed. No Atlassian page lists supported payout countries. A community thread asking where this is documented has no answer: https://community.developer.atlassian.com/t/supported-countries-for-marketplace-partner-registration-and-payouts-where-is-this-documented/102084
- Staff replies for Canada, Guatemala and Ukraine say there are no country problems there. They do not mention Sri Lanka.
- The partner support form needs a Vendor ID, so you cannot ask before a profile exists (same thread). Practical route: create the partner profile, then ask Developer and Marketplace support about Sri Lanka payout support, before building the sales plan.
- Sole proprietor or company: staff reply (Ukraine) says "A legal entity is not required". Asymm is a company anyway.

Tax forms and withholding:
- Non-US partners complete "a standard Form W-8BEN during payout setup" (individual) and W-8BEN-E for a company (staff replies above: Canada and Ukraine say W-8BEN; Guatemala says W-8BEN-E). Asymm Systems, as a company, should expect W-8BEN-E. Which form applies to a single-owner company depends on how it is registered. Unconfirmed, ask the owner's accountant.
- Withholding: Agreement clause 4.7: Atlassian may "deduct or withhold any applicable taxes payable by you". Vendor report: with no W-8 on file "the statutory default is 30%", and Atlassian told that vendor "a U.S. TIN is required for exemption" (https://community.developer.atlassian.com/t/individual-developer-no-registered-company-whats-the-minimum-verification-needed-to-publish-a-paid-via-atlassian-app/102404). That vendor report is second-hand and the W-8BEN-E rule for a foreign TIN is unconfirmed.
- Treaty: the IRS lists a US-Sri Lanka income tax treaty (1985, protocol 2002). Source: https://www.irs.gov/businesses/international-businesses/sri-lanka-tax-treaty-documents . Whether Atlassian treats app income as business profits (treaty Article 7) is a vendor report only. Unconfirmed. Ask Atlassian for the treatment in writing and ask a Sri Lankan tax adviser.
- Sales tax: Atlassian handles most collection and remittance on Marketplace sales; "You are responsible for taxes resulting from Atlassian's payments" (search summary of https://developer.atlassian.com/platform/marketplace/sales-tax/ ; the fetched page itself did not contain the text, so unconfirmed on the page).
- A W-8BEN is valid "through 31 December of the third year after you sign it" (vendor report, same thread).

---

## 6. Pricing rules

- Cloud paid apps are priced by user tier, matched to the host Atlassian app license: tiers "have to exactly match the Atlassian host app license" and the app tier upgrades with the host tier. Source (doc): https://developer.atlassian.com/platform/marketplace/pricing-payment-and-billing/
- How the site count is used: Jira Marketplace apps are "priced based on the maximum number of users of Jira apps on your site". Example: Jira 100 users and Jira Service Management 80 agents means each app is billed at the 100-user price. Source (doc): https://support.atlassian.com/subscriptions-and-billing/docs/understand-billing-for-cloud-apps/ . That page does not use the words "every licensed user". Vendor pages say the same (all licensed users on the site, not only app users), but I rely on the Atlassian wording above.
- 1-10 user tier can be free: "set your 1-10 user tier price at any value, including $0.00" (cloud only, announced December 2021, it is "the only exception to the current progressive discounting rule"). Source (community announcement): https://community.developer.atlassian.com/t/introducing-a-new-0-price-point-for-your-1-10-cloud-app-user-tier/54225 . The current pricing page does not mention it, so confirm in the Partner Portal. Unconfirmed as still current.
- Monthly and annual: both offered for cloud Paid via Atlassian. Annual price is 10 times the monthly price. Monthly renews automatically. Source (doc): pricing page above.
- Price changes: existing customers "get a 60-day price override" if they stay on the same tier. Same page.
- Highest tier limit: unconfirmed (community posts mention 20,000 then 50,000 and more).
- Bundles of several apps at one price: not supported for cloud as far as found. The sales-promotions page says bundles are "Data Center only". Source (doc): https://developer.atlassian.com/platform/marketplace/sales-promotions/ . The discount-programs page does not mention bundles: https://developer.atlassian.com/platform/marketplace/app-discount-programs/ . "App editions" (tiers of one app) were announced in a community article from July 2025 (seen in search results only, not fetched). Unconfirmed. A "partner bundle" programme was not found.
- Automatic discounts Atlassian applies to your price: Academic (cloud 50%, Confluence 75%), Social Impact 75%, Social Impact Global Access 85%, Classroom 75%, Open source 100%, Sandbox 100%, and an opt-out Channel Partner discount. Source (doc): https://developer.atlassian.com/platform/marketplace/app-discount-programs/ . The partner agreement says Atlassian manages these; the cost bearer is not stated. Unconfirmed who funds them.
- Refunds are controlled by Atlassian and can be offset against later payouts (agreement clause 4.5).

---

## 7. Programmes that help a new vendor

- Runs on Atlassian badge: applied automatically, no application. Requirements: "Apps exclusively use Atlassian-hosted compute and storage", data residency matching the host app, customer control over external data egress. Customers can filter by it. Check with the Forge CLI eligibility command. The page lists no revenue benefit, though the Atlassian revenue-share blog ties the 0% incentive to Forge-only apps (see section 5). Sources (doc): https://developer.atlassian.com/platform/marketplace/runs-on-atlassian/
- Cloud Fortified: replaced. "AEC is replacing the Cloud Fortified Apps program". Cloud Fortified takes no new submissions; existing badges stay visible through 31 December 2026. Source (community, staff announcement): https://community.developer.atlassian.com/t/introducing-atlassian-enterprise-certified-aec/103035 . The Cloud Fortified page itself still exists: https://developer.atlassian.com/platform/marketplace/cloud-fortified-apps-program/
- Atlassian Enterprise Certified (AEC), the successor: open to Forge cloud apps, but needs a current annual penetration test, public bug bounty, SOC 2 Type II or ISO 27001, public trust center, VPAT, status page. Source (doc, updated 28 Oct 2026): https://developer.atlassian.com/platform/marketplace/atlassian-enterprise-certified-program/ . Not realistic for a first-year one-person vendor.
- Staff Picks: retired. Atlassian "said so-long to the coveted Staff Picks badge" (post dated 15 Oct 2024). Replacements: Spotlight (top apps by installs, reviews), Rising Star (newer apps gaining traction), Bestsellers, and collections. Source (doc blog): https://www.atlassian.com/blog/apps/new-atlassian-marketplace . How Rising Star is chosen is not stated. Unconfirmed.
- Marketplace Partner Program (Silver, Gold, Platinum): Silver needs $150K annual cloud gross sales, Gold $750K, Platinum $3M. Base partners (at least one paid-via-Atlassian app) get partner communications, "a $2,500 credit for internal Atlassian tools", and basic ticket access. Source (doc): https://developer.atlassian.com/platform/marketplace/marketplace-partner-program/ . Partner portal access needs a private-domain email.
- Promotions: you can create promo codes for your own paid-via-Atlassian apps in the vendor account. Source (doc): https://developer.atlassian.com/platform/marketplace/sales-promotions/
- Atlassian Ventures: invests at "Seed - Series B with $1-5M investments". The page gives no application route beyond a contact address and does not say it is open to applications. Not a fit for a bootstrapped vendor. Source (doc): https://www.atlassian.com/ventures . The 2021 post that described a $50m fund for early-stage app startups is old: https://www.atlassian.com/blog/development/get-ready-to-grow-explore-a-world-of-possibility-in-the-atlassian-ecosystem
- Forge funding or credit programmes: none found in 2026. The only Forge incentive found is the 0% revenue share up to $1M. Unconfirmed that nothing else exists (a "Developer Champions" pilot appeared only in a job posting, not an Atlassian programme page).
- Solution partners (resellers): the Channel Partner discount is opt-out at app level and gives a discount from list price "percentage not stated". Source (doc): https://developer.atlassian.com/platform/marketplace/app-discount-programs/ . No resale or referral programme for Forge vendors found. Unconfirmed.

---

## 8. Discoverability

- Search ranks on three factors: keyword relevance (name, tagline, brief description), semantic match, and an engagement score (ratings and reviews count, average rating, installs, and whether support details are given). "installs is only one of them." Source (doc): https://developer.atlassian.com/platform/marketplace/marketplace-search-results-and-rankings/
- Keyword stuffing hurts: "Including irrelevant keywords makes it harder for customers to understand your app's value."
- New apps: the page gives no special treatment. Atlassian staff said established apps can outrank new ones (search summary only, unconfirmed).
- Asking for reviews: the ranking page tells partners to ask customers for ratings and reviews. Rules: reviewers must confirm they use the app, falsifying reviews or ratings leads to warnings, suspension or removal, and the partner agreement says you "may not review or comment on your own Marketplace App or those of competitors" (clause 8.2). Sources: the ranking page above and https://www.atlassian.com/licensing/marketplace/partneragreement
- Paying or rewarding customers for reviews: no explicit rule found on a fetched page. Unconfirmed. Do not offer rewards for reviews.

---

## 9. Forge platform pricing for the vendor

- Atlassian charges the app developer for Forge usage above free allowances, per app per month, across all environments including development. Billing started 1 January 2026. Invoices come on the first of each month for the prior month, from 1 February 2026. Sources (doc): https://developer.atlassian.com/platform/forge/forge-platform-pricing/ and https://www.atlassian.com/blog/developer/updates-to-forge-pricing-effective-january-2026
- Free allowances and overage (per app per month, live pricing page):
  - Functions compute: 200,000 GB-seconds free, then $0.000025 per GB-second. The January 2026 blog and a community comment say 100,000 GB-seconds. The live page is newer, so use 200,000 but treat as unconfirmed until you see your Developer Console figure.
  - Key-value store reads and writes: 0.1 GB each free; $0.055 per GB read, $1.09 per GB written. Data stored: not charged in January 2026, "pricing to come later in 2026". Whether it is now charged is unconfirmed.
  - Logs: 1 GB free, then $1.005 per GB.
  - SQL: 1 hour compute and 100,000 requests free, 730 GB-hours storage free.
  - Object store: 5,000 requests free.
  - Containers and LLM: no free allowance (not relevant unless used).
- Billing details: "Once pricing takes effect, you'll need to provide billing details to continue using Forge." Credit cards and ACH were supported at launch (blog). Invoices go to the developer space admin. An app can sit in only one developer space, and apps cannot be transferred with an unpaid balance.
- Sandboxes: usage on up to five sandboxes per production site is exempt from April 2026 (live pricing page).
- What it means for Asymm: four small apps get four separate allowances. Light Jira apps with modest traffic will probably stay inside the free allowance, but development and staging usage counts, so avoid runaway scheduled triggers and heavy logging. A card must still be on file in the Developer Console. A free listing does not avoid charges. Unconfirmed: actual cost of Asymm's apps. Check the Usage and costs page in the Developer Console.

---

## Critical path to the first paid customer

Durations are realistic planning figures built from the sources above. Items marked (parallel) can run at the same time.

| Stage | Official figure | Plan for | Notes |
|---|---|---|---|
| 1. Atlassian org, partner profile, agreement, 2SV | no figure | 1-2 days | Needs company-domain email. Publishing the developer space is permanent. |
| 2. Partner Verification (identity, business) | 2-3 business days; forms due in 14 days | 1-3 weeks (parallel with 3) | A sole trader reported about 3 weeks. Stripe selfie and ID by the owner. |
| 3. Payout profile: bank details, W-8BEN-E, KYC | no figure | 1-2 weeks (parallel); start immediately | Sri Lanka support unconfirmed. Ask support first. |
| 4. App readiness: licensing code, End User Terms, DPA, Privacy and Security tab, listing assets, scope and egress justification | n/a | 1-2 weeks (parallel) | Test with `forge install --license` in development. |
| 5. Submission and review | 1 week aim; 5-10 or 10-15 business days | 2-4 weeks including one resubmission | Missing prerequisites delay review. A verification ticket still open blocks approval. |
| 6. Listing live | on approval | same week as approval | Production install of the paid app is possible only after this. |
| 7. First evaluator installs | n/a | days to months | Depends on discovery. A new listing starts low in search. |
| 8. Trial | 30 days minimum, up to 59 | 30-59 days | Converts at billing date if the customer has a valid payment method. Annual cannot be trialled. |
| 9. First payout | within 30 days after the end of the month in which $500 profit accrues | +30-60 days after the sale, longer if under $500 | Threshold counts profit across all apps. |

Totals:
- Account and agreements, verification, payout setup, and app readiness run in parallel: about 2-3 weeks.
- Submission to live: about 2-4 weeks.
- Earliest first paid customer: about 6-9 weeks after starting, if an evaluator appears right at listing (live in about 5-7 weeks, plus a 30-day trial).
- First cash in the bank: about 3-5 months after starting.

Steps only the owner can do (no one else can sign, verify or hold the bank account):
1. Create the Atlassian account and organisation, verify it, and accept the Marketplace Partner Agreement (binding signature).
2. Complete the Identity Information form and the Stripe Identity check (ID document and selfie).
3. Provide business name, address, registration or tax ID for due diligence.
4. Enter the bank account details in the company name and sign the tax form (W-8BEN-E or W-8BEN). Decide the treaty claim with an accountant.
5. Add a payment method for Forge usage billing in the Developer Console.
6. Sign off End User Terms, DPA, privacy policy, and the Privacy and Security tab answers ("legal responsibility").
7. Publish the developer space (permanent) and choose the payment model (Paid via Atlassian) and prices.
8. Raise any support question tied to the partner account, such as Sri Lanka payout eligibility.

Open items to settle first (unconfirmed above): Sri Lanka payout support, W-8BEN-E vs W-8BEN for Asymm Systems, whether a card is needed at trial start, the current compute allowance (100,000 or 200,000 GB-seconds), and whether the free 1-10 tier is still offered.

---

## Source quality note

All facts come from pages fetched on 2026-11-06 through a fetch tool that returns a model-written extract of each page, not the raw HTML. Quotes are as returned. Pages whose text was truncated or empty (Atlassian purchasing FAQ, Marketplace Terms of Use, sales tax page, Forge licensing deep links) were not used for firm claims. Search-result summaries were used only to find pages, and any claim that rests only on them is marked unconfirmed.
