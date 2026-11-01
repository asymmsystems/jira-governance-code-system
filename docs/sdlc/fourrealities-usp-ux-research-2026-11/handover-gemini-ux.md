# Prompt for Gemini: in-Jira UX standard and FourRealities redesign

Read `handover-gemini.md` (same folder) first. Every rule, command and pitfall there still applies. This prompt adds one task in two phases. **Phase 1 is a design document that the owner must approve. Do not build until line 1 of that document reads `APPROVED <date>`.** The owner's process is design first, approval, then build.

## 0. Inputs from the owner (2026-11-01)

- Current UI (version 3.10.0): the AUDT project page and the AUDT-1 issue panel. Problems the owner sees: too much text, oversized boxes, no visual hierarchy, a large "Alignment 100% (LOW)" box that says little, a long issue panel that repeats the gates twice (chip row, then one box per gate), and too many buttons of equal weight.
- Two mockups suggested by other AI tools: a "FourRealities Audit Dashboard" and a "Delivery assurance" page. They are web pages with custom fonts, hex colours, ring charts and icons.
- Brand palette:

  | Role | Strong | Light |
  |---|---|---|
  | Teal | #5295A3 | #9CC8D1 |
  | Rose | #BA6E8F | #C985A3 |
  | Sage | #8FA96D | #AFC29C |
  | Sand | #F8DBA9 | #FDF5E5 |
  | Neutral surface | #F9F7F6 | #FFFFFF |
  | Ink | #1A1C1E | #333333 |

- Scope: one in-ticket UX standard for all of the owner's Jira apps (FourRealities, LedgerSeal, DefinitionGuard), covering buttons, button rows, sections, collapsing, the background colour (for example #F9F7F6), indented sub-sections and borders.

## 1. Facts you must design around (checked 2026-11-01)

1. **UI Kit (native render) accepts no hex colours.** `Box` `xcss` takes only Atlassian design tokens, for example `elevation.surface.sunken`, `color.background.neutral`, `color.background.accent.blue.subtlest`, `color.border`, `radius.medium`, `space.150`. The token list is in `node_modules/@atlaskit/forge-react-types/dist/types/components/__generated__/tokens.codegen.d.ts`. Tokens follow Jira's light and dark themes. A hex background would break dark mode.
2. **So the brand palette maps to the nearest tokens inside Jira.** #F9F7F6 maps to `elevation.surface.sunken` (Jira's own light grey). Teal maps to the `color.background.accent.teal.*` tokens, rose to `accent.magenta`, sage to `accent.lime` or `accent.green`, and sand to `accent.yellow` or `accent.orange` (check each name in the token file). The exact hex values are possible only in Custom UI, which needs a bundled React app and npm dependencies; that is a separate owner decision. Do not propose it as part of this task.
3. **Brand contrast (WCAG 2.2 AA).** I measured each colour against white:
   - Teal #5295A3 is 3.39:1, rose #BA6E8F is 3.67:1, and sage #8FA96D is 2.60:1. None of them may be used for body text on white, because body text needs 4.5:1. Teal and rose pass only for large text and icons, which need 3:1. Sage fails even that.
   - The light colours and sand are background colours only, with Ink #1A1C1E text on them (6:1 or better).
   - Ink #1A1C1E and #333333 pass on white. Use them for text.
4. **Rules that rule out parts of the mockups:**
   - **Mockup text that is false.** "Issues reviewed 1/1" claims a review that apps cannot read (H11). "Verify LedgerSeal" and "Record the audit seal" are seal actions, which are forbidden. Use "Open LedgerSeal panel" instead. Use "Not applicable yet" for gates that do not apply, not "Not rated" or "Not assessed" as a failure.
   - **Features that are not in scope.** "Export report", "Share", "Save view" and "Create snapshot" are new features. List them as proposals for the owner. "Create snapshot" is the existing Refresh, so rename it only if the owner agrees.
   - **Visuals UI Kit cannot draw.** Ring gauges and custom icons are not possible. Use `ProgressBar`, `Lozenge`, `Badge`, `Icon` (the UI Kit glyph list) and `Heading`.
   - **Scores.** Keep H5: the gates come before any score, no people are ranked, and "Alignment" is always shown with its parts.
5. **Ideas worth taking from the mockups:**
   - **Status word.** Lead with a status word: "Audit readiness: Incomplete" plus "Evidence found for 1 of 4 gates across 1 issue". It is better than a bare 100%, because it never says "100% (LOW)" when 3 of 4 gates have not been rated.
   - **Next step.** Put one "Next step" line under that status.
   - **Gate cards.** Use one small card per gate: name, status lozenge, one question, one evidence line, and one link-style action.
   - **Priority actions.** Add a short numbered "Priority actions" list for the issues with the most missing evidence.
   - **Issue table.** Use a compact table: issue key and updated date; "1 / 4 gates evidenced"; the four gate chips; missing evidence ("3 gaps: Process, Code, Audit"); risk; owner; Inspect.
   - **Footnote.** End with a quiet footnote: "Alignment is calculated across rated gates only."

## 1b. Brand system: one set of variables, reusable by every app

The owner wants one brand implementation that all his Jira apps reuse. Design it that way from the start.

### Palette (the owner's colours plus muted additions chosen for him)

The owner likes muted colours and allows additions. Each family has a strong colour, a light background colour, and a text shade. The text shades were checked on 2026-11-01: each one gives at least 4.9:1 contrast on white and on #F9F7F6, so it passes WCAG AA for normal text. Ink #1A1C1E text on any light colour gives at least 9:1.

| Family | Strong (icons, large text only) | Light (backgrounds) | Text shade (normal text) | Use |
|---|---|---|---|---|
| Teal (owner) | #5295A3 | #9CC8D1 | #3D7480 | primary brand, information |
| Rose (owner) | #BA6E8F | #C985A3 | #93506F | missing evidence, danger |
| Sage (owner) | #8FA96D | #AFC29C | #5B7243 | evidence found, success |
| Sand (owner) | #F8DBA9 | #FDF5E5 | #85652B | excepted, warning, needs re-check |
| Slate (added) | #6B7C8C | #C3CCD4 | #4E5D6B | not applicable, neutral states, secondary text |
| Plum (added) | #8C7A9B | #D3C9DC | #6A5A79 | second accent, for example the trend chart's second series |
| Clay (added) | #B98A72 | #EAD5C9 | #8A5A42 | third accent, for example risk "High" next to rose "Critical" |
| Stone (added) | #A8A196 | #E4E0D9 | #6B655C | borders and dividers in Custom UI, subtle chips |
| Surface (owner) | #F9F7F6 app area, #FFFFFF sections | | | |
| Ink (owner) | #1A1C1E primary text, #333333 secondary text | | | |

You may adjust a shade, but record its contrast numbers in the standard. Never use a strong colour, sage in particular, for normal-size text.

### Variables, never raw values

1. **Brand definitions.** Define the brand once, as named variables, in a brand module such as `src/brand/brand.ts`. It has three layers:
   - **Palette:** the hex values above, for documentation and for any future Custom UI.
   - **Semantic roles,** for example `surface.app`, `surface.section`, `surface.note`, `border.section`, `text.primary`, `text.secondary`, `status.found`, `status.missing`, `status.excepted`, `status.notApplicable`, `action.primary`, `space.section`, `radius.section`.
   - **UI Kit mapping:** each role mapped to the nearest Atlassian token (for example `surface.app` maps to `elevation.surface.sunken`, `status.found` to the `success` lozenge and the lime or green accent token).
2. **No raw values in components.** Components use only the semantic roles. They never contain a hex value, and never a token string such as `'color.border'` or `'space.150'`. Add an architecture-test rule: outside the brand module, no file in `src/` contains `#` followed by a hex colour, or a string that starts with `color.`, `elevation.`, `space.` or `radius.`.
3. **Shared layout components.** Put them next to the brand module (for example `src/brand/layout.tsx`): `AppSurface`, `PanelHeader`, `SummaryBlock`, `Section` (collapsible), `NoteBox`, `ActionRow` (one primary button only), `StatusLozenge`. They read only the semantic roles.
4. **Reuse by the other apps.** Write the brand module and the layout components so they can move, unchanged, into a shared package later, for example `packages/asymm-jira-ui`:
   - no import from FourRealities code;
   - its own tests;
   - a short README with the roles and the components.

   Creating that package, and adopting it in LedgerSeal and DefinitionGuard, changes shared code and other apps. The rules require the owner's approval first. So in Phase 1, propose the package (its name, its contents, and how each app imports it without `npm install`, for example a TypeScript path or a relative import). Build it in FourRealities only until the owner approves.
5. **Dark mode.** In UI Kit, Jira's tokens follow the user's theme. The hex palette applies only in Custom UI, which needs its own dark variants. List those as an open point for the owner, not as work.

## 2. Phase 1: write the standard (no code)

Write `docs/design/asymm-jira-ui-standard.md` for the owner's approval. Leave line 1 empty for the owner's APPROVED line. It must cover the following, each with a short ASCII wireframe:

1. **Panel anatomy for every app inside a Jira issue (issue panel).** Recommended baseline, which you may improve with reasons:
   - **Header row:** app name (the manifest title), one status lozenge (for example "Incomplete", "Sealed", "DoD complete"), and a subtle "Refresh" button on the right.
   - **Summary block:** the status sentence, the next step, and the gate chips on one line. This is always visible. The issue-context sidebar glance shows this block only.
   - **Detail sections:** each one starts collapsed and has a single clickable header row: a chevron-style button ("Show details" / "Hide details", or the section name), the section name and a count badge. The panels have no accordion component, so build the toggle from a subtle `Button` plus state, as `IssuePanel` does today.
   - **Surfaces:** the whole app area sits on `elevation.surface.sunken` (the token for the #F9F7F6 idea). Each section is a `Box` on `elevation.surface` with border `color.border`, radius `radius.medium` and padding `space.150`. Use one border level only: a sub-section inside a section is indented with `space.200` left padding, with no second border. Notes (who requested, who approved, rework reasons) use `color.background.neutral` with `space.100` padding.
   - **Buttons:**
     - Exactly one `primary` button per panel: the next step.
     - Other actions use `default`.
     - Links to another app ("Open LedgerSeal panel") and "Refresh" use `subtle`.
     - The button row sits at the end of the summary block or of its section, never floating between sections.
     - Use at most three buttons in a row; move further actions into the section they belong to.
     - Name a destructive or irreversible action plainly, and confirm it in a modal.
   - **Text:** at most one sentence per line of evidence. Move source names and metric codes into a `Tooltip`. Use sentence case. No em dashes.
   - **Status colours:** use the same tokens in every app.

     | State | Lozenge appearance |
     |---|---|
     | Evidence found and verified | `success` |
     | Found, not verified | `inprogress` |
     | Missing | `removed` |
     | Excepted or needs a re-check | `moved` |
     | Not applicable yet | `default` |
2. **The project page standard:** a status banner, the gate cards, the priority actions, coverage at a glance, and the issue table, in that order, all on the same tokens.
3. **Brand system:** the palette from section 1b with its contrast numbers; the semantic roles; the role-to-token mapping; and the proposal for the shared package (name, contents, import method, and how each app adopts it). Add a note that the exact hex values need Custom UI, which is a separate decision.
4. **Per-app adoption list:** what changes in FourRealities now, and what would change in LedgerSeal and DefinitionGuard. Those two apps must not be changed in this task; their adoption needs the owner's approval per app.
5. **The mockup review:** each element, with Adopt, Adapt (how) or Drop (why, citing H5, H11, T-05, the hard rules or a UI Kit limit).
6. **Open questions for the owner:** at most three, one decision each, each with a recommendation.

Then stop and tell the owner where the document is.

## 3. Phase 2: build FourRealities to the approved standard

Only after `APPROVED` is line 1 of the document:

1. **Pure logic first.** Put it in `src/ui/`, test-first:
   - a status word and sentence from the summary ("Audit readiness: Incomplete; evidence found for n of 4 gates across m issues"). A project with no rated gates is never "Complete".
   - priority actions: the issues with the most missing gates, at most 5, each with one action text.
   - "n gaps" text for each row.
2. **Brand module and components.** Build the brand module and the shared layout components from section 1b, test-first, in `src/brand/`. Every FourRealities component uses them and only them for colour, spacing and borders. Add the architecture-test rule against raw colour and token values. The accessibility test must still pass. Extend it to check: one primary button per panel, at most one border level, sections collapsed by default except the summary.
3. **Project page.** Status banner, then the four gate cards (small; status lozenge, question, evidence line, one action), then priority actions next to coverage at a glance, then filters, preset chips and the compact issue table. Keep the trend panel below the table. Remove the large alignment box: its content moves into the banner and the coverage tile.
4. **Issue panel and glance.** The summary block is always shown. The gate details are one collapsible section with the four rows inside it (sub-rows indented, not boxed). Exceptions and rework notes use `NoteBox`. The glance in `jira:issueContext` shows only the summary block.
5. **Delivery.** Update spec v2, the backlog (add the items as B-43 onwards), the round log and the final report. Deploy to development, check the result live on DEMO (read-only) and on AUDT-1 (any writes recorded), save screenshots, commit one item per commit, and report to the owner with the screenshots' paths.

## 4. Not in this task
- Custom UI and npm dependencies.
- Changes to LedgerSeal or DefinitionGuard.
- Export, Share and Save view.
- B-41 (Confluence search). It still needs the owner's approval of the new scope and of the install upgrade.
- Merging, pushing, tagging, and staging or production deploys.
