# Master Operational Prompt: Asymm Systems Jira Governance Suite Launch & First Paid Sale

> **Target Goal:** Take the entire Asymm Systems Jira Suite (**LedgerSeal**, **DefinitionGuard**, **FourRealities**, **PlanShift**) from post-build and live in-Jira verification through to official Atlassian Marketplace publication, comprehensive hosted user/admin documentation, active inbound marketing, and securing the **first commercial paying sale**.
>
> **Target Audience:** Engineering Leads, Release Managers, Quality/Compliance Managers (SOC 2, ISO 27001, GxP/MedTech, FinTech) using Jira Cloud.
>
> **Publisher:** Asymm Systems (`asymm.systems`)  
> **Architecture Guarantee:** 100% Atlassian Forge Native (Zero egress, runs entirely within customer Atlassian tenant, data privacy by design).

---

## 1. Operational Context & Baseline

### 1.1 Where the Suite Stands Today
1. **LedgerSeal (`apps/ledgerseal`)**:
   - Status: 100% built, fully tested (315+ unit/architecture tests, >=95% branch coverage), verified live in Atlassian Cloud (`asymmsystems.atlassian.net`).
   - Features: SHA-256 snapshot hashes of covered fields/comments/attachments, Ed25519 signatures, separation of duties, hash-chained history, workflow transition validator, open-source offline verifier.
2. **DefinitionGuard (`apps/definitionguard`)**:
   - Status: 100% built, tested, merged to master (`fa26bec`), verified with `@asymm/jira-ui`.
   - Features: Per-issue-type DoD checklists, evidence requirements (links/notes), reviewer permissions, non-assignee review enforcement, audited waivers with reasons, workflow transition gate into Done, transition coverage check.
3. **FourRealities (`apps/fourrealities`)**:
   - Status: 100% built, tested, architecture and UI standards established.
   - Features: Multi-perspective delivery alignment (Intent vs Process vs Code vs Audit), Reality Alignment Index (RAI), architecture drift detection, rework loop tracking.
4. **PlanShift (`apps/planshift`)**:
   - Status: Built and audited (`docs/sdlc/planshift-audit-2026-10-30.md`).
   - Features: Visual sprint baseline freezing, scope shift approvals, commitment delta tracking, WBS planning, resource heatmaps.
5. **Shared Infrastructure**:
   - Design System: `@asymm/jira-ui` (`packages/asymm-jira-ui`) enforcing Atlassian Design System tokens and zero hex colors.
   - Permissions: Uniform Permission Management Standard (`docs/design/uniform-permission-management-standard.md`).
   - Live Browser Automation: Headless Puppeteer runner in scratch directory with active pre-authenticated session cookies (`docs/design/in-jira-automated-testing-guide.md`), bypassing MFA with zero OTPs.

### 1.2 Non-Negotiable Constraints & Quality Standards
- **Zero em dashes (unicode 8212):** Do not use unicode em dashes in code, documentation, or commit messages. Use hyphens (`-`), colons (`:`), or parentheses.
- **Zero npm installs in monorepo:** Never run `npm install` inside `apps/` or `packages/`. For scratch automation tools, use an isolated scratch directory outside the workspace tree.
- **Zero AI Co-Authorship tags:** Never include `Co-Authored-By` lines for AI in git commit messages.
- **Commit discipline:** Write clear commit messages conforming to Conventional Commits: `type(scope): message`.
- **Quality Gates:** 100% unit tests passing, zero lint warnings (`forge lint`), zero raw tokens or hex codes outside `@asymm/jira-ui`.

---

## 2. Phase 1: Marketplace Listings & High-Fidelity Asset Pipeline (All 4 Apps)

### Objective
Ensure every app has an authoritative, compliance-grounded Marketplace listing document and high-resolution visual assets (icons, banners, retina screenshot galleries) captured directly from live Jira.

### Task 1.1: Listing Copy Standardization
Audit and complete the listing files under `docs/marketplace/`:
- `docs/marketplace/ledgerseal-listing.md`
- `docs/marketplace/definitionguard-listing-v2.md`
- `docs/marketplace/fourrealities-listing.md` (upgrade from brief draft to full compliance-grounded copy)
- `docs/marketplace/planshift-listing.md` (author full listing matching the commercial audit)

Every listing must provide:
1. **Title & Punchy Tagline (Max 80 chars):** Clear, functional value proposition without generic marketing fluff.
2. **Short Highlight Description (Max 250 chars):** Immediate hook for Jira search results.
3. **The Core Problem:** Explain why standard Jira fails (e.g. Jira's change log records edits, but cannot prove whether approved tickets were tampered with before release).
4. **Key Capabilities & Proof:** Bulleted features mapped to verifiable tests and user flows.
5. **Enterprise Compliance Grounding:** Explicitly define alignment with SOC 2 (CC8.1), ISO 27001 (A.8.32), and FDA 21 CFR Part 11, including honest statements of boundaries (e.g. auditor discretion, procedure validation).
6. **Data Privacy & "Runs on Atlassian" Security:** State Forge-native execution, zero egress, zero external databases, customer tenant data residency.
7. **Pricing Table:** Transparent pricing with the free 10-user wedge.

### Task 1.2: Automated Live Visual Asset Generation
Do not use Figma mockups or unrendered prototypes. Use the headless browser runner (`docs/design/in-jira-automated-testing-guide.md`) to capture crisp screenshots from the live development instance (`asymmsystems.atlassian.net`).

#### Asset Checklist per App:
1. **App Icon:** 144x144 px PNG, transparent background, high-contrast vector design.
2. **Cover Banner:** 2280x1140 px (2:1 ratio), centered hero composition, minimal text.
3. **Screenshots (Minimum 4, Recommended 6):** 1840x1150 px PNGs:
   - View 1: Primary Issue Panel / Glance in default active state.
   - View 2: Interactive user action (e.g. sealing issue, checking DoD item with evidence link, drift score breakdown, baseline shift alert).
   - View 3: Transition validator enforcement (Jira workflow transition blocked with clear error modal).
   - View 4: Administrator policy page (group selection, settings, coverage report).
   - View 5: Cryptographic proof / attestation details (expanded certificate panel or exported evidence JSON).

---

## 3. Phase 2: User & Administrator Documentation Portal (`docs.asymm.systems`)

### Objective
Scaffold, author, and publish a technical documentation portal providing comprehensive documentation for end users, administrators, and compliance auditors across all 4 apps.

### Task 2.1: Documentation Site Setup
- **Framework:** VitePress or Astro Starlight in `docs/user-guide/` or `site/`.
- **Design Tokens:** Clean technical documentation theme matching Atlassian Design System tokens (neutral backgrounds, crisp typography, light/dark mode support).
- **Deployment Pipeline:** Automated GitHub Actions workflow deploying to GitHub Pages or Cloudflare Pages on domain `docs.asymm.systems`.

### Task 2.2: Site Architecture & Content Tree

```
docs.asymm.systems/
├── index.md                        # Suite Overview: The Zero-Trust Jira Governance Platform
├── quickstart.md                   # 5-Minute Evaluation Guide (Installing from Marketplace)
├── architecture-and-security.md    # Forge isolation, Zero-Egress guarantee, KVS storage
├── permissions-standard.md         # Admin Guide: The Uniform Permission Management Standard
├── apps/
│   ├── ledgerseal/
│   │   ├── index.md                # LedgerSeal Overview & Tamper-Evident Approval Mechanics
│   │   ├── admin-guide.md          # Configuring Approver Groups & Workflow Transition Validators
│   │   ├── user-guide.md           # Sealing, Resealing, Revoking, Viewing Post-Approval Diffs
│   │   ├── compliance-mapping.md   # SOC 2 CC8.1, ISO 27001 A.8.32, FDA 21 CFR Part 11 Mapping
│   │   └── open-verifier.md        # Standalone Node.js offline Ed25519 verification script & guide
│   ├── definitionguard/
│   │   ├── index.md                # DefinitionGuard Overview & Enforceable Definition of Done
│   │   ├── admin-guide.md          # Setting up Issue-Type DoD Checklists & Transition Gates
│   │   ├── user-guide.md           # Ticking items, Submitting Evidence links/notes, Audited Waivers
│   │   ├── coverage-report.md      # How to use the Transition Coverage Check to eliminate blindspots
│   │   └── compliance-mapping.md   # Mapping DoD evidence to internal audit controls
│   ├── fourrealities/
│   │   ├── index.md                # FourRealities Overview: Intent, Process, Code, and Audit
│   │   ├── admin-guide.md          # Connecting Git repositories and Confluence Decision Records
│   │   ├── user-guide.md           # Interpreting the Reality Alignment Index (RAI) and drift levels
│   │   └── resolving-drift.md      # Addressing architecture drift, rework loops, and unreviewed PRs
│   └── planshift/
│       ├── index.md                # PlanShift Overview: Sprint Baseline Protection & Scope Control
│       ├── admin-guide.md          # Freezing Sprint Baselines & Shift Approval Authorities
│       ├── user-guide.md           # Visual WBS, Resource Heatmaps, and Requesting Scope Shifts
│       └── scope-creep-audit.md    # Auditing sprint commitment variance and scope expansion
└── faq.md                          # Licensing, Cloud Fortified, Troubleshooting, Support
```

### Task 2.3: Open Verifier Publication (LedgerSeal Hero Asset)
Host and document the standalone verification script directly in the docs site and in a public repository (`asymm-systems/ledgerseal-verifier`):
- Uses standard library `node:crypto` only (zero dependencies).
- Allows external compliance auditors to verify signed attestations offline against the published public key (`keys/ls-dev-2026-11.pub.pem`).

---

## 4. Phase 3: Atlassian Developer Console Submission & Approval

### Objective
Prepare and submit all 4 apps for official Atlassian Marketplace approval.

### Task 3.1: Listing Configuration
On [developer.atlassian.com/console](https://developer.atlassian.com/console):
1. **Listing Details:** App name, icon (144x144), hero banner (2280x1140), highlights, detailed markdown description, and retina screenshot gallery.
2. **Pricing Configuration (Standardized Suite Model):**
   - **1 to 10 Users:** **Free** (The frictionless wedge for evaluation).
   - **11 to 100 Users:** **$1.50 per user/month** (e.g. 50 users = $75/mo).
   - **101 to 250 Users:** **$1.20 per user/month**.
   - **251 to 1,000 Users:** **$0.90 per user/month**.
   - **Annual Discount:** 2 months free (standard Atlassian billing).
3. **Security & Privacy Self-Assessment:**
   - Complete the Atlassian Security Self-Assessment.
   - Confirm zero egress and zero external data storage (all data resides in customer Forge KVS).
   - Provide links to:
     - Privacy Policy: `https://asymm.systems/privacy`
     - Terms of Service: `https://asymm.systems/terms`
     - Support Portal & SLA: `https://asymm.systems/support` (or `support@asymm.systems`)

### Task 3.2: Atlassian Review Feedback Resolution
Pre-empt common Atlassian Marketplace review rejections:
- Ensure all permissions in `manifest.yml` have explicit justifications in the submission notes.
- Ensure screenshots do not contain mockups, placeholder text (Lorem Ipsum), or unrendered tokens.
- Ensure compliance claims strictly disclaim legal certification (e.g. "supports compliance with", "your auditor decides").

---

## 5. Phase 4: Launch & Targeted Inbound Marketing Engine

### Objective
Position the suite as the indispensable **Zero-Trust Governance & Change Control Platform** for regulated engineering teams, driving targeted organic traffic and installations.

### Task 4.1: Flagship Thought Leadership Content
Author and publish the flagship technical article:
- **Title:** *"Why Jira's Change Log Isn't Change Control: The Approved Ticket Problem"*
- **Core Thesis:** Jira tracks that changes happened, but native Jira workflows cannot prove whether the ticket description, acceptance criteria, or attachments were tampered with after leadership approved the release.
- **Narrative Flow:**
  1. The anatomy of a silent release failure: ticket approved at 10:00 AM, requirements edited at 2:00 PM, moved to Done at 4:00 PM without re-review.
  2. Why standard Jira permission schemes do not solve this without locking down the entire project.
  3. The cryptographic solution: cryptographic snapshot hashing, tamper-evident seals, and automated transition gates.
- **Distribution:** Publish on Asymm Systems blog, Hacker News, Reddit (`r/devops`, `r/jira`), and LinkedIn.

### Task 4.2: Video Walkthrough Screencasts (60 to 90 Seconds)
Create tight, high-framerate screencasts:
1. **LedgerSeal:** Seal an issue -> Edit ticket description -> Watch lozenge turn amber `[CHANGED]` with attribution -> Attempt workflow transition -> Transition blocked by validator -> Reseal with justification.
2. **DefinitionGuard:** View issue DoD -> Try moving to Done -> Blocked by gate -> Add mandatory link evidence -> Move to Done succeeds.

### Task 4.3: Community & Social Engagement
- **Atlassian Community:**
  - Engage in discussions tagged `change-management`, `audit-logging`, `compliance`, `iso27001`, `soc2`.
  - Share open-source verifier scripts and Forge zero-egress architectural overviews.
- **LinkedIn Targeted Outreach:**
  - Identify QA Directors, VPs of Engineering, and Compliance Leads in FinTech, HealthTech, and enterprise SaaS.
  - Value proposition: Zero-friction security review (runs 100% on Atlassian Forge with zero external data egress).

---

## 6. Phase 5: The First Sale Playbook (Install to Paid License)

### Objective
Convert self-serve free-tier installations (1-10 users) into the suite's first commercial paying customer.

```
Free Install (<10 users)
  │
  ▼
Automated Detection (Marketplace vendor insights & forge logs)
  │
  ▼
Concierge Onboarding (<24h personalized technical outreach)
  │
  ▼
Fast-Track Security Review (Forge Zero-Egress Architecture One-Pager)
  │
  ▼
Expansion Trigger (Team reaches 10-user limit or 25+ production seals)
  │
  ▼
First Paid Commercial License Conversion
```

### Step-by-Step Conversion Execution:

#### Step 1: Real-Time Install Detection
- Check Atlassian Marketplace Vendor Insights daily for new instance installations.
- Use `forge logs` to monitor initial onboarding health and detect any permission or configuration hurdles.

#### Step 2: Proactive Concierge Onboarding (< 24 Hours)
Send a personalized, non-salesy message to the installer:
> *"Hi [Name], saw you installed LedgerSeal on your Jira instance. I am Fahim, the creator. If you need any help configuring your approver groups or attaching the workflow transition validator to your software boards, I would be happy to configure a sample workflow for you or share our pre-filled compliance audit packet."*

#### Step 3: Eliminate Procurement & Security Review Friction
When the customer expresses interest:
- Immediately provide the **Forge Architecture & Security Whitepaper**:
  - Highlights: 100% Forge native, zero egress endpoints, customer tenant storage, no external credentials needed.
  - Accelerates enterprise InfoSec approval from 6 weeks to 24 hours.

#### Step 4: The 10-User Expansion Trigger
- When the evaluating team uses the app on their core sprint board and seals 20+ tickets or checks 50+ DoD items:
- Offer a tailored session to roll out the configuration across the wider engineering organization.
- Crossing the 10-user mark automatically transitions the account into the paid tier ($1.50/user/mo) via native Atlassian billing.

#### Step 5: Close & Cement the Win
- Confirm seamless billing through the customer's existing Atlassian invoice.
- Schedule a 30-day health check.
- Request an honest 5-star review on the Atlassian Marketplace and a 2-sentence case study quote for `docs.asymm.systems`.

---

## 7. Execution Checklist & Success Milestones

| Phase | Milestone | Deliverable | Status |
|---|---|---|---|
| **Phase 1** | Listings & Assets | Completed copy for all 4 apps; live retina screenshots captured via Puppeteer | [ ] |
| **Phase 2** | Documentation Site | `docs.asymm.systems` live with quickstart, user guides, admin guides, and open verifier | [ ] |
| **Phase 3** | Marketplace Submission | 4 apps submitted on Atlassian Developer Console; security self-assessment approved | [ ] |
| **Phase 4** | Inbound Marketing | "The Approved Ticket Problem" article published; 2 walkthrough videos live; Atlassian Community engagement active | [ ] |
| **Phase 5** | First Paid Sale | 1-10 free user installs detected; concierge onboarding delivered; first commercial invoice paid | [ ] |
