# First-Sale Playbook: Closing the First Paying Commercial Customer

*Asymm Systems Commercial Operations Guide - Phase 5*

---

## 1. Commercial Foundation & Billing Mechanics

To execute an effective commercial sales motion on the Atlassian Marketplace, the publisher must understand Atlassian's exact billing and distribution architecture:

### 1. The Instance-Level User Wedge
On the Atlassian Marketplace, app licensing follows the **Jira Cloud site user tier**, not individual per-seat usage:
- **1 to 10 Users:** Free tier. Small teams and evaluation sandboxes install and use the app with full features at zero cost.
- **11+ Users:** Commercial tier. When an organization with an 11+ user Jira site installs the app, Atlassian automatically initiates a **30-day free commercial trial**.
- **Post-Trial Conversion:** At day 31, Atlassian automatically bills the customer's payment method on file according to our configured pricing schedule:
  - 11-100 users: $1.50 per user per month.
  - 101-250 users: $1.20 per user per month.
  - 251-1000 users: $0.90 per user per month.
  - Annual plans: Billed at a 16.6% discount (equivalent to 10 months paid, 2 months free).

### 2. Marketplace Revenue Collection & Settlement
- **Atlassian Merchant of Record:** Atlassian handles billing, invoicing, VAT/tax calculation, currency conversion, and credit card processing.
- **Revenue Share:** Atlassian retains its standard Marketplace commission (typically 15% to 25% depending on vendor program tier) and remits net earnings monthly via direct bank deposit or Stripe transfer.
- **First Paid Sale Milestone:** The first commercial sale occurs when the first customer with >10 users completes their 30-day trial and their payment method processes successfully on Atlassian's billing run.

---

## 2. Daily Telemetry & Operational Health

During the first 90 days post-launch, execute this daily 10-minute operational rhythm:

### 1. Marketplace Insights Inspection
Every morning at 09:00 UTC, log into the **Atlassian Developer Console** (`developer.atlassian.com/console`):
- Check **Installs:** Track net new installs across LedgerSeal, DefinitionGuard, FourRealities, and CascadePlan.
- Check **Evaluations:** Monitor active 30-day evaluation trials. Note company domain names where visible.
- Check **Licenses:** Review active paid licenses and upcoming renewal dates.
- Check **Uninstalls / Churn:** If an uninstall occurs, inspect the feedback reason code immediately.

### 2. Live Runtime Log Inspection (`forge logs`)
If a customer reports an issue or if install counts stall, inspect production error streams via the Forge CLI:

```bash
# Inspect production logs for LedgerSeal
cd apps/ledgerseal
forge logs -e production -a <app-id> --limit 50

# Inspect production logs for DefinitionGuard
cd apps/definitionguard
forge logs -e production -a <app-id> --limit 50

# Inspect production logs for FourRealities
cd apps/fourrealities
forge logs -e production -a <app-id> --limit 50

# Inspect production logs for CascadePlan
cd apps/cascadeplan
forge logs -e production -a <app-id> --limit 50
```

Look specifically for:
- Unhandled resolver rejections.
- Quota alerts on Forge KVS storage reads/writes.
- Authorization errors resulting from Jira permission misconfigurations.

---

## 3. The "Concierge Onboarding" Motion

Enterprise customers in regulated industries rarely convert without direct human validation. When a high-potential organization initiates a trial or submits an inquiry, trigger the Concierge Onboarding workflow immediately.

### Step 1: Detect Qualified Install
A qualified prospect typically displays one or more of these signals:
- Customer email domain belongs to a recognized financial services, healthcare/pharma, defense, or high-growth SaaS enterprise.
- The Jira instance has 50+ users.
- Support request or question submitted to `support@asymm.systems`.

### Step 2: Day 2 Concierge Welcome (The "Fahim" Message)
Send a personalized, respectful note from the founder/engineering lead within 24 hours of trial initiation:

```text
Subject: Welcome to LedgerSeal - Technical onboarding support for [Company]

Hi [Name],

I saw you recently installed LedgerSeal from the Atlassian Marketplace for [Company]'s Jira Cloud instance.

I am reaching out as the lead engineer at Asymm Systems to offer direct technical onboarding assistance.

Because LedgerSeal is 100% Atlassian Forge native, all computation and cryptographic state data run entirely inside your Atlassian tenant with zero external egress. Many of our enterprise evaluators need this architecture documented for their internal security review.

I would be glad to support your evaluation in whatever format is most efficient:
1. Provide our pre-filled Vendor Security Assessment (CAIQ / SIG Lite) for your InfoSec team.
2. Jump on a brief 15-minute architecture walkthrough to help configure approver groups and workflow transition validators.
3. Review your specific SOC 2, ISO 27001, or FDA 21 CFR Part 11 change control requirements.

Our complete technical documentation is available at:
https://asymm.systems/product/jira-governance/user-guide/ledgerseal.html

Let me know if you would like to connect this week.

Best regards,

Fahim Farook
Lead Engineer, Asymm Systems
fahim@asymm.systems | asymm.systems
```

### Step 3: Providing the Security & Compliance Whitepaper
When the prospect's security team asks for vendor documentation:
- Direct them to: `https://asymm.systems/product/jira-governance/compliance.html`
- Emphasize key zero-trust architectural proofs:
  - Zero third-party servers: no AWS/GCP backend to breach.
  - Zero egress: no outbound network fetch calls.
  - Open offline verification: auditors can verify evidence independently via `https://asymm.systems/product/jira-governance/user-guide/open-verifier.html`.

---

## 4. Evaluation Nurture Sequence (Day 7, 14, 21, 28)

### Day 7: Workflow Validator Check-in
*Objective:* Verify that the customer has placed the workflow validator on their production workflow, as unconfigured apps get uninstalled.

```text
Subject: Checking in: Gating workflow transitions in LedgerSeal

Hi [Name],

Quick technical follow-up: Have you had a chance to attach the LedgerSeal validator (`ledgerseal-validator`) to your release workflow transitions?

The app provides value immediately once the transition to "Done" or "Released" is gated, stopping post-approval modifications automatically.

Here is a 2-minute setup guide with screenshots:
https://asymm.systems/product/jira-governance/user-guide/ledgerseal.html

Let me know if you hit any workflow permission questions.
```

### Day 14: Mid-Trial Value Verification
*Objective:* Ensure the team has experienced a real transition block or checklist verification.

```text
Subject: Mid-trial check: DefinitionGuard / LedgerSeal at [Company]

Hi [Name],

Your team is halfway through the 30-day evaluation trial.

Has your team encountered any friction with checklist evidence requirements or approver permissions? We want to make sure the app fits smoothly into your sprint rhythm before the trial concludes.

If you have custom field requirements or need guidance on auditing exports for upcoming compliance deadlines, I am here to assist.
```

### Day 21: Commercial Procurement Notice
*Objective:* Prompt the technical champion to coordinate with procurement or Jira site administration before the trial ends.

```text
Subject: LedgerSeal trial update: 7 days remaining

Hi [Name],

Your 30-day evaluation trial of LedgerSeal concludes next week on [Date].

Because billing is handled natively through Atlassian Marketplace, no manual contract or invoice is required: the subscription will automatically continue on your organization's regular Atlassian invoice.

If your procurement or billing team requires our vendor tax ID, W-9, or formal SOC 2 architecture packet to keep the subscription active, you can download them directly here:
https://asymm.systems/product/jira-governance/compliance.html

Thank you for trusting Asymm Systems with your release governance.
```

---

## 5. First Sale Closing & Review Acceleration

Once the first commercial customer converts successfully:

### 1. Day 35: The 5-Star Review Request
Positive Marketplace reviews are the single highest-converting inbound asset on Atlassian Marketplace. Reach out right after the first paid invoice clears:

```text
Subject: Thank you for subscribing to LedgerSeal (+ quick favor)

Hi [Name],

I saw that [Company] officially completed its trial and subscribed to LedgerSeal. Thank you for your partnership and support.

If LedgerSeal has made your release reviews or compliance preparation smoother, would you be willing to leave a short, honest review on the Atlassian Marketplace?

As an independent engineering team, customer reviews make a massive difference in helping other teams discover our tools:
https://marketplace.atlassian.com/apps/ledgerseal/reviews

Thank you again, and please let me know whenever you have feature suggestions.
```

### 2. Case Study / Logo Authorization
Ask satisfied commercial customers if Asymm Systems may reference their industry and use-case (e.g., *"How a leading FinTech company automated SOC 2 CC8.1 change control in Jira Cloud"*).

---

## 6. Commercial Deal Tracking Pipeline

Use this pipeline table to monitor prospect progression from initial install to paid conversion:

| Customer Domain | Contact Name & Role | App Installed | User Tier | Trial Start | Trial End | Security Packet Sent? | Current Status | Next Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| *Example: fintech-payments.io* | *Jane Doe (QA Director)* | *LedgerSeal* | *125 users* | *2026-11-05* | *2026-12-05* | *Yes* | *Trial Active (Day 10)* | *Check workflow validator status* |
| | | | | | | | | |
| | | | | | | | | |
| | | | | | | | | |
