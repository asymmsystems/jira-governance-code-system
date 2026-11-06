# Distribution Kit: Asymm Systems Jira Governance Suite

This distribution kit contains ready-to-publish copy, technical community discussion starters, social announcements, and direct outbound communication templates for the launch of the Asymm Systems Jira Governance Suite (**LedgerSeal**, **DefinitionGuard**, **FourRealities**, **CascadePlan**).

---

## 1. Hacker News (Show HN / Technical Launch)

### Submission Title
> Show HN: LedgerSeal - Tamper-evident cryptographic approval seals for Jira Cloud

### Submission URL
`https://asymm.systems/product/jira-governance/user-guide/ledgerseal.html` (or the suite overview `https://asymm.systems/product/jira-governance.html`)

### First Comment by Creator (Post immediately after submitting)
```text
Hey HN,

I built LedgerSeal because almost every engineering team operating under SOC 2, ISO 27001, or FDA 21 CFR Part 11 relies on Jira for release approvals, but Jira has a quiet structural flaw: an approved ticket can be modified right before deployment, and Jira will let it deploy without re-review.

We call this "The Approved Ticket Problem":
1. At 10:00 AM, QA and Security review and approve a release ticket.
2. At 2:00 PM, someone modifies an environment variable, an API payload, or an acceptance criterion.
3. At 4:00 PM, the deployment script checks that the ticket has status "Approved" and ships it.

Jira's audit log records who made the edit, but an audit log is post-hoc forensics, not change control. Standard Jira permission schemes cannot prevent this without locking down the entire project with `jira.issue.editable = false`, which breaks comments, subtasks, and CI/CD status updates.

LedgerSeal solves this mathematically:
1. When an authorized reviewer approves a ticket, LedgerSeal canonicalizes the issue specification (RFC 8785) and computes a deterministic SHA-256 snapshot hash across covered fields, attachments, and sign-offs.
2. The snapshot hash is digitally signed with an Ed25519 key and appended to a cryptographic hash chain stored in Atlassian Forge KVS.
3. A native Jira workflow transition validator (ledgerseal-validator) recalculates the snapshot hash when the ticket attempts to transition to Done or Released. If a covered field, comment or attachment changed after approval, the release transition is blocked until another approver approves the change, and the message names the changed fields.
4. It is 100% Forge native: zero external network calls (no outbound fetch), zero external servers, runs entirely on Atlassian Forge, with no external servers.
5. Evidence verification is completely offline: we open-sourced a zero-dependency CLI verifier using only the Node.js standard library (https://asymm.systems/product/jira-governance/user-guide/open-verifier.html) so auditors can check the signatures and hash chains themselves, offline.

Pricing: free up to 10 users, then $0.95 per user per month (less for larger sites) on the Marketplace.

Docs & Architecture: https://asymm.systems/product/jira-governance/user-guide/
Offline Verifier: https://asymm.systems/product/jira-governance/user-guide/open-verifier.html

I'd love feedback on the canonicalization scheme and how teams here handle release gate verification in Jira.
```

---

## 2. Reddit Community Posts

### A. r/devops (Focus: Deployment Gates and Pipeline Integrity)

**Title:** Why Jira change logs aren't change control (and how to gate deployments mathematically)

**Body:**
```text
If your deployment pipeline queries Jira to verify that tickets in a release are "Approved", you might have a hidden security gap.

In standard Jira Cloud, approval fields are just metadata. If someone has Edit Issues permission in the project, they can edit the description, swap an environment configuration, or alter the scope on an "Approved" ticket at 2:00 PM, and your automated deployment script at 4:00 PM will happily deploy it because the status is still "Approved".

Jira records the edit in the change history, but history is an audit trail, not a gate. You cannot prevent this with workflow properties like `jira.issue.editable = false` without completely freezing the ticket (blocking comments, retrospective notes, and build status webhooks).

We built an open solution called LedgerSeal on Atlassian Forge:
- When a ticket is signed off, it hashes the canonicalized JSON of the issue state (SHA-256) and stores a signed Ed25519 seal in Atlassian Forge storage.
- A workflow validator recalculates the hash on the transition to Done/Released. If a covered field, comment or attachment changed after approval, the transition is blocked and the panel shows what changed.
- Runs with zero external egress (Forge isolated runtime, no third-party servers).
- We also published an open-source offline verification script using only the Node.js standard library, so auditors can check evidence files themselves, offline.

Article with technical architecture: https://asymm.systems/product/jira-governance/user-guide/ledgerseal.html
Verifier repo: https://asymm.systems/product/jira-governance/user-guide/open-verifier.html

How are other teams ensuring approved tickets aren't modified prior to automated deployment?
```

---

### B. r/jira (Focus: Jira Administration, Validators, and Permissions)

**Title:** Solving the post-approval editing dilemma without `jira.issue.editable = false`

**Body:**
```text
Hey Jira Admins,

Question: How do you handle tickets that require formal approval before release, where you cannot allow anyone to change acceptance criteria or requirements after sign-off?

The classic Jira problem:
- If you leave Edit Issues enabled, developers or PMs can modify ticket descriptions after sign-off without re-triggering approval.
- If you add `jira.issue.editable = false` to the workflow step, nobody can add comments, link issues, update subtasks, or let CI/CD tools write build data.
- If you build custom automation rules to reset statuses on edit, you get noisy transition loops and broken webhooks.

We built LedgerSeal (Forge native) to solve this cleanly:
Instead of freezing the whole issue, it takes a deterministic SHA-256 snapshot of covered fields (summary, description, components, attachments, custom fields) when an authorized user seals it.

A transition validator on the transition to Done or Released checks:
`current_snapshot_hash === sealed_snapshot_hash`

If someone edited a covered field, the transition blocks with an error explaining what changed. If they only added a comment or updated an uncovered field, it transitions smoothly.

It's live on the Atlassian Marketplace (free tier for up to 10 users).

Documentation: https://asymm.systems/product/jira-governance/user-guide/ledgerseal.html
Marketplace: https://marketplace.atlassian.com/apps/ledgerseal

Would love to know how other admins solve post-approval change control in their workflows.
```

---

### C. r/compliance (Focus: SOC 2 CC8.1, ISO 27001 A.8.32, FDA 21 CFR Part 11)

**Title:** Eliminating "post-approval change risk" in Jira for SOC 2 and GxP audits

**Body:**
```text
During SOC 2 CC8.1 and ISO 27001 change management audits, one of the toughest questions auditors ask is:
"How do you prove that the Jira ticket approved by QA is identical to what was actually deployed?"

Jira's default history log shows modifications, but it doesn't prove integrity at the moment of release. An auditor can sample 20 tickets and check if any ticket was edited between the approval timestamp and the resolution timestamp. If it was, you have a change control deviation.

We developed an Atlassian Forge suite to automate this proof:
1. LedgerSeal: Hashes the approved issue state (SHA-256) and Ed25519 signs it. Gated workflow transitions reject release if the hash diverges.
2. DefinitionGuard: Enforces mandatory DoD checklists, lets admins mark items the assignee may not tick, and records waiver reasons in a hash-chained history.
3. Standalone Verification: Outputs standalone evidence JSON that can be verified offline with an open-source Node script (https://asymm.systems/product/jira-governance/user-guide/open-verifier.html), so auditors can check evidence files themselves, offline.

Architecture: 100% Forge native, zero external network egress, data stays in Atlassian Forge storage.

Full compliance mapping table (SOC 2, ISO 27001, 21 CFR Part 11):
https://asymm.systems/product/jira-governance/compliance.html
```

---

## 3. LinkedIn Thought Leadership Post

```text
The most common change management failure in Jira isn't missing approvals.

It's post-approval modifications.

Here is what happens in almost every engineering organization:
1. 10:00 AM: QA and Security review a ticket, verify test results, and click Approve.
2. 2:00 PM: An engineer tweaks a configuration parameter or dependency version in the description.
3. 4:00 PM: The ticket is marked Done and deployed.

Who approved the 2:00 PM modification? Nobody.

Jira's change log recorded the edit, but a change log is post-hoc forensics. It doesn't stop the change from deploying. And setting `jira.issue.editable = false` isn't an answer because it breaks comments, attachments, and CI/CD status webhooks.

We built LedgerSeal to solve this with mathematics:
- On approval, it computes a deterministic SHA-256 snapshot hash of covered fields and attachments.
- A workflow transition validator recalculates the hash before the ticket can reach Done.
- If a covered field, comment or attachment changed after approval, the release transition is blocked until another approver approves the change.
- 100% Atlassian Forge native: zero external egress, data in Atlassian Forge storage.

We also open-sourced the offline verifier so compliance teams can check evidence files themselves, offline:
https://asymm.systems/product/jira-governance/user-guide/ledgerseal.html

#DevOps #Jira #Cybersecurity #SOC2 #ISO27001 #Compliance #Atlassian
```

---

## 4. Atlassian Community Articles

### Forum: Jira Cloud > Best Practices & Workflows
**Tags:** `change-management`, `audit-logging`, `compliance`, `iso27001`, `soc2`, `workflow-validators`

**Post Title:** How to enforce post-approval change control in Jira Cloud workflows

**Draft Content:**
```text
Hello Atlassian Community,

Many teams struggle with this workflow requirement: Once a ticket has been formally approved for release, how do you guarantee that nobody modifies the requirements, configuration, or attachments before the ticket transitions to Done?

Common workarounds and their drawbacks:
1. Revoking "Edit Issues" permission: Too blunt. Prevents developers from logging work or adding retrospective notes on other tickets.
2. Setting workflow property `jira.issue.editable = false`: Freezes the entire ticket, preventing comments, attachments, and build tool status updates.
3. Custom Automation rules: Complex to maintain across multiple project workflows and creates noisy transition churn.

We designed LedgerSeal to solve this natively within Forge:
- Approvers seal the ticket using their designated approver group permissions.
- The app stores a SHA-256 cryptographic snapshot hash of the ticket state in Forge KVS.
- You place the LedgerSeal Validator on your transition to Done or Released.
- If the ticket has not been modified since approval, the transition proceeds. If anyone altered a covered field, the transition is blocked and the panel shows what changed.

You can evaluate it for free up to 10 users on the Atlassian Marketplace:
https://marketplace.atlassian.com/apps/ledgerseal

Documentation and audit mapping: https://asymm.systems/product/jira-governance/user-guide/
```

---

## 5. Direct LinkedIn Outreach Templates

### Template A: Head of Quality Assurance / QA Director

```text
Hi [Name],

I saw you're leading QA at [Company]. Quick question regarding your release sign-off process in Jira:

How do you currently verify that a Jira ticket hasn't been edited between the time QA approves it and the time it's transitioned to Done/Deployed?

In standard Jira, anyone with edit access can modify descriptions or test requirements post-approval without triggering a re-review. We built LedgerSeal (Atlassian Forge native) to solve this: it takes a SHA-256 snapshot on approval and hard-blocks the Done transition if any covered field was modified since sign-off.

It runs entirely on Atlassian Forge with zero external egress.

We put together an overview and compliance mapping here: https://asymm.systems/product/jira-governance/user-guide/ledgerseal.html

Would you be open to checking it out?
```

### Template B: VP of Engineering / CTO

```text
Hi [Name],

Reaching out because engineering teams preparing for SOC 2 CC8.1 or ISO 27001 often get flagged for "The Approved Ticket Problem" in Jira: tickets approved for release that had unreviewed specification edits right before deployment.

Jira's change log records the edit, but doesn't prevent deployment. Setting `jira.issue.editable = false` breaks comments and CI/CD webhooks.

We built LedgerSeal on Atlassian Forge to gate transitions cryptographically: it signs the approved issue state snapshot and blocks the release transition if a covered field, comment or attachment changed after approval.

Zero external egress, data in Atlassian Forge storage, free for up to 10 users.

Technical write-up: https://asymm.systems/product/jira-governance/user-guide/ledgerseal.html

Hope this helps your release governance.
```

### Template C: Compliance Officer / GxP Validation Lead

```text
Hi [Name],

Hope you're having a productive week. If [Company] uses Jira for validation or change authorizations, you might find our recent compliance work useful:

We built LedgerSeal to provide tamper-evident approval seals and offline evidence checks for Jira Cloud, addressing FDA 21 CFR Part 11 (§ 11.10e audit trails) and SOC 2 CC8.1 change control.

It generates an append-only cryptographic hash chain for every approval and includes an open-source, zero-dependency offline CLI verifier so your auditors can check evidence files themselves, offline:
https://asymm.systems/product/jira-governance/user-guide/open-verifier.html

Full compliance mapping documentation is available at:
https://asymm.systems/product/jira-governance/compliance.html

Happy to answer any architecture or security questions.
```
