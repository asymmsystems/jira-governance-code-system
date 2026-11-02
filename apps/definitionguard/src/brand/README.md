# Asymm Jira UI Shared Brand and Layout Module

This folder (`src/brand/`) contains the reusable brand definitions and Forge UI Kit layout primitives for Asymm Systems Jira apps (FourRealities, LedgerSeal, and DefinitionGuard).

It has zero imports from DefinitionGuard domain, contract, or UI code (React and `@forge/react` only) so it can move unchanged into `packages/asymm-jira-ui` once workspace extraction is approved.

## Architecture Rule

Outside `src/brand/`, no source file in `src/` may contain:
- raw hex colours (`#...`), or
- raw Atlassian Design System token strings starting with `color.`, `elevation.`, `space.`, or `radius.`.

Components import semantic roles (`SPACE`, `TEXT_ROLE`) and layout primitives from `src/brand/` instead.

## Semantic Roles (`brand.ts`)

- `STRONG_PALETTE`, `LIGHT_PALETTE`, `TEXT_PALETTE`: Brand hex palette and verified WCAG 2.2 AA contrast ratios for documentation and future Custom UI.
- `SPACE`: Semantic spacing roles (`page`, `section`, `group`, `item`, `compact`, `sub`, `tight`, `indent`, `none`) mapped to Atlassian `space.*` tokens.
- `TEXT_ROLE`: Semantic text colour roles (`primary`, `secondary`, `muted`, `accentTeal`, `danger`, `warning`, `success`) mapped to theme-aware `color.text.*` tokens.
- `TOKENS`: Surface (`elevation.surface.sunken`, `elevation.surface`, `color.background.neutral`), border, shadow, and radius mappings.
- `statusToAppearance(state, verification)`: Maps gate states to Atlassian `Lozenge` appearances (`success`, `inprogress`, `removed`, `moved`, `default`).

## Shared Layout Primitives (`layout.tsx`)

- `AppSurface`: Outermost sunken canvas container with standard (`space.250`) and sidebar `compact` (`space.150`) padding modes.
- `PageHeader`: Full-width project dashboard header with title, project scope lozenge, subtitle, quiet timestamp, and right-aligned action slot.
- `PanelHeader`: Issue panel header with manifest title, status lozenge, and right-aligned action slot.
- `StatusBanner`: State-aware executive readiness card with a semantic left accent stripe, bold status `Lozenge`, summary text, and a full-width borderless `Next step:` callout strip using `KeyValueInline`.
- `KeyValueInline`: Baseline-aligned inline bold-label + value pair (`alignBlock="baseline"`, `Text as="span"`) that prevents Jira Cloud `@atlaskit/css-reset` `<p>` top margins from shifting baselines.
- `CardHeader`: Standardized section/card header with `Heading`, optional count `Badge`, right-aligned `metaText` or `action`, and optional secondary `subtitle`.
- `FourColumnGrid` / `TwoColumnGrid` / `ThreeColumnGrid`: Responsive equal-gutter multi-column rows sharing an identical `space.200` gutter so multi-row card seams align to the pixel.
- `Card` / `GateCard` / `SummaryBlock`: Single-border elevated surfaces with `space.200` padding and equal row heights.
- `StatTile`: Borderless neutral KPI metric block for inside cards.
- `ListRow`: Structured list row with optional bottom hairline divider and right-aligned action slot.
- `TableCard`: Unified container combining a subtle header/filter toolbox and `DynamicTable` inside a single card separated by a hairline divider.
- `Section`: Collapsible detail card with count `Badge` and chevron toggle button.
- `SubSection` / `NoteBox`: Indented full-width sub-rows and borderless neutral metadata boxes for exceptions and rework history.
- `ModalContent` / `FormField`: Generously padded modal body wrapper and proximity-grouped label + input + helper stacks.
- `LabeledInline` / `AttributionLine`: Reusable inline control-strip label wrapper and `User`-aware audit attribution line.
- `ActionRow` / `StatusLozenge`: Wrapped horizontal button row and accessible status lozenge.

## Typography Rhythm Rule (`Text as="span"`)

In Jira Cloud's Forge UI Kit 2 host, `<Text>` defaults to `<p>`, and `@atlaskit/css-reset` applies `margin-top: 12px` to every non-first `<p>`. Every `<Text>` inside `<Inline>` or `<Stack>` must render `as="span"` so flexbox `space` tokens control vertical and baseline alignment with zero shift.
