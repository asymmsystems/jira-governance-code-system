# Video Walkthrough Scripts: 60-90 Second Product Demos

This document contains shot-by-shot production scripts for three high-impact, 60 to 90-second product walkthrough videos for the Atlassian Marketplace, YouTube, and LinkedIn.

---

## Technical Recording Guidelines

- **Resolution:** 1920x1080 (1080p, 60fps) or 2560x1440 (1440p).
- **Browser Display:** Google Chrome in dedicated clean profile, browser zoom set to **125%** to ensure Jira fonts and Forge panel badges are crisp and legible.
- **Mouse Cursor:** Subtle cursor highlight circle enabled.
- **Audio:** Clear vocal delivery, 48kHz / 24-bit audio, normalized to -16 LUFS.
- **Captions:** Hardcoded bottom-centered captions (Inter SemiBold, white with subtle dark box) for silent LinkedIn and Marketplace playback.

---

## Video 1: LedgerSeal: The Tamper Trap (60-80 Seconds)

**Target Audience:** Release Managers, QA Directors, Compliance Officers  
**Featured Issues:** `LSP-3` (Sealed Baseline), `DEMO-34` (Tampered Issue)

| Timecode | Visual Action | On-Screen Captions | Voiceover Script |
| :--- | :--- | :--- | :--- |
| **00:00 - 00:12** | Screen displays Jira issue `LSP-3`. Zoom smoothly to the LedgerSeal issue panel showing the bright green **[SEALED]** badge and verified Ed25519 signature. | **LedgerSeal:** Cryptographic issue sealing for Jira Cloud. | In Jira, release approvals happen every day. But what happens if a ticket is edited *after* approval? |
| **00:12 - 00:26** | Switch to `DEMO-34`. The issue shows status "Approved" and a seal from 10:00 AM. Click the description and change `timeout: 10s` to `timeout: 50s` and save. | Post-approval edits happen quietly. Jira's change log doesn't block them. | At 2:00 PM, an engineer modifies a critical timeout in the description. In standard Jira, this ticket can deploy right to production without re-review. |
| **00:26 - 00:44** | Click the workflow dropdown and attempt to transition `DEMO-34` to **Done**. The transition halts with a modal: **"Transition Blocked by LedgerSeal Validator"**. Red banner highlights: `Description hash mismatch: modified post-seal`. | **The Tamper Trap:** The workflow transition to Done is hard-blocked. | Not with LedgerSeal. When the deployment transition triggers, LedgerSeal recalculated the SHA-256 snapshot hash. The hash diverged, and the release transition is instantly blocked. |
| **00:44 - 01:00** | Click into the LedgerSeal **Certificate View**. Click **Export Evidence JSON**. Open a terminal and run `node verify-evidence.mjs --evidence evidence.json`. All 4 green checks pass. | **Zero-trust verification:** Export standalone evidence and verify offline. | Auditors don't have to trust us or Jira. Export standalone evidence and verify the cryptographic signature and hash chain completely offline with our open-source CLI. |
| **01:00 - 01:15** | Transition to end card: Asymm Systems logo, Atlassian Forge badge, text: `100% Forge Native - Zero External Egress - Free up to 10 users`. | **Try LedgerSeal Free on Atlassian Marketplace.** asymm.systems | 100% Forge Native. Zero external egress. Available now on the Atlassian Marketplace. Visit asymm.systems. |

---

## Video 2: DefinitionGuard: The Ungated Done Gate (60-75 Seconds)

**Target Audience:** Engineering Leads, QA Leads, Scrum Masters  
**Featured Issue:** `DEMO-35` (Active Sprint Story)

| Timecode | Visual Action | On-Screen Captions | Voiceover Script |
| :--- | :--- | :--- | :--- |
| **00:00 - 00:14** | Jira Kanban or Scrum board view. Grab issue `DEMO-35` and attempt to drag it directly into the **Done** column. | Dragging unfinished tickets to Done is too easy in Jira. | How many times does a ticket move to "Done" before unit tests are written, PRs are reviewed, or acceptance criteria are checked? |
| **00:14 - 00:28** | The ticket snaps back. A Jira workflow error banner appears: **"DefinitionGuard: 2 mandatory DoD checklist items incomplete"**. | **Enforced DoD:** Workflow validator stops unverified transitions. | DefinitionGuard stops incomplete tickets at the gate. If mandatory Definition of Done criteria aren't met, Jira refuses to transition. |
| **00:28 - 00:45** | Open the issue details. In the DefinitionGuard panel, click the checkbox for `Automated Regression Suite`. An input box appears asking for required evidence. Paste a Jenkins/GitHub Actions run URL and click Confirm. | **Proof Required:** Require evidence links or verification notes. | Criteria can require real evidence. Ticking an item requires a verified test run URL or documentation link, not just an empty checkbox. |
| **00:45 - 00:58** | Try to check `Peer Code Review` as the ticket assignee. A tooltip blocks the action: `Non-assignee review rule enforced`. Switch user or demonstrate non-assignee signing off. | **Segregation of Duties:** Assignees cannot approve their own work. | It enforces strict peer review rules. The assignee cannot approve their own work, satisfying SOC 2 and ISO 27001 segregation of duties. |
| **00:58 - 01:12** | All items green. Transition issue to **Done**. The transition succeeds with a smooth confirmation. Click **Audit Export** to show the JSON event log. | **Audit Ready:** Full event history logged to tenant Forge KVS. | Once verified, the ticket transitions cleanly, recording an immutable audit trail in your Atlassian tenant. |
| **01:12 - 01:25** | End card: DefinitionGuard by Asymm Systems, Atlassian Marketplace badge, URL: `asymm.systems/product/jira-governance`. | **DefinitionGuard:** Enforceable DoD for Jira Cloud. Free up to 10 users. | Put real guardrails on your Definition of Done. Try DefinitionGuard free today on the Atlassian Marketplace. |

---

## Video 3: CascadePlan: Catching Hidden Scope Creep (60-80 Seconds)

**Target Audience:** Project Managers, Engineering Directors, Scrum Masters  
**Featured View:** CascadePlan Planner

| Timecode | Visual Action | On-Screen Captions | Voiceover Script |
| :--- | :--- | :--- | :--- |
| **00:00 - 00:14** | Open CascadePlan in Jira project navigation. Display the visual WBS hierarchical tree with Epics, Stories, and Tasks clearly arranged. | **CascadePlan:** Hierarchical WBS planning and baseline control for Jira. | Jira boards tell you what you're working on today. But they can't tell you how much your sprint commitment quietly expanded since planning. |
| **00:14 - 00:26** | Click the **Freeze Baseline** button in the toolbar. The baseline badge turns from DRAFT to **[FROZEN: Sprint 12 Initial]** at 160 hours. | **Freeze Baselines:** Lock sprint commitments with one click. | At the start of the sprint, freeze your baseline. CascadePlan locks a cryptographic snapshot of every committed task and estimate. |
| **00:26 - 00:42** | Switch to Jira backlog or board. Add an urgent 24-hour bug into the active sprint, and increase an existing task from 4 hours to 12 hours. | Mid-sprint changes cause hidden schedule erosion. | Midway through the sprint, unexpected tasks are injected, and estimates increase. In native Jira, these changes vanish into velocity averages. |
| **00:42 - 00:58** | Switch back to CascadePlan. The planner displays a bright amber alert banner: `Scope Creep Detected: +32h (+20.0%)`. The newly added and modified tasks are highlighted with tags. | **Real-Time Delta:** Track net hours and percentage variance instantly. | CascadePlan catches the drift immediately. It flags the added hours, calculates net commitment variance, and highlights exactly which tasks expanded. |
| **00:58 - 01:14** | Click **Request Scope Shift**. Enter justification: `Client requested expedited payment gateway`. Open approval modal and approve shift to create baseline `v1.1`. Click **Resource Grid** to show capacity balance. | **Scope Shift Approvals & Capacity Grid:** Keep teams balanced. | Submit a formal Scope Shift Request to keep stakeholders aligned, while the Resource Grid visualizes capacity bottlenecks across your team. |
| **01:14 - 01:28** | End card: CascadePlan by Asymm Systems, Atlassian Forge Native, `asymm.systems/product/jira-governance`. | **Stop silent scope creep.** Install CascadePlan from Atlassian Marketplace. | Take control of your sprint baselines. Install CascadePlan on the Atlassian Marketplace today. |
