<!--
Copyright (c) 2026 Asymm Systems. All rights reserved.

@author Fahim Farook
-->
# LedgerSeal: approval seals and change control for Jira Cloud

**Tamper-evident approval seals and post-approval change control for Jira.** Atlassian Forge app by Asymm Systems. Status on 2026-11-08: pending Marketplace approval.

## The Data Center need it answers

On Data Center, regulated teams use transition signature and approval apps, or in-house plugins, to show that a change was approved. Some of these have no cloud version. Example, checked 2026-11-08: Electronic Signature for Jira (Deviniti) is listed for Data Center and Server only (https://marketplace.atlassian.com/apps/1212175). The auditor's question stays the same in cloud: is the ticket that reached Done the ticket that was approved?

## What it does

1. **Sealed at approval.** A SHA-256 hash of the covered fields, comments and attachments, who signed and the sign-off role, in a hash-chained history.
2. **Changes after approval, named.** Each changed item shows its value at approval, its value now and who changed it.
3. **Separation of duties.** A user who changed the covered content cannot approve those changes, revoke the seal, or seal again after another approver revokes it.
4. **The move waits.** The Require Valid LedgerSeal validator blocks a transition when the issue is not sealed, was changed after approval, or the seal was revoked.
5. **Evidence you can check offline.** Ed25519-signed evidence, checked by an open-source (Apache-2.0) verifier against the published key `ls-prod-2026-11`.

## Compliance mapping (supports; the auditor decides)

| Control | LedgerSeal |
|---|---|
| SOC 2 CC8.1 | Records who approved; detects changes after approval |
| ISO/IEC 27001:2022 A.8.32 | Separation of duties and change detection on change tickets |
| 21 CFR 11.10(e) audit trail | Supported: hash-chained records of seals, changes, approvals of changes and revokes |
| 21 CFR 11.50 signature manifestation | Partly met: date, time and meaning are recorded; the name is shown from the Atlassian account while it exists, and as a deleted user after the account closes |
| 21 CFR 11.70 signature linking | The attestation is signed by the app, not by the approver. The auditor decides |
| 21 CFR 11.200 and 11.300 | Not met: the signer does not log in again when sealing |

## What it does not do

- No Part 11 electronic signatures by itself. Keep your own signing control if your predicate rules need them.
- No re-authentication at signing (some Data Center and cloud apps check credentials; LedgerSeal does not).
- No multi-step or parallel approval routing.
- The validator does nothing until a Jira admin adds it to a transition.
- The history is tamper-evident, not immutable: someone who can rewrite the app's storage, the vendor included, can write a new consistent chain.
- Asymm Systems holds the signing key; the signature does not protect against the vendor.

## Data and hosting

Runs on Atlassian Forge. No external egress (`permissions.external` is absent). Data in Forge storage for the site; people in hashed records are pseudonymous tokens; account ids are reported to Atlassian weekly and the link of a closed account is deleted. Scopes: `read:jira-work`, `write:issue.property:jira`, `read:jira-user`, `storage:app`, `report:personal-data`.

Isolated Cloud: planned. Government Cloud: planned.

## Price

Free for 1 to 10 users. $0.95 per user per month (11 to 100), $0.75 (101 to 250), $0.24 (251 and more).

## Links

User guide: https://asymm.systems/product/jira-governance/user-guide/ledgerseal.html. Compliance mapping: https://asymm.systems/product/jira-governance/compliance.html. Verifier: https://github.com/asymmsystems/jira-governance-code-cli.
