# Merge review: feature/production-public-keys

Date: 2026-11-06. Reviewer: an independent Claude Code session (not the session that wrote the branch).
Branch: `feature/production-public-keys`, head `3874f0b` (commits `3c407d9`, `3874f0b`). Base: `master` at `c3abc07`.
Apps: FourRealities (code, tests, docs), LedgerSeal and DefinitionGuard (key files and docs only).

## Verdict

**Merge.** No Critical or High finding. Merged as one squash commit `9085514` on `master`, so the generated images that `3c407d9` added and `3874f0b` removed (`site/public/assets/...`) are not in the history of `master`.

## What the branch does

- Adds the production public keys as files: `apps/ledgerseal/keys/ls-prod-2026-11.pub.pem`, `tools/verifier/keys/ls-prod-2026-11.pub.pem`, `docs/marketplace/definitionguard-public-key-dg-prod-2026-11.pem`.
- Adds `dg-prod-2026-11` and `ls-prod-2026-11` to `apps/fourrealities/src/accessor/attestation-keys.ts` with `environments: ['PRODUCTION']`. The development keys keep `['DEVELOPMENT', 'STAGING']`.
- Rewrites the trust-list tests in `apps/fourrealities/test/accessor-attestation-verifier.test.ts`.
- Bumps `tools/verifier/package.json` to 1.3.0 and updates 14 documents (ADR-012, ADR-013, FourRealities spec v3, listing and admin guide, LedgerSeal README, keys README, open verifier page, verifier README, playbook, approved-ticket problem, three progress logs).

## Checks and evidence

| Check | Result |
|---|---|
| Key files byte-equal to the owner's public files `~/.keys/ledgerseal/ls-prod-2026-11.pub.pem` and `~/.keys/definitionguard/dg-prod-2026-11.pem` (only these two files were opened) | `cmp`: equal, all three repository files |
| Fingerprints (`openssl pkey -pubin -outform DER \| sha256sum`) | `ls-prod-2026-11`: `09f2b807adc803a7f687e0561e90b8dcadadd6c1d752c66b55980a27b89cc5d3`; `dg-prod-2026-11`: `956589daeeb464de4dd4a3c04659c494d2e2b31e4fc9a06784704539ce91f9fb`. Both match the brief. Both are Ed25519. The `ls-dev-2026-11` fingerprint quoted on the open verifier page (`cecef4ee...d283`) also matches its file. |
| PEM strings in `attestation-keys.ts` equal the key files | Yes; the new test "bundles the same public keys as the published key files" reads the files and compares, and passes |
| `tools/verifier` identical to `asymmsystems/ledgerseal-verifier` main `870988f` (tag `v1.3.0` points to `870988f9b710`) | `diff -r --exclude=.git`: identical. GitHub release v1.3.0 has assets `ls-prod-2026-11.pub.pem`, `ls-dev-2026-11.pub.pem`, `verify-evidence.mjs`, `vectors.json`, `SHA256SUMS`, `LICENSE`. Self-test: `PASS 10 of 10 vectors` |
| Public key page https://asymm.systems/product/jira-governance/signing-keys.html, named by the docs | HTTP 200; lists all four key ids, all four PEMs and all four fingerprints, equal to the repository files |
| Production Forge variables of the producers (read-only `forge variables list -e production`; secret values not shown) | LedgerSeal: `LEDGERSEAL_KEY_ID = ls-prod-2026-11`, `LEDGERSEAL_SIGNING_KEY` set encrypted. DefinitionGuard: `DG_SIGNING_KEY_ID = dg-prod-2026-11`, `DG_SIGNING_KEY` set encrypted. So the "Done 2026-11-06" marks in the two producer progress logs hold, and the key ids FourRealities trusts are the ones the producers sign with. |

### Trust-list logic

`trustedKeysFor` (`apps/fourrealities/src/accessor/attestation-verifier.ts`) maps `DEVELOPMENT` and `STAGING` to themselves and every other value, `undefined` included, to `PRODUCTION`, then keeps the keys whose `environments` include it. `verifyAttestation` looks up the key by producer AND `keyId` in that filtered list only. So in production:

- a record with `keyId` `ls-dev-2026-11` or `dg-dev-2026-11` is `UNKNOWN_KEY`, whatever its signature;
- a record signed with a development private key but labelled `ls-prod-2026-11` is checked against the production public key and is `BAD_SIGNATURE`;
- a LedgerSeal key does not verify a DefinitionGuard record (producer must match).

`UNKNOWN_KEY` and `BAD_SIGNATURE` score like no record (ADR-012 decision 4, unchanged). The environment comes from `getAppContext().environmentType`; a failure there gives `undefined`, which is production. `setTrustedKeys` in `src/index.ts` is an existing test hook and is not reached from a resolver. A dev-signed record cannot count in production.

### Tests fail without the change

With `master`'s `attestation-keys.ts` and the branch's test file: 5 of 16 tests fail (production trust list, unknown environment, one dev and one prod key per producer, production record against the bundled key, production record with a test-only key pair). With the change: 16 of 16 pass. The test "trusts exactly the two production keys in production, and no development key" also fails if any development key is given `PRODUCTION`.

### Gate (FourRealities, on the squash result, CI order)

| Step | Result |
|---|---|
| `npm ci` (packages/asymm-jira-ui, then the app) | OK |
| `npx tsc --noEmit` | 0 errors |
| `npm test -- --coverage` | 46 suites, 549 tests passed; all files 99.39 statements, 96.55 branches, 99.18 functions, 99.79 lines |
| `npm run build` | OK |
| `npm audit --omit=dev --audit-level=high` | exit 0 (7 moderate, existing, none high or critical) |
| `forge lint` | No issues found |
| `git status` | clean |
| em or en dashes in the diff | none |
| `git diff --cached --stat` of the squash | 20 files, 140 insertions, 34 deletions, no `site/public` path |

LedgerSeal and DefinitionGuard: no code change in this branch; their CI on `master` is the check. Apps CI on the branch ran on `3c407d9` only (run 42206968416, success); `3874f0b` touches only `site/public` and does not trigger Apps CI. Apps CI on `master` after the push is in the final message of this session.

## Findings

### Critical
None.

### High
None.

### Medium
None.

### Low

- **L-1** `site/apps/ledgerseal/open-verifier.md` lines 44 to 55: the worked example still runs `DEMO-101-evidence.json` against `keys/ls-dev-2026-11.pub.pem` and shows `PASS signature (ls-dev-2026-11)`. It is true for a development sample, and the key table below now marks the dev key "development builds only", but a reader of the public page may copy the dev key for a Marketplace export. Suggest a one-line note that a Marketplace export names `ls-prod-2026-11`.
- **L-2** `docs/marketplace/master-suite-launch-prompt.md` line 146 still names `keys/ls-dev-2026-11.pub.pem` as the published public key. Internal prompt file, not public.
- **L-3** `docs/sdlc/fourrealities-marketplace-fixes-2026-11/progress-log.md` owner command 2 is marked Done but keeps the old sentence "Until then, in production their records show 'Reported, not verified'"; lines 19 and 132 are historical entries that describe the earlier state. Historical, not a claim about the current build.
- **L-4** (note, not a defect) The FourRealities change takes effect in production only after `forge deploy -e production` of FourRealities (owner command 3 of its progress log). Until then the deployed production build trusts no key, as ADR-012 Consequences now says.

## Fix-log entries not confirmed

None. The two "Done 2026-11-06" marks in each producer progress log were confirmed through the production Forge variable list (names and key ids only). Key generation itself (step 1) was confirmed only through the public key files and the matching key id; the private keys were not opened.
