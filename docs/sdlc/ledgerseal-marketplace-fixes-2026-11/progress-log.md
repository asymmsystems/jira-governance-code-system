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

1. Make the production key (Ed25519, PKCS#8 DER, base64):
   ```bash
   umask 077
   openssl genpkey -algorithm ed25519 -out ls-prod-2026-11.key.pem
   openssl pkey -in ls-prod-2026-11.key.pem -outform DER | base64 -w0 > ls-prod-2026-11.key.b64
   openssl pkey -in ls-prod-2026-11.key.pem -pubout -out keys/ls-prod-2026-11.pub.pem
   ```
2. Set the Forge variables of the production environment:
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
