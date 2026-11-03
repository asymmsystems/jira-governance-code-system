# @asymm/jira-ui: Shared In-Jira UI Kit Brand and Layout Package

This package (`packages/asymm-jira-ui`) contains the canonical brand definitions, design tokens, and Forge UI Kit layout primitives for all Asymm Systems Jira apps (**FourRealities**, **LedgerSeal**, **DefinitionGuard**, and **PlanShift**).

It is a zero-dependency monorepo package (`react` and `@forge/react` peer dependencies only) designed for uniform adoption across apps without code duplication.

## Monorepo Setup

In each app's `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@asymm/jira-ui": ["../../packages/asymm-jira-ui/src"],
      "@asymm/jira-ui/*": ["../../packages/asymm-jira-ui/src/*"]
    }
  }
}
```

Components across all apps import directly from `@asymm/jira-ui`:

```tsx
import {
  AppSurface,
  PanelHeader,
  SummaryBlock,
  KeyValueInline,
  StatusLozenge,
  Card,
  Section,
  NoteBox,
  TEXT_ROLE,
  SPACE
} from '@asymm/jira-ui';
```

## Architecture Rule

Outside `@asymm/jira-ui`, no app source file in `src/` may contain:
- raw hex colours (`#...`), or
- raw Atlassian Design System token strings starting with `color.`, `elevation.`, `space.`, or `radius.`.

Components import semantic roles (`SPACE`, `TEXT_ROLE`, `TOKENS`) and layout primitives from `@asymm/jira-ui` instead.

## Semantic Roles (`brand.ts`)

- **`STRONG_PALETTE`, `LIGHT_PALETTE`, `TEXT_PALETTE`**: Brand hex palette and verified WCAG 2.2 AA contrast ratios for documentation and future Custom UI.
- **`SPACE`**: Semantic spacing roles (`page`, `section`, `group`, `item`, `compact`, `sub`, `tight`, `indent`, `none`) mapped to Atlassian `space.*` tokens.
- **`TEXT_ROLE`**: Semantic text colour roles (`primary`, `secondary`, `muted`, `accentTeal`, `danger`, `warning`, `success`) mapped to theme-aware `color.text.*` tokens.
- **`TOKENS`**: Surface (`elevation.surface.sunken`, `elevation.surface`, `color.background.neutral`), border, shadow, and radius mappings.
- **`statusToAppearance(state, verification)`**: Maps gate and verification states to Atlassian `Lozenge` appearances (`success`, `inprogress`, `removed`, `moved`, `default`).

## Shared Layout Primitives (`layout.tsx`)

- **`AppSurface`**: Outermost sunken canvas container with standard (`space.250`) and sidebar `compact` (`space.150`) padding modes.
- **`PageHeader`**: Full-width project dashboard header with title, project scope lozenge, subtitle, quiet timestamp, and right-aligned action slot.
- **`PanelHeader`**: Issue panel header with manifest title, status lozenge, and right-aligned action slot.
- **`StatusBanner`**: State-aware executive readiness card with a semantic left accent stripe, bold status `Lozenge` (never a numeric `Badge`), summary text, and a full-width borderless `Next step:` callout strip using `KeyValueInline`.
- **`KeyValueInline`**: Baseline-aligned inline bold-label + value pair (`alignBlock="baseline"`, `Text as="span"`) that prevents Jira Cloud `@atlaskit/css-reset` `<p>` top margins from shifting baselines.
- **`CardHeader`**: Standardized section/card header with `Heading`, optional count `Badge`, right-aligned `metaText` or `action`, and optional secondary `subtitle`.
- **`FourColumnGrid` / `TwoColumnGrid` / `ThreeColumnGrid`**: Responsive equal-gutter multi-column rows (`Inline` + `Box` flex-basis cells) sharing an identical `space.200` (16px) gutter so multi-row card seams align to the pixel.
- **`Card` / `GateCard` / `SummaryBlock`**: Single-border elevated surfaces with `space.200` padding and equal row heights.
- **`StatTile`**: Borderless neutral KPI metric block for inside cards (wrapping `value` in `Box` so semantic headings carry zero extra top margin).
- **`ListRow`**: Structured list row with optional bottom hairline divider and right-aligned action slot.
- **`TableCard`**: Unified container combining a subtle header/filter toolbox and `DynamicTable` inside a single card separated by a hairline divider.
- **`Section`**: Collapsible detail card (starts collapsed by default) with count `Badge` and chevron toggle button.
- **`SubSection` / `NoteBox`**: Indented full-width sub-rows and borderless neutral metadata boxes for exceptions and rework history.
- **`ModalContent` / `FormField`**: Generously padded modal body wrapper (`space.200` block, `space.250` inline) and proximity-grouped label + input + helper stacks.
- **`LabeledInline` / `AttributionLine`**: Reusable inline control-strip label wrapper (`Views:`, `Risk:`) and `User`-aware audit attribution line (`Requested by <User> on ...`).
- **`ActionRow` / `StatusLozenge`**: Wrapped horizontal button row and accessible status lozenge (`maxWidth="100%"`).

## Typography Rhythm Rule (`Text as="span"`)

In Jira Cloud's Forge UI Kit 2 host, `<Text>` defaults to `<p>`, and `@atlaskit/css-reset` applies `margin-top: 12px` to every non-first `<p>`. Every `<Text>` inside `<Inline>` or `<Stack>` must render `as="span"` so flexbox `space` tokens control vertical and baseline alignment with zero shift.
