<!--
Copyright (c) 2026 Asymm Systems. All rights reserved.

@author Fahim Farook
-->
# Site items (entries only, not applied)

Changes the public site (`asymmsystems/asymm-corporate-code-pfw`, JBake, `src/main/jbake/content/product/jira-governance/`) needs once the regulated LedgerSeal features are released to production and pass live probes (Q-14). Nothing here was applied to the site. The owner approves every line of public prose.

| # | Phase | Page | Change |
|---|---|---|---|
| R-1 | 2 | `compliance.html` (LedgerSeal Part 11 table) | Replace the 11.200 and 11.300 rows with spec v4 section 17 (code signing, option B): 11.100(a) partly met (new row); 11.200(a)(1), (a)(2), (a)(3) partly met; 11.300(a) to (c) the customer's identity provider; 11.300(d) partly met (no alert email until a stable email API exists, Q-02); 11.300(e) not applicable. 11.50 stays partly met (Q-05) |
| R-2 | 2 | `user-guide/ledgerseal.html` | New section "Code signing": a Jira admin names the projects on LedgerSeal settings > Signing codes; "Send me a code" in the seal, approve and revoke forms; the code works once for 5 minutes; lockout after 5 failures in a row (3 to 10) and unlock by another Jira admin with a reason; the Security alerts tab (no email is sent); Jira outgoing email must be on; a shared mailbox defeats the code |
| R-3 | 2 | `user-guide/ledgerseal.html` (admin page) | The admin page is now called "LedgerSeal settings" with tabs Approver groups, Signing codes, Security alerts (was "LedgerSeal approvers") |
| R-4 | 2 | `user-guide/open-verifier.html` | Format `ledgerseal-evidence/2` and its two checks (signing policies; code signing on every signature that needs it); "use 1.4.0 or later for format 2"; format 1 output is unchanged |
| R-5 | 2 | `product/jira-governance/ledgerseal.html`, FAQ | Scope list gains `send:notification:jira` (emails only a signer's own code). "Data stays in Atlassian" stays true (the email goes through Jira) |
| R-6 | 2 | `privacy.html` | Code signing stores, per person: a party token, lockout state and a hash-chained history of code requests and attempts; codes only as keyed hashes for at most a day; no email address is stored |
| R-7 | 3 | `user-guide/ledgerseal.html` | New section "Sign on the transition screen": a Jira admin adds the "LedgerSeal signature" field to a transition screen with no other covered field (a comment typed there blocks the move), and the Require Valid LedgerSeal validator to that transition; the person signs in the field, then selects the transition button; the signature works once, for 2 minutes; the board, the issue view and the list view open the same dialog; REST, automation and bulk changes have no screen and are blocked by the validator unless the issue is already sealed; JSM approval steps skip validators. A seal made before canonical form 2.3.0 shows a change when the field is first set: approve it once. "Sign with LedgerSeal" in the actions menu works everywhere |
| R-8 | 3 | `user-guide/ledgerseal.html` (what Jira Cloud cannot do) | The list of ADR-018 "What is not possible in Jira Cloud": no re-entry of the Atlassian password; no interception of the transition button; the field must be added by an admin; no UI modifications on Forge fields; only the validator can refuse a transition; no signing on REST, automation or JSM approval steps; no rollback from a post function |
| R-9 | 3 | `compliance.html` | 11.10(g) row text may name "the signature field on the transition screen" with R-1 |
| R-10 | 4 | `user-guide/ledgerseal.html` | New section "Approval routes": define a route (JSON on LedgerSeal settings > Approval routes: stages, order groups, approver groups, quorum, target statuses a stage gates, optional re-approval stages), bind it to a project and issue types, sign stages in the panel ("Sign as {stage}", "Reject" with a reason), one person signs one stage, a change or rejection starts again, the last stage seals; revoking a routed seal needs a member of the last order group; JQL `ledgersealApproval = "OPEN"` |
| R-11 | 4 | `user-guide/open-verifier.html` | Verifier 1.4.0: checks 6 to 9 (route versions, stage signatures of the sealing run, quorum and stage order, one stage per person) and check 4 skipping run entries; download 1.4.0 with its SHA256SUMS once released in the public repository |
| R-12 | 4 | `compliance.html` | 11.10(f) "Supports" row (routes enforce the order of approval stages) and 11.10(g) "Supports" row, as spec v4 section 17 |
| R-13 | 4 | FourRealities user guide | A LedgerSeal property of an issue still in approval (schema 4, no status) counts as "not sealed" |
