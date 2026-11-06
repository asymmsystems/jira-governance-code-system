# Prompt for every other Gemini session: reuse the shared in-Jira branding

You work on one of the owner's other Jira apps: LedgerSeal, DefinitionGuard, PlanShift, or a new app. Another Gemini session is building one shared in-Jira UX standard and brand system, in the FourRealities worktree. Your app must reuse that standard and that brand. It must not invent its own. This prompt says what to read, what you may do now, what you must wait for, and how to adopt the brand when it is ready.

## 1. Where things are (full paths)

| Thing | Full path |
|---|---|
| The prompt the FourRealities session follows (it defines the standard; read sections 1, 1b and 2) | `/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system/docs/sdlc/fourrealities-usp-ux-research-2026-11/handover-gemini-ux.md` |
| The standard, once written | `/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system/docs/design/asymm-jira-ui-standard.md` |
| The brand module, once built | `/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system/apps/fourrealities/src/brand/brand.ts` |
| The shared layout components, once built | `/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system/apps/fourrealities/src/brand/layout.tsx` |
| The shared package | `packages/asymm-jira-ui` at the repository root |
| FourRealities worktree (read-only for you) | `/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system` (branch `feature/fourrealities-research-build`) |
| LedgerSeal worktree | `/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system` (branch `feature/ledgerseal-research-build`) |
| DefinitionGuard worktree | `/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system` (branch `feature/definitionguard-completion`) |

Work only in your own app's worktree. Never edit files in another session's worktree. Read them only.

## 2. Status checks before you touch any UI

Run these checks at the start of every UI task, and say the result to the owner in one line:

1. **Is the standard written?** Check that `/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system/docs/design/asymm-jira-ui-standard.md` exists. (Yes)
2. **Is the brand module built?** Check that `packages/asymm-jira-ui/src/brand.ts` exists. (Yes)
3. **Is the shared package approved and available on your branch?** Approved on 2026-11-03. Check that `packages/asymm-jira-ui` exists in **your** worktree root.

## 3. What you may do at each stage

### Stage A: standard not written yet
- Do **not** restyle your app's panels or pages. No new colours, backgrounds, borders or layout systems.
- You may still fix bugs and build features in your own backlog. When you need UI, use plain UI Kit components with these neutral rules, which the standard will also contain and which use only Atlassian tokens:
  - Lozenge appearances by state: verified evidence `success`; found but not verified `inprogress`; missing `removed`; excepted or needs a re-check `moved`; not applicable yet `default`.
  - Exactly one `primary` button per panel, for the next step. Other actions `default`. Links to another app and "Refresh" `subtle`. At most three buttons in a row.
  - Sentence case, one sentence per evidence line, no em dashes, labels on every text field, `shouldWrap` on every `Inline`, and `alignInline="start"` on any `Stack` that holds lozenges (otherwise they stretch into bars).
- Keep a short list of the UI places in your app that will need the standard later. You will need it in Stage C.

### Stage B: standard written, but no shared package yet
- Read the standard in full.
- You may change your own app's panels to follow the standard's **anatomy** (header row, summary block, collapsible detail sections, one border level, the button rules). Use plain UI Kit components and Atlassian tokens.
- Do **not** copy `brand.ts` or `layout.tsx` into your app, and do not write your own version of them. Two copies drift apart. Wait for the shared package. If a task cannot wait, ask the owner one question: "Copy the brand module now and replace it with the package later, or wait for the package?" Recommend waiting.

### Stage C: shared package approved and present on your branch
- Import the brand roles and layout components from the shared package, in the way the standard describes (a TypeScript path or a relative import; no `npm install`).
- In components, use only the semantic roles (for example `surface.app`, `status.missing`, `action.primary`). Never write a hex colour. Never write a raw token string such as `'color.border'` or `'space.150'` outside the package.
- Add the same architecture-test rule to your app: outside the shared package, no file in your app's `src/` contains a hex colour, or a string that starts with `color.`, `elevation.`, `space.` or `radius.`.
- Wrap every panel in the shared `AppSurface`, and use `PanelHeader`, `SummaryBlock`, `Section`, `NoteBox`, `ActionRow` and `StatusLozenge`. Show the summary block in the `jira:issueContext` glance, if your app has one.
- Getting the package onto your branch means a merge or a cherry-pick from another branch. That changes shared code, so ask the owner first, and say which commit you would bring in.

## 4. What the brand is (for reference; the standard wins if they differ)

- **Owner palette:** teal #5295A3 / #9CC8D1, rose #BA6E8F / #C985A3, sage #8FA96D / #AFC29C, sand #F8DBA9 / #FDF5E5, surfaces #F9F7F6 (app area) and #FFFFFF (sections), ink #1A1C1E and #333333.
- **Muted additions:** slate, plum, clay and stone, with text shades. The full table and the contrast numbers are in section 1b of `/home/fahimfarookme/Documents/projects/jira-governance/repository/code/jira-governance-code-system/docs/sdlc/fourrealities-usp-ux-research-2026-11/handover-gemini-ux.md`.
- **Inside Jira (UI Kit native render), only Atlassian design tokens work, never hex.** Each brand role maps to the nearest token, for example #F9F7F6 to `elevation.surface.sunken`. Exact hex colours need Custom UI, which is a separate owner decision. Do not adopt Custom UI.
- **Text colour rule:** strong colours (teal, rose and especially sage) are never used for normal-size text. Use the text shades or ink.

## 5. Rules that still apply

- Your own session's hard rules, from your own handover or agent definition, come first.
- Never edit another app's code, another session's worktree, or a shared package without the owner's approval.
- No npm installs or new dependencies without approval. Deploy only to the development environment.
- Commits: `git commit -F <file>`, `type(<app>): summary`, a body that describes the final state, a `Refs:` trailer, never a `Co-Authored-By` line. No em dashes anywhere.

## 6. Report

When you finish a UI task, tell the owner in short sentences:
- which stage applied (A, B or C);
- what you changed;
- which commit holds it;
- which version is deployed to development;
- where the screenshots are;
- which places still wait for the next stage.
