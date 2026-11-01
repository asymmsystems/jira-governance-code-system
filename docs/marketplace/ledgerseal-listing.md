# Atlassian Marketplace Listing: LedgerSeal

## App Information
* **Name:** LedgerSeal: Tamper-Evident Approval Seal
* **Tagline:** Seal a Jira issue when it is approved. See what changed after approval, and who changed it.
* **Categories:** Workflow & Automation, Security

---

## Short Description (Highlight)
LedgerSeal records an approval as a signed seal of the issue. If the issue changes after approval, LedgerSeal shows which covered items changed, who changed them and when. It can block a workflow transition until the issue is sealed and unchanged. An auditor can check the seal with our published public key and an open verifier.

---

## Detailed Description

### The problem
Jira keeps a change log, but it does not tell you whether the content that moves on is the content that was approved. A user who can edit an issue can change it after approval, and nothing compares the issue with the approval.

LedgerSeal ties the approval to the issue content, and keeps the evidence.

### Key Capabilities
1. **A seal of the approved content:**
   When an approver seals an issue, LedgerSeal stores a SHA-256 hash of the covered fields, the comments and the attachment list. The panel lists the covered fields, and the fields it does not cover with the reason for each.
2. **Changes after approval, with who and when:**
   When a covered item changes, the panel shows "Changed after approval", the item, the old and new value, who changed it and when. LedgerSeal records the change when the issue update event arrives, even if no one opens the issue.
3. **Separation of duties:**
   Only project admins and Jira admins can seal, reseal or revoke. A user who changed the issue cannot approve that change, and cannot get around this by revoking and sealing again. A reseal after a change needs a reason.
4. **History that a reseal does not hide:**
   LedgerSeal keeps every seal, change incident, reseal and revoke in a hash-chained history. An issue that changed after approval stays marked as changed after approval, also after a reseal.
5. **Workflow transition validator:**
   LedgerSeal can block a workflow transition until the issue is sealed and unchanged. A Jira admin must add the validator to the workflow.
6. **Signed records and an open verifier:**
   Seal records are signed with Ed25519. An auditor can check them with our published public key. The key is held by the vendor, so the signature proves that LedgerSeal wrote the record, not that the vendor could not. The evidence export (JSON) contains the hashed snapshot, the history and the signed attestation. The open verifier uses the Node standard library only, and checks the hash, the history chain and the signature.
7. **Find issues in JQL:**
   Search by seal state, for example `issue.property[ledgerseal-cert].status = "SEAL_BROKEN"`, or by `ledgersealEverCompromised` and `ledgersealIncidents`. The property is a summary for search. Check the signature before you rely on a value.

### Each seal records
The signer's Jira account and name, the time, the meaning (Approved, Reviewed or Verified) and the declaration the signer agreed to (supports 21 CFR 11.50(a)).

### Compliance
- "Only users in your approver policy can seal, reseal or revoke. A user who changed the issue cannot approve that change (supports authority checks, 21 CFR 11.10(g))."
- "LedgerSeal can block a workflow transition until the issue is sealed and unchanged (supports operational sequencing checks, 21 CFR 11.10(f))."
- "LedgerSeal can provide evidence for the approval step of a change management control, such as SOC 2 CC8.1 or ISO 27001 A.8.32. Your auditor decides whether it is sufficient."
- "LedgerSeal does not provide 21 CFR Part 11 electronic signatures by itself. It does not perform the two-component signing in 11.200. Compliance depends on your validation and procedures."

This is a product description, not legal advice.

### Known limits
- The approver policy is fixed: project admins and Jira admins. A group or role policy is planned.
- A change of status does not break a seal, so the validator can gate a transition.
- Some fields are not covered, such as rank, sprint and SLA timers. The panel lists each one and the reason.
- Attachments are covered by their id, name, size and type, not by file content. Jira gives a replaced file a new id.
- If an edit and its revert both happen with no issue update event and no panel view in between, LedgerSeal does not see the change.
- Some computed Jira Service Management fields (for example sentiment and form counts) are covered today and may change by themselves. Check them in the covered list on a service project.

---

## Pricing Strategy (Monthly per Instance)

* **1 to 10 Users:** Free for up to 10 users
* **11 to 100 Users:** \$1.50 per user/month (\$15 to \$150/month)
* **101 to 250 Users:** \$1.20 per user/month (\$150 to \$300/month)
* **251 to 1,000 Users:** \$0.90 per user/month (\$300 to \$900/month)
* **1,001+ Users:** Custom Enterprise Tier

---

## Security and Data
* **Runtime:** Runs on Forge, in the Forge runtime under the user's Atlassian login. The app backend makes no outbound network calls. The panel icon is bundled with the app.
* **Data storage:** Forge key-value storage, hosted by Atlassian, and one issue property (`ledgerseal-cert`) per sealed issue.
* **Scopes:**
  * `read:jira-work`: read the issue, comments, work log, field list and change log to compute and check the seal.
  * `write:jira-work`: write the `ledgerseal-cert` issue property, used for JQL search.
  * `read:jira-user`: read the signer's display name for the seal record.
  * `storage:app`: store seals and history in Forge storage.
