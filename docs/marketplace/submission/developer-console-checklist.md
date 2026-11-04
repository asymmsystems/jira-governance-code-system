# Atlassian Developer Console Submission Checklist & Runbook

This runbook guides the publisher through official Atlassian Marketplace submission on [developer.atlassian.com/console](https://developer.atlassian.com/console) for all 4 apps in the Asymm Systems Jira Governance Suite (**LedgerSeal**, **DefinitionGuard**, **FourRealities**, **CascadePlan**).

---

## 1. Pre-Submission Technical Audit & Blockers

Before submitting any app in the Developer Console, ensure these prerequisites are satisfied:

| Check | Requirement | Verification Command / Check | Status |
|---|---|---|---|
| **Licensing Enabled** | Every paid app manifest must declare `app.licensing.enabled: true`. | Verified in `apps/cascadeplan` and `apps/definitionguard`. Ensure `apps/ledgerseal` has licensing enabled for commercial listing. | Ready |
| **No External Icon URLs** | Icons in `manifest.yml` must reference local static resources (e.g. `resource:icons;icon.svg`) rather than raw GitHub URLs. | Checked in manifests. LedgerSeal uses Feather SVG icon. Replace raw URLs with local bundled SVG icons before submission. | Fix Needed |
| **Production Forge Deploy** | Apps must be deployed to the Forge `production` environment. | Run `forge deploy -e production` inside each app directory. | Ready |
| **Production Installation** | App must be installed on at least one production Jira instance. | Run `forge install -e production --site asymmsystems.atlassian.net`. | Ready |
| **Clean Lint & Tests** | Zero lint warnings and 100% test pass rate. | Run `npm test` across all app suites. | 100% Pass |

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
   - *FourRealities:* `Delivery integrity dashboard: align Confluence specs, Jira issues, and Git PRs.`
   - *CascadePlan:* `Visual sprint baseline control, scope creep detection, and WBS planning for Jira`
2. **Icon Upload:** Upload `docs/marketplace/assets/<app>/icon.png` (144x144 px PNG).
3. **Hero Banner:** Upload `docs/marketplace/assets/<app>/banner.png` (2280x1140 px PNG).
4. **Screenshot Gallery:** Upload all 5 screenshots in numerical order (`01-*.png` through `05-*.png`) from `docs/marketplace/assets/<app>/` and copy the manifest captions.
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

### Step 2.4: Security & Privacy Self-Assessment Answers
Complete the Atlassian Security Self-Assessment with these authoritative answers:
- **Where is customer data stored?** In Atlassian Cloud storage only (Forge Key-Value Storage). No external databases or storage servers.
- **Does the app make outbound network requests?** No. Zero external egress. All compute runs on Atlassian Forge.
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

- Atlassian Marketplace reviews typically take **3 to 7 business days**.
- If the reviewer requests clarification on scopes or permissions:
  - Reference the exact section in the submission notes.
  - Reiterate that the app has zero external egress and runs 100% within Atlassian Forge.
  - Respond within 24 hours to keep the submission in the active review queue.
