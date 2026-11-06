# LedgerSeal fixes for a paid Marketplace listing: progress log

Branch `feature/ledgerseal-marketplace-fixes`, from `7f87747`. The review is `docs/sdlc/suite-readiness-review-2026-11/ledgerseal-readiness.md` (blockers B1 to B7, findings F-01 to F-21). The owner's instruction "do NOW" (2026-11-06): adopt the review's recommendations, record each decision, keep going. One entry per fix, in the order built, with the commit and the proof.

Gate for every entry: `npx tsc --noEmit` 0 errors, `npm test` (jest with coverage thresholds of 90%), `npm run build`, `npm audit --omit=dev --audit-level=high` exit 0, `forge lint`. Final numbers are at the end.

## 2026-11-06

### Decision record: ADR-011 (B1)

- **Commits:** `6d65b08` (written as ADR-010), `4140ba5` (renumbered to ADR-011: DefinitionGuard took 00010).
- **File:** `architecture/decision/adr-00011-ledgerseal-personal-data.org`, status "[ADOPTED: owner instruction 'do NOW', 2026-11-06]".
- **Decision:** hashed records hold a party token, not an account id; the token-to-account map is one key per account, deleted on closure; existing records are converted once by a recorded redaction event; canonical form 2.2.0; attestation schema 3 with no account id; deleted-issue cleanup; weekly report.
- **Refinement of the review, with the reason:** the token is HMAC-SHA-256 of the account id under a random per-site key, not a plain random token. Jira keeps a closed account's id on the issue, so the live issue must give the same token after closure; a random token would need the account id kept next to it, which is the data to erase (ADR-011 decision 3).

### F-18. Copyright header and author on every file

- **Commit:** `7808bd3`.
- **What changed:** 17 source and test files and `jest.config.js` got the Asymm Systems line and `@author Fahim Farook`. New `test/headers.test.ts` checks every source and test file, and that none has an em or en dash.
- **Proof:** the new test fails on `7f87747` for those 17 files and passes after; full suite green.

### MK-02. npm audit

- **Commit:** `8581fdb`.
- **What changed:** `package.json` `overrides: { "prosemirror-view": "^1.42.3" }`, as CascadePlan.
- **Proof:** before: 13 advisories (8 high); after: `npm audit --omit=dev --audit-level=high` exit 0, 7 moderate left in Atlassian UI packages.

### B1 part 1. Party tokens, canonical form 2.2.0 (with F-07), attestation schema 3; prices

- **Commit:** `54f0ea2`.
- **What changed:**
  - `src/domain/party.ts` (new): token `pty_` + 32 hex of HMAC-SHA-256; `pseudonymise` replaces user objects and mentions.
  - `src/storage/party-repository.ts` (new): site key `ls3:partykey`, map `ls3:party:{token}`, resolver. The site key is created just before the first write, so a refused first seal writes nothing.
  - Seal, incident and revoke rows, assignments and the sealed issue hold tokens; `signerName` is no longer stored.
  - The panel resolves tokens to account ids and names for display: "a closed account" for a closed signer, revoker or changer; "a user no longer on this issue" for a sealed person it cannot name.
  - Canonical form 2.2.0: tokens; `{ id }` only in reference fields (F-07). 2.0.0 and 2.1.0 unchanged.
  - Attestation schema 3: no `sealedByAccountId`. Evidence adds an unsigned `parties` map.
  - Listing prices (owner decision of 2026-11-06): free 1 to 10, $0.95 (11 to 100), $0.75 (101 to 250), $0.24 (251 to 1,000), custom above.
- **Proof:** `test/party.test.ts` (12), `test/canonical-v22.test.ts` (5 hand-written vectors in `test/fixtures/vectors-2.2.0.json`, all matched on the first run, and F-07 cases); 29 older tests updated from account ids and names to tokens.

### B1 part 2. Weekly personal data report, closure, deleted issues (F-11)

- **Commit:** `b14e19f`.
- **What changed:** manifest scope `report:personal-data`, scheduled trigger `ledgerseal-personal-data-report` (weekly, `timeoutSeconds: 300`), trigger `ledgerseal-issue-deleted`. `src/service/personal-data.ts`: report every map account and the policy admin once each, newest `updatedAt`; on `closed` delete the map key and clear the policy admin. `deleteIssueRecords` deletes all keys of a deleted issue. A reseal deletes the replaced snapshot.
- **Proof:** `test/personal-data.test.ts` (9): a closed account's map key goes, the seal stays valid, records unchanged, the next run reports nothing about it.
- **Note:** `forge lint` then reported one "approval" (major version because of the new scope); the deploy acknowledged it (`--approve MAJOR_VERSION_RULE`, development only).

### B1 part 3. Conversion of existing records (recorded redaction event)

- **Commit:** `4a2eb72`.
- **What changed:** `src/service/conversion.ts`: replaces every account id in rows, seals and the current snapshot with its token, removes names, re-chains, appends `LS_REDACTED` (`REDACT`) with the previous head seq and hash, the count and the tokens; marks `attributes.parties: "TOKEN"`. Journal key for a crash midway; snapshot, redaction row and sealed issue in one transaction. An invalid record gets its ids replaced in place and stays invalid. Old-format `cert:active:` records become a stub. Runs before seal and revoke, and in the weekly job (which then rewrites the property).
- **Proof:** `test/conversion.test.ts` (12) with `test/support/old-record.ts` (a record written exactly as before): old evidence verifies; after conversion no id or name remains, chain valid, still SEAL_VALID, gate open, property schema 3; one incident stays one; Jira unreachable converts nothing; a stopped conversion finishes with the same result; invalid stays invalid; a conflict waits.

### B3, F-17. Public verifier v1.1.0, one copy in the monorepo

- **Commits:** public repository `asymmsystems/ledgerseal-verifier` `2504985` (pull request 1, CI green on Node 18.x, 20.x, 22.x, merged by fast-forward to `main`; `main` CI run 42143715352 green); monorepo `8d8f969`.
- **What changed:** the verifier prints a NOTE for each `LS_REDACTED` entry and for the unsigned `parties` map; checks and exit codes unchanged. New fixture `test/fixtures/redacted-evidence.json` (a made-up converted record, generated by the app) and `redaction-key.pub.pem`; 3 new tests (10 in all). README section "Redaction entries and party tokens". Version 1.1.0.
- **Release:** https://github.com/asymmsystems/ledgerseal-verifier/releases/tag/v1.1.0 with `verify-evidence.mjs`, `vectors.json`, `LICENSE`, `ls-dev-2026-11.pub.pem`, `SHA256SUMS`:
  - `619c2b8994e607de6ad1232e37263acecc8c4003daed8f2246f0c214399f3af2  verify-evidence.mjs`
  - `5cc3656b4e87443b9850f49bc864650b99ce7af3fd2f6f2896dd70c793865457  vectors.json`
  - `272774088714fd2e158415976b849668772530986fcfc2aa2668c6e19c9cd271  LICENSE`
  - `c7618b74ecca80992ec2c7f1e6a37980cc4fb07da417ab36dfad6ee3ba72ab34  ls-dev-2026-11.pub.pem`
- **Monorepo:** `tools/verifier` is identical to the public repository (`diff -r` empty, except `.git`). `apps/ledgerseal/verifier` is removed after a search in every form (`ledgerseal/verifier`, `../verifier`, `'verifier'`, `verifier/vectors`, `verifier/verify-evidence`, `node verifier`): the three tests and the README that used it now use `tools/verifier`.
- **Not changed:** the public fixture text names "ADR-010" (written before the renumbering); it is inside hashed, signed evidence.

### B2, F-01, F-13. Separation of duties

- **Commit:** `0b64023`.
- **What changed:** `src/domain/policy.ts`: authors are change log entries with a covered item (F-13: status, Rank, Sprint do not count), users who added or edited a comment or work log after the seal, and users who added an attachment. Approve, revoke and seal-after-revoke refuse them; the panel offers none of those buttons to them. Incidents name work log authors.
- **Proof:** `test/separation-of-duties.test.ts` (10), two older tests changed to the new rule (the editor can no longer revoke).
- **Live:** see "Live checks" (PAY-13).

### F-02, F-03. Transition-screen values

- **Commit:** `3f09cfa`.
- **What changed:** `modifiedFields` read at the top level and under `transition` (top wins); a screen comment is a new comment; screen values record no incident.
- **Proof:** `test/transition-screen.test.ts` (7).
- **Live:** the validator payload of 4.0.0 (temporary shape log, never committed, removed in 4.1.0) is `{"issue":{"id","key"},"modifiedFields":{},"context":{"cloudId","moduleKey","userAccess"},"user":{"accountId"},"transition":{"from":{"id"},"to":{"id"}},"contextToken"}`. So `modifiedFields` is at the top level (F-03 confirmed). A comment sent with a REST transition does not appear in `modifiedFields`; the shape of a comment typed on a transition screen was not seen, because no LSP or PAY transition has a screen. The code accepts a string, rich text, `{ body }` or an update list.

### B5, F-04, F-08, F-14, F-15. Panel and validator

- **Commit:** `cd6794b`.
- **What changed:** an unsigned attestation write or evidence export is logged; the panel shows a warning; the evidence gets a `warning` field (B5). The "Open Four Realities panel" button is removed (F-04). The no-seal message names "Seal this issue" (F-14). On an inactive licence a blocked transition tells the user to renew or remove the validator (F-08). History: plain words, who acted, "Show more history", error text on a failed call (F-15).
- **Proof:** `test/panel-notes.test.ts` (9).
- **Live:** the button is gone (screenshots). The live validator context has no licence object on a development install, so the F-08 message could not be seen live.

### F-05, F-10

- **Commit:** `5e385d2`.
- **What changed:** `viewHash` from the panel; seal refused with `ISSUE_CHANGED` when the issue changed since (F-05). Lists over 50 pages fail closed with `TOO_LARGE`; the change log is read once per invocation (F-10).
- **Proof:** `test/seal-what-was-seen.test.ts` (4), 2 new tests in `test/jira-client.test.ts`.

### B6. Screenshots

- **Files:** `docs/marketplace/assets/ledgerseal/01-sealed-panel.png`, `02-tamper-detected.png`, `03-transition-blocked.png`, `04-admin-approvers.png`, `05-seal-history.png` (new; `05-certificate.png` removed). All 1840 x 900, real captures of 4.1.0, cropped to the app surface (no Jira header, no DEV badge). 01, 02, 05 from PAY; 04 from the admin page; 03 from LSP-1, because PAY's workflow has no LedgerSeal validator (changing the PAY workflow was out of scope).
- **Scripts:** `apps/ledgerseal/test/live/shots.py`, `shot_admin.py`, `shot_blocked.py` (commit `015d795`).
- **Listing:** manifest rewritten; `test/listing.test.ts` checks the five files exist at 1840 x 900 and none is marked for recapture.

### B3, B4, B5 wording; docs (F-09, F-19)

- **Commit:** the docs commit that adds this log.
- **Listing:** separation of duties as built; signed by the production key `ls-prod-2026-11` (true after the owner commands below); verifier = public repository and the site page; the 11.200 and 11.300 boundary; personal data; prices; screenshot manifest.
- **Reviewer notes:** the fifth scope; signing and personal data; test steps on the reviewer's own site.
- **`apps/ledgerseal/README.md`:** separation of duties, scopes, modules, storage keys, install order (F-09), test numbers (F-19). **`apps/ledgerseal/keys/README.md`:** production key row, rotation, unsigned behaviour.
- **Spec:** `docs/spec/ledgerseal-spec-v3.md` (new); v2 frozen with one header line.
- **Test:** `test/listing.test.ts` (12): prices, links, no private repository link, no independence claim, the 11.200 boundary, the separation-of-duties wording, scopes = manifest, notes independent of our site, screenshots.

## Deploys (development only)

| Version | From | Note |
|---|---|---|
| 4.0.0 | `5e385d2` plus a temporary, uncommitted payload-shape log | `forge deploy -e development --approve MAJOR_VERSION_RULE`; `forge install --upgrade -e development --site asymmsystems.atlassian.net --product jira --confirm-scopes`: "Upgrade complete", install "Up-to-date" (version 4) |
| 4.1.0 | `5e385d2` (shape log removed) | live checks and screenshots |
| 4.2.0 | `015d795` code (the docs commit changes no code) | final development version |

## Live checks (asymmsystems.atlassian.net, 4.1.0)

| Check | Result |
|---|---|
| Seal PAY-10 through the panel | SEALED; property `schemaVersion 3`, `SEAL_VALID`, `keyId ls-dev-2026-11`, signed, no `sealedByAccountId` |
| Evidence of PAY-10 from "Show evidence (JSON)" with `tools/verifier` and the dev key | 4 of 4 PASS, exit 0. Snapshot, history and attestation hold no account id or name; assignee, reporter and creator are `pty_` tokens; the account id is only in the unsigned `parties` map |
| Old record LSP-3 (2.1.0, schema 2 property with `sealedByAccountId`) | panel reads it as SEALED. Evidence before: 4 PASS. Revoke, then seal again: history SEAL, REDACT, REVOKE, RESEAL; property schema 3 without the account id; evidence after: 4 PASS and "NOTE entry 2 is a redaction: 7 account ids and names were replaced by party tokens" |
| Separation of duties on PAY-13 (sealed, then a summary edit and a comment by the same user) | CHANGED, 2 items, each "Changed by" the user; "You changed this issue, so another approver must approve it."; no Approve and no Revoke offered |
| Gate on LSP-1 (sealed, changed) in the issue view | "Transition failed: LedgerSeal: 1 field changed after approval (Summary)..."; status stays In Progress |
| Gate on LSP-4 by REST transition 41 with a comment | 400 with the LedgerSeal message; LSP-4 unchanged |
| Deleted-issue trigger | six issues deleted by other sessions (ids 10109 to 10114) each logged "issue N deleted, 0 record key(s) deleted" (no seals on them). A sealed-then-deleted case could not be run: deleting LSP-5 returned 403 (no Delete issues permission) |
| Weekly report | not observed live yet (no run in the logs since the deploy); covered by tests |
| Admin page | renders with the policy; a group search works (nothing saved) |
| Observation | one resolver invocation timed out at 25 s on 4.1.0 (2026-11-06T02:46:12Z, invocation `15f775ab-69e6-470f-a0d7-ab8231fee766`), no error text; not reproduced. Watch `forge logs` |

## Every live change

| When (UTC) | Where | Change | State now |
|---|---|---|---|
| 02:00 | Forge development | deploy 4.0.0, install upgrade (consent to `report:personal-data`) | version 4.1.0 and later |
| 01:56 | LSP-4 | REST transition 41 attempt with a comment (blocked, nothing saved); the validator recorded LSP-4's existing Description change as an incident | LSP-4 content unchanged; LedgerSeal record has one more incident (it was already changed) |
| 02:01 | PAY-10 | Approval Seal panel added to the issue view; sealed by the owner account | sealed (demo for screenshots) |
| 02:05 | LSP-3 | revoked ("LedgerSeal live check: revoke and seal again (ADR-011 conversion)") and sealed again ("Approved again after the LedgerSeal live check"); record converted | sealed, as before; history 4 entries |
| 02:06 to 02:09 | PAY-13 | panel added; description set, two identical comments (10039, 10040; the second by an accidental rerun), sealed, then comment 10041 and summary "Manual review queue for flagged and high-value orders" | restored at 02:5x: summary "Manual review queue for flagged orders", description cleared (Jira keeps an empty document), comments 10039 to 10041 deleted. The LedgerSeal record stays and shows CHANGED (the restored issue differs from what was sealed) |
| 02:2x | LSP-1 | gated move to Done tried twice in the UI (blocked) | unchanged, In Progress |
| 02:3x | LSP-5 | created "[LS-PROBE] LedgerSeal deleted-issue cleanup check, delete after test", sealed | still exists: delete returned 403. **Owner: delete LSP-5** |
| | Admin page | a group search for "jira" | nothing saved. The policy already named `jira-user-access-admins-asymmsystems` before this session; left as found |

No other project, workflow or setting was changed. No production or staging deploy.

## Site changes needed (asymm.systems; the main session applies them)

Source: `asymm-corporate/repository/code/asymm-corporate-code-pfw/src/main/jbake/content/`, read at `6d838f9`.

1. `product/jira-governance/user-guide/open-verifier.html`, header paragraph.
   - Old: "to independently verify LedgerSeal signatures, snapshot hashes, and audit chains completely offline without trusting Jira or Asymm Systems."
   - New: "to check LedgerSeal evidence offline: the snapshot hash, the hash-chained history, the newest seal and the Ed25519 signature. A pass shows the evidence was not changed after export and was signed with the published key. It does not stop someone who can rewrite the app's stored data, including the vendor, from writing a new consistent record."
2. Same page, section 1.
   - Old: "<strong>LedgerSeal provides complete cryptographic independence.</strong> Every approved ticket can export a standalone evidence JSON document."
   - New: "Every approved ticket can export a standalone evidence JSON document, and the check needs no access to Jira or to LedgerSeal."
3. Same page, section 6, repository item.
   - Old: `<a href="https://github.com/asymmsystems/jira-governance-code-system/tree/master/tools/verifier" ...>tools/verifier/ in GitHub Monorepo</a>`
   - New: `<a href="https://github.com/asymmsystems/ledgerseal-verifier" ...>asymmsystems/ledgerseal-verifier on GitHub (Apache-2.0), release v1.1.0</a>` (if the main session renames the repository to `asymmsystems/jira-governance-code-cli`, use that URL), and add "Production key: `keys/ls-prod-2026-11.pub.pem` (Ed25519, SPKI PEM), used by every Marketplace installation." after the owner publishes it. Add a short paragraph: "Evidence may contain a redaction entry (LS_REDACTED): records made before LedgerSeal used party tokens were converted once; the verifier names the entry. The `parties` map is not signed."
4. Same page, section 1, first sentence: "In enterprise audits (SOC 2, ISO 27001, FDA 21 CFR Part 11), a critical principle ..." can stay; the description meta line "independently verifying" -> "checking ... offline".
5. `product/jira-governance/user-guide/ledgerseal.html`, intro.
   - Old: "When the vendor signing key is configured for the installation, the attestation is signed with Ed25519."
   - New: "The attestation is signed with Ed25519 by the Asymm Systems key `ls-prod-2026-11`; its public key is in the open verifier repository."
6. Same page, approve steps, item 1.
   - Old: "LedgerSeal refuses the approval if the approver changed the issue since the last seal (separation of duties)."
   - New: "LedgerSeal refuses the approval if the approver changed the issue since the last seal: a covered field, a comment or work log they added or edited, or an attachment they added (separation of duties). Status, Rank and Sprint changes do not count."
7. Same page, after the steps.
   - Old: "An approver can also <strong>Revoke seal</strong> with a reason; sealing again after a revoke follows the same separation-of-duties rule."
   - New: "An approver who did not change the issue since the seal can also <strong>Revoke seal</strong> with a reason; sealing again after a revoke follows the same separation-of-duties rule."
8. Same page, Figure 2: image `/images/product/jira-governance/ledgerseal/05-certificate.png` -> `05-seal-history.png` (copy all five new files from `docs/marketplace/assets/ledgerseal/` into `/images/product/jira-governance/ledgerseal/`); caption "The Approval Seal panel on a sealed issue, with the seal details collapsed." -> "The seal details with the hash-chained history, naming who sealed."
9. Same page, permissions list, View item: add "The evidence record names people by a pseudonymous token and lists their account ids in an unsigned map."
10. `product/jira-governance/compliance.html`, SOC 2 "Formal Change Authorization" row: "The attestation is signed with Ed25519 when the vendor signing key is configured." -> "The attestation is signed with Ed25519 by the Asymm Systems key of the app."
11. Same page, "Separation of Duties" row: "LedgerSeal refuses an approval from anyone who changed the issue since the last seal." -> "LedgerSeal refuses an approval or a revoke from anyone who changed a covered field, a comment, a work log or an attachment since the last seal."
12. Same page, ISO "Identification & Record of Changes" row: "...are recorded with timestamps and Atlassian account IDs." -> "...are recorded with timestamps; LedgerSeal names people by a pseudonymous token that it links to the Atlassian account until the account is closed."
13. Same page, Part 11 table: add a row after 11.70: "<strong>&sect; 11.200 / 11.300 Electronic Signature Components and Controls</strong> | At least two distinct identification components at signing; controls for identification codes and passwords. | Not met: LedgerSeal does not re-authenticate the signer and does not perform two-component signing. Use your own controls if your predicate rules need Part 11 signatures." In the 11.70 row: "When the vendor signing key is configured, the attestation ..." -> "The attestation ...".
14. `product/jira-governance.html` price table and `product/jira-governance/faq.html` billing list: the suite now has per-app prices. LedgerSeal (owner decision 2026-11-06, same as DefinitionGuard): 1 to 10 users free; 11 to 100 $0.95; 101 to 250 $0.75; 251 to 1,000 $0.24 per user per month; above 1,000 custom. The table shows $1.50 / $1.20 / $0.90 for all apps today. Also remove "compliance review assistance" and "designated technical concierge" (suite README section 2 item 6).
15. `privacy.html`: add a LedgerSeal section (Partner Agreement 8.4(e)), for example: "LedgerSeal for Jira Cloud. Stores, in Atlassian Forge storage on your site: seal records, which name people by a pseudonymous token (a keyed hash of the Atlassian account id under a key only the app can read); one record per person who sealed, revoked or changed a sealed issue, linking the token to the Atlassian account id; the account id of the Jira admin who last saved the approver groups; and the issue content that was sealed (field values, comments, attachment names), as Jira holds it. No email address and no display name is stored. Every week LedgerSeal reports these account ids to Atlassian's personal data reporting API; when Atlassian reports an account as closed, LedgerSeal deletes the link from the token to the account and the admin id, so the records name no one. A deleted issue's records are deleted. Forge storage is deleted 28 days after the app is uninstalled; the `ledgerseal-cert` issue property, which holds no personal data, stays on the issues. LedgerSeal sends no data outside your Atlassian site."

## Shared files outside this branch's scope (changes needed)

- `docs/marketplace/suite-launch-and-first-sale-playbook.md` (F-21): line 3 "PlanShift" -> "CascadePlan"; line 114 `asymm-systems/ledgerseal-verifier` -> `asymmsystems/ledgerseal-verifier`; line 116 the dev key -> the production key `ls-prod-2026-11`; line 151 "status turn orange `CHANGED`" -> "the red `CHANGED` lozenge".
- `docs/launch/distribution-kit.md` line 33: "...verify signatures and hash chains independently without trusting us or Jira." -> "...check the evidence offline; a pass shows the evidence was not changed after export and was signed with the published key."; line 120 "meaning you don't have to rely on an app vendor during an audit" -> "so the check needs no access to the app".
- `docs/design/asymm-jira-ui-standard.md` line 360 and `docs/design/prompt-other-apps-ui-adoption.md` line 106 ask every app for an "Open Four Realities panel" button; LedgerSeal no longer has it (F-04). The standard should say: only when FourRealities is installed, and it must open that panel.
- `docs/marketplace/submission/developer-console-checklist.md`: Personal Data Reporting row, LedgerSeal: Ready (weekly report, scope declared, ADR-011); Real Screenshots: LedgerSeal Ready (1840 x 900).

## Owner commands

Run in `apps/ledgerseal`, on the owner's own machine. Never paste the private key anywhere else.

1. **Done 2026-11-06.** Make the production key (Ed25519, PKCS#8 DER, base64):
   ```bash
   umask 077
   openssl genpkey -algorithm ed25519 -out ls-prod-2026-11.key.pem
   openssl pkey -in ls-prod-2026-11.key.pem -outform DER | base64 -w0 > ls-prod-2026-11.key.b64
   openssl pkey -in ls-prod-2026-11.key.pem -pubout -out keys/ls-prod-2026-11.pub.pem
   ```
2. **Done 2026-11-06.** Set the Forge variables of the production environment:
   ```bash
   forge variables set -e production --encrypt LEDGERSEAL_SIGNING_KEY "$(cat ls-prod-2026-11.key.b64)"
   forge variables set -e production LEDGERSEAL_KEY_ID ls-prod-2026-11
   forge variables list -e production
   ```
3. Back up the key: store `ls-prod-2026-11.key.pem` in the company password manager (or an encrypted offline copy in two places), then `shred -u ls-prod-2026-11.key.pem ls-prod-2026-11.key.b64`. Without it, a restore of the key after a Forge variable loss is impossible; a new key id would then be needed.
4. Publish the public key: commit `apps/ledgerseal/keys/ls-prod-2026-11.pub.pem` and `tools/verifier/keys/ls-prod-2026-11.pub.pem`; add it to `keys/` and the key table of https://github.com/asymmsystems/ledgerseal-verifier, cut a release with `SHA256SUMS`, and list it on the open verifier page.
5. Rotation: make `ls-prod-YYYY-MM` the same way, set both variables, deploy, publish the new public key, keep the old public key published (old properties keep their old `keyId`; evidence is signed again at export with the current key).
6. Check after the production deploy (B7, owner): `forge deploy -e production` (it asks to approve the major version for `report:personal-data`), install on a test site from production after approval, seal one issue, export the evidence, run `node verify-evidence.mjs evidence.json keys/ls-prod-2026-11.pub.pem`: exit 0, and no "unsigned" line in `forge logs -e production`.
7. Delete probe issue LSP-5 on asymmsystems.atlassian.net (this account has no Delete issues permission in LSP).

## Left open, with the reason

- **B7 production deploy:** owner step (above).
- **F-06** (restricted comments shown to every viewer): plausible, needs a role-restricted comment test with a second user; not done.
- **F-12** (always-visible glance): a new module and screenshots; Medium, not small. Not done.
- **F-08 live:** the validator context on a development install has no licence object, so the licence message could not be seen live.
- **F-15:** evidence download: UI Kit has no file download; the JSON stays in a code block.
- **F-20** (granular property scope): optional; not done.
- **Weekly report live run:** not yet in the logs; check `forge logs -e development` after it runs (expected: "personal data report: N account(s) reported ..., M record(s) converted"). It will convert LSP-1, LSP-2, LSP-4 and DEMO-34 (old records) and rewrite their properties without the account id.

## Final gate (branch head)

`npx tsc --noEmit` 0 errors; `npm test`: 46 suites, 484 tests passed; coverage statements 97.88%, branches 94.26%, functions 96.61%, lines 98.67% (thresholds 90%); `npm run build` exit 0; `npm audit --omit=dev --audit-level=high` exit 0; `forge lint` "No issues found". Development version 4.2.0.

## Merge review follow-ups (branch `feature/ledgerseal-review-followups`, from `origin/master` `42e79fa`)

The review is `docs/sdlc/merge-reviews-2026-11/ledgerseal-merge-review.md` (probes in `/home/fahimfarookme/.cache/jira-suite-merge-review/ledgerseal/probes/`).

### M-1, M-2, L-2

- **Commit:** `f24ab2d`.
- **M-1:** a conversion journal means "not finished" for a seal or revoke as for the weekly job (`convertIfNeeded` checks `hasConversionJournal`). A record already committed (`parties: TOKEN`) with a journal is never written again from it: the conversion only deletes superseded snapshots and the journal (`finishCleanup`), so a revoke or seal made after the stop stays.
- **M-2:** `PartyRepository.register` adds an account not yet in the map only when Jira reports it active (`JiraClient.isActiveUser`: `GET /rest/api/3/user`, `active`; 404 counts as not active; unknown is not added now). Used for change authors in incidents and for actors found by a conversion. Seal and revoke callers are signed in.
- **L-2:** `deleteIssueRecords` deletes `ls3:convert:{issueId}`.
- **Proof:** `test/review-followups.test.ts` (7), built from probes R1 and R2 without master's code (`test/support/old-record.ts`). With the M-1 change reverted the two M-1 tests fail; with the M-2 filter removed three tests fail (the two M-2 incident tests and the conversion test; corrected after the follow-ups review, L-10); with both in place all pass.

### L-1, L-7. Open verifier 1.2.0

- **Commits:** public repository `67776e4` (pull request 2, CI green on Node 18.x, 20.x, 22.x, run 42196616081; `main` fast-forwarded); monorepo `6ac7045`.
- **What changed:** a fifth check: the attestation's status is the state of the newest entry that is not `LS_REDACTED`. Apache-2.0 header on `.github/workflows/test.yml`. Version 1.2.0; 12 tests. `tools/verifier` identical to the repository (`diff -r` empty). The app's evidence steps name the check; `test/evidence.test.ts` checks a changed and a revoked seal pass it.
- **Release:** https://github.com/asymmsystems/ledgerseal-verifier/releases/tag/v1.2.0, `SHA256SUMS`:
  - `e3d4d9c006b488d281caf92484172ed0c14746ffd190aae78bea4ad4ee574154  verify-evidence.mjs`
  - `5cc3656b4e87443b9850f49bc864650b99ce7af3fd2f6f2896dd70c793865457  vectors.json`
  - `272774088714fd2e158415976b849668772530986fcfc2aa2668c6e19c9cd271  LICENSE`
  - `c7618b74ecca80992ec2c7f1e6a37980cc4fb07da417ab36dfad6ee3ba72ab34  ls-dev-2026-11.pub.pem`

### M-4 (owner decision, option A), L-3, L-5

- **Commit:** `7cbda07`.
- **M-4:** listing, reviewer notes and `site/apps/ledgerseal/compliance-mapping.md` say 21 CFR 11.50 is partly met: "Each seal records the date, time and meaning of the signature. The signer's name is shown from their Atlassian account while it exists; after the account is closed, it is shown as a deleted user, so a printed name is not kept in the record." The panel's label for a closed account is now "a deleted user", as the wording says. `test/listing.test.ts` fails if 11.50 is claimed without "partly met".
- **L-3:** reviewer notes section 5 numbered 1, 2, 3 (tested).
- **L-5:** `site/apps/ledgerseal/admin-guide.md` says a comment typed on the screen of a gated transition blocks it as "Comment added".

### L-4. Screenshot 03

- 03 retaken on LSP-5 (my probe issue): its only change after the seal is a description, so the panel shows no test title. Script `apps/ledgerseal/test/live/shot_blocked.py LSP-5`.

### Deploy and live checks (development 4.3.0)

| Check | Result |
|---|---|
| Evidence of PAY-10 (sealed), PAY-13 (changed), LSP-3 (converted, resealed) with verifier 1.2.0 | 5 of 5 PASS each; status check SEAL_VALID, SEAL_BROKEN, SEAL_VALID; properties schema 3, signed, no account id |
| Gate on LSP-5 after its description change | "Transition failed: LedgerSeal: 1 field changed after approval (Description)..."; status stays Backlog; screenshot 03 retaken (1840 x 900) |
| M-1 and M-2 live | not run live: M-1 needs an invocation stopped between two writes, M-2 a closed Atlassian account; both are proven by the tests above |

### Live changes (follow-ups)

| When (UTC) | Where | Change | State now |
|---|---|---|---|
| 2026-11-06 | Forge development | deploy 4.3.0 | 4.3.0 |
| 2026-11-06 | LSP-5 (my probe issue) | description set to "Rotate the payment gateway API keys on Friday, then disable the old keys." (was empty); gated move to Done tried (blocked) | changed after its seal; still to be deleted by the owner (403 for this account) |

### Site changes needed (follow-ups; add to the list above)

16. `product/jira-governance/compliance.html`, Part 11 table, 11.50 row, third cell.
    - Old: "Every seal records and displays the approver, the time, and the meaning chosen by the approver (Approved, Reviewed or Verified)."
    - New: "Partly met. Each seal records the date, time and meaning of the signature. The signer's name is shown from their Atlassian account while it exists; after the account is closed, it is shown as a deleted user, so a printed name is not kept in the record."
17. `product/jira-governance/user-guide/ledgerseal.html`, workflow validator section, after "If LedgerSeal cannot check the issue, the validator blocks the transition (it fails closed).": add "If the gated transition has a screen with a comment box, a comment typed there is new content on a sealed issue, so the validator blocks the transition with \"Comment added\". Add the comment after the transition, or ask another approver to approve it first." (L-5)
18. `privacy.html`, the LedgerSeal section of item 15 (L-6): replace "seal records, which name people by a pseudonymous token (a keyed hash of the Atlassian account id under a key only the app can read)" with "seal records, which name every person they mention (signers, people who changed the issue, and people named in the sealed content such as the assignee, comment authors and mentions) by a pseudonymous token: a keyed hash of the Atlassian account id under a key only the app can read. A pseudonymous token is still personal data: the app can link it to the account id that Jira shows on the issue." and replace "the records name no one" with "the app no longer holds the account id, and the panel shows a deleted user".
19. `product/jira-governance/user-guide/open-verifier.html`: the verifier makes five checks (adds "attestation status matches the history"); link release v1.2.0 instead of v1.1.0.

### Final gate (follow-up branch head)

`npx tsc --noEmit` 0 errors; `npm test`: 47 suites, 497 tests passed; coverage statements 97.86%, branches 94.33%, functions 96.69%, lines 98.63%; `npm run build` exit 0; `npm audit --omit=dev --audit-level=high` exit 0; `forge lint` "No issues found"; `tools/verifier` 12 of 12. Development version 4.3.0.


## Second follow-ups (branch `feature/ledgerseal-review-followups-2`, from `origin/master` `47ad030`)

The review is `docs/sdlc/merge-reviews-2026-11/ledgerseal-followups-merge-review.md` (probe P1 in `/home/fahimfarookme/.cache/jira-suite-merge-review/ledgerseal-followups/probes/zz-probe-concurrent.test.ts`).

### M-5. Two conversions of one record never overlap

- **What changed (`src/service/conversion.ts`):**
  - Lease: a conversion journal younger than `CONVERSION_LEASE_MS` (10 minutes: the weekly function's 300 s limit plus a margin) belongs to a conversion that may still be running. Another conversion of the record returns BUSY instead of resuming it, so a seal or revoke at that moment answers CONFLICT and the user tries again. An older journal is a stopped run, resumed as before.
  - Re-check: just before its commit a conversion reads the record again and returns BUSY, writing nothing more, if the record changed or a row exists after the redaction row.
  - Residual: Forge KVS has no conditional write for plain keys (transaction checks apply to custom entities only), so the re-check and the commit are two calls. Correction (third follow-ups review, M-7): this lease did not close the window after a stop, because a resumed run did not claim it again and the journal's start time stayed old; two resumers could both run once the journal was 10 minutes old. Replaced by the lease key of M-7 below.
- **Proof:** `test/review-followups.test.ts`, describe "M-5" (2): P1 exactly (the weekly run paused inside its commit; the revoke answers CONFLICT, the weekly run commits, the retried revoke goes in, history SEAL, REDACT, REVOKE, a new seal works), and a stalled run past its lease that wakes after a revoke (BUSY, record revoked, a new seal works). Without the lease the P1 test fails; without the re-check the stalled-run test fails.

### L-8. An existing account is never shown as a deleted user

- **What changed:** on closure the map key becomes a closed mark `{ closed: true, closedAt }` (no account id) instead of being deleted. Registration skips a closed mark (M-2 holds without asking Jira) and marks an account closed when Jira answers 404 (`JiraClient.accountState`: active, inactive, gone, or null). An active, deactivated or unreadable account keeps its mapping; the weekly report erases it if Atlassian reports it closed. Display: "a deleted user" only for a closed mark; a token with no entry is "an unknown user" (signer, revoker, changer, history), and the evidence `parties` map leaves it out (null stays "closed").
- **Proof:** `test/review-followups.test.ts` (L-8 tests, 2), updated M-2 and report tests (the closed mark).

### L-9. Listing test

- `test/listing.test.ts` fails when a panel label speaks of "closed account" or "closed accounts", and reads `site/apps/ledgerseal/compliance-mapping.md` for the decided 11.50 wording. Setting the plural label back to "closed accounts" makes it fail.

### M-6. Launch article

- `docs/launch/approved-ticket-problem.md`: the seal record holds a pseudonymous party token and no name; the signature is the app's; separation of duties as built; the mapping header "How LedgerSeal Supports It"; 11.10(e) with the token and the vendor limit; 11.50 "Partly met" with the decided wording; 11.70 "your auditor decides"; 11.200 and 11.300 "Not met". A search of `docs/launch` and `docs/marketplace` for "satisf", "11.50" and "Account ID" finds no other LedgerSeal claim (lines 15 and 39 of the article describe the approvers and Jira).

### L-10

- The M-2 proof above now says three tests.

### Deploy and live checks (development 4.4.0)

- `forge deploy -e development`: the first attempt timed out at 300 s; the retry deployed 4.4.0 (branch head `39e3d66` code).

| Check | Result |
|---|---|
| Evidence of PAY-10 (sealed), PAY-13 (changed), LSP-3 (converted, resealed) with verifier 1.2.0 | 5 of 5 PASS each; properties schema 3, signed, no account id |
| PAY-13 panel | CHANGED; "Changed by: Fahim Farook" for the edits. Two rows say "unknown": the comments deleted when PAY-13 was restored, because Jira does not record who deletes a comment (not a token) |
| M-5, L-8 live | not run live: M-5 needs two invocations on one old record at the same moment, L-8 a deactivated or unreadable account; both proven by the tests above |

No live write in this round.

### Final gate (second follow-ups)

`npx tsc --noEmit` 0 errors; `npm test`: 47 suites, 501 tests passed; coverage statements 97.89%, branches 94.19%, functions 96.74%, lines 98.65%; `npm run build` exit 0; `npm audit --omit=dev --audit-level=high` exit 0; `forge lint` "No issues found". Development version 4.4.0.


## Third follow-ups (branch `feature/ledgerseal-review-followups-3`, from `origin/master` `a215c9b`)

The review is `docs/sdlc/merge-reviews-2026-11/ledgerseal-followups-2-merge-review.md` (probes Q1 to Q4 in `/home/fahimfarookme/.cache/jira-suite-merge-review/ledgerseal-followups-2/probes/zz-probe-m5.test.ts`).

### M-7, L-11. A lease claimed on every attempt; re-checks before each group of writes

- **What changed (`src/service/conversion.ts`):**
  - Lease key `ls3:convert-lease:{issueId}` = `{ holder, takenAt }`, claimed on every attempt, first or resumed (`takeLease`): created with FAIL_IF_EXISTS; an existing lease is taken over only when older than `CONVERSION_LEASE_MS` (10 minutes), and the taker reads it back to confirm it holds it. A run releases its lease when it ends; a run that throws keeps it until it expires, so a stopped run is resumed only after 10 minutes. A seal or revoke that meets a held lease answers CONFLICT.
  - Before writing the history rows, before writing the assignments, and before the commit, the run checks that it still holds the lease, that the record is unchanged, and that no row follows the redaction row; otherwise it returns BUSY and writes nothing more.
  - A deleted issue's lease key is deleted with it.
  - Residual: a lease takeover is a write and a read-back, not an atomic compare; two takers at the same moment after an expiry are told apart by the read-back, and each group of writes re-checks the holder. Plain KVS keys have no conditional write.
- **Proof:** `test/review-followups.test.ts`: Q1 (a stalled run whose lease was taken over never writes its old assignment back over a revoke; SEAL_REVOKED, history SEAL, REDACT, REVOKE), Q3 (two resumers after a stop: the seal answers CONFLICT while the weekly run commits, then goes in on retry), Q4 (the second resumer gets BUSY), Q2 (within the lease CONFLICT, after it the seal works), and the takeover read-back. With master's `conversion.ts` Q1, Q3 and Q4 fail; with only the re-check before the assignment writes removed, Q1 fails and shows the rollback itself (the ended assignment back to `thruDate: null`) (L-11).

### L-13. An inactive account is not mapped

- `PartyRepository.register`: an account not yet in the map that Jira answers inactive gets no mapping and no closed mark, because Jira may answer a closed account as inactive; it shows as "an unknown user". Active or unreadable accounts are mapped (L-8); gone (404) gets the closed mark. Not confirmed live what Jira answers for a closed account (no closed account on the development site). Tokens erased by 4.3.0 (key deleted before the closed mark existed) show "an unknown user"; development site only.

### M-8. Documents describe the closed mark

- ADR-011 decisions 4, 5 and 10 and its consequences (amended in place, dated): the closed mark, "a deleted user", "an unknown user", unknown tokens left out of `parties`, the inactive rule. Spec v3 item 12, the `PanelData` seal shape (`sealedByUnknown`) and the evidence API. Reviewer notes, the `report:personal-data` row and "Personal data". `test/listing.test.ts` fails if the notes say the key is deleted.

### L-12

- `docs/launch/approved-ticket-problem.md`: five checks and five `PASS` lines (adds the status check); "cryptographic immutability" replaced by "tamper evidence", with the 11.10(e) limit.
- `site/apps/ledgerseal/open-verifier.md`: five checks, the status line in the expected output, and a note that a Marketplace export names `ls-prod-2026-11` while the worked example uses the development key.

### Deploy and live check (development 4.5.0)

- `forge deploy -e development`: 4.5.0 (code of `3dde4a6`).
- PAY-10 evidence exported from the panel: 5 of 5 PASS with `tools/verifier` and the development key; property schema 3, signed, no account id.
- M-7, L-13 live: not run live (M-7 needs a stopped conversion and two invocations on one old record; L-13 a closed or inactive account); proven by the tests above. No live write in this round.

### Final gate (third follow-ups)

`npx tsc --noEmit` 0 errors; `npm test`: 47 suites, 506 tests passed; coverage statements 97.88%, branches 94.23%, functions 96.79%, lines 98.67%; `npm run build` exit 0; `npm audit --omit=dev --audit-level=high` exit 0; `forge lint` "No issues found". Development version 4.5.0.


## Fourth follow-ups (branch `feature/ledgerseal-review-followups-4`, from `origin/master` `c8be4c9`)

The review is `docs/sdlc/merge-reviews-2026-11/ledgerseal-followups-3-merge-review.md` (probes R1 to R3 in `/home/fahimfarookme/.cache/jira-suite-merge-review/ledgerseal-followups-3/probes/`). Production (2.0.0) was deployed by the main session from master `c8be4c9`; this branch deploys to development only.

### M-9. A run that read the record before its lease never writes an old record back

- **What changed (`src/service/conversion.ts`):** after claiming the lease, `convertRecord` reads the record and the journal again; if either changed, it releases the lease and starts over (at most three attempts, then BUSY). The invalid-record branch checks, before its writes, that the run still holds the lease and that the record is the one it read; otherwise BUSY and no write. `stillCurrent` now reads the record and the next row first and the lease last, just before the writes it guards.
- **Proof:** `test/review-followups.test.ts`, describe "M-9" (4): R1 (paused at its lease claim while a revoke converts and revokes: the late run gives ALREADY, the record stays SEAL_REVOKED with SEAL, REDACT, REVOKE, a later seal works), R2 (a revoke and a reseal while the late run waits are both kept), three restarts give BUSY, and the invalid branch writes nothing when the record changed. All four fail with master's `conversion.ts`.

### L-14. Each guard has a test that fails without it

| Guard removed | Test that fails (by its assertion, not a timeout) |
|---|---|
| re-read after the lease claim (M-9) | R1 |
| check before the invalid-branch writes (M-9) | "the invalid-record branch writes nothing ..." |
| lease holder check in `stillCurrent` | "at the re-check before the history rows: a lost lease means BUSY and no history write" |
| re-check before the history rows | the same test (the stalled run writes history rows after a takeover) |
| re-check before the final save | "at the re-check before the final save: a later revoke is never rolled back" (the record would go back to head 2, LS_SEALED) |
| re-check before the assignments (M-7) | Q1 (earlier round) |

- Residual, as before: each re-check and the write group after it are separate KVS calls. The final-save test shows the one write in flight when a lease is lost (an assignment) can still land; the record and the history keep the revoke.

### L-15

- `docs/launch/approved-ticket-problem.md`: check 4 says the verifier skips redaction entries; "(see the § 11.10e row)" matches the row label.
- `site/apps/ledgerseal/open-verifier.md`: exit code 0 says what a PASS means and what it does not, as the public verifier README says.
- **Site change needed (item 20):** `product/jira-governance/user-guide/open-verifier.html`, the exit-code text. Old: "All four verification stages passed. The evidence is authentic and untampered." (or the current five-stage text with the same sentence). New: "All five checks passed. The evidence file has not been changed since it was exported and signed, and it was signed with the private key that belongs to the public key you used. This does not show that nobody could have written a different, consistent record: Asymm Systems holds the signing key, and anyone who can rewrite the app's stored data, including the vendor, could write a new consistent chain."

### Deploy, live check and gate (fourth follow-ups)

- `forge deploy -e development`: 4.6.0 (code of `4b833ab`). Production not touched.
- PAY-10 evidence exported from the panel: 5 of 5 PASS with `tools/verifier` and the development key; property schema 3, signed, no account id. M-9 not run live (it needs a stalled conversion and another run in between); proven by the tests above. No live write.
- Gate: `npx tsc --noEmit` 0 errors; `npm test` 47 suites, 512 tests passed; coverage statements 97.99%, branches 94.42%, functions 96.8%, lines 98.68%; build, `npm audit --omit=dev --audit-level=high` and `forge lint` clean.

## Finish (branch `feature/ledgerseal-finish`, from `origin/master` `3c76131`, master `a1ab087` merged in)

Production runs 2.0.0 (deployed by the main session); this branch deploys to development only.

### M-10, L-16 (fourth follow-ups review, `docs/sdlc/merge-reviews-2026-11/ledgerseal-followups-4-merge-review.md`)

- **Commit:** `eba2778`.
- **M-10:** the re-read after the lease claim compares the whole record (`canonicalJson`), not only its hash: the invalid-record branch writes a new record with the same hash. The invalid branch checks before its writes, and again just before it writes the record, that it holds the lease, that the record is unchanged in full and that no row follows its head.
- **Proof (each fails when its guard is removed):** probe P1 as a test (a reseal that converts and claims its row while the late run waits is kept; later seals work); a row after the head stops the invalid branch; the journal compare (a journal written after the first read makes the run restart and resume it); the next-row check in `stillCurrent` (simulated directly: no app path writes that row while the lease is held); the attempt limit (three lease claims, two restarts; the old test title said "three restarts").

### L-17

- **Commit:** `ace581b`. `site/apps/ledgerseal/open-verifier.md`: exit code 1 means at least one check failed, the FAIL lines name which, and the reasons include a changed export, the wrong public key file, or a missing part.

### F-06. Restricted comments

- **Commit:** `9e00bd7`.
- **What changed:** the snapshot records the restricted comments it covers (`restrictedComments`, outside the hashed form). The panel shows a changed restricted comment's text only to a viewer whose own comment list (`GET /rest/api/3/issue/{id}/comment` as the user) contains it; otherwise "A restricted comment that you cannot see in Jira". A removed restricted comment is never shown; a removed comment of an older snapshot is hidden. The evidence export answers `RESTRICTED_EVIDENCE` to a viewer who cannot see every restricted comment of the seal.
- **Proof:** `test/restricted-comments.test.ts` (9). Without the panel masking 4 fail; without the export check 2 fail.
- **Live (development 5.1.0, LSP-5):** group-level comment visibility is turned off on the site, so the check used a role: the signed-in user was added to the LSP role Administrators, a comment restricted to that role was posted (id 10042), and the panel was read. Jira did not give the app the comment: no "Comment added" row. So a comment restricted to a role or group the app user is not in is not covered by the seal (a change to it is not detected) and is never shown or exported. The listing, notes, README and spec v3 say so. The comment was deleted and the user removed from the role again (checked: not a member after).

### F-20. Narrow issue-property scope

- **Commit:** `5a3afa2`. The manifest declares `write:issue.property:jira` instead of `write:jira-work`; the only Jira write is the `ledgerseal-cert` property. Reviewer notes, README and spec v3 updated; manifest and listing tests check the scope list.
- **Proof:** `forge lint` does not check scope coverage (with the write scope removed it still reports no error), so the proof is live: development 5.1.0 deployed with `--approve MAJOR_VERSION_RULE`, the install upgraded (`forge install --upgrade ... --confirm-scopes`, "Upgrade complete", version 5, Up-to-date). PAY-10 was revoked and sealed again: the property was rewritten (certificate `c02fb948...` to `4b877003...`, `issuedAt` 2026-11-06T13:56:15.931Z, signed), no "could not write" in the logs, and the evidence passes 5 of 5 checks.
- **Owner note:** the scope change is a major version: the next production deploy asks for `--approve MAJOR_VERSION_RULE`, and each site admin consents on upgrade.

### F-12. Always-visible seal state

- **Commit:** `e445058`. A `jira:issueContext` module "Approval seal" (`ledgerseal-context`, resource `src/frontend/context.tsx`): it shows the state lozenge and the status sentence, and says to open the Approval Seal panel for actions. It has no button. (Corrected after the finish review, L-20: like a panel load, its verify call records a new change it finds, as a history row and the property; it is not read-only.) `jira:issueGlance` is the older module that `jira:issueContext` replaces; neither supports a dynamic status in the collapsed row, so the state shows when the entry is expanded.
- **Proof:** `test/context-entry.test.ts` (3).
- **Live:** the entry "LedgerSeal, Approval seal" is in the details column of PAY-10 and LSP-5 (screenshots in the ignored `test/live/shots/`). Expanding it in the headless browser did not open its content, so the expanded view is proven by the tests only. The Marketplace screenshots show the panel, not the details column, so they are unchanged.

### Live changes (this round)

| When (UTC) | Where | Change | State now |
|---|---|---|---|
| 2026-11-06 | Forge development | deploys 5.0.0 and 5.1.0, install upgrade (scope change) | 5.1.0 |
| 13:55 | PAY-10 | revoked ("LedgerSeal live check: revoke and seal again (ADR-011 conversion)") and sealed again | sealed, as before |
| 14:0x | LSP | the signed-in user added to the project role Administrators, then removed | not a member, as before |
| 14:0x | LSP-5 | comment 10042 restricted to Administrators, then deleted | deleted |

### Site changes needed (add to the list above)

21. `product/jira-governance/user-guide/open-verifier.html`, exit code 1. New: "At least one check failed, and the FAIL lines name which. The evidence may have been changed after it was exported, or the public key file you gave is not the key that signed it, or a part of the evidence is missing."
22. `product/jira-governance/user-guide/ledgerseal.html`, covered content: add "Comments restricted to a project role or group are covered only when Jira lets the LedgerSeal app read them, that is when the app's user is in that role or group; otherwise a change to such a comment is not detected. A covered restricted comment's text is shown in the panel, and the evidence is exported, only to a user who can see the comment in Jira."
23. Same page, "Find the panel": add "Every issue shows an Approval seal entry in its details column with the seal state; expand it, or open the Approval Seal panel from the issue's app button to seal, approve or see details."
24. `privacy.html` LedgerSeal section: the app's Jira write scope is now the issue-property scope (`write:issue.property:jira`) if the page lists scopes.

### Final gate (finish)

`npx tsc --noEmit` 0 errors; `npm test`: 49 suites, 531 tests passed; coverage statements 98.06%, branches 94.15%, functions 96.97%, lines 98.71%; `npm run build` exit 0; `npm audit --omit=dev --audit-level=high` exit 0; `forge lint` "No issues found" (the scope change was approved at the development deploy). Development version 5.1.0.


## Finish review fixes (same branch; review `/home/fahimfarookme/.cache/jira-suite-merge-review/ledgerseal-finish/ledgerseal-finish-merge-review.md`)

### H-1. The evidence export follows the panel's rule

- **What changed (`evidenceFlow`):** the export always reads the live comments as the app. A sealed comment counts as restricted when it was restricted at the seal, or is restricted now, or (a snapshot made before F-06) has been removed since. The export goes only to a viewer whose own comment list contains every such comment; otherwise `RESTRICTED_EVIDENCE`. A failed read fails closed (`JIRA_UNREACHABLE`).
- **Consequence:** evidence of a seal made before F-06 that covers a since-deleted comment is not exported to anyone, because its visibility is unknown; sealing the issue again makes a snapshot that records it. Production 2.0.0 holds such seals.
- **Proof:** `test/restricted-comments.test.ts`: P3 (open at the seal, restricted later: refused to an outsider, exported to an insider) and P2 (a seal before F-06, its restricted comment deleted: refused, the text in neither panel nor export) both fail with `ledger.ts` of `a15694d`, as does the fail-closed test; a removed comment that was open at a seal after F-06 does not stop the export.

### L-18. A hidden comment row names no author and no time

- Decided: hide them. Jira hides a restricted comment entirely from a user outside its role or group, its author included, so the row says only "Comment added" (or edited, removed) with "A restricted comment that you cannot see in Jira", no "Changed by" and no time. Separation of duties is unchanged: it reads the author from Jira, not from the row. Test: "shows that a comment changed, but not who changed it or when" (fails with `a15694d`). Listing, notes, README and spec v3 say so.

### L-19, L-20

- Spec v3: the grader note names the granular scope. The context entry is described as having no button; its verify call records a new change like a panel load (code comment, test name, this log).

### L-21. Defensive guards (recorded, no new test)

- `conversion.ts` `heldAndUnchanged`: the first call before the invalid branch's writes, and the whole-record compare inside it (the lease and next-row parts and the second call have failing tests). Both are defensive only: without the first call the rows, assignments and content are rewritten with the same tokens and the run still ends BUSY before the record write; inside the lease no writer can change the record and keep its hash. Kept because they cost one read each and stop work early.

### Site changes needed (finish review)

25. `product/jira-governance/user-guide/ledgerseal.html` (replaces the text of item 22): "Comments restricted to a project role or group are covered only when Jira lets the LedgerSeal app read them, that is when the app's user is in that role or group; otherwise a change to such a comment is not detected. A covered comment that is restricted, at the seal or now, is shown in the panel only to a user who can see it in Jira; others see that a comment changed, without its text, author or time. The evidence is exported only to a user who can see every such comment. If LedgerSeal can no longer read a covered comment (it was deleted, or restricted since to a role or group the app's user is not in), the panel shows that comment's sealed text to no one, and for that seal: its evidence is not exported to anyone; approving the changes makes a new seal whose evidence can be exported."

### Deploy, live check and gate (finish review fixes)

- `forge deploy -e development`: 5.2.0 (code of `22cc3e1`). Production not touched.
- PAY-10 (no restricted comment): the evidence still exports from the panel and passes 5 of 5 checks; property schema 3, signed, no account id. H-1 itself needs a second user outside a role, so it is proven by the tests. No live write.
- Gate: `npx tsc --noEmit` 0 errors; `npm test` 49 suites, 536 tests passed; coverage statements 98.06%, branches 94.15%, functions 96.99%, lines 98.71%; build, `npm audit --omit=dev --audit-level=high` and `forge lint` clean.


## Finish review round 2 (H-2, L-22)

### H-2. A comment the app can no longer read is treated as restricted, for every seal

- **Decision (suite owner, 2026-11-06, option 1 of the round 2 report, fail closed):** a sealed comment missing from the app's own read may have been deleted, or restricted since to a role or group the app user is not in (Jira then does not return it to the app; seen live on LSP-5). LedgerSeal cannot tell which, so for every seal, new or made before F-06: the panel shows that comment's sealed text, author and time to no one, and the seal's evidence is refused to everyone (`RESTRICTED_EVIDENCE`). A readable restricted comment keeps the per-viewer rule.
- **Cost:** after a covered comment is deleted, the evidence of that seal cannot be exported any more, by anyone. Approving the changes makes a new seal whose evidence can be exported; its history keeps the earlier rows, but the old seal's snapshot is not exported again. The panel still shows that a comment was removed. Recorded in spec v3 section 4.4.
- **What changed:** `hiddenComments` hides every comment the app can no longer read; `evidenceFlow` refuses when any sealed comment is missing from the app's live read; the `RESTRICTED_EVIDENCE` message says so and how to get exportable evidence.
- **Proof:** probe P4 as a test (open at the seal, then restricted to a role the app is not in: no sealed text in the panel and no export, for an outsider and an insider) and "a sealed comment the app can no longer read stops the export for everyone" (then an approval of the changes exports again); both fail with `ledger.ts` of `0ec66bc`. Two older tests changed to the decision: the change list shows a removed comment without its sealed text, and a removed open comment now stops the export.

### L-22

- The listing, reviewer notes, README and site item 25 now say: "its evidence is not exported to anyone; approving the changes makes a new seal whose evidence can be exported", not "seal the issue again to export its evidence".
