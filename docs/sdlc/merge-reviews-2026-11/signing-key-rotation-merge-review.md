# Signing key rotation merge review

- Date: 2026-11-06. Reviewer: independent merge review session.
- Branch: `feature/signing-key-rotation` at `4bccd2c`, cut from master `6c19fa4`. Two commits:
  - `03d94af`: the runbook `docs/security/signing-key-rotation.md` and the script `tools/rotate-signing-key.sh`.
  - `4bccd2c`: two answers in `site/vendor-security-assessment.md`.
- Merged onto master `f16ab2e`. The files do not overlap with the commits after `6c19fa4`.
- Read: the full diff; how each app reads its key (`apps/ledgerseal/src/domain/attestation.ts`, `apps/definitionguard/src/integrity/attestation.ts`); the FourRealities trust list (`apps/fourrealities/src/accessor/attestation-keys.ts`); the evidence export (`evidenceFlow`, `apps/ledgerseal/src/service/ledger.ts`); the verifier releases; and Atlassian's "Security Bug Fix Policy for Marketplace apps" (https://developer.atlassian.com/platform/marketplace/security-bugfix-policy/, last updated Aug 24, 2026, fetched 2026-11-06).
- Nothing deployed. No `forge` command run. Every key made in this review was a throwaway and is shredded.

## 1. Verdict

**Merge.** The script keeps the private key inside its mode-700 directory and never prints it. The `forge variables` commands it prints produce exactly the format each app reads. The runbook order is safe: publish the key, then deploy FourRealities' trust list, then switch signers. The fix times quoted in the site answer match Atlassian's policy. Four Low findings stay open (section 4).

## 2. The script

All runs used `TMPDIR` set to a new, empty directory, so I could see everything the script left. OpenSSL 3.5.6.

| Run | Result |
|---|---|
| `--dry-run ledgerseal production` | exit 0. It prints the key id, the fingerprint, a passed self-test, the SPKI PEM public key and the two `forge` commands. No line contains `PRIVATE`. `TMPDIR` is empty afterwards. |
| `--dry-run definitionguard production` | The same. |
| Real run with an id already in use (`ls-prod-2026-11`) | Refused, exit 2. The dry run only warns. |
| Key id `ls-prod-x;rm` | Refused by the id pattern, exit 2. Nothing created. |
| Real run, `ledgerseal development ls-dev-2099-01` | Directory mode 700, both files mode 600, nothing written outside it, no `PRIVATE` in the output. Running the printed value command gives base64 of PKCS#8 DER. Node `crypto.createPrivateKey({ key, format: 'der', type: 'pkcs8' })`, as in `createSigner`, loads it as `ed25519`, and a signature verifies with the printed public key. The printed `shred` command left `TMPDIR` empty. |
| Real run, `definitionguard development dg-dev-2099-01` | The same. The printed value is base64 of the PKCS#8 PEM. `createPrivateKey(Buffer.from(v, 'base64').toString('utf8'))`, as in `signIfConfigured`, loads it, and a signature verifies. |

Variable names match the code: `LEDGERSEAL_SIGNING_KEY` and `LEDGERSEAL_KEY_ID` (`signerFromEnvironment`), and `DG_SIGNING_KEY` and `DG_SIGNING_KEY_ID`. The private key variable is always set with `--encrypt`. The used-id check reads the FourRealities trust list and both published key locations. `sh -n` passes. shellcheck is not installed here.

## 3. The runbook

- **Order.**
  - Step 2 publishes the public key in every place: trust list, key files, verifier release, website.
  - Step 3 deploys FourRealities and checks that old records still verify.
  - Only then do steps 4 and 5 set the new variables and deploy the producer.
  - Step 6 verifies new evidence, and gives a rollback that works because the old key stays trusted.
  - This matches section 3's warning that a producer must never sign with a key the deployed FourRealities does not trust.
- **Step 6, re-signed export.** It says an export of an issue sealed before the rotation names the new key id. `evidenceFlow` builds a new attestation with `deps.signer` at export time, so that is right.
- **Step 2.4.** The verifier release v1.3.0 holds the assets the runbook lists: `LICENSE`, `SHA256SUMS`, `vectors.json`, `verify-evidence.mjs` and both `keys/*.pub.pem`.
- **Section 4 (exposed key)** keeps the exposed public key published for old evidence, and makes the trust decision explicit and recorded.

## 4. Findings

### Critical, High, Medium

None.

### Low

- **L-41. Step 2.5 names the wrong website repository.** It says `asymm-corporate`. That repository has no `src/main/jbake/content/product/jira-governance/signing-keys.html`. The page is in `asymmsystems/asymm-corporate-code-pfw` (default branch `develop`).
- **L-42. `site/faq.md:54` still says "Critical Incident Response SLA: 24 hours."** This branch fixed the same promise in `site/vendor-security-assessment.md`, which now says 72 hours to acknowledge and points to https://asymm.systems/security.
- **L-43. Question 16 of `docs/marketplace/submission/ledgerseal-security-questionnaires.md` is now out of date.** It says `site/vendor-security-assessment.md` gives 24 hours. After this merge it gives 72 hours, matching the compliance page.
- **L-44. Step 4 passes the private key value on the `forge` command line.** The `"$( ... )"` form keeps the value out of shell history. But while `forge variables set` runs, the base64 private key is in that process's argument list, and other local users can read it with `ps`. On a single-user workstation the exposure is small. If the Forge CLI prompts for the value when it is left out, that avoids it. I did not check the CLI.

### Notes

- `site/vendor-security-assessment.md` now links https://asymm.systems/security. That page exists only after the website branch `feature/security-policy` is released to `main`.
- The fix times quoted ("critical within 10 days, high within 4 weeks") match Atlassian's policy for cloud apps (critical CVSS 9.0 and above: 10 days; high CVSS 7.0 and above: 4 weeks). The website's compliance page (`product/jira-governance/compliance.html:176`) still says "critical remediation target within 30 days". That is covered in `security-policy-site-merge-review.md`.

## 5. Gate

| Check | Result |
|---|---|
| `apps/`, `packages/`, `.github/` | Unchanged by this branch. The merge result's app tree equals master `f16ab2e`, which was gated in `ledgerseal-permission-checks-merge-review.md`. |
| Tests that read the changed files | None |
| Script | Dry runs and real runs as in section 2 |
| Em or en dashes in added lines | None |
