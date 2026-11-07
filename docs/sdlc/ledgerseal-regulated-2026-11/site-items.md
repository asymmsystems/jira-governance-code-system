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
