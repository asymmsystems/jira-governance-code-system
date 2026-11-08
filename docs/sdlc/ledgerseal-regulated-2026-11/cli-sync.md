<!--
Copyright (c) 2026 Asymm Systems. All rights reserved.

@author Fahim Farook
-->
# Files to sync to the public CLI repository

Target: `asymmsystems/jira-governance-code-cli` (public, Apache-2.0), release **v1.4.0**. **Not pushed by this build** (owner's instruction). Copy each file from `tools/verifier/` of branch `feature/ledgerseal-regulated` to the same path in the public repository, run `npm test` and `node verify-evidence.mjs --self-test` there, then tag `v1.4.0` with the flat SHA256SUMS as for v1.3.0.

| File | Phase | Why |
|---|---|---|
| `verify-evidence.mjs` | 2, 4 | Format 2: signing policies and code signing (check 10); route versions, stage signatures, quorum and stage order, one stage per person (checks 6 to 9); check 4 skips run entries; self-test of route vectors |
| `vectors-route-1.json` | 4 | Route hash vectors for `--self-test` |
| `package.json` | 2, 4 | Version 1.4.0; `npm test` runs both test files |
| `README.md` | 4 | Format 2 checks and "use 1.4.0 or later" |
| `test/format2.test.mjs` | 2, 4 | Format 1 golden outputs; format 2 code-signing and route vectors |
| `test/fixtures/expected-1.3.0/*.txt`, `*.exit` (24 files) | 2 | 1.3.0 output of every fixture and key |

Unchanged and not to be copied: `LICENSE`, `SECURITY.md`, `keys/`, `vectors.json`, `test/verify.test.mjs`, the other fixtures, `.github/workflows/test.yml`.
