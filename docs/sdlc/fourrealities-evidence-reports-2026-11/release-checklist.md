<!--
Copyright (c) 2026 Asymm Systems. All rights reserved.

@author Fahim Farook
-->
# FourRealities evidence reports: production release checklist

For the release of ADR-015 from `master` (PR #1 merged as `29265b5`, plus the release branch `feature/fourrealities-evidence-reports-release` once it is merged). Do the steps in this order. Each step names who does it and how to check it. Nothing here has been done in production yet.

Paths: `REPO` is a fresh clone of `asymmsystems/jira-governance-code-system` at the merged `master` (for example `~/Documents/projects/jira-governance/repository/tmp/prod-deploy`); `SECRETS` is `~/Documents/projects/jira-governance/.tmp/secrets/fourrealities-report-keys` (mode 700, files mode 600).

## 1. Owner: Firefox download check (development)

- On asymmsystems.atlassian.net, development app 7.11.0 or later: project PAY, Apps, Four Realities, tab "Evidence reports". Make a report for the last 30 days; when it is Ready, choose Download and save each of the four files in **Firefox**.
- Pass: every file is saved under the name on its card (for example `fourrealities-PAY-2026-10-09-2026-11-07-1a2b3c4d.json`), and `node tools/verifier/verify-fourrealities-report.mjs <manifest> <report.json> <report.csv>` passes (with the development-key WARN).
- If Firefox saves nothing: stop. The Custom UI fallback of HLD 4.2 (about 4 days) needs an owner decision.

## 2. Set the production Forge variables (signing key)

The key pair `fr-prod-2026-11` was made on 2026-11-08 (public key `apps/fourrealities/keys/fr-prod-2026-11.pub.pem`; SHA-256 of the DER public key `07b6b5e5749e282627a112d99dac364e199b4a355913e1b820145221cca30419`). Run from `REPO/apps/fourrealities`, logged in to Forge as the app's owner:

```sh
cd "$REPO/apps/fourrealities"
forge variables set -e production --encrypt FOURREALITIES_SIGNING_KEY "$(cat "$SECRETS/fr-prod-2026-11.pkcs8.der.b64")"
forge variables set -e production FOURREALITIES_KEY_ID fr-prod-2026-11
forge variables list -e production
```

Check: the list shows `FOURREALITIES_KEY_ID  fr-prod-2026-11` and `FOURREALITIES_SIGNING_KEY  ****` (encrypted). The private key is never printed, logged or committed. Without these variables production makes no report and the tab says why (spec v4 N-7, R3-5).

## 3. Production deploy (major version)

```sh
cd "$REPO/apps/fourrealities"
npm ci --prefix ../../packages/asymm-jira-ui && npm ci
npx tsc --noEmit && npm test && npm run build
npx --yes @forge/cli@15.0.0 lint
forge deploy -e production --non-interactive --approve MAJOR_VERSION_RULE
forge eligibility -e production
```

- The `objectStore` module makes this a major version: existing installations stay on the old version until each site administrator accepts the update (Manage apps). No new scope.
- Check: the deploy names the new major version; `forge eligibility -e production` says "eligible for the Runs on Atlassian program".

## 4. Verifier 1.4.0 in the public repository

Copy into `asymmsystems/jira-governance-code-cli` (local `~/Documents/projects/jira-governance/repository/code/jira-governance-code-cli`), on a feature branch, then review and merge by the owner's push rules:

- `tools/verifier/verify-fourrealities-report.mjs` (new)
- `tools/verifier/test/verify-fourrealities-report.test.mjs` (new)
- `tools/verifier/keys/fr-prod-2026-11.pub.pem` and `tools/verifier/keys/fr-dev-2026-11.pub.pem` (new)
- `tools/verifier/README.md` and `tools/verifier/package.json` (version 1.4.0)

```sh
CLI=~/Documents/projects/jira-governance/repository/code/jira-governance-code-cli
git -C "$CLI" switch -c feature/fourrealities-report-verifier origin/main
cp "$REPO"/tools/verifier/verify-fourrealities-report.mjs "$CLI"/
cp "$REPO"/tools/verifier/test/verify-fourrealities-report.test.mjs "$CLI"/test/
cp "$REPO"/tools/verifier/keys/fr-prod-2026-11.pub.pem "$REPO"/tools/verifier/keys/fr-dev-2026-11.pub.pem "$CLI"/keys/
cp "$REPO"/tools/verifier/README.md "$REPO"/tools/verifier/package.json "$CLI"/
(cd "$CLI" && npm test)
```

After the merge: tag `v1.4.0`, make the release with a flat `SHA256SUMS` (as v1.0.0 to v1.3.0), and check `sha256sum -c SHA256SUMS`.

## 5. Site pages (asymm.systems, `asymm-corporate-code-pfw`)

Apply the items of `progress-log.md`, section "Site items", as corrected on 2026-11-08 (retention and content texts of review round 5, and the signing-keys rows with both fingerprints): the user guide section 7 and the section 5 changes; the privacy policy FourRealities items; the signing keys page; the open verifier page (verifier 1.4.0 download and checksums). Release the site by its usual flow and check the pages live.

## 6. Listing copy

When step 3 is live: apply `docs/marketplace/fourrealities-listing.md`, section "Release copy: evidence reports (ADR-015)" (capability row, boundary sentence, storage and personal data bullets, description line, release note) to the Marketplace listing. Never "audit log", "tamper-proof", "tamper-evident" or "compliant" for the reports. `apps/fourrealities/test/listing.test.ts` checks the wording in the file.

## 7. Security questionnaire update

Apply `docs/marketplace/submission/fourrealities-security-questionnaires.md`, section 5 (questions 3, 6, 7, 8, 9, 19 and the retention row) and `fourrealities-submission-notes.md`, section 6, in the Developer Console. No scope change.

## 8. Smoke test on the production site

On a production installation that has accepted the major version (the owner's site, or a test site with the production app):

1. The tab "Evidence reports" opens and shows "Signed with fr-prod-2026-11"; no "No reports can be made" message.
2. A project administrator makes a report for the last 7 days; it goes from Queued to Ready without a reload.
3. Download the four files; run `node verify-fourrealities-report.mjs <manifest> <report.json> <report.csv>` with verifier 1.4.0: every check passes, with **no** development-key WARN, and the NOTE line names the period with both days included.
4. A viewer with Browse projects only sees the list but no "New evidence report"; a viewer who cannot see one issue of the report gets "You cannot see 1 of the N issues ...".
5. `forge logs -e production` shows `report download URLs` lines with counts only, and no error lines of the report functions.
6. Next day: the `report daily run` log line appears (counts only).
