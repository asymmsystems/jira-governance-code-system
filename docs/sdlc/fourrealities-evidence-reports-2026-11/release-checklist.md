<!--
Copyright (c) 2026 Asymm Systems. All rights reserved.

@author Fahim Farook
-->
# FourRealities evidence reports: production release checklist

For the release of ADR-015 from `master` (PR #1 merged as `29265b5`, plus the release branch `feature/fourrealities-evidence-reports-release` once it is merged). Do the steps in this order. Each step names who does it and how to check it. Step 1 is done; nothing else has been done in production yet.

Paths: `REPO` is a fresh clone of `asymmsystems/jira-governance-code-system` at the merged `master` (for example `~/Documents/projects/jira-governance/repository/tmp/prod-deploy`); `SECRETS` is `~/Documents/projects/jira-governance/.tmp/secrets/fourrealities-report-keys` (mode 700, files mode 600).

## 1. Owner: Firefox download check (development): DONE 2026-11-08

- On asymmsystems.atlassian.net, development app 7.11.0: project PAY, Apps, Four Realities, tab "Evidence reports"; a report made, then downloaded in **Firefox**.
- Result (owner, 2026-11-08): **passed**. The four files saved in Firefox are byte-identical to the files saved in Chrome, and `verify-fourrealities-report.mjs` passes on them. The Custom UI fallback of HLD 4.2 is not needed.

## 2. Set the production Forge variables (signing key)

The key pair `fr-prod-2026-11` was made on 2026-11-08. Its public key is `apps/fourrealities/keys/fr-prod-2026-11.pub.pem`, and the SHA-256 of the DER public key is `07b6b5e5749e282627a112d99dac364e199b4a355913e1b820145221cca30419`. Log in to Forge as the app's owner.

### 2a. Prove that the private key belongs to the published public key

Do this before you set the variable. The commands print only fingerprints, never the key.

```sh
SECRETS=~/Documents/projects/jira-governance/.tmp/secrets/fourrealities-report-keys
cd "$REPO/apps/fourrealities"
DERIVED=$(base64 -d "$SECRETS/fr-prod-2026-11.pkcs8.der.b64" | openssl pkey -inform DER -pubout -outform DER | sha256sum | cut -d' ' -f1)
PUBLISHED=$(openssl pkey -pubin -in keys/fr-prod-2026-11.pub.pem -outform DER | sha256sum | cut -d' ' -f1)
VERIFIER=$(openssl pkey -pubin -in ../../tools/verifier/keys/fr-prod-2026-11.pub.pem -outform DER | sha256sum | cut -d' ' -f1)
echo "$DERIVED"; echo "$PUBLISHED"; echo "$VERIFIER"
[ "$DERIVED" = 07b6b5e5749e282627a112d99dac364e199b4a355913e1b820145221cca30419 ] && [ "$DERIVED" = "$PUBLISHED" ] && [ "$DERIVED" = "$VERIFIER" ] && echo KEY_MATCHES || echo STOP
```

Pass: three equal lines, `07b6b5e5...30419`, then `KEY_MATCHES`. If the output is `STOP`, do not set the variable. The app checks this again when it runs (release review REL-3). If the configured key's public half is not the bundled public key of its id, the app makes no report, gives `NO_SIGNING_KEY`, and the tab says why.

### 2b. Set the variables, with the key value kept off the command line

How `forge variables set` takes the value (checked in the `@forge/cli` 15.0.0 source, `register-environment-variables-commands.js` and `cli-shared` `command-line-ui.js`):
- It does **not** read the value from standard input. When stdin is not a terminal, it opens `/dev/tty` for its prompt, so a pipe (`... | forge variables set`) does not work.
- When `[value]` is left out and `--encrypt` is given, it asks "Enter the variable value:" in a masked password prompt. The value then never appears on a command line.

Safest form (recommended). Leave out the value, and paste it into the masked prompt.

```sh
cd "$REPO/apps/fourrealities"
forge variables set -e production --encrypt FOURREALITIES_SIGNING_KEY
#   at "Enter the variable value:", paste the one line of $SECRETS/fr-prod-2026-11.pkcs8.der.b64
#   (for example, open the file in a local editor and copy the line; clear the clipboard after the paste)
forge variables set -e production FOURREALITIES_KEY_ID fr-prod-2026-11
forge variables list -e production
```

Only if the prompt cannot be used, use the command-line form:

```sh
forge variables set -e production --encrypt FOURREALITIES_SIGNING_KEY "$(cat "$SECRETS/fr-prod-2026-11.pkcs8.der.b64")"
```

With this form, the value is in the process arguments for the length of the call, so another local user could see it with `ps`. Use it only on a single-user workstation, and never in a shared shell or CI.

Check: the list shows `FOURREALITIES_KEY_ID  fr-prod-2026-11` and `FOURREALITIES_SIGNING_KEY` as encrypted (the value is not shown). The private key is never printed, logged or committed. Without these variables, production makes no report, and the tab says why (spec v4 N-7, R3-5). Forge applies variables at the next deploy, so step 3 must follow.

## 3. Production deploy (major version)

### 3a. Record what is in production now (for the rollback)

```sh
cd "$REPO/apps/fourrealities"
forge deploy list -e production > ../../../fr-prod-before.txt
forge version list -e production >> ../../../fr-prod-before.txt
```

- Write down the newest production deployment (its version) and the `master` SHA that it was built from. Take the SHA from the earlier release record. If none exists, take it from the tag or log of that release.
- Keep `fr-prod-before.txt` with the release notes.

### 3b. Build from the merged master and record its SHA

```sh
git -C "$REPO" fetch origin
git -C "$REPO" switch --detach origin/master
git -C "$REPO" rev-parse HEAD            # record this: the deployed master SHA
cd "$REPO/apps/fourrealities"
npm ci --prefix ../../packages/asymm-jira-ui && npm ci
npx tsc --noEmit && npm test && npm run build
npx --yes @forge/cli@15.0.0 lint
```

Record the SHA of `git rev-parse HEAD` in the progress log, section "Production release", with the date and the Forge version from 3c.

### 3c. Deploy

```sh
forge deploy -e production --non-interactive --approve MAJOR_VERSION_RULE
forge eligibility -e production
```

- The `objectStore` module makes this a major version. Existing installations stay on the old version until each site administrator accepts the update (Manage apps). There is no new scope.
- Check: the deploy output names the new major version, and `forge eligibility -e production` says "eligible for the Runs on Atlassian program".
- **If `--approve MAJOR_VERSION_RULE` is refused** (for example, the rule id is unknown or the CLI still asks): no production deploy has proved this rule id yet. Run `forge deploy -e production` without `--non-interactive` and `--approve`. Read the prompt; it names the rule. Answer yes only if it is about the major version (the new `objectStore` module), and stop on any other rule.

### 3d. Rollback (if the deploy or the smoke test of step 8 fails)

- The Forge CLI 15.0.0 has no rollback command (`forge --help` lists none). A rollback is a new deploy of the earlier code.
- Sites that have not accepted the major version stay on the previous version, so they need nothing.
- To take production back to the earlier code:

  ```sh
  git -C "$REPO" switch --detach <previous production master SHA from 3a>
  cd "$REPO/apps/fourrealities" && npm ci --prefix ../../packages/asymm-jira-ui && npm ci && npm run build
  forge deploy -e production
  ```

  This makes a new version: Forge never moves an installation back to an older version. Forge decides whether removing the `objectStore` module is a major change; this has not been tried. If it is major, administrators who accepted the evidence reports version must accept the update again. Read the deploy output, and stop if it asks to approve a rule other than the major version.
- Leave the Forge variables set. They do nothing in the earlier code, and they are needed for the next attempt. Do not delete report files or KVS records.
- If only a part fails (for example, the verifier release of step 4), fix forward instead. The app works without the public verifier copy.
- Record what failed and the SHA that runs now in the progress log.

## 4. Verifier 1.4.0 in the public repository

Copy into `asymmsystems/jira-governance-code-cli` (local `~/Documents/projects/jira-governance/repository/code/jira-governance-code-cli`), on a feature branch. The owner reviews and merges it, following his push rules. The source is `REPO/tools/verifier`. Its `verify-evidence.mjs`, `SECURITY.md`, `LICENSE`, `vectors.json` and `test/fixtures` are already the same as in the public repository's `main` (checked on 2026-11-08).

- `verify-fourrealities-report.mjs` (new)
- `test/verify-fourrealities-report.test.mjs` (new)
- `keys/fr-prod-2026-11.pub.pem` and `keys/fr-dev-2026-11.pub.pem` (new)
- `README.md` and `package.json` (version 1.4.0)

```sh
CLI=~/Documents/projects/jira-governance/repository/code/jira-governance-code-cli
git -C "$CLI" fetch origin
git -C "$CLI" switch -c feature/fourrealities-report-verifier origin/main
cp "$REPO"/tools/verifier/verify-fourrealities-report.mjs "$CLI"/
cp "$REPO"/tools/verifier/test/verify-fourrealities-report.test.mjs "$CLI"/test/
cp "$REPO"/tools/verifier/keys/fr-prod-2026-11.pub.pem "$REPO"/tools/verifier/keys/fr-dev-2026-11.pub.pem "$CLI"/keys/
cp "$REPO"/tools/verifier/README.md "$REPO"/tools/verifier/package.json "$CLI"/
diff -r --exclude=.git --exclude=.github --exclude=node_modules "$REPO"/tools/verifier "$CLI"   # expect no output
(cd "$CLI" && npm test)
```

After the merge, tag and release with flat assets, as for v1.3.0 (its assets: `LICENSE`, the key files, `SHA256SUMS`, `vectors.json`, `verify-evidence.mjs`):

```sh
git -C "$CLI" fetch origin && git -C "$CLI" switch --detach origin/main
git -C "$CLI" tag -a v1.4.0 -m "Verifier 1.4.0: FourRealities evidence reports" && git -C "$CLI" push origin v1.4.0
OUT=$(mktemp -d) && cd "$CLI"
cp verify-evidence.mjs verify-fourrealities-report.mjs vectors.json LICENSE keys/*.pub.pem "$OUT"/
cd "$OUT" && sha256sum LICENSE vectors.json verify-evidence.mjs verify-fourrealities-report.mjs *.pub.pem > SHA256SUMS
sha256sum -c SHA256SUMS                                   # every line: OK
gh release create v1.4.0 --repo asymmsystems/jira-governance-code-cli --title "v1.4.0" --notes "Adds verify-fourrealities-report.mjs and the fr-prod-2026-11 and fr-dev-2026-11 keys." LICENSE vectors.json verify-evidence.mjs verify-fourrealities-report.mjs *.pub.pem SHA256SUMS
mkdir "$OUT/check" && cd "$OUT/check" && gh release download v1.4.0 --repo asymmsystems/jira-governance-code-cli && sha256sum -c SHA256SUMS
```

Check: the downloaded release passes `sha256sum -c SHA256SUMS` for every file, and `sha256sum fr-prod-2026-11.pub.pem` matches the repository file.

## 5. Site pages (asymm.systems, `asymm-corporate-code-pfw`)

Apply the items in `progress-log.md`, section "Site items", as corrected on 2026-11-08: the retention and content texts of review round 5 and release review REL-1 and REL-2, and the signing-keys rows with both fingerprints. That means:
- the user guide section 7 and the section 5 changes;
- the privacy policy items for FourRealities;
- the signing keys page;
- the open verifier page (the verifier 1.4.0 download and its checksums from step 4).

Release the site by its usual flow, then check the pages live.

## 6. Listing copy

When step 3 is live, apply `docs/marketplace/fourrealities-listing.md`, section "Release copy: evidence reports (ADR-015)", to the Marketplace listing: the capability row, the boundary sentence, the storage and personal data bullets, the description line and the release note.
- Never use "audit log", "tamper-proof", "tamper-evident" or "compliant" for the reports.
- `apps/fourrealities/test/listing.test.ts` checks the wording in the file.

## 7. Security questionnaire update

In the Developer Console, apply:
- `docs/marketplace/submission/fourrealities-security-questionnaires.md`, section 5: questions 3, 6, 7, 8, 9 and 19, and the retention row;
- `fourrealities-submission-notes.md`, section 6.

There is no scope change.

## 8. Smoke test on the production site

Use a production installation that has accepted the major version (the owner's site, or a test site with the production app).

1. The tab "Evidence reports" opens and shows "Signed with fr-prod-2026-11.", with no "No reports can be made on this site" message.
2. A project administrator makes a report for the last 7 days. It goes from Queued to Ready without a reload.
3. Download the four files. Run `node verify-fourrealities-report.mjs <manifest> <report.json> <report.csv>` with verifier 1.4.0. Pass: every check passes, there is **no** development-key WARN, and the NOTE line names the period with both days included.
4. A viewer with Browse projects only sees the list, but no "New evidence report". A viewer who cannot see one issue of the report gets "You cannot see 1 of the N issues ...".
5. `forge logs -e production` shows `report download URLs` lines with counts only, and no error lines from the report functions.
6. Next day: the `report daily run` log line appears (counts only).

If a check fails, go to 3d.
