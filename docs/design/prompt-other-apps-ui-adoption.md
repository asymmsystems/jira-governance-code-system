# Prompt for Gemini Sessions: Adopt the Shared In-Jira UI Library (@asymm/jira-ui)

You are working on one of the owner's Jira apps: **LedgerSeal**, **DefinitionGuard**, or **PlanShift**.
The shared UI standard and design system is built and approved. The canonical package is available at the monorepo root: `packages/asymm-jira-ui` (package name `@asymm/jira-ui`).

Your app must **not** re-implement or duplicate `brand.ts` or `layout.tsx`. If your app currently has a local `src/brand/` directory, you must replace it with direct imports from `@asymm/jira-ui`.

---

## 1. Where Things Are in the Monorepo

| Asset | Location in Monorepo |
|---|---|
| **Shared UI Package** | `packages/asymm-jira-ui` |
| **Package Exports** | `packages/asymm-jira-ui/src/index.ts` |
| **Brand Tokens & Roles** | `packages/asymm-jira-ui/src/brand.ts` |
| **Layout Primitives (22 components)** | `packages/asymm-jira-ui/src/layout.tsx` |
| **In-Jira UI Standard Specification** | `docs/design/asymm-jira-ui-standard.md` |
| **Your App Root** | `apps/<app-name>` (e.g., `apps/ledgerseal`, `apps/definitionguard`) |

---

## 2. Adoption Steps (3 Steps, Zero npm installs)

### Step 1: Configure Path Mapping in `tsconfig.json`
Open your app's `tsconfig.json` (e.g., `apps/ledgerseal/tsconfig.json`) and add `baseUrl` and `paths` under `compilerOptions`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022", "DOM"],
    "jsx": "react",
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@asymm/jira-ui": ["../../packages/asymm-jira-ui/src"],
      "@asymm/jira-ui/*": ["../../packages/asymm-jira-ui/src/*"]
    },
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test/**/*"]
}
```

### Step 2: Remove Local Duplicates
If your app directory contains `apps/<your-app>/src/brand/brand.ts` or `layout.tsx`, delete them. Do not maintain separate copies.

### Step 3: Import Directly from `@asymm/jira-ui`
Update all UI components to import directly from `@asymm/jira-ui`:

```tsx
import {
  AppSurface,
  PanelHeader,
  SummaryBlock,
  KeyValueInline,
  StatusLozenge,
  Card,
  Section,
  SubSection,
  NoteBox,
  ActionRow,
  ListRow,
  FormField,
  ModalContent,
  TEXT_ROLE,
  SPACE,
  TOKENS
} from '@asymm/jira-ui';
```

---

## 3. App-Specific Implementation Guides

### A. LedgerSeal (`apps/ledgerseal`)

Follow [asymm-jira-ui-standard.md](file:///home/fahimfarookme/Documents/projects/gemini-earning-fr-build/docs/design/asymm-jira-ui-standard.md) Section 5.2:

1. **Outer Shell**:
   Wrap the issue panel in `<AppSurface>` (and `<AppSurface compact>` for glance mode).
2. **Header Row**:
   ```tsx
   <PanelHeader
     title="LedgerSeal"
     statusText={isSealed ? "Sealed" : "Unsealed"}
     statusAppearance={isSealed ? "success" : "default"}
     action={
       <Button appearance="default" spacing="compact" iconBefore="refresh" onClick={onRefresh}>
         Refresh
       </Button>
     }
   />
   ```
3. **Summary Block (Always Visible)**:
   - Primary status sentence: e.g. "Cryptographic seal: Valid (sealed on 2026-10-30)."
   - Single primary action: `<Button appearance="primary" onClick={onSeal}>Seal issue</Button>` inside `<ActionRow>`.
   - Subtle inter-app link: `<Button appearance="subtle" spacing="compact" onClick={openFourRealities}>Open Four Realities panel</Button>`.
4. **Collapsible Details**:
   - Put certificate properties, SHA-256 digest, and signature verification inside a collapsible `<Section title="Certificate & attestation details" count={3}>`.
   - Certificate metadata notes and tamper warnings must use `<NoteBox>`, never a second bordered box.

---

### B. DefinitionGuard (`apps/definitionguard`)

Follow [asymm-jira-ui-standard.md](file:///home/fahimfarookme/Documents/projects/gemini-earning-fr-build/docs/design/asymm-jira-ui-standard.md) Section 5.3:

1. **Outer Shell**:
   Wrap in `<AppSurface>` (and `<AppSurface compact>` for glance mode).
2. **Header Row**:
   ```tsx
   <PanelHeader
     title="DefinitionGuard"
     statusText={allDone ? "DoD complete" : "Open items"}
     statusAppearance={allDone ? "success" : "inprogress"}
     action={
       <Button appearance="default" spacing="compact" iconBefore="refresh" onClick={onRefresh}>
         Refresh
       </Button>
     }
   />
   ```
3. **Summary Block**:
   - Status sentence: e.g. "Definition of Done: 4 of 5 items complete."
   - Next step callout: `<KeyValueInline label="Next step:" value="Review test coverage documentation" />`.
   - Single primary action: `<Button appearance="primary">Complete DoD</Button>` inside `<ActionRow>`.
4. **Checklist Rows**:
   - Render mandatory and optional items using `<ListRow>` with bottom hairline dividers (`divided={true}`).
   - Checkbox or toggle status using `<StatusLozenge>`.
   - Rework notes and waiver history inside `<NoteBox>`.
### C. Uniform Admin Policy Page (`src/frontend/admin.tsx`)

Follow [uniform-permission-management-standard.md](file:///home/fahimfarookme/Documents/projects/gemini-earning-fr-build/docs/design/uniform-permission-management-standard.md):

Every app in the suite provides a native `jira:adminPage` where Jira administrators configure authorized groups. Do not write custom group picker forms; import the shared admin panel from `@asymm/jira-ui`:

```tsx
import { AdminPolicyPanel, buildAdminPolicyView, GroupChoice, savedGroups } from '@asymm/jira-ui';
```

Use `AdminPolicyPanel` to render the standard cards, group lists, remove buttons, and group search input without writing custom UI layout code.

### D. Jest Configuration (`jest.config.js`)

In your app's `jest.config.js`, add `moduleNameMapper` so Jest resolves `@asymm/jira-ui`:

```js
  moduleNameMapper: {
    '^@asymm/jira-ui$': '<rootDir>/../../packages/asymm-jira-ui/src/index.ts'
  },
  moduleDirectories: ['node_modules', '<rootDir>/node_modules'],
```

## 4. UI Rules Enforced by the Standard

1. **Strict One-Border Rule**:
   Never nest a bordered `<Box>` or `<Card>` inside another bordered `<Box>`. Sub-rows are visually grouped by `<SubSection>` (indented with `space.200` padding) or borderless `<NoteBox>` (neutral background with small radius).
2. **Typography Alignment Rule (`Text as="span"`)**:
   Jira Cloud's Forge UI Kit applies a default `margin-top: 12px` to `<p>` elements. Every `<Text>` inside `<Inline>` or `<Stack>` must render as `<Text as="span">` so flexbox alignment and baseline spacing remain pixel-perfect.
3. **Button Hierarchy**:
   - Exactly **one** `appearance="primary"` button per view for the immediate next step.
   - Default actions use `appearance="default" spacing="compact"`.
   - Refresh, inter-app links, and dismissive actions use `appearance="subtle"`.
   - Maximum 3 buttons in any `<ActionRow>`.
4. **No Raw Tokens or Hex Colors**:
   Outside `packages/asymm-jira-ui`, no file in `src/` may contain raw hex values (`#...`) or raw ADS token strings (`color.`, `elevation.`, `space.`, `radius.`). All colors and dimensions must be imported as semantic roles (`TEXT_ROLE`, `SPACE`, `TOKENS`).

---

## 5. Verification Checklist

Before reporting completion, run:
1. `npm test`: All tests in your app must pass.
2. Architecture test: Verify that no raw tokens or hex codes exist outside `@asymm/jira-ui`.
3. `forge lint`: 0 issues found.
4. Deploy to development: `forge deploy -e development --non-interactive`.
