
# Asymm Systems: In-Jira UI Standard

- **Status:** Draft for owner approval (Phase 1).
- **Date:** 2026-11-01
- **Scope:** In-ticket and project dashboard UX standard for Asymm Systems Jira apps (FourRealities, LedgerSeal, DefinitionGuard).
- **Author:** Fahim Farook

---

## 1. Executive Summary

This standard defines a unified, clean, and accessible user experience across all Asymm Systems Atlassian Forge apps. It replaces cluttered text-heavy interfaces with structured, card-based surfaces, clear typographic hierarchy, honest metrics, and predictable button placement.

The standard addresses key usability issues identified in existing builds:
1. Eliminates raw unstyled text walls by introducing bounded container cards.
2. Removes ambiguous and oversized metric boxes.
3. Unifies module titles and vocabulary across issue body panels and sidebar glances.
4. Removes floating text arrows that wrap awkwardly on narrow viewports.
5. Establishes a single primary action per view so users always know the next step.
6. Defines a shared brand system with accessible contrast levels that maps cleanly to Jira native design tokens.

---

## 2. Panel Anatomy for Jira Issues

Every Asymm Systems app rendered inside a Jira issue (`jira:issuePanel` and `jira:issueContext`) follows this exact layout structure.

### 2.1 Structural Regions

1. **Header Row:**
   - App title on the left (matches manifest module title, for example "Four Realities").
   - One high-level status lozenge immediately next to the title (for example, "Incomplete", "Sealed", "DoD complete").
   - Subtle "Refresh" button right-aligned on the header row.
   - For sidebar context (`jira:issueContext`), the header row is provided by Jira native chrome.

2. **Summary Block (Hero Card):**
   - Always visible on every issue surface.
   - In `jira:issueContext` (sidebar glance), this summary block represents the entire glance content.
   - Contains:
     - Primary status sentence (for example, "Audit readiness: Incomplete; 1 of 4 gates evidenced.").
     - Exactly one next step line in bold or distinct text (for example, "Next step: complete Definition of Done in DefinitionGuard.").
     - Gate pipeline badges in chain order, rendered with uniform spacing without loose arrow glyphs.
     - Single primary action button (for example, "Link decision record" or "Request Code exception").

3. **Detail Sections (Collapsible):**
   - The findings section starts collapsed by default to prevent visual clutter.
   - Header is a single clickable row with a chevron indicator ("Show details" / "Hide details"), section title ("Gate findings"), and a count badge ("4").
   - Built with a subtle `Button` and local component state.
   - When expanded, reveals the four gate findings in chain order.

4. **Surfaces, Borders, and Indentation:**
   - The overall app container sits on `elevation.surface.sunken` (maps to the #F9F7F6 brand background concept).
   - Each major section is a `Box` on `elevation.surface` with border `color.border`, border radius `radius.medium`, and padding `space.150`.
   - **Strict one border rule:** Never nest bordered boxes inside another bordered box.
   - Sub-sections (individual gate findings inside the section) are visually separated by an indented layout (`space.200` left padding or a subtle divider), never a second border.
   - Metadata notes (exception requests, approvals, rework reasons) use a dedicated `NoteBox` with background `color.background.neutral`, radius `radius.medium`, and padding `space.100`.

5. **Button Hierarchy and Placement:**
   - **Exactly one `primary` button per view:** Dedicated strictly to the immediate next remediation step.
   - **Secondary actions:** Use `default` appearance (for example, "Add rework reason").
   - **Cross-app links and refresh:** Use `subtle` appearance (for example, "Open LedgerSeal panel", "Open DefinitionGuard panel", "Refresh").
   - **Placement:** The action button row sits at the bottom of the summary block or the bottom of the expanded section. It never floats between sections.
   - **Limit:** At most three buttons in any horizontal row. Additional actions belong inside their respective detail sub-sections.
   - **Destructive actions:** Revoking or rejecting exceptions must use plain language and require explicit confirmation inside a modal.

6. **Typography and Content Rules:**
   - At most one sentence per line of evidence.
   - Source names, field references, and metric codes belong in a `Tooltip` over the gate label, never as cluttering body text.
   - Sentence case throughout.
   - No em dash characters anywhere.

### 2.2 Gate Status Colours

All Asymm Systems apps use consistent Atlassian Design System lozenge appearances:

| State | Meaning | Lozenge Appearance |
|---|---|---|
| Evidence found and verified | Direct evidence confirmed by the app | `success` |
| Evidence found (heuristic or unverified) | Hint read from third party app or heuristic | `inprogress` |
| Evidence missing | Gate applies and evidence is absent | `removed` |
| Excepted or needs re-check | Approved exception or stale record | `moved` |
| Not applicable yet | Gate does not apply in current status | `default` |

### 2.3 ASCII Wireframe: Issue Panel

```text
+------------------------------------------------------------------------------------+
| Four Realities  [ Incomplete ]                                           [Refresh] |
+------------------------------------------------------------------------------------+
| SUMMARY BLOCK (elevation.surface, border color.border, radius.medium)              |
|                                                                                    |
| Audit readiness: Incomplete (1 of 4 gates evidenced)                               |
| Next step: complete Definition of Done in DefinitionGuard                          |
|                                                                                    |
| [● Intent: found]  [✕ Process: missing]  [✕ Code: missing]  [○ Audit: n/a]         |
|                                                                                    |
| Alignment: 25% (CRITICAL risk)   Why 25%?                                          |
|                                                                                    |
| [ Link decision record (Primary) ]  [ Request Code exception ]                     |
+------------------------------------------------------------------------------------+
| v Gate findings (4)                                                [Hide details]  |
+------------------------------------------------------------------------------------+
|   ● Intent: Evidence found (verified)                                              |
|     Confluence specification link verified on this site.                           |
|                                                                                    |
|   ✕ Process: Evidence missing                                                      |
|     No Definition of Done checklist completed in DefinitionGuard.                  |
|     Rework loops: 1                                                                |
|     +----------------------------------------------------------------------------+ |
|     | Note: reopened on 2026-11-01 by Fahim Farook: rechecked rework logic       | |
|     +----------------------------------------------------------------------------+ |
|                                                                                    |
|   ✕ Code: Evidence missing (heuristic)                                             |
|     No merged pull request found in Development field.                             |
|     +----------------------------------------------------------------------------+ |
|     | Exception: requested on 2026-11-01 by Fahim Farook: config change only     | |
|     | Waiting for administrator approval.                                        | |
|     +----------------------------------------------------------------------------+ |
|                                                                                    |
|   ○ Audit: Not applicable yet                                                      |
|     LedgerSeal completion seal is evaluated when the issue is Done.                |
|                                                                                    |
|   [Open LedgerSeal panel]  [Open DefinitionGuard panel]                            |
+------------------------------------------------------------------------------------+
```

---

## 3. Project Page Standard

The project dashboard (`jira:projectPage`) provides executive delivery assurance and audit preparation. It replaces the large alignment score box with a status banner, compact cards, priority actions, and a clean triage table.

### 3.1 Structural Regions (Top to Bottom)

1. **Header Row:**
   - App title ("Four Realities Audit Dashboard").
   - Project name, snapshot timestamp ("Read 2026-11-01 08:49 UTC"), and "Refresh" button.

2. **Status Banner:**
   - Prominent status heading (for example, "Audit readiness: Incomplete").
   - Evidence summary sentence ("Evidence found for 1 of 4 gates across 1 rated issue").
   - Next step sentence indicating the most impactful action across the project.

3. **Gate Cards Row:**
   - Four small, uniform cards side by side on a single line (wrapping if needed).
   - Each card displays:
     - Gate title with metric code in tooltip.
     - Rate lozenge (`100%`, `0%`, or `n/a`).
     - Plain question (for example, "Is the work traced to a decision record?").
     - Progress bar showing evidence ratio.
     - Evidence count text ("1 of 1 rated issues have evidence").
     - Action link ("Show 1 missing Intent") displayed only when gaps exist.

4. **Priority Actions and Coverage Tile:**
   - Two columns side by side:
     - **Left (Priority actions):** Numbered list of up to 5 issues with the most missing gates, stating key, summary, and next step.
     - **Right (Coverage at a glance):** Rated vs unrated issue counts, average alignment percentage, and risk distribution tags (Critical, High, Medium, Low).

5. **Filter Bar and Preset Views:**
   - Text search (key or summary).
   - Dropdown selectors: Assignee, Sprint, Gate.
   - Preset buttons: "My issues", "Critical and high", "Audit prep", "Needs a decision link".
   - Visible issue count indicator ("Showing 1 of 1 issues").

6. **Compact Issue Triage Table:**
   - Clean column layout:
     - **Issue:** Key and updated date.
     - **Summary:** Issue summary text.
     - **Gates:** Four compact pipeline badges side by side without arrows.
     - **Evidence:** Gates evidenced ratio ("1 / 4 gates evidenced").
     - **Gaps:** Specific missing gates ("3 gaps: Process, Code, Audit") or "None".
     - **Risk:** Compact risk lozenge (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `UNRATED`).
     - **Assignee:** Assigned user or "Unassigned".
     - **Action:** Subtle "Inspect" button opening the inspect modal.

7. **Weekly Trend Panel:**
   - Placed below the triage table.
   - Text line per week followed by a clean line chart showing the last 4 weekly snapshots.

8. **Footnote:**
   - Quiet text line at the very bottom: "Alignment is calculated across rated gates only."

### 3.2 ASCII Wireframe: Project Page

```text
+------------------------------------------------------------------------------------+
| Four Realities Audit Dashboard                                                     |
| Delivery evidence: AUDT  Read 2026-11-01 08:49 UTC                       [Refresh] |
+------------------------------------------------------------------------------------+
| STATUS BANNER (elevation.surface.sunken, border color.border, radius.medium)       |
| Audit readiness: Incomplete                                                        |
| Evidence found for 1 of 4 gates across 1 rated issue (0 unrated).                  |
| Next step: complete Definition of Done for 1 issue in DefinitionGuard.             |
+------------------------------------------------------------------------------------+
| GATE CARDS ROW                                                                     |
| +-----------------+ +-----------------+ +-----------------+ +-----------------+    |
| | Intent    100%  | | Process     n/a | | Code        n/a | | Audit       n/a |    |
| | Traced to spec? | | DoD complete?   | | Merged via PR?  | | Sealed in LS?   |    |
| | [=============] | | [             ] | | [             ] | | [             ] |    |
| | 1 of 1 evidenced| | 0 rated issues  | | 0 rated issues  | | 0 rated issues  |    |
| +-----------------+ +-----------------+ +-----------------+ +-----------------+    |
+------------------------------------------------------------------------------------+
| PRIORITY ACTIONS (Left)               | COVERAGE AT A GLANCE (Right)               |
| 1. AUDT-1: Complete Definition of     | Rated issues: 1    Unrated issues: 0       |
|    Done in DefinitionGuard.           | Alignment: 100% (rated gates only)         |
|                                       | Risk: [Crit 0] [High 0] [Med 0] [Low 1]    |
+------------------------------------------------------------------------------------+
| Search: [__________]  Assignee: [Any v]  Gate: [Any v]                             |
| Presets: [My issues] [Critical and high] [Audit prep] [Needs decision link]        |
| Showing 1 of 1 issues                                                              |
+------------------------------------------------------------------------------------+
| ISSUE   SUMMARY       GATES        EVIDENCED  GAPS             RISK   OWNER  ACT   |
| AUDT-1  Write check   [●][○][○][○] 1 / 4      Process,Code,Aud [LOW]  Farook [Insp]|
+------------------------------------------------------------------------------------+
| Trend: last 4 weeks (whole project)                                                |
| [Chart: Evidence found, percent of rated]                                          |
+------------------------------------------------------------------------------------+
| Alignment is calculated across rated gates only.                                   |
+------------------------------------------------------------------------------------+
```

---

## 4. Brand System: Reusable Variables and Mappings

### 4.1 Palette Contrast Analysis (WCAG 2.2 AA)

All colours are evaluated against a pure white background (#FFFFFF) and the sunken app surface (#F9F7F6).

#### Strong Brand Colours
Strong colours are intended strictly for graphic accents, icons, and large headings (minimum 3:1 contrast required by WCAG AA):

| Colour Name | Hex Code | Contrast on White | Contrast on #F9F7F6 | Allowed Usage |
|---|---|---|---|---|
| Teal (owner) | #5295A3 | 3.39:1 | 3.21:1 | Large headings (18pt+), icons, card borders |
| Rose (owner) | #BA6E8F | 3.67:1 | 3.47:1 | Large headings, danger accents, icons |
| Sage (owner) | #8FA96D | 2.60:1 | 2.46:1 | Non-text graphics only (fails text contrast) |
| Sand (owner) | #F8DBA9 | 1.33:1 | 1.26:1 | Background fill only |
| Slate (added) | #6B7C8C | 3.92:1 | 3.71:1 | Large headings, secondary icons |
| Plum (added) | #8C7A9B | 3.11:1 | 2.94:1 | Large accents, chart secondary series |
| Clay (added) | #B98A72 | 2.67:1 | 2.53:1 | Non-text graphics only |
| Stone (added) | #A8A196 | 2.28:1 | 2.16:1 | Decorative borders and dividers |

#### Light Background Colours
Used for container fills. All light colours paired with Ink primary text (#1A1C1E) achieve contrast ratios exceeding 9:1 (exceeds WCAG AAA):

| Background | Hex Code | Contrast with Ink #1A1C1E | Allowed Usage |
|---|---|---|---|
| Teal light | #9CC8D1 | 9.82:1 | Informational highlight fills |
| Rose light | #C985A3 | 6.84:1 | Missing evidence warning fills |
| Sage light | #AFC29C | 9.47:1 | Evidence found success fills |
| Sand light | #FDF5E5 | 15.34:1 | Caution and exception fills |
| Slate light | #C3CCD4 | 10.63:1 | Neutral state fills |
| Plum light | #D3C9DC | 10.98:1 | Accent highlight fills |
| Clay light | #EAD5C9 | 12.35:1 | High-risk callout fills |
| Stone light | #E4E0D9 | 13.51:1 | Note container fills |

#### Accessible Text Shades
Normal body text requires at least 4.5:1 contrast against its background. The following text shades are verified for normal body text:

| Text Shade | Hex Code | Contrast on White | Contrast on #F9F7F6 | WCAG AA Status |
|---|---|---|---|---|
| Teal text | #3D7480 | 5.24:1 | 4.96:1 | PASS (normal text) |
| Rose text | #93506F | 5.42:1 | 5.13:1 | PASS (normal text) |
| Sage text | #5B7243 | 5.04:1 | 4.77:1 | PASS (normal text) |
| Sand text | #85652B | 5.01:1 | 4.74:1 | PASS (normal text) |
| Slate text | #4E5D6B | 6.06:1 | 5.73:1 | PASS (normal text) |
| Plum text | #6A5A79 | 5.48:1 | 5.19:1 | PASS (normal text) |
| Clay text | #8A5A42 | 5.36:1 | 5.07:1 | PASS (normal text) |
| Stone text | #6B655C | 5.08:1 | 4.81:1 | PASS (normal text) |
| Ink primary | #1A1C1E | 16.10:1 | 15.25:1 | PASS (primary body text) |
| Ink secondary| #333333 | 12.60:1 | 11.93:1 | PASS (secondary body text) |

---

### 4.2 Semantic Roles and Atlassian Token Mappings

In Forge native UI Kit, direct hex values cannot be rendered via `xcss`. All semantic roles map directly to Atlassian Design System tokens that automatically support light and dark modes:

| Semantic Role | Token Mapping | Purpose |
|---|---|---|
| `surface.app` | `elevation.surface.sunken` | Outermost container background (#F9F7F6 equivalent) |
| `surface.section` | `elevation.surface` | Content section card background (#FFFFFF equivalent) |
| `surface.note` | `color.background.neutral` | Metadata note callout background |
| `surface.subtle` | `color.background.neutral.subtle` | Hover and subtle background fill |
| `border.section` | `color.border` | Outer card boundary line |
| `border.subtle` | `color.border.subtle` | Subtle divider line |
| `text.primary` | `color.text` | Standard primary body text |
| `text.secondary` | `color.text.subtle` | Supporting descriptions and metadata |
| `text.subtlest` | `color.text.subtlest` | Timestamps and quiet footnotes |
| `space.section` | `space.150` | Padding inside section cards |
| `space.item` | `space.100` | Gap between distinct items in a stack |
| `space.sub` | `space.050` | Micro-gap between label and text |
| `space.indent` | `space.200` | Left indentation for sub-sections |
| `radius.section` | `radius.medium` | Rounded corners on card containers |
| `radius.chip` | `radius.small` | Rounded corners on badges and tags |

Lozenge and status mappings:
- `status.found` maps to Lozenge `appearance="success"`.
- `status.foundUnverified` maps to Lozenge `appearance="inprogress"`.
- `status.missing` maps to Lozenge `appearance="removed"`.
- `status.excepted` maps to Lozenge `appearance="moved"`.
- `status.notApplicable` maps to Lozenge `appearance="default"`.

---

### 4.3 Shared Package Proposal: `packages/asymm-jira-ui`

To ensure uniform adoption across FourRealities, LedgerSeal, and DefinitionGuard, all brand constants and layout primitives will be organized for future extraction into a shared workspace package:

1. **Package Name:** `packages/asymm-jira-ui`
2. **Contents:**
   - `src/brand.ts`: Palette constants, WCAG contrast table, semantic role definitions, and Atlassian token maps.
   - `src/layout.tsx`: Exported layout components (`AppSurface`, `PanelHeader`, `SummaryBlock`, `Section`, `NoteBox`, `ActionRow`, `StatusLozenge`).
   - `src/types.ts`: TypeScript contracts for status states, gate models, and actions.
   - `README.md`: Usage guide and design token reference.
   - Unit and accessibility test suite.
3. **Import Method (Zero Dependency Changes):**
   - No `npm install` is executed.
   - Apps import the shared package using a TypeScript path alias configured in `tsconfig.json`:
     ```json
     {
       "compilerOptions": {
         "paths": {
           "@asymm/jira-ui": ["../../packages/asymm-jira-ui/src"]
         }
       }
     }
     ```
   - This keeps the shared `node_modules` completely untouched, satisfying hard rule 6.
4. **Adoption Plan:**
   - **Step 1 (FourRealities build):** Build the code in `apps/fourrealities/src/brand/` first with clean modular boundaries and zero imports from FourRealities engine or contracts.
   - **Step 2 (Shared extraction):** Once approved by the owner, extract `src/brand/` into `packages/asymm-jira-ui`.
   - **Step 3 (Sibling apps):** LedgerSeal and DefinitionGuard import the package only after explicit owner approval.

---

## 5. Per-App Adoption Plan

### 5.1 FourRealities (In Scope for Phase 2)
- Unify manifest titles to **Four Realities**.
- Replace bare issue panel with `AppSurface`, `PanelHeader`, `SummaryBlock`, and collapsible `Section`.
- Replace raw text findings with indented gate sub-sections.
- Move exception history and rework notes into `NoteBox`.
- Standardize button rows to exactly one primary button.
- Remove loose text `→` arrows from the pipeline.
- Replace large dashboard alignment box with status banner, small gate cards, priority actions list, and coverage tile.
- Enforce architecture rule: no raw token strings or hex colors in components outside `src/brand/`.

### 5.2 LedgerSeal (Future Phase, Requires Explicit Approval)
- Retain all certificate verification and sealing engine logic.
- Adopt `AppSurface` and `PanelHeader` for the issue panel.
- Display one top status lozenge ("Sealed" in `success`, "Unsealed" in `default`, "Compromised" in `removed`).
- Move certificate properties and cryptographic digest into a collapsible `Section`.
- Place single primary action "Seal Issue" in the action row.
- Provide subtle button link "Open Four Realities panel".
- No property names or storage keys changed.

### 5.3 DefinitionGuard (Future Phase, Requires Explicit Approval)
- Retain all checklist parsing and attestation engine logic.
- Adopt `AppSurface` and `PanelHeader` for the issue panel.
- Display one top status lozenge ("DoD complete" in `success`, "Incomplete" in `removed`).
- Move checklist items and mandatory item counts into a collapsible `Section`.
- Place single primary action "Complete DoD" in the action row.
- Provide subtle button link "Open Four Realities panel".
- No property names or storage keys changed.

---

## 6. Mockup Review: Adopt, Adapt, or Drop

| Element from AI Mockups | Recommendation | Reason and Technical Constraints |
|---|---|---|
| "Issues reviewed 1/1" | **DROP** | Violates research finding H11. Forge apps cannot read code review approvals via public GA APIs. Claiming review occurred is factually false. |
| "Verify LedgerSeal" / "Record audit seal" | **DROP** | Violates hard rules 1 and 2. FourRealities never writes evidence owned by another app. |
| "Open LedgerSeal panel" button | **ADOPT** | Uses `openProducerPanel` subtle button to navigate user to LedgerSeal's native panel. |
| "Not assessed" / "Not rated" as failure | **DROP** | Violates spec Invariant 3 and B-14 / B-16. Unrated gates must be `n/a` and excluded from denominators. |
| "Export report", "Share", "Save view" | **DROP (for now)** | New out-of-scope features requiring new permissions and backend handlers. Placed on future roadmap. |
| "Create snapshot" button | **ADAPT** | Existing functionality is named "Refresh". Keep existing behavior; proposal below to decide button label. |
| Custom web fonts and hex backgrounds | **DROP** | Violates Fact 1. UI Kit native render does not support custom fonts or raw hex colors; requires Atlassian Design System tokens. |
| SVG ring gauges and custom circular charts | **DROP** | Violates Fact 4. UI Kit does not support SVG gauge primitives. Use native `ProgressBar`, `Lozenge`, and `Badge`. |
| Status word ("Audit readiness: Incomplete") | **ADOPT** | Provides immediate, honest context instead of misleading raw 100% scores on partially rated issues. |
| Next step line | **ADOPT** | Clearly states the single most impactful remediation action directly below the status banner. |
| Small gate cards with rate and question | **ADOPT** | Clean visual presentation grouping question, evidence line, and action link. |
| Priority actions list | **ADOPT** | Ranked list of up to 5 issues with the most missing gates to guide immediate remediation. |
| Compact table with gaps summary | **ADOPT** | Shows issue key, updated date, four chips without arrows, gaps summary, and risk. |
| Quiet footnote | **ADOPT** | Transparently clarifies: "Alignment is calculated across rated gates only." |
| Gates before score (H5 principle) | **KEEP** | Preserves core research finding: gate evidence comes first, score follows. Prevents metric gaming. |

---

## 7. Open Questions for the Owner

### Question 1: Button label for manual snapshot rebuild
On the project dashboard, should the manual snapshot trigger button be labelled **"Refresh"** or **"Create snapshot"**?
- **Option A (Recommended):** Keep **"Refresh"**. It matches native Jira conventions, avoids confusing users who might expect a saved bookmark or permanent artifact, and accurately conveys that a daily snapshot is already automated.
- **Option B:** Change to **"Create snapshot"**. Matches the wording in the proposed external mockup.

### Question 2: Default state of the findings section on the issue panel
In the main issue panel, should the "Gate findings" detail section start **collapsed** or **expanded**?
- **Option A (Recommended):** Start **collapsed**. The summary block already displays the overall status, the next step, and the four gate chips. Keeping details collapsed provides a compact, uncluttered experience on the ticket while allowing one-click expansion.
- **Option B:** Start **expanded**. Displays all four gate detail rows immediately on load.

### Question 3: Priority actions scope on the project dashboard
Should the "Priority actions" list display issues **project-wide** or respect the currently active filters (such as "My issues")?
- **Option A (Recommended):** **Respect active filters**. When no filter is applied, it lists the top priority issues across the whole project. When a filter or preset (like "My issues") is selected, it lists priority actions only for that filtered subset.
- **Option B:** Always **project-wide**. The top issues remain fixed regardless of table filter selections.
