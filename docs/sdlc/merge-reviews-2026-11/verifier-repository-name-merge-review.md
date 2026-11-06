# Verifier repository name merge review

- Date: 2026-11-07. Reviewer: independent merge review session.
- Repository: `asymmsystems/asymm-corporate-code-pfw` (corporate website). Branch `feature/verifier-repository-name` at `88ee6b6` (one commit, 3 files), cut from `develop` `707b109`. Merged into `develop` with `--no-ff` as `f9fed05` and pushed. `main` (`8355066`, the coordinator's latest release) and the tags are untouched.
- Change: six verifier links (seven URLs) in the open verifier guide, the signing keys page and the LedgerSeal guide now name `asymmsystems/jira-governance-code-cli` instead of `asymmsystems/ledgerseal-verifier`.

## 1. Verdict

**Merged into `develop`.** No finding.

## 2. Links (`curl -L`, 2026-11-07)

| Path under `https://github.com/asymmsystems/` | New name | Old name |
|---|---|---|
| repository root | 200 | 200 after 1 redirect to the new name |
| `blob/main/keys/ls-dev-2026-11.pub.pem` | 200 | 200 after 1 redirect |
| `blob/main/keys/ls-prod-2026-11.pub.pem` | 200 | 200 after 1 redirect |
| `releases/tag/v1.3.0` | 200 | 200 after 1 redirect |

## 3. Build

- `./mvnw -o clean process-resources` (Eliya): exit 0.
- `target/site` has 7 links to `jira-governance-code-cli`, and `ledgerseal-verifier` nowhere.
- `git grep ledgerseal-verifier src` on the branch finds nothing.
- `develop` still contains no Marketplace link commit of `feature/marketplace-live-links`.
