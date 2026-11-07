<!--
Copyright (c) 2026 Asymm Systems. All rights reserved.

@author Fahim Farook
-->
# Files to sync to the public CLI repository

Target: `asymmsystems/jira-governance-code-cli` (public, Apache-2.0). **Not pushed by this build** (owner's instruction). Copy each file from `tools/verifier/` of branch `feature/ledgerseal-regulated` to the same path in the public repository, then tag the release.

| File | Phase | Why |
|---|---|---|
| `verify-evidence.mjs` | 2 | Format 2: signing policies and the code-signing check (check 10) |
| `test/format2.test.mjs` | 2 | Format 1 golden outputs and format 2 vectors |
| `test/fixtures/expected-1.3.0/*.txt`, `*.exit` (24 files) | 2 | 1.3.0 output of every fixture and key, for the format 1 test |
| `package.json` | 2 | `npm test` runs both test files |
