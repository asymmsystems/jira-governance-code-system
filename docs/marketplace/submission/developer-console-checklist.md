# Atlassian Developer Console Submission Checklist & Runbook

This runbook guides the publisher through official Atlassian Marketplace submission on [developer.atlassian.com/console](https://developer.atlassian.com/console) for all 4 apps in the Asymm Systems Jira Governance Suite (**LedgerSeal**, **DefinitionGuard**, **FourRealities**, **CascadePlan**).

---

## 1. Pre-Submission Technical Audit & Blockers

Before submitting any app in the Developer Console, ensure these prerequisites are satisfied:

| Check | Requirement | Verification Command / Check | Status |
|---|---|---|---|
| **Licensing Enabled** | Every paid app manifest must declare `app.licensing.enabled: true`. | Present in all four manifests (`apps/*/manifest.yml`, checked 2026-11-05). | Ready |
| **No External Icon URLs** | Icons in `manifest.yml` must reference local static resources (e.g. `resource:icons;icon.svg`) rather than raw URLs. | All four manifests use local `resource:` icons (checked 2026-11-05). | Ready |
| **Production Forge Deploy** | Apps must be deployed to the Forge `production` environment. | Run `forge deploy -e production` inside each app directory. | Not verified (the recorded LedgerSeal and CascadePlan deploys are to `development` only) |
| **Production Installation** | Paid apps: test in the development or staging environment (`forge install --environment development --license active`); a paid app cannot be installed from production until its listing is approved, and production installs are billed. | Install from production only after approval (then run the licence check, MK-08). | After approval |
| **Clean Lint & Tests** | Zero lint warnings and 100% test pass rate. | Run `npm test` and `forge lint` in each app. | Not verified on master (`apps/definitionguard/test/listing.test.ts` was reported failing on 2026-11-05) |
| **Real Screenshots** | Every gallery image must show the shipped app, captured from live Jira (no mock-ups). | See the screenshot manifest in each `docs/marketplace/<app>-listing.md`. | CascadePlan: Ready (5 new screenshots and 3 highlights, 2026-11-06). Other apps: Fix Needed (images marked RECAPTURE REQUIRED) |
| **Legal and Support Pages** | Terms of Service and Support URLs must resolve. | `curl -sI https://asymm.systems/terms` and `/support`. | Ready (published in site release 06.11.2026-1; both return 200) |

---

## 2. Step-by-Step Developer Console Submission Process

Log into [developer.atlassian.com/console](https://developer.atlassian.com/console):

### Step 2.1: App Selection & Listing Profile
For each app:
1. Select the app from the console dashboard using its Forge App ID:
   - **LedgerSeal:** `ari:cloud:ecosystem::app/7489a645-7c96-400a-b289-eb36f2701a00`
   - **DefinitionGuard:** `ari:cloud:ecosystem::app/73e4f63d-7d60-450c-96d5-f81ca68a709c`
   - **FourRealities:** `ari:cloud:ecosystem::app/974e4981-7626-4b1c-a41f-7eaccb7f3605`
   - **CascadePlan:** `ari:cloud:ecosystem::app/cac8499e-e92e-4ba6-95cc-af398b1be791`
2. Under **Distribution**, click **Create Marketplace Listing**.

### Step 2.2: Media & Copy Assets Upload
1. **App Name & Tagline:** Copy exactly from the respective listing file under `docs/marketplace/`:
   - *LedgerSeal:* `Tamper-evident approval seals and post-approval change control for Jira.`
   - *DefinitionGuard:* `Enforceable Definition of Done with evidence, review rules, and audit history.`
   - *FourRealities:* `Delivery evidence per Jira issue: decision, Definition of Done, PR, audit seal.`
   - *CascadePlan:* `Jira timeline with percent-trigger links, block moves, baselines and undo.` (app name: `CascadePlan: Timeline and Dependencies`)
2. **Icon Upload:** Upload `docs/marketplace/assets/<app>/icon.png` (144x144 px PNG).
3. **Hero Banner:** Upload `docs/marketplace/assets/<app>/banner.png` (2280x1140 px PNG; CascadePlan: 1120x548 px, BL-7). CascadePlan also has three highlight images, `highlight-1.png` to `highlight-3.png` (580x330 px), with the captions in its listing file.
4. **Screenshot Gallery:** Upload all 5 screenshots in numerical order (`01-*.png` through `05-*.png`) from `docs/marketplace/assets/<app>/` with their captions (CascadePlan: the listing's Screenshots and Highlights sections; 1840x900 px).
5. **Detailed Description:** Paste the complete Markdown body from the listing file into the Marketplace description field.

### Step 2.3: Standardized Suite Pricing Configuration
Configure native Atlassian billing under **Pricing**:
- **Paid via Atlassian:** Yes.
- **Pricing Model:** Per-User Tiered Pricing (Monthly & Annual).
- **Free Evaluation Tier:**
  - `1 to 10 Users`: **$0.00 / month (Free)**
- **Commercial Tiers:**
  - `11 to 100 Users`: **$1.50 per user / month** ($15.00 / user / year)
  - `101 to 250 Users`: **$1.20 per user / month** ($12.00 / user / year)
  - `251 to 1,000 Users`: **$0.90 per user / month** ($9.00 / user / year)
  - `1,001+ Users`: Custom enterprise tier.

### Step 2.4: Security questionnaires and the Privacy & Security tab
The Security Self-Assessment was retired by Atlassian on 13 August 2023. The current gates are the Forge app security questionnaire (it has blocking items), the partner security questionnaire (information only), partner identity verification, the vulnerability scan on submission, and the Privacy & Security tab. Answers per app:
- *CascadePlan:* `docs/marketplace/submission/cascadeplan-security-questionnaires.md`.

Common answers for the suite (enter per app; check each app's own code first):
- **Where is customer data stored?** In Atlassian Cloud storage only (Forge Key-Value Storage). No external databases or storage servers.
- **Does the app make outbound network requests?** No external egress. The apps call only Atlassian APIs of the customer's own site (FourRealities also searches that site's Confluence pages). All compute runs on Atlassian Forge.
- **Does the app use AI/LLMs or third-party inference?** No. All verification, hashing, and algorithms are deterministic standard algorithms (SHA-256, Ed25519) executing locally in Forge.
- **Does the app comply with Atlassian Data Residency?** Yes. Forge native apps inherit Atlassian's data residency automatically.

### Step 2.5: Mandatory Legal & Support URLs
Provide the live production URLs:
- **Privacy Policy:** `https://asymm.systems/privacy`
- **Terms of Service:** `https://asymm.systems/terms`
- **Support URL:** `https://asymm.systems/support`
- **Support Email:** `support@asymm.systems`
- **Documentation URL:** `https://asymm.systems/product/jira-governance/user-guide/<app>.html`

### Step 2.6: Reviewer Notes Submission
Paste the entire content of `docs/marketplace/submission/<app>-submission-notes.md` into the **Notes for Reviewer** field. This includes the scope justifications, reviewer test steps, and architecture statement.

---

## 3. Post-Submission Review SLA & Communication

- Atlassian states three different review times: "Approvals take 10-15 business days" (approval page), "New app submissions: 5-10 business days" (security workflow), and "we aim to provide a decision within one week" (listing Forge apps). Plan for up to 15 business days.
- If the reviewer requests clarification on scopes or permissions:
  - Reference the exact section in the submission notes.
  - Reiterate that the app has zero external egress and runs 100% within Atlassian Forge.
  - Respond within 24 hours to keep the submission in the active review queue.
