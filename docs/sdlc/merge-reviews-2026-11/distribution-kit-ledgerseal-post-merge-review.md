# Distribution kit LedgerSeal post merge review

- Date: 2026-11-06. Reviewer: independent merge review session.
- Branch: `feature/distribution-kit-ledgerseal-post` at `6102adb` (one commit), cut from master `e0e3eb7`.
- Purpose: fix L-29 of `docs/sdlc/merge-reviews-2026-11/price-docs-followups-merge-review.md`, and correct point 5 of the post. The owner approved the exact wording of both lines.
- Scope: the diff (one file, 2 lines), and the whole Hacker News post in `docs/launch/distribution-kit.md` section 1 (lines 7 to 43). I checked the post against `docs/marketplace/ledgerseal-listing.md`, `tools/verifier/README.md`, `apps/ledgerseal/manifest.yml`, `apps/ledgerseal/src/validator/workflow-validator.ts` and `tools/verifier/verify-evidence.mjs`. I did not check the Reddit, LinkedIn and Community posts in sections 2 to 4.
- Rule: findings only. I did not edit the owner's prose.

## 1. Verdict

**Merge.** Both changed lines are correct and are exactly the approved wording. The rest of the post has three claims that go further than the listing or the verifier README (L-30 to L-32, all Low). This branch did not cause them, and they need the owner's wording, so they do not block the merge.

## 2. The two changed lines

| Line | Result |
|---|---|
| `:35` "Pricing: free up to 10 users, then $0.95 per user per month (less for larger sites) on the Marketplace." | Correct. It matches the LedgerSeal listing and README section 4 ($0.95, then $0.75 and $0.24). L-29 is fixed. |
| `:33` point 5 now ends "so auditors can check the signatures and hash chains themselves, offline." | Correct. It no longer claims independence from the vendor. That agrees with the verifier README ("What a PASS means, and what it does not") and with the listing's Ed25519 row ("it does not protect against the vendor"). |

## 3. New findings (the rest of the post)

### Critical, High, Medium

None.

### Low

- **L-30. Point 3 says any change is caught: "If a single byte or attachment changed since approval, the deployment transition is hard-blocked".** The listing limits this:
  - The snapshot covers only covered fields, comments, work logs and attachments. Some fields are never covered, for example Rank and Sprint (spec v2 exclusion table).
  - A comment or work log restricted to a role or group the app's user is not in is not covered, and "a change to such a comment or work log is not detected" (listing, Content Snapshot row).

  The post states no such limit. Possible owner wording: "If a covered field, comment or attachment changed since approval, ...".
- **L-31. Point 5 overstates what the verifier is and does.**
  - It says the verifier uses "only Node.js node:crypto". The README says it uses only the Node.js standard library: `node:crypto`, `node:fs`, `node:path` and `node:url`.
  - "Compliance verification is completely offline" calls the check compliance verification. The README says a PASS means the file was not changed after export and was signed with the matching key. The listing's "Honest Compliance Boundary" says the auditor decides compliance.

  Possible owner wording: "Evidence verification is offline: ... using only the Node.js standard library ...".
- **L-32. Point 4 says the app "runs entirely in the customer's Atlassian tenant".** The listing says only "LedgerSeal runs on Atlassian Forge" and "Data residency follows Atlassian's rules for Forge app storage". Forge functions run on Atlassian's platform, not inside a customer tenant. The listing also says the app reports account ids to Atlassian's personal data reporting API every week. That is an Atlassian call, so "zero external network calls" still holds. Possible owner wording: "runs on Atlassian Forge; it calls only your site's Jira API and Atlassian's own APIs".

## 4. Claims checked, no conflict

| Claim | Evidence |
|---|---|
| Validator `ledgerseal-validator` | `apps/ledgerseal/manifest.yml:29` (key). Its display name is "Require Valid LedgerSeal". |
| The validator names the changed field | `workflow-validator.ts` `changedItemsMessage`: it names up to five changed fields, plus "Attachments", and counts the rest. |
| Ed25519 signature, hash chain in Forge KVS | Listing: the Ed25519 and history chain rows, and Forge Storage |
| RFC 8785 canonicalization | Neither the listing nor the README names RFC 8785. The README states the rule: keys sorted by UTF-16 code unit, no whitespace. The verifier's `canonicalJson` serializes keys, strings and numbers with `JSON.stringify`, as RFC 8785 does. No test uses the RFC's own test vectors, so full conformance is not proven. `docs/launch/approved-ticket-problem.md:82,94,97` makes the same claim. |
| "we open-sourced" the verifier | `github.com/asymmsystems/ledgerseal-verifier` is public, licence Apache-2.0 (GitHub API, 2026-11-06) |
| Links in the post | HTTP 200, 2026-11-06: `.../user-guide/open-verifier.html`, `.../user-guide/`, `.../user-guide/ledgerseal.html`, `.../jira-governance.html` |

## 5. Gate

| Check | Result |
|---|---|
| Changed files | `docs/launch/distribution-kit.md` only |
| `apps/`, `packages/`, `tools/`, `.github/` | Identical to `e0e3eb7`, where all four app suites passed |
| Tests that read the changed file | None: no file in `apps/`, `packages/`, `tools/` or `.github/` names `distribution-kit` |
| Em or en dashes in the added lines | None |
