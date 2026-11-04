# FourRealities Admin Guide

This guide walks Jira administrators through configuring FourRealities, connecting data sources, tuning the Reality Alignment Index (RAI), and establishing drift detection thresholds.

![FourRealities Project Settings](/assets/fourrealities/04-settings.png)

---

## 1. Connecting Data Sources

To preserve data privacy and maintain zero-egress security, FourRealities does not connect to external version control systems or documentation tools directly. Instead, it leverages Jira's existing, authenticated platform integrations.

### Step 1: Connect Version Control via Jira Development Integration
FourRealities reads code events (branches, commits, pull requests, review states) via Jira's native development status endpoint. Ensure your repositories are linked to Jira using an official Atlassian integration:
- **GitHub:** Install the official [GitHub for Jira](https://marketplace.atlassian.com/apps/1219592) app or configure GitHub Enterprise Server under **Jira Settings > Products > Integrations > GitHub**.
- **Bitbucket:** Native integration is enabled automatically when Bitbucket Cloud is linked to your Atlassian site.
- **GitLab:** Install the official [GitLab for Jira Cloud](https://marketplace.atlassian.com/apps/1220973) integration.

> [!NOTE]
> Because FourRealities reads development status data through Jira's internal APIs, you do not need to configure third-party API keys, OAuth tokens, or webhooks inside FourRealities.

### Step 2: Connect Documentation (Confluence & ADRs)
To verify the **Intent** reality:
- Link your Confluence Cloud workspaces to your Jira site under **Jira Settings > Products > Integrations > Confluence**.
- When team members link Confluence specification pages or Architectural Decision Records (ADRs) to Jira issues via **Link issue > Web link** or **Confluence page**, FourRealities automatically inspects the linked intent.

---

## 2. Configuring Project Settings

Navigate to your Jira project and select **Project Settings > FourRealities**.

### Configuring Reality Weights
By default, each reality contributes equally (25%) to the overall Reality Alignment Index (RAI). You can adjust weightings based on your organization's delivery priorities:

- **Intent Weight (0 to 100%):** Importance of linked design specifications and ADRs.
- **Process Weight (0 to 100%):** Importance of accurate ticket estimates, state transitions, and milestone scheduling.
- **Code Weight (0 to 100%):** Importance of pull request linking, commit associations, and peer code reviews.
- **Audit Weight (0 to 100%):** Importance of test pass rates, compliance validation, and rework penalty mitigation.

*(The sum of all four reality weights must equal 100%.)*

### Rework Loop Sensitivity Threshold
A "rework loop" occurs when a ticket repeatedly bounces between an active development status and a review or testing status (for example: *In Review -> In Progress -> In Review*).
- **Default Bounce Threshold:** 2 bounces trigger a warning; 3 or more bounces trigger a critical rework alert.
- **Adjustment:** For complex investigative research spikes, administrators can relax the threshold. For strict production releases, set the threshold to 1.

### Branch and PR Naming Conventions
You can define regular expressions to validate that Git branches and commit messages adhere to team naming standards (for example: `feature/PROJ-[0-9]+-.*`). When code commits deviate from the pattern, Code Reality health is discounted.

---

## 3. Permissions Management

FourRealities respects the [Uniform Permission Management Standard](/permissions-standard):
- **Viewing Dashboard & Metrics:** Available to any user with the **Browse Projects** permission in the project.
- **Configuring Project Settings:** Restricted to users with the **Administer Projects** permission.
- **Global Settings:** Accessible to users with the **Jira System Administrator** global permission.

---

## 4. Periodic Metric Recalculation

FourRealities recalculates alignment metrics in real time whenever an issue panel is viewed or when the project dashboard is refreshed. To minimize load on Jira APIs, aggregated project statistics are cached within Forge KVS and updated incrementally.
