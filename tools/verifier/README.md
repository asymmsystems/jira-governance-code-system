# LedgerSeal and FourRealities offline verifiers

An offline checker for the approval evidence that LedgerSeal for Jira Cloud exports. It is one file, `verify-evidence.mjs`, of about 135 lines, and uses only the Node.js standard library (`node:crypto`, `node:fs`, `node:path`, `node:url`). It needs no network and no access to Jira or to the LedgerSeal app.

Read it before you run it: that is the point of keeping it small.

Publisher: Asymm Systems, https://asymm.systems. Licence: Apache License 2.0 (see `LICENSE`).

## What it checks

| # | Check | Passes when |
|---|---|---|
| 1 | Snapshot hash | The SHA-256 of the canonical JSON of `snapshot` equals `attestation.snapshotHash`. |
| 2 | History chain | The history entries, sorted by `seq`, run 1, 2, 3 with no gap; each `prevEntryHash` equals the previous `entryHash` (the first equals 64 zeros); each `entryHash` is the SHA-256 of its entry without that field. |
| 3 | Newest seal | The attestation's `certificateId` is the certificate of the newest seal entry in the history. |
| 4 | Status | `attestation.status` is the state of the newest history entry that is not a redaction: `SEAL_VALID` for `LS_SEALED`, `SEAL_BROKEN` for `LS_CHANGED`, `SEAL_REVOKED` for `LS_REVOKED`. |
| 5 | Signature | The Ed25519 signature `attestation.sig` verifies over the canonical JSON of the attestation without `sig`, with the public key you give. |

Canonical JSON: object keys sorted by UTF-16 code unit at every level, no whitespace, undefined fields left out. `vectors.json` holds the test vectors; `--self-test` checks the code against them.

### Redaction entries and party tokens

LedgerSeal names people by party token (`pty_` and 32 hex characters), not by Atlassian account id. Records made before LedgerSeal used tokens were converted once, and the history then holds a redaction entry (`statusId` `LS_REDACTED`). At that entry, account ids and names in the entries before it were replaced by tokens and the chain was computed again; the entry records the head hash before the conversion and the number of values replaced. A redaction entry is part of the chain, so checks 2, 3 and 4 cover it (check 4 looks past it). The verifier prints a `NOTE` line for each one, so you can see it.

Evidence exported since then has a `parties` map from each token in the history to an account id, or `null` for a closed account. It is not signed, and no check uses it.

## What a PASS means, and what it does not

A PASS on all five checks means:
- the evidence file has not been changed since it was exported and signed, and
- it was signed with the private key that belongs to the public key you used.

It does not mean that nobody could have created a different, consistent record. Asymm Systems holds the LedgerSeal signing key, and anyone who can rewrite the app's stored data, including the vendor, could write a new consistent chain. The evidence also covers only the fields, comments and attachments that LedgerSeal recorded in its snapshot.

## Use

Node.js 18 or later.

```bash
node verify-evidence.mjs <evidence.json> [public-key.pem]
node verify-evidence.mjs --evidence <evidence.json> --public-key <public-key.pem>
node verify-evidence.mjs --self-test
```

Without a key file, the verifier reads `keys/<keyId>.pub.pem` next to the script, using the `keyId` named in the evidence.

Every run makes all five checks and prints one line per check, for example:

```text
PASS snapshot hash
PASS history chain (1 entries)
PASS attestation names the newest seal
PASS attestation status matches the history (SEAL_VALID)
PASS signature (test-key)
```

Evidence with a redaction entry also prints, for example:

```text
NOTE entry 2 is a redaction: 5 account ids and names were replaced by party tokens, and the entries before it were rewritten (head hash before: 9d75...28ce).
```

Exit codes: `0` every check passed; `1` at least one check failed (the FAIL lines name which); `2` a missing argument or file.

## Getting the evidence from Jira

1. Open the sealed issue and open the **Approval Seal** panel from the issue's app button.
2. Expand **Certificate & attestation details**.
3. Choose **Show evidence (JSON)** and copy the JSON into a file, for example `SEC-101-evidence.json`.
4. Run `node verify-evidence.mjs SEC-101-evidence.json`.

## Public keys

| Key id | Used by | File |
|---|---|---|
| `ls-prod-2026-11` | LedgerSeal production, the Marketplace app | `keys/ls-prod-2026-11.pub.pem` |
| `ls-dev-2026-11` | LedgerSeal development builds only (test sites) | `keys/ls-dev-2026-11.pub.pem` |
| `fr-dev-2026-11` | FourRealities evidence reports, development builds only (test sites) | `keys/fr-dev-2026-11.pub.pem` |

Evidence names its key in `attestation.keyId`. The same keys are listed on https://asymm.systems/product/jira-governance/signing-keys.html. The SHA-256 fingerprint of the DER public key (`openssl pkey -pubin -in keys/ls-prod-2026-11.pub.pem -outform DER | sha256sum`) of `ls-prod-2026-11` is `09f2b807adc803a7f687e0561e90b8dcadadd6c1d752c66b55980a27b89cc5d3`.

Check a download against `SHA256SUMS` in the release:

```bash
sha256sum -c SHA256SUMS
```

The SHA-256 fingerprint of the DER public key of `fr-dev-2026-11` is `f2ad70911a15f39cf37570f86fb3b55e7cf62b48b65bbfd50c8f649de01b979f`. The FourRealities production key `fr-prod-2026-11` is added here when FourRealities evidence reports are released to production.

## FourRealities evidence reports

`verify-fourrealities-report.mjs` checks an evidence report of FourRealities for Jira Cloud (evidence reports for change-management audits) offline. A report is three files that you download from the project page, tab "Evidence reports": `report.json`, `report.csv` and the signed `manifest.json`. It uses only the Node.js standard library and the canonical JSON of `verify-evidence.mjs`.

| # | Check | Passes when |
|---|---|---|
| 1 | File hashes | The SHA-256 and the byte count of `report.json` and of `report.csv` equal the values in the manifest. |
| 2 | Signature | The Ed25519 signature `sig` verifies over the canonical JSON of the manifest without `sig`, with the public key named by `keyId`. |
| 3 | Header | The `header` of `report.json` equals the manifest without `files`, `keyId` and `sig`. |
| 4 | Chain (with `--previous`) | The manifest's `previous.manifestSha256` is the SHA-256 of the previous report's manifest (its canonical JSON with `sig`), and `previous.reportId` names it. A removed report shows as a break. |

```bash
node verify-fourrealities-report.mjs <manifest.json> <report.json> <report.csv> [public-key.pem] [--previous <previous-manifest.json>]
```

When some issues of the scope are not in the report (deleted, no longer readable, or moved to another project while the report was made), the verifier prints a `WARN` line with their number, which the manifest signs, and one line per issue with its key and the reason; it fails when `report.json` lists a different number. A PASS with such lines means the files are intact, not that the report holds every issue. A report signed with a development key (a key id with `-dev-`, such as `fr-dev-2026-11`) prints a `WARN` line: it is a test report, not evidence from a production site. Such a report that says `environment: production` fails. Without a key file, the key is read from `keys/<keyId>.pub.pem`. An unsigned report (manifest `warning: "UNSIGNED"`) fails check 2. The people file of a download is not signed (names change, and a closed account must disappear) and is not needed. Exit codes as above: `0` every check passed, `1` a check failed, `2` a missing argument or file.

What a PASS means: the three files are the ones FourRealities signed, and, with `--previous`, the report follows the previous one. It does not mean that the report holds everything Jira ever recorded: FourRealities reports what Jira's changelog held when the report was made, free-text fields show only that they changed, and the gate results are observed when the report was made.

## Tests

```bash
node verify-evidence.mjs --self-test
node --test test/verify.test.mjs test/verify-fourrealities-report.test.mjs
```

The fixtures in `test/fixtures` are made-up records signed with a test key; they hold no customer data.

## Security

See `SECURITY.md`. Report problems to `security@asymm.systems`, not in a public issue.

## Documentation

https://asymm.systems/product/jira-governance/user-guide/open-verifier
