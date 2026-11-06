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
| **00:00 - 00:12** | Screen displays Jira issue `LSP-3`. Zoom smoothly to the LedgerSeal issue panel showing the green **SEALED** lozenge, the approver and the certificate ID. | **LedgerSeal:** Cryptographic issue sealing for Jira Cloud. | In Jira, release approvals happen every day. But what happens if a ticket is edited *after* approval? |
| **00:12 - 00:26** | Switch to `DEMO-34`. The issue shows status "Approved" and a seal from 10:00 AM. Click the description and change `timeout: 10s` to `timeout: 50s` and save. | Post-approval edits happen quietly. Jira's change log doesn't block them. | At 2:00 PM, an engineer modifies a critical timeout in the description. In standard Jira, this ticket can deploy right to production without re-review. |
| **00:26 - 00:44** | Click the workflow dropdown and attempt to transition `DEMO-34` to **Done**. Jira blocks the transition and shows the LedgerSeal validator error message. Back in the issue, the Approval Seal panel shows the red **CHANGED** lozenge with the description's Was and Now values. | **The Tamper Trap:** The workflow transition to Done is blocked. | Not with LedgerSeal. When the transition runs, LedgerSeal recalculates the SHA-256 snapshot hash. The hash differs from the sealed one, so the transition is blocked. |
| **00:44 - 01:00** | Expand the seal details on the sealed issue `LSP-3` and click **Show evidence (JSON)**. Copy the record into `evidence.json`. Open a terminal and run `node verify-evidence.mjs --evidence evidence.json`. Five `PASS` lines appear. | **Offline verification:** Copy the evidence record and verify it offline. | Auditors can check the evidence themselves, offline. Copy the evidence record and verify the snapshot hash, the hash chain and the signature with our open-source CLI. |
| **01:00 - 01:15** | Transition to end card: Asymm Systems logo, Atlassian Forge badge, text: `100% Forge Native - Zero External Egress - Free up to 10 users`. | **Try LedgerSeal Free on Atlassian Marketplace.** asymm.systems | 100% Forge Native. Zero external egress. Available now on the Atlassian Marketplace. Visit asymm.systems. |

---

## Video 2: DefinitionGuard: The Ungated Done Gate (60-75 Seconds)

**Target Audience:** Engineering Leads, QA Leads, Scrum Masters  
**Featured Issue:** `DEMO-35` (Active Sprint Story)

| Timecode | Visual Action | On-Screen Captions | Voiceover Script |
| :--- | :--- | :--- | :--- |
| **00:00 - 00:14** | Jira Kanban or Scrum board view. Grab issue `DEMO-35` and attempt to drag it directly into the **Done** column. | Dragging unfinished tickets to Done is too easy in Jira. | How many times does a ticket move to "Done" before unit tests are written, PRs are reviewed, or acceptance criteria are checked? |
| **00:14 - 00:28** | The ticket snaps back. A Jira workflow error banner appears: **"DefinitionGuard: 2 mandatory DoD checklist items incomplete"**. | **Enforced DoD:** Workflow validator stops unverified transitions. | DefinitionGuard stops incomplete tickets at the gate. If mandatory Definition of Done criteria aren't met, Jira refuses to transition. |
| **00:28 - 00:45** | Open the issue details. In the DefinitionGuard panel, click the checkbox for `Automated Regression Suite`. An input box appears asking for required evidence. Paste a Jenkins/GitHub Actions run URL and confirm. | **Proof Required:** Require evidence links or verification notes. | Criteria can require evidence. Ticking the item needs a test run link or a note, not just an empty checkbox. |
| **00:45 - 00:58** | Try to check `Peer Code Review` as the ticket assignee. DefinitionGuard refuses the tick because this item may not be ticked by the assignee. Switch user and tick it as a reviewer. | **Segregation of Duties:** Assignees cannot tick their own review items. | Admins can mark items that the assignee may not tick, so someone else must check the work. This supports SOC 2 and ISO 27001 segregation-of-duties controls. |
| **00:58 - 01:12** | All items green. Transition issue to **Done**. The transition succeeds with a smooth confirmation. As a project admin, click **Load audit history**, then **Export history** to show the JSON event log. | **Audit Ready:** Full event history kept in Atlassian Forge storage. | Once verified, the ticket transitions cleanly, and every tick, waiver and reset is recorded in a hash-chained audit history. |
| **01:12 - 01:25** | End card: DefinitionGuard by Asymm Systems, Atlassian Marketplace badge, URL: `asymm.systems/product/jira-governance`. | **DefinitionGuard:** Enforceable DoD for Jira Cloud. Free up to 10 users. | Put real guardrails on your Definition of Done. Try DefinitionGuard free today on the Atlassian Marketplace. |

---

## Video 3: CascadePlan: Dependencies That Explain Themselves (60-80 Seconds)

**Target Audience:** Project Managers, Engineering Directors, Scrum Masters  
**Featured View:** CascadePlan Planner

| Timecode | Visual Action | On-Screen Captions | Voiceover Script |
| :--- | :--- | :--- | :--- |
| **00:00 - 00:14** | Open **CascadePlan Planner** in the Jira project navigation. The canvas timeline shows a plan with Epics, Stories and Tasks and their bars. | **CascadePlan:** Fast timelines for Jira. | Most Jira timelines only know one kind of dependency: finish, then start. Real teams overlap their work. |
| **00:14 - 00:28** | Add a dependency from `Database design` to `API integration` with a 30% trigger. The `API integration` bar moves to start when `Database design` reaches 30%. | **Percent-Trigger Dependencies:** Start when the predecessor reaches 30%. | With CascadePlan, a task can start when its predecessor reaches a set percentage, for example 30% of the database design. |
| **00:28 - 00:42** | Hover over the `API integration` bar, then press `?`. The explanation names the driving task, the trigger percentage and the driving dates. | **Why does it start then?** Every date has a reason. | Hover any bar, or press the question mark, and CascadePlan tells you exactly which task drives its start date, and why. |
| **00:42 - 00:58** | Drag `Database design` two days later. During the drag, the preview lists the Jira updates that will be made. Release. A flag offers **Undo** for 10 seconds; open the **Changes** panel to show the writes. | **Honest Jira Writes:** Preview, undo, and a full list of changes. | CascadePlan never writes values you did not enter. Before you release the mouse, it shows every Jira update. Each change can be undone, and the Changes panel lists every write. |
| **00:58 - 01:14** | Select a bar with the keyboard, press Space to enter move mode, and shift it with the arrow keys. Toggle **Table** view to show the same plan as a table. | **Keyboard and Table View:** No mouse required. | Plan entirely from the keyboard, or switch to the table view at any time. |
| **01:14 - 01:28** | End card: CascadePlan by Asymm Systems, Atlassian Forge Native, `asymm.systems/product/jira-governance`. | **Plans that explain themselves.** Install CascadePlan from Atlassian Marketplace. | Build plans that explain themselves. Install CascadePlan on the Atlassian Marketplace today. |
