# Support Playbook: Jira Governance Suite

How Asymm Systems answers support and security mail for CascadePlan, LedgerSeal, DefinitionGuard and FourRealities. Every promise here is already published; this playbook adds no new one.

Prepared 2026-11-07. Sources: `https://asymm.systems/support`, `https://asymm.systems/security`, `https://asymm.systems/privacy`, `https://asymm.systems/terms`, the FAQ and user guides under `https://asymm.systems/product/jira-governance/`, and the four listing files in `docs/marketplace/`.

## 1. Channels and published promises

| Channel | Use | Published promise | Where it is published |
|---|---|---|---|
| `support@asymm.systems` | Questions and defects for the four apps, every tier including the free tier | First answer within 24 business hours, Monday to Friday. A defect that blocks production work: within 4 hours. | `/support`, FAQ section 3, the user guide hub, each listing |
| `security@asymm.systems` | Vulnerability reports, any product | Acknowledgement within 72 hours. Jira apps: fixes follow Atlassian's Security Bug Fix Policy for cloud apps: critical within 10 days, high within 4 weeks (medium 12 weeks, low 25 weeks), of being reported or triaged. | `/support`, `/security` section 5, `compliance.html`; Atlassian policy https://developer.atlassian.com/platform/marketplace/security-bugfix-policy/ (last updated 24 August 2026, fetched 2026-11-07) |
| `privacy@asymm.systems` | Privacy questions and data requests | Questions within 7 days, data requests within 30 days | `/support`, `/privacy` |
| Marketplace listing reviews | Public reviews | The Marketplace Partner Agreement (section 8.2) allows only informational answers to support requests in the reviews section of our own app. Never review our own or a competitor's app. | Marketplace Partner Agreement, last revised 1 December 2025 |

The 24-hour and 4-hour clocks count business hours from the time the mail arrives. Keep the first answer short and real: a fix, a workaround, or the next step and when you will write again.

## 2. Triage

For every new mail:

1. **Is it a security report?** A way to read, change or block data the user should not reach, a signature or hash that can be forged, a secret in a log. Move it to the security process (section 4). Do not discuss it in a public place.
2. **Which app and site?** If the mail does not say, ask for the app, the Atlassian site address (`<name>.atlassian.net`), what they did, what they expected and what happened, and a screenshot (the `/support` page asks for the same).
3. **Set the severity** (section 3) and start the clock.
4. **Look for a saved reply** (section 5). Change it to fit the question; never send a saved reply that does not answer what was asked.
5. **Reproduce** on the test site when it is a defect. Read the production log of the app:

   ```bash
   (cd apps/<app> && forge logs -e production --since 1d)
   ```

6. **Record** the case in the table of `docs/launch/go-to-market-plan.md`, section 4.3, only with what the customer wrote to us.

## 3. Severity

| Severity | Meaning | Examples | First answer |
|---|---|---|---|
| S1 Production blocked | The app stops the customer's production work and there is no workaround | A validator blocks every transition on a workflow; the planner does not open for anyone; a licence that is active is treated as inactive | Within 4 hours (published) |
| S2 Defect with workaround | Wrong behaviour, work can go on | A panel shows a wrong state; a CascadePlan cascade stops part way | Within 24 business hours |
| S3 Question | How to do something, licensing, pricing, data | Most mail | Within 24 business hours |
| Security | A vulnerability report | See section 4 | Acknowledge within 72 hours |

An S1 for a gate (LedgerSeal or DefinitionGuard) has a safe workaround that the customer controls: a Jira admin removes the validator from the transition and publishes the workflow. Offer it in the first answer, with what it costs them (the transition is not gated until the validator is added again).

## 4. Security reports

1. Acknowledge within 72 hours (saved reply R15). Do not confirm or deny the finding in the acknowledgement.
2. Triage with the reporter's steps on the test site. Rate it critical, high, medium or low.
3. Fix within Atlassian's times for cloud apps, from the time the report is triaged: critical 10 days, high 4 weeks, medium 12 weeks, low 25 weeks. Where `/security` gives a longer target (30 days for critical), the shorter Atlassian time applies.
4. If customer data was or may have been exposed, follow `/security` section 6: tell Atlassian as its app security incident management guidelines for Marketplace Partners require, and tell affected customers without undue delay and within 72 hours of confirming a breach of their personal data. The Partner Agreement, section 8.4, requires Atlassian's approval for any breach notice to end users that refers to Atlassian.
5. Tell the reporter when the fix is deployed.

## 5. Saved replies

Each reply names its source. Sign every reply "Asymm Systems support". Replace the parts in brackets.

### R1. Install and first setup

> Thank you for trying [app]. A Jira site administrator installs it from its Atlassian Marketplace listing: [listing URL]. After the install, the quick start for each app is here: https://asymm.systems/product/jira-governance/user-guide/
>
> In short: [pick one]
> - CascadePlan: open a project and choose CascadePlan Planner in the project navigation. No setup is needed.
> - LedgerSeal: seal an issue from the Approval Seal panel. To block transitions, a Jira administrator adds the Require Valid LedgerSeal validator to the release transition.
> - DefinitionGuard: open the Definition of Done panel on an issue; a built-in checklist for the issue type is there. To block moves into Done, a Jira administrator adds the DefinitionGuard DoD Enforcement validator to every transition into a Done status.
> - FourRealities: open Four Realities in the project navigation; the first open builds the project view.
>
> If a step does not work as the guide says, reply with your site address and a screenshot.

Source: user guide hub, quick start cards.

### R2. "The LedgerSeal validator does not block"

> LedgerSeal blocks a transition only where a Jira administrator has added the Require Valid LedgerSeal validator, and only after the workflow is published. Please check:
> 1. Project settings > Workflows: the transition you used has the validator under Validators, and the workflow draft is published.
> 2. The issue: the validator blocks when the issue is not sealed, was changed after approval, or the seal was revoked. An issue that is sealed and unchanged passes, and so does an issue where only Rank, Sprint or the status changed, because those are not covered.
> 3. Restricted comments and work logs: a comment or work log restricted to a role or group that the LedgerSeal app user is not in is not covered, so a change to it is not detected.
>
> If all three are as expected and the transition still passes, reply with the issue key and the transition name.

Source: LedgerSeal guide sections 2 and 5; `apps/ledgerseal/src/domain/canonicalizer.ts`; listing row "Content Snapshot".

### R3. "The DefinitionGuard gate does not block" (or "blocks when it should not")

> DefinitionGuard blocks a move into a Done-category status only on transitions where a Jira administrator added the DefinitionGuard DoD Enforcement validator; the app cannot add it for you. Project settings > DefinitionGuard > Gate coverage lists each transition into a Done status as Gated, Not gated or Exempt; click Check again after a workflow change.
>
> The gate lets a move through when every mandatory item is ticked or waived, or when the target status is in "Statuses the gate lets through" (for example Canceled). If the DefinitionGuard licence on the site is not active, the gate is off and lets every move through, and the panel says "Licence not active".
>
> If it blocks: the message lists the open mandatory items. An item marked "Not the assignee" cannot be ticked or waived by the current assignee or anyone who was the assignee after the item was opened; the validator checks this again at the move. If DefinitionGuard cannot read the data it needs, it blocks the move.

Source: DefinitionGuard guide sections 3, 5, 6 and 7; listing rows "Move-to-Done Gate" and "Gate Coverage Check".

### R4. Free tier

> Every app in the suite is free for Jira sites with up to 10 users. The free tier is not a trial: it has every feature of the app, no time limit, and no credit card. Atlassian licenses apps by the user tier of the whole Jira site, so a site with 11 or more users is on a paid tier.

Source: FAQ section 1; listings, "Transparent Pricing".

### R5. Trials and licensing

> On a site with more than 10 users, a site administrator starts the app's free 30-day trial from the Marketplace listing. Atlassian handles the trial and the billing; for a monthly subscription the app's cost is added to your next Atlassian bill when the trial ends, unless you cancel. Atlassian is the seller and sends the invoice.
>
> If the licence is not active, each app says so: CascadePlan shows "Licence required"; FourRealities shows "Licence not active" and reads nothing; DefinitionGuard shows "Licence not active", saves no checklist change and turns its gate off; LedgerSeal cannot seal or approve, keeps its existing seals, and its validator still decides as before and explains how to renew or remove it. A Jira administrator checks the licence under Manage apps.

Source: Atlassian Purchasing & Licensing, "Marketplace apps" (https://www.atlassian.com/licensing/purchase-licensing, fetched 2026-11-07); CascadePlan guide section 17; FourRealities guide section 5; DefinitionGuard guide section 6; `apps/ledgerseal/src/index.ts` (`LICENCE_INACTIVE_GATE_MESSAGE`).

### R6. Pricing, including above 1,000 users

> Each app has its own price per user per month, billed by Atlassian:
> - CascadePlan: $1.50 (11 to 100 users), $1.20 (101 to 250), $0.90 (251 and more)
> - FourRealities: $1.40, $1.10, $0.80
> - DefinitionGuard: $0.95, $0.75, $0.24
> - LedgerSeal: $0.95, $0.75, $0.24
>
> Above 1,000 users each app keeps its 251 to 1,000 price for every larger tier; there is no custom quote. Annual billing is 10 times the monthly price: you pay for 10 months and get 12. Sites with 1 to 10 users pay nothing. Atlassian's price calculator on the listing gives the exact amount for your user count.

Source: suite page "Pricing & Packaging"; FAQ section 1; listings; `docs/sdlc/suite-readiness-review-2026-11/README.md` section 4.

### R7. Data residency

> The apps run on Atlassian Forge and keep their data in Atlassian's Forge hosted storage for your site, which Atlassian hosts in your site's data residency location (for example the EU, the US or Australia), and, where the privacy policy says so, in issue properties of your own Jira issues. No app calls a server outside Atlassian; Asymm Systems operates no servers or databases for them. Data residency follows Atlassian's rules for Forge apps.

Source: `/privacy`, "What is the same for every app"; FAQ section 2; listings, "Data Residency".

### R8. Personal data

> None of the apps stores an email address. Each app stores Atlassian account ids only where a rule needs them, reports them to Atlassian's personal data reporting service every week, and removes the link to an account that Atlassian reports as closed:
> - CascadePlan: who froze a baseline, who requested or reviewed a scope change, each person who works on a task through a Jira sub-task, and the Jira administrator who last saved the approver groups.
> - LedgerSeal: people are named in seal records by a pseudonymous token; the link from token to account id is deleted when the account is closed.
> - DefinitionGuard: who ticked, waived, reopened or reset an item, or saved a setting, as a random pseudonym.
> - FourRealities: who requested or decided a Code exception, who gave a rework reason, and the assignee for the "My issues" filter.
>
> The full list is in our privacy policy: https://asymm.systems/privacy. For a data request, write to privacy@asymm.systems; we answer within 30 days.

Source: `/privacy`; FAQ section 2; listings, "Personal Data".

### R9. LedgerSeal evidence export and the offline verifier

> To give an auditor the evidence of a seal: open the issue's Approval Seal panel, open the seal details and click Show evidence (JSON). Copy the text into a file such as evidence.json.
>
> The auditor checks it offline with our open-source verifier (Apache-2.0, Node.js 18 or later, no dependencies): https://github.com/asymmsystems/jira-governance-code-cli
>
>     node verify-evidence.mjs evidence.json
>
> Without a key file, the verifier uses keys/<keyId>.pub.pem next to the script. It runs five checks (snapshot hash, history chain, newest seal, status, signature) and exits 0 when all pass, 1 when a check fails (the FAIL lines say which), and 2 for a usage error or a missing file. A pass shows the record was not changed after export and was signed with the published key `ls-prod-2026-11` (https://asymm.systems/product/jira-governance/signing-keys.html). It does not show that nobody could have written a different, consistent record; Asymm Systems holds the signing key.

Source: LedgerSeal guide section 7; open verifier guide sections 3 to 5; listing rows "Ed25519 Signed Attestation" and "Offline Verifier".

### R10. "Show evidence" is not offered, or a comment shows no text (restricted comments)

> Comments and work logs restricted to a project role or group are covered by the seal only when Jira lets the LedgerSeal app read them, that is when the app's user is in that role or group.
> - A covered restricted comment is shown in the panel only to a user who can see it in Jira; others see that a comment changed, without its text, author or time. The panel shows only the number of work logs, never their text.
> - The evidence is exported only to a user who can see every such comment and work log.
> - If LedgerSeal can no longer read a covered comment or work log (it was deleted, or restricted since to a role or group the app's user is not in), nobody sees that comment's sealed text, and that seal's evidence is not exported to anyone. Approving the changes makes a new seal whose evidence can be exported.

Source: LedgerSeal guide section 2; listing row "Content Snapshot".

### R11. FourRealities shows "Not used on this site"

> "Not used on this site" means FourRealities does not score that check on your site, so a finished issue is not marked down for it. Process and Audit are used once a signed DefinitionGuard or LedgerSeal record is found on the site, and Code once pull request data is found in the Jira Development field (your GitHub, GitLab or Bitbucket integration for Jira fills it). A Jira administrator can also set the source of each check in Jira settings > Apps > FourRealities gate authority instead of leaving it on Detect.
>
> A DefinitionGuard or LedgerSeal record counts only when FourRealities verifies its signature. A record it cannot verify counts like no record: Evidence missing on a Done issue, Not applicable before Done. A Checklists for Jira checklist is shown but never counts as evidence, because it cannot be signed.

Source: FourRealities listing, rows "Only the Checks Your Site Uses" and "Signed Records Are Verified", and "Works with, and works alone"; FourRealities guide sections 1 and 5; `apps/fourrealities/src/engine/default-gate-engine.ts`.

### R12. CascadePlan percent links

> A CascadePlan link says "B starts when A reaches N%". The link is a normal Jira "Blocks" link; the percent is kept on B as the issue property `cascadeplan.links`. To add one, hover a bar and drag the arrow at its right end onto the bar that waits for it, or select the bar, choose Add dependency and set "Starts when that issue reaches (percent)". 100% is the classic finish-to-start link. Click an arrow or its label to change the percent, swap the direction, or remove the Jira link.
>
> A's progress is its logged time against its estimate, or a value set by hand for the plan; a Done item is always 100%. "Why this date?" (the row's ❓ button, or ?) names the link that sets B's earliest start. With Enforce deps on, B cannot be dropped earlier than the link allows; with it off, a dialog offers to snap, lower the percent, keep the violation (the bar turns red) or cancel. A link between a work item and its own parent or sub-task, or one that makes a loop, is refused.

Source: CascadePlan guide sections 4 and 6; listing row "Percent-Trigger Dependencies".

### R13. Refunds

> Atlassian sells the app and handles refunds. Atlassian's policy: refunds for monthly cloud subscriptions are only available within the first paid month after the trial period; new annual cloud subscriptions can only be refunded within 30 days of the first purchase; renewals and upgrades cannot be refunded; Marketplace apps follow the same conditions. Please ask Atlassian through https://support.atlassian.com/contact/ (billing and licensing). For an exception outside 30 days, Atlassian asks you to reach out to the vendor for approval: write to us with your site and the app, and we will answer you.

Source: Atlassian Purchasing & Licensing, "Can I get a refund?" (fetched 2026-11-07); Marketplace Partner Agreement section 8.3 (Atlassian handles refund requests for Paid-via-Atlassian apps) and section 4.5. A refund outside Atlassian's window is the owner's decision.

### R14. Annual billing, invoices, quotes, tax

> Atlassian is the seller: it bills, invoices, calculates tax and converts currency, through your Atlassian account. Annual billing is 10 times the monthly price. For a quote or an invoice, use Atlassian's own tools for your site (admin.atlassian.com, Billing) or Atlassian support. Our terms add nothing to Atlassian's standard Marketplace end user agreement except our support policy: https://asymm.systems/terms

Source: `/terms`; FAQ section 1; Partner Agreement section 8.3.

### R15. Security report acknowledgement

> Thank you for the report. We received it on [date, time UTC] and will look at it now. We will tell you our assessment and the expected fix date. For our Jira apps we follow Atlassian's Security Bug Fix Policy for Marketplace cloud apps (critical within 10 days, high within 4 weeks of triage). Please do not share the details publicly until we confirm the fix is deployed.

Source: `/security` section 5; `compliance.html`, "Vulnerability Management".

## 6. What not to say

- Do not promise a feature date, a custom price, a discount or a refund. These are owner decisions; the Marketplace sets prices and refunds.
- Do not say the apps "certify" or "make you compliant". The listings say the apps support compliance and the auditor decides.
- Do not call the LedgerSeal history "immutable" or "append-only". It is tamper-evident; someone who can rewrite the app's storage, including the vendor, can write a new consistent chain.
- Do not say the LedgerSeal or DefinitionGuard signature protects against the vendor. Asymm Systems holds the signing keys.
- Do not use a support mail address to send marketing. See `docs/launch/trial-conversion.md`.
