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
| **Clean Lint & Tests** | Zero lint warnings and 100% test pass rate. | Run `npm test` and `forge lint` in each app. | Tests: Ready (all four apps pass in Apps CI run 42134853441 on `1e1318b`, 2026-11-06; the DefinitionGuard listing test passes since `907ccd7`). `forge lint`: not verified in CI (the job needs the `FORGE_EMAIL` and `FORGE_API_TOKEN` secrets) |
| **Personal Data Reporting** | An app that stores Atlassian account ids must report them to the personal data reporting API and erase the data of closed accounts (Marketplace Partner Agreement; Forge `report:personal-data` scope with a scheduled report). | `grep -n "report:personal-data" apps/*/manifest.yml`; the stored ids are listed in the privacy policy, `https://asymm.systems/privacy`. | CascadePlan: Ready (hourly `reportPersonalData` job, each id reported once every 7 days, 900 s timeout, scope declared; covers every stored id, including the approver policy's saver). LedgerSeal, DefinitionGuard, FourRealities: Fix Needed (they store account ids, LedgerSeal also the signer's display name, but declare no `report:personal-data` scope and send no report; blocks submission) |
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
- **Commercial Tiers** (per user per month; annual is 10 times monthly; the 251 to 1,000 price applies to every larger tier, up to the form's last tier, 90,001 to 100,000 users):
  - CascadePlan: $1.50 (11 to 100), $1.20 (101 to 250), $0.90 (251 and more)
  - FourRealities: $1.40, $1.10, $0.80
  - DefinitionGuard: $0.95, $0.75, $0.24
  - LedgerSeal: $0.95, $0.75, $0.24

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
