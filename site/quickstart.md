# 5-Minute Evaluation Quickstart

This guide walks administrators and engineering leads through installing, configuring, and verifying any app from the Asymm Systems Governance Suite on Jira Cloud in under 5 minutes.

---

## Prerequisites
- A Jira Cloud instance with Jira Administrator permissions.
- Access to the [Atlassian Marketplace](https://marketplace.atlassian.com).

---

## Step 1: Install from Atlassian Marketplace

Every app in the suite includes a **Free Evaluation Tier for teams up to 10 users**:

1. In your Jira Cloud instance, navigate to **Apps** -> **Explore more apps**.
2. Search for the desired suite app:
   - `LedgerSeal`
   - `DefinitionGuard`
   - `FourRealities`
   - `CascadePlan`
3. Click **Try it free** to install the app.
4. Because the suite runs 100% on Atlassian Forge, installation completes in seconds without configuring external databases or webhook endpoints.

---

## Step 2: Configure Approver Groups (Uniform Permission Standard)

The suite utilizes the **Uniform Permission Management Standard** across all apps:

1. Navigate to **Jira Settings (Gear Icon)** -> **Apps**.
2. In the left sidebar, click the app's administration page:
   - **LedgerSeal approvers**
   - **DefinitionGuard approvers**
   - **CascadePlan approvers**
3. In the **Authorized Groups** input, search for and select your compliance, release, or lead groups (e.g. `jira-administrators`, `release-managers`, `tech-leads`).
4. Click **Save Policy**. Only members of these configured groups will have authority to apply seals, grant waivers, or approve baseline shifts.

---

## Step 3: Attach Workflow Transition Validators (LedgerSeal & DefinitionGuard)

To enforce quality gates at the workflow level:

1. Navigate to **Jira Settings** -> **Issues** -> **Workflows**.
2. Locate the workflow for your project and click **Edit**.
3. Select the transition leading into the **Done** status (e.g. `Done`, `Released`, `Closed`).
4. In the transition details panel, click **Validators** -> **Add validator**.
5. Select the app validator:
   - For LedgerSeal: **Require Valid LedgerSeal**
   - For DefinitionGuard: **DefinitionGuard DoD Enforcement**
6. Click **Add** and **Publish Draft**.

---

## Step 4: Verify Live in Your Project

Open any test ticket in your active sprint board:

- **Testing LedgerSeal:** Open the **LedgerSeal Audit Gate** issue panel. Click **Seal Issue**. Edit the ticket description and verify that the panel turns amber `[CHANGED]` and the transition into Done is blocked.
- **Testing DefinitionGuard:** Open the **Definition of Done** issue panel. Add a mandatory item requiring an evidence URL. Attempt moving the ticket to Done and verify that the validator blocks the move until evidence is attached.
- **Testing FourRealities:** Open the **Delivery Integrity** issue glance on any ticket. Verify that Intent, Process, Code, and Audit scores render.
- **Testing CascadePlan:** Open the **CascadePlan Planner** project page in the left sidebar. Click **Freeze Baseline** to record your sprint commitment snapshot.

---

## Need Help?
Contact our engineering team directly at `support@asymm.systems` for concierge onboarding or custom compliance mapping.
