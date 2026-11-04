# Asymm Systems Marketing Asset Generation Pipeline

This directory contains scripts for generating and capturing official Atlassian Marketplace visual assets across the Asymm Systems Jira Governance Suite (**LedgerSeal**, **DefinitionGuard**, **FourRealities**, **PlanShift**).

---

## 1. Specifications & Viewport Mathematics

Atlassian Marketplace requires specific image dimensions:
- **App Icons:** 144x144 px PNG, transparent background.
- **Hero Banners:** 2280x1140 px PNG (exact 2:1 ratio).
- **Screenshot Gallery:** 1840x1150 px PNG (retina standard).

### Viewport Configuration
To produce exact 1840x1150 px screenshots:
- **Desktop Standard View:** `{ width: 1840, height: 1150, deviceScaleFactor: 1 }` captures standard desktop Jira layout with complete sidebar, breadcrumbs, and issue details without responsive squishing.
- **Retina Half View:** `{ width: 920, height: 575, deviceScaleFactor: 2 }` outputs `920 * 2 = 1840` by `575 * 2 = 1150` px for high-density scaled views.

---

## 2. Scripts

### `render-brand-assets.mjs`
Renders vector icons (`icon.png`) and centered hero banners (`banner.png`) for all 4 apps using Atlassian Design System tokens (`#0C66E4`, `#091E42`, `#FFFFFF`, `#DEEBFF`, `#1F845A`).

```bash
node tools/marketing/render-brand-assets.mjs
```

### `capture-suite-assets.mjs`
Automates live headless Chrome navigation against the production tenant `asymmsystems.atlassian.net` using pre-authenticated session cookies.

```bash
JIRA_COOKIES_FILE=/path/to/cookies.mjs node tools/marketing/capture-suite-assets.mjs
```

Destination: `docs/marketplace/assets/<app>/`
- `01-*.png` to `05-*.png`
- `banner.png`
- `icon.png`
