# Frequently Asked Questions (FAQ)

---

## 1. Licensing & Pricing

### How does pricing work?
Every app in the Asymm Systems Jira Governance Suite follows a transparent tiered pricing model:
- **1 to 10 Users:** **Free** (Fully functional evaluation tier).
- **11 to 100 Users:** **$1.50 per user / month** ($15.00 / user / year).
- **101 to 250 Users:** **$1.20 per user / month** ($12.00 / user / year).
- **251 to 1,000 Users:** **$0.90 per user / month** ($9.00 / user / year).
- **Annual Discount:** 2 months free when billed annually.

### How is the app tier determined?
Atlassian Marketplace licensing follows the user tier of your Jira Cloud instance, not the number of people who actively click in the app. For example, if your Jira instance has 25 licensed users, the app runs at the 25-user tier.

### How is billing handled?
Billing is processed natively by Atlassian and appears directly on your standard monthly or annual Atlassian Cloud invoice. Asymm Systems does not collect credit cards or billing details.

---

## 2. Cloud Fortified & Marketplace Status

### Are Asymm Systems apps Cloud Fortified?
Not yet. Atlassian Cloud Fortified requires an app to maintain a minimum of 25 active production installations and specific historical uptime metrics. As our apps achieve these marketplace tenure thresholds, we will submit for official Cloud Fortified badging.

### What guarantees exist today?
All apps are built on **Atlassian Forge**, inheriting Atlassian's high-availability infrastructure, automated scaling, zero-egress sandboxing, and customer tenant data residency.

---

## 3. Common Troubleshooting Scenarios

### The workflow validator says "Failed to validate" or blocks my transition.
- **LedgerSeal:** An issue transition is blocked if the issue is unsealed, or if covered fields were edited post-approval. To unblock, an authorized approver must reseal the issue with a recorded justification.
- **DefinitionGuard:** Transition into Done is blocked while mandatory DoD checklist items remain open without verified evidence or an authorized waiver.

### I cannot see the app admin page under Jira Settings -> Apps.
To access app administration pages, your account must belong to the `jira-administrators` or `site-admins` group.

### Does FourRealities connect to my external GitHub or Bitbucket account?
No direct external connection is needed. FourRealities reads pull request information through Jira's native development status integration (`/rest/dev-status`). If your Jira Cloud instance is already connected to GitHub, GitLab, or Bitbucket, FourRealities automatically inspects PR review states.

---

## 4. Support SLA & Contact

- **Standard Support Hours:** Monday through Friday, 09:00 to 18:00 UTC.
- **Critical Incident Response SLA:** 24 hours.
- **General Support Inquiries:** `support@asymm.systems`
- **Security Disclosures:** `security@asymm.systems`
- **Online Support Portal:** https://asymm.systems/support
