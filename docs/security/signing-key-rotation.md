# Signing key rotation runbook

How to replace the Ed25519 signing key of LedgerSeal or DefinitionGuard. The company security policy (https://asymm.systems/security, section 4) states the rules; this runbook is how we keep them.

## 1. What is rotated

| App | Signs | Forge variables | Private key format in the variable | Read by |
|---|---|---|---|---|
| LedgerSeal | the `ledgerseal-cert` issue property and the exported evidence | `LEDGERSEAL_SIGNING_KEY` (encrypted), `LEDGERSEAL_KEY_ID` | base64 of the PKCS#8 DER private key (`apps/ledgerseal/src/domain/attestation.ts`, `createSigner`) | `signerFromEnvironment` in the same file |
| DefinitionGuard | the `definitionguard-dod` issue property | `DG_SIGNING_KEY` (encrypted), `DG_SIGNING_KEY_ID` | base64 of the PKCS#8 PEM private key (`apps/definitionguard/src/integrity/attestation.ts`) | `signIfConfigured` in the same file |

Each signed record names its key in the field `keyId`. A key id has the form `<ls|dg>-<prod|dev>-<YYYY-MM>`, for example `ls-prod-2026-12`. A key id names one key for ever: never reuse one.

Who checks the signatures:

- **FourRealities** checks LedgerSeal and DefinitionGuard records against its trust list, `apps/fourrealities/src/accessor/attestation-keys.ts` (ADR-012). Production trusts only the keys listed with `environments: ['PRODUCTION']`. A record with a key id that is not in the list counts like no record (`UNKNOWN_KEY`).
- **The open verifier** (public repository `asymmsystems/ledgerseal-verifier`, copy in `tools/verifier`) checks LedgerSeal evidence. Without a key argument it reads `keys/<keyId>.pub.pem`.
- **Customers and auditors** take the public keys from https://asymm.systems/product/jira-governance/signing-keys.html.

## 2. Who and when

- **Who:** Fahim Farook, who owns the Forge apps and their production environments, runs every step. Each repository change goes through a branch and an independent review before merge, as for any other change.
- **Scheduled:** every 12 months for each production key. The first scheduled rotation is in December 2026, for `ls-prod-2026-11` and `dg-prod-2026-11`.
- **At once:** when we suspect that a private key is exposed. Follow section 4 as well.
- **Development keys** (`ls-dev-*`, `dg-dev-*`) follow the same steps with `development` in place of `production`, and are trusted in FourRealities with `environments: ['DEVELOPMENT', 'STAGING']`.

Rotate one app at a time, or both in one pass; the order of the steps below is the same.

## 3. Steps

Do the steps in this order. Step 3 must be complete before step 4: if a producer signs with a key that the deployed FourRealities does not trust, every new record from that producer counts like no record in production.

### Step 1. Generate the new key

From a clean checkout of this repository:

```sh
tools/rotate-signing-key.sh ledgerseal production ls-prod-2026-12
tools/rotate-signing-key.sh definitionguard production dg-prod-2026-12
```

The script writes the key pair to a new temporary directory with mode 700, prints the public key, its SHA-256 fingerprint (of the DER public key) and the `forge variables` commands for step 4. It does not run them. It never prints the private key and refuses a key id that this repository already uses. Test it first with `--dry-run`, which deletes its output when it exits.

Write down the key id, the fingerprint and the path of the temporary directory. If you must stop before step 4, store the private key in the password manager now (step 8), shred the directory, and at step 4 take the key from the password manager.

### Step 2. Publish the public key everywhere

Add the new key; change no existing key. On a branch `feature/<app>-key-<key id>`:

1. **FourRealities trust list.** Add an entry to `TRUSTED_KEYS` in `apps/fourrealities/src/accessor/attestation-keys.ts` with the producer, the new key id, `environments: ['PRODUCTION']`, the PEM text exactly as the script printed it (with the final newline), and a comment with the file path, the publication date and the fingerprint. Keep the old entry. In `apps/fourrealities/test/accessor-attestation-verifier.test.ts`, add the new key id to the file map of "bundles the same public keys as the published key files" and to the production key list of "trusts exactly the ... production keys in production".
2. **Key files in this repository.**
   - LedgerSeal: `apps/ledgerseal/keys/<key id>.pub.pem` and `tools/verifier/keys/<key id>.pub.pem`, and a row in the table of `apps/ledgerseal/keys/README.md`.
   - DefinitionGuard: `docs/marketplace/definitionguard-public-key-<key id>.pem`.
3. **Documents that name the current production key.** Find them with `git grep -n '<old key id>'` and update each one that names the key in use: at least `site/apps/ledgerseal/open-verifier.md`, `site/apps/fourrealities/admin-guide.md`, `apps/ledgerseal/README.md` and `tools/verifier/README.md`. Records of past work (progress logs, merge reviews) stay as they are.
4. **Verifier repository** `asymmsystems/ledgerseal-verifier` (LedgerSeal only). Add `keys/<key id>.pub.pem`, bump the minor version in `package.json`, merge to `main`, tag `vX.Y.0`, and publish a GitHub release with the same assets as v1.3.0: every `keys/*.pub.pem`, `verify-evidence.mjs`, `vectors.json`, `SHA256SUMS` and `LICENSE`. Then make `tools/verifier` in this repository equal to the tag: `diff -r --exclude=.git <verifier clone> tools/verifier` prints nothing.
5. **Website** (repository `asymm-corporate`, page `src/main/jbake/content/product/jira-governance/signing-keys.html`): add the new key with its key id, fingerprint and PEM text in the production section, and point the verifier links to the new release. Move the old key to a "Retired production keys" part of the page with the date it stopped signing (the date of step 5). Publish the site.
6. Check that every published copy is the same key: `openssl pkey -pubin -in <file> -outform DER | sha256sum` gives the fingerprint from step 1 for each file, and the PEM text on the website and in `attestation-keys.ts` equals the file.

Merge to `master` after review, when Apps CI passes.

### Step 3. Deploy FourRealities with the new trust entry

From `apps/fourrealities` on the merged `master`:

```sh
forge deploy -e production
```

Check that the deploy finished, and that a production issue with an existing LedgerSeal or DefinitionGuard record still shows the record as verified (the old key is still trusted). Do not go on until this is true.

### Step 4. Set the Forge production variables

From `apps/ledgerseal` (or `apps/definitionguard`), run the two commands that step 1 printed. They have this form:

```sh
# LedgerSeal
forge variables set -e production --encrypt LEDGERSEAL_SIGNING_KEY "$(openssl pkey -in '<dir>/<key id>.key.pem' -outform DER | openssl base64 -A)"
forge variables set -e production LEDGERSEAL_KEY_ID <key id>

# DefinitionGuard
forge variables set -e production --encrypt DG_SIGNING_KEY "$(openssl base64 -A -in '<dir>/<key id>.key.pem')"
forge variables set -e production DG_SIGNING_KEY_ID <key id>
```

The private key must always be set with `--encrypt`. Check with `forge variables list -e production`: the key id variable shows the new key id, and the key variable is shown as encrypted, with no value.

### Step 5. Deploy

Forge apps read changed variables after a deploy. From `apps/ledgerseal` (or `apps/definitionguard`):

```sh
forge deploy -e production
```

Deploy the commit that is already in production when you can, so the deploy changes only the key. If `master` holds other changes for the app, they ship too: review them before you deploy.

### Step 6. Verify new evidence

- **LedgerSeal.** On an Asymm Systems test site with the production app installed, seal a test issue, open the seal details, click **Show evidence (JSON)** and save it as `evidence.json`. From the new verifier release, run `node verify-evidence.mjs evidence.json`. All five check lines must start with `PASS`, the signature line must name the new key id, and the exit code must be `0`. Then export the evidence of an issue sealed before the rotation and verify it the same way: export signs again with the current key, so it must also pass and name the new key id. An evidence file saved before the rotation keeps the old key id and must still pass with the old key.
- **DefinitionGuard.** Change a checklist item on a test issue, then read the `definitionguard-dod` issue property (`GET /rest/api/3/issue/<issue key>/properties/definitionguard-dod`). Its `keyId` must be the new key id and `sig` must not be null.
- **FourRealities.** On the same test site, the issue panel must show the new LedgerSeal and DefinitionGuard records as verified.

If a check fails, set the old key id and old private key back (step 4 with the old values, then step 5) and find the cause before you try again. The old key is still trusted everywhere, so this is safe.

### Step 7. Keep the old public key published

Do not remove the old key from any place. Records already on issues stay signed with the old key until the app writes them again, and customers keep evidence that names it.

- FourRealities keeps the old entry in `TRUSTED_KEYS`.
- The verifier keeps `keys/<old key id>.pub.pem` in every later release.
- This repository keeps the old key files.
- The website lists the old key under the retired keys, with the date it stopped signing.

The one exception is an exposed key: see section 4.

### Step 8. Store the private key and delete local copies

1. Store the new private key (the PEM file from step 1) in the password manager, in an entry named by the key id, with the fingerprint and the date in the notes. The password manager is the only place that keeps it, apart from the encrypted Forge variable.
2. Delete every local copy with `shred`. For the script's directory, run the command it printed: `shred -u '<dir>'/* && rmdir '<dir>'`. Do the same for any other copy you made.
3. Record the rotation in section 5 of this runbook.

## 4. Suspected exposure

Do steps 1 to 8 at once, and also:

1. Treat it as a security incident under the security policy (https://asymm.systems/security, section 6): contain, assess, notify affected customers and Atlassian, fix, review.
2. Decide, and record the decision, whether FourRealities still trusts the exposed key. If it does not, remove its entry from `TRUSTED_KEYS` and deploy FourRealities: every record signed with that key then counts like no record in production until the producer writes the record again with the new key.
3. Keep the exposed public key published, so that old evidence can still be checked, but mark it on the website as exposed, with the date from which records signed with it must not be trusted.

## 5. Rotation log

| Key id | App and environment | Published | Stopped signing | Reason |
|---|---|---|---|---|
| `ls-prod-2026-11` | LedgerSeal, production | 2026-11-06 | | |
| `dg-prod-2026-11` | DefinitionGuard, production | 2026-11-06 | | |
