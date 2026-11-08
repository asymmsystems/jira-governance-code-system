<!--
Copyright (c) 2026 Asymm Systems. All rights reserved.

@author Fahim Farook
-->
# Files to sync to the public CLI repository

Target: `asymmsystems/jira-governance-code-cli` (public, Apache-2.0), release **v1.5.0**. **Not pushed by this build** (owner's instruction). FourRealities releases its report verifier as v1.4.0 first (public PR #3, merged in master 9a7c005); this release follows it. Copy each file from `tools/verifier/` of branch `feature/ledgerseal-regulated-v2` (rebased onto master 9a7c005, so it holds the FourRealities files too) to the same path in the public repository, after PR #3 is merged there. Run `npm test` and `node verify-evidence.mjs --self-test` there, then tag `v1.5.0` with the flat SHA256SUMS as for v1.3.0.

| File | Phase | Why |
|---|---|---|
| `verify-evidence.mjs` | 2, 4, fix rounds 1 and 2 | Format 2: signing policies and code signing (check 10, by the policy and project each entry names); route versions, stage signatures, quorum and stage order, one stage per person (checks 6 to 9); declaration texts (check 11); no entry of a run after the entry that ended it (check 12); the format 2 checks run whenever the content needs them; check 4 skips run entries; self-test of route vectors |
| `vectors-route-1.json` | 4 | Route hash vectors for `--self-test` |
| `package.json` | 2, 4 | Version 1.5.0; `npm test` runs the LedgerSeal and FourRealities test files |
| `README.md` | 4, fix rounds 1 and 2 | Format 2 checks 6 to 12, "use 1.5.0 or later", what a PASS means; keeps the FourRealities section of 1.4.0 |
| `test/format2.test.mjs` | 2, 4, fix rounds 1 and 2 | Format 1 golden outputs; format 2 code-signing, route, declaration and ended-run vectors; edited-format and swapped-policy attacks |
| `test/fixtures/expected-1.3.0/*.txt`, `*.exit` (24 files) | 2 | 1.3.0 output of every fixture and key |

Unchanged and not to be copied: `LICENSE`, `SECURITY.md`, `keys/`, `vectors.json`, `test/verify.test.mjs`, the other fixtures, `.github/workflows/test.yml`, and the FourRealities files of 1.4.0 (`verify-fourrealities-report.mjs`, its test, `keys/fr-*.pub.pem`), which PR #3 brings.
