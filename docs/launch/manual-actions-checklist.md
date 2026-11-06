# Publisher Manual Actions Checklist

This checklist consolidates all operational actions that require direct human execution by the publisher (account ownership, credentials, DNS routing, and legal authority).

---

## 1. Atlassian Developer Console (`developer.atlassian.com/console`)

### Vendor Account & Legal Profile
- [ ] Log into the Atlassian Developer Console with the official publisher account (`asymm.systems`).
- [ ] Verify vendor profile details: Company Name (**Asymm Systems**), Website (`https://asymm.systems`), Support Email (`support@asymm.systems`).
- [ ] Complete payment setup: Connect bank account or Stripe profile to receive Atlassian Marketplace monthly revenue disbursements.

### App Submissions (Repeat for all 4 apps: LedgerSeal, DefinitionGuard, FourRealities, CascadePlan)
- [ ] **Forge Production Deployment:**
  - Run `forge deploy -e production` for each app from its respective directory under `apps/`.
  - Run `forge install -e production` into the test/demo instance.
  - Confirm `licensing: enabled: true` is present in `manifest.yml`.
- [ ] **Create/Update App Listing in Console:**
  - Copy Title and Tagline from `docs/marketplace/<app>-listing.md`.
  - Copy Short Description (<= 250 characters).
  - Copy Full Description body from `docs/marketplace/<app>-listing.md`.
  - Set Primary Category and Secondary Category.
- [ ] **Upload Visual Assets:**
  - Upload `docs/marketplace/assets/<app>/icon.png` (144x144 px PNG).
  - Upload `docs/marketplace/assets/<app>/banner.png` (1120 x 548 px PNG) and `highlight-1.png` to `highlight-3.png` (580 x 330 px PNGs).
  - Upload all 5 screenshots from `docs/marketplace/assets/<app>/` (1840 x 900 px PNGs).
- [ ] **Configure Pricing & Licensing:**
  - Select **Paid via Atlassian**.
  - Configure user tiers:
    - 1 to 10 users: **Free ($0.00)**.
    - 11 to 100 users: **$1.50 per user per month**.
    - 101 to 250 users: **$1.20 per user per month**.
    - 251 to 1000 users: **$0.90 per user per month**.
    - Annual subscription: Enable with standard 2-months-free discount (10x monthly).
- [ ] **Security Self-Assessment:**
  - Fill out the Atlassian Marketplace Security Self-Assessment using the pre-compiled responses in `docs/marketplace/submission/developer-console-checklist.md`.
  - Confirm Zero External Egress (runs 100% in Forge tenant runtime).
- [ ] **Reviewer Notes & Test Credentials:**
  - Copy reviewer test plan and scope justifications from `docs/marketplace/submission/<app>-submission-notes.md`.
  - Provide review credentials or sandbox installation link as instructed.
- [ ] **Submit for Approval:**
  - Click **Submit for Review**.

---

## 2. Documentation Portal Deployment (`asymm.systems`)

- [x] **Host Documentation on Corporate Domain:**
  - Integrated into `asymm-corporate-code-pfw` under `/product/jira-governance/`.
  - Avoids GitHub Pages plan restrictions and unifies SEO under `asymm.systems`.
- [ ] **Deploy Corporate Site to Cloudflare Pages:**
  - Merge branch `develop` to `main` in `asymm-corporate-code-pfw`.
  - Push release tag to trigger `.github/workflows/production.yml`.
  - Confirm live resolution at `https://asymm.systems/product/jira-governance.html` and `https://asymm.systems/product/jira-governance/user-guide/`.

---

## 3. Monorepo & Open-Source Verifier

- [x] **Monorepo Created & Pushed:**
  - Private repository: `https://github.com/asymmsystems/jira-governance-code-system` (synced on `master`).
- [x] **Offline Verifier Consolidated in Monorepo:**
  - The verifier package lives under `tools/verifier/` and is documented directly on the site (`https://asymm.systems/product/jira-governance/user-guide/open-verifier.html`).

---

## 4. Corporate & Legal Infrastructure (`asymm.systems`)

- [ ] **Publish Legal & Support Pages:**
  - Ensure the following public URLs resolve with clean HTTP 200 responses:
    - `https://asymm.systems/privacy`
    - `https://asymm.systems/terms`
    - `https://asymm.systems/support`
- [ ] **Email Routing Verification:**
  - Confirm incoming email routing for:
    - `support@asymm.systems` (support ticketing)
    - `fahim@asymm.systems` (founder / concierge onboarding)

---

## 5. Video Walkthrough Recordings

- [ ] **Record Product Screencasts:**
  - Follow the shot-by-shot scripts in `docs/launch/video-scripts.md`:
    - Video 1: *LedgerSeal: The Tamper Trap* (60-80s).
    - Video 2: *DefinitionGuard: The Ungated Done Gate* (60-75s).
    - Video 3: *CascadePlan: Catching Hidden Scope Creep* (60-80s).
- [ ] **Upload & Embed:**
  - Upload videos to YouTube / Vimeo (1080p60 or 1440p).
  - Add video links to Marketplace app listing media galleries.

---

## 6. Community & Inbound Marketing Launch

- [ ] **Hacker News:** Submit *Show HN: LedgerSeal* using copy from `docs/launch/distribution-kit.md`. Post creator comment immediately.
- [ ] **Reddit:** Post technical discussion threads to `r/devops`, `r/jira`, and `r/compliance`.
- [ ] **LinkedIn:** Publish founder thought leadership post and tag relevant technical leaders.
- [ ] **Atlassian Community:** Post the workflow validator guide to Jira Cloud discussions.

---

## 7. Security Hygiene: Session Token Rotation

- [ ] **Rotate Demo Jira Session Cookies:**
  - The automation guide (`docs/design/in-jira-automated-testing-guide.md`) contains historical test session tokens from pre-launch automation.
  - Log out of `asymmsystems.atlassian.net` in the browser to invalidate all active session IDs.
  - When re-authenticating for future live tests, store fresh session cookies in an untracked, gitignored file (e.g., `/tmp/scratch/jira-cookies.mjs`) referenced exclusively via the `JIRA_COOKIES_FILE` environment variable.
