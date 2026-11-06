# LedgerSeal offline evidence verifier

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
| `ls-dev-2026-11` | LedgerSeal development builds only (test sites) | `keys/ls-dev-2026-11.pub.pem` |

The key of the Marketplace app will be added here, and on https://asymm.systems, before the app is listed. Evidence names its key in `attestation.keyId`.

Check a download against `SHA256SUMS` in the release:

```bash
sha256sum -c SHA256SUMS
```

## Tests

```bash
node verify-evidence.mjs --self-test
node --test test/verify.test.mjs
```

The fixtures in `test/fixtures` are made-up records signed with a test key; they hold no customer data.

## Security

See `SECURITY.md`. Report problems to `security@asymm.systems`, not in a public issue.

## Documentation

https://asymm.systems/product/jira-governance/user-guide/open-verifier
