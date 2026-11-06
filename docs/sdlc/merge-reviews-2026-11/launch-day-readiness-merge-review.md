# Launch-day readiness merge review

- Date: 2026-11-07. Reviewer: independent merge review session.
- Branch: `feature/launch-day-readiness` at `506164f`, cut from master `b346f50`. Master had not moved, so the merge result has the same tree as `506164f`. Two commits:
  - `2902351`: `docs/launch/launch-day-runbook.md`, `docs/launch/support-playbook.md`, `docs/launch/trial-conversion.md`;
  - `506164f`: section 6, "Live variants", appended to `docs/launch/distribution-kit.md`.
- Nothing from this branch is public. It holds documents for launch day.
- Sources checked:
  - the app code and manifests on master;
  - the four listing files;
  - the website `asymmsystems/asymm-corporate-code-pfw` `develop` at `784f151`;
  - the Atlassian Marketplace Partner Agreement (https://www.atlassian.com/licensing/marketplace/partneragreement, fetched 2026-11-07);
  - Atlassian Purchasing & Licensing (https://www.atlassian.com/licensing/purchase-licensing, fetched 2026-11-07).
- Downloaded pages, not committed: `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/merge-review/launch-day-readiness/`.

## 1. Verdict

**Merge.**
- Sections 1 to 5 of the distribution kit are byte-identical to master.
- Each live variant changes only the Marketplace lines.
- The Partner Agreement quotes are verbatim.
- The saved replies match the code, the listings and the site, with one wording error on refunds (L-57).
- L-58 was withdrawn on 2026-11-07: it was a reviewer error (see section 5).

The finding does not block the merge.

## 2. Distribution kit

- **Sections 1 to 5 byte-identical.** The master file (14,174 bytes) is an exact byte prefix of the branch file (`cmp -n 14174` equal), and the diff removes no line.
- **Live variants.** Each of the 9 text blocks of section 6 was diffed against its original:

  | Block | Changed lines |
  |---|---|
  | 6.1, 6.2 | one added "Atlassian Marketplace: <LedgerSeal listing>" line |
  | 6.3 | "Coming soon ..." replaced by "Now on the Atlassian Marketplace (free for up to 10 users): <listing>" |
  | 6.4 | added the LedgerSeal and DefinitionGuard listing lines |
  | 6.5 | added the LedgerSeal listing lines |
  | 6.6 | "It is coming soon ..." replaced by "It is now on ...: <listing>" |
  | 6.7 (three templates) | added "Atlassian Marketplace listing: <LedgerSeal listing>" |

  The four titles are unchanged. This matches the change table in section 6.
- **App ids.** The ids agree across the runbook, the kit and the website link commits: LedgerSeal `1226135152`, DefinitionGuard `4212324863`, CascadePlan `1796314853`, FourRealities `2752796967`. They cannot be checked from outside before approval: each answers HTTP 200 with a generic page, and so does any path. The runbook's step 1 (a `301` to a slug, opened signed out) is the check, and it says a `200` alone proves nothing.

## 3. Partner Agreement

The page says "Last Revised: December 1, 2025".

| Text in `trial-conversion.md` | Result |
|---|---|
| Section 8.4(c), End User Communications, quoted in full | **Verbatim**, all three sentences |
| Section 8.4(b), the sentence "If you retrieve End User Data directly from Atlassian ..." | **Verbatim** |
| 8.3: sole discretion over payments, refund requests and customer service for Paid-via-Atlassian apps | Accurate summary |
| 8.2: no review of your own app or a competitor's; informational answers to support requests in your own app's reviews | Accurate summary |
| Support playbook section 4: breach notices to end users that refer to Atlassian need Atlassian's approval | Accurate: section 8.4(g) "you must obtain Atlassian's approval for any breach notifications to end ..." |

## 4. Saved replies and promises (support playbook)

| Claim | Checked against | Result |
|---|---|---|
| Support: 24 business hours, Monday to Friday; 4 hours for a production blocker | site `support.html`, `faq.html`, user guide hub | Match |
| Privacy: questions 7 days, data requests 30 days | `support.html`, `privacy.html` | Match |
| Security: 72 hours; Atlassian's 10 days, 4 weeks, 12 weeks, 25 weeks | `security.html`, `compliance.html`; Atlassian policy (checked in `definitionguard-fsrt-authorization` and `security-policy-site` reviews) | Match |
| R1 names: "CascadePlan Planner", "Approval Seal", "Require Valid LedgerSeal", "Definition of Done", "DefinitionGuard DoD Enforcement", "Four Realities" | each `manifest.yml` | Match |
| R2: Rank, Sprint and status are not covered; restricted items the app user cannot read are not covered | `canonicalizer.ts` (`BASE_SYSTEM_EXCLUDED` `status`, `BASE_CUSTOM_EXCLUDED` `gh-lexo-rank`, `gh-sprint`); listing "Content Snapshot" | Match |
| R3: "Statuses the gate lets through", "Gate coverage", "Not gated", "Exempt", "Check again", "Licence not active", gate off without a licence | `apps/definitionguard/src/frontend/settings.tsx`, `index.tsx`; `evaluateTransition` log "the gate let this move through" | Match |
| R5: CascadePlan "Licence required"; FourRealities and DefinitionGuard "Licence not active"; LedgerSeal validator decides as before, and on a block names renew or remove | `server/request.ts`; `frontend/app.tsx`; `withLicenceNote` and `LICENCE_INACTIVE_GATE_MESSAGE` (`apps/ledgerseal/src/index.ts`) | Match |
| R6: prices; above 1,000 users the 251 to 1,000 price; annual 10 x monthly | README section 4, listings | Match |
| R7: data residency wording | `privacy.html`, "What is the same for every app" | Match, word for word |
| R8: no email address stored; personal data per app | `git grep emailAddress apps/*/src`: no hit; `privacy.html` per-app "Personal data" | Match |
| R9: verifier: Node 18, `keys/<keyId>.pub.pem`, five checks, exit 0, 1 and 2, `ls-prod-2026-11` | `tools/verifier/README.md` | Match |
| R11: "Not used on this site", "gate authority", "Detect", "Checklists for Jira" | `apps/fourrealities/src` (gate engine, admin, dashboard) | Match |
| R12: "Add dependency", "Starts when that issue reaches (percent)", "Enforce deps", "Why this date?", property `cascadeplan.links` | `apps/cascadeplan/static/frontend/build/index.html`, `legacy-planner.js`, `ui/why.ts` | Match |
| R13: Atlassian refund conditions | Atlassian Purchasing & Licensing | Match, except the last sentence (L-57) |

Runbook facts:
- Every proof path it cites exists.
- The DefinitionGuard listing rows it names exist.
- The CascadePlan title "CascadePlan: Timeline and Dependencies" matches the listing.
- `tools/verifier/package.json` has no dependencies and is Apache-2.0.
- The "RFC 8785" note is accurate: `canonical-json.ts` writes a non-finite number as `null`.
- The site's `preview.yml` and `production.yml` workflows exist, and so do tags `06.11.2026-1` to `-6`.
- The four link commits and `b3b80d5` each revert cleanly on their own (`git apply -R --check`).

## 5. Findings

### Critical, High, Medium

None.

### Low

- **L-57. R13 gets the refund exception backwards.**
  - Atlassian's page says: "For exceptions outside of 30 days, please reach out to the vendor for approval."
  - R13 says: "For a request outside 30 days, Atlassian asks the vendor for approval; tell us your site and the app, and we will answer Atlassian."
  - So the customer contacts us; Atlassian does not ask us.
  - Suggested text: "For a refund outside these windows, Atlassian asks you to contact us, the vendor, for approval. Tell us your site and the app; a refund outside Atlassian's window is the owner's decision."
- **L-58. Withdrawn (reviewer error, 2026-11-07).** This said a sentence in `trial-conversion.md` line 70 was cut off after the word "Report". It was not. The full line, 770 characters, ends: `... not renewed". Reports are not real time: read this week's numbers on Monday for the week before.` The reviewer read the file with each line cut at 700 characters (`cut -c1-700`) and took the cut for the end of the sentence. The fix in `34f15e7` (adding the glossary's churn formula) is verbatim from Atlassian's glossary and is harmless. See `go-to-market-plan-merge-review.md`.

### Considered, no finding

- The "Weak" claims in the runbook (RFC 8785, "open solution", "append-only") are marked as such and left in the owner-approved text, as the runbook says.

## 6. Gate

| Check | Result |
|---|---|
| Changed files | Four files in `docs/launch/` |
| `apps/`, `packages/`, `.github/` | Unchanged |
| CI | No workflow runs for documentation only |
| Em or en dashes in added lines | None (checked at merge) |
