# Go-to-market plan merge review

- Date: 2026-11-07. Reviewer: independent merge review session.
- Branch: `feature/go-to-market-plan` at `1c0d0c6`, cut from master `c2582b7`. Master had not moved, so the merge result has the same tree as `1c0d0c6`. Four commits:
  - `cb5d37c`: `docs/launch/go-to-market-plan.md`, a "Superseded" first line on three old playbooks, and pointer fixes;
  - `e839c8a`: owner-approved wording in `distribution-kit.md`, and the runbook claim table;
  - `34f15e7`: L-57 and L-58 of `launch-day-readiness-merge-review.md`;
  - `1c0d0c6`: `video-scripts.md`.
- Sources checked:
  - the four listing files;
  - `docs/sdlc/suite-readiness-review-2026-11/README.md` and `marketplace-commercial-rules.md`;
  - the Partner Agreement as fetched for the previous review;
  - Atlassian's reports glossary (https://developer.atlassian.com/platform/marketplace/glossary-reports/, fetched 2026-11-07);
  - `tools/verifier/README.md`.
- Pages, not committed: `/home/fahimfarookme/.cache/jira-suite-merge-review/go-to-market-plan/`.

## 1. Verdict

**Merge.**
- The old playbooks changed only in line 1.
- Kit sections 1 to 5 changed only in the four approved phrases.
- The plan's prices, revenue share and 8.4(c) rules match their sources.
- Three Low findings on the plan's wording (section 5). One note on a prompt file (section 6).

**L-58 was a reviewer error and is withdrawn.** `trial-conversion.md` line 70 was never cut off. My earlier read cut each line at 700 characters, and the line is 770 characters long, ending `... Reports are not real time: read this week's numbers on Monday for the week before.` The fixer's change in `34f15e7` adds Atlassian's churn formula, `(Number of subscriptions not renewed)/ (Number of subscriptions due to be renewed)`. That text is verbatim from the glossary, so it does no harm. `launch-day-readiness-merge-review.md` is corrected in the same merge.

## 2. The old playbooks

`first-sale-playbook.md`, `docs/marketplace/suite-launch-and-first-sale-playbook.md` and `docs/marketplace/master-suite-launch-prompt.md` each gain one first line: "Superseded by docs/launch/go-to-market-plan.md on 2026-11-07; kept as a dated record." For each file, the new file without its first line equals the master file.

## 3. Distribution kit

Sections 1 to 5 keep 247 lines. Exactly four lines differ, in the approved phrases:

| Line | Before | After |
|---|---|---|
| 29 | "canonicalizes ... (RFC 8785)" | "serializes ... as canonical JSON with sorted keys" |
| 59 | "We built an open solution called LedgerSeal on Atlassian Forge:" | "We built LedgerSeal on Atlassian Forge, with an open-source verifier:" |
| 201 | "hard-blocks the Done transition if" | "blocks the Done transition once a Jira admin adds the validator, if" |
| 237 | "an append-only cryptographic hash chain" | "a tamper-evident cryptographic hash chain" |

Section 6 carries the same four changes. The runbook claim table now gives a proof for each phrase instead of marking it "Weak", and the proofs hold:
- `canonical-json.ts` sorts keys by UTF-16 code unit;
- the verifier is Apache-2.0;
- the guide's section 5 says a Jira admin adds the validator;
- the listing row is "Tamper-Evident History Chain".

## 4. Facts in the plan

| Claim | Source | Result |
|---|---|---|
| Prices per app, free 1 to 10, annual 10 x monthly, the 251 to 1,000 price above 1,000 | README section 4; listings | Match |
| Examples: 11 users, $10.45 (LedgerSeal) and $16.50 (CascadePlan); 50 users, $47.50 (LedgerSeal); about 11 months to $500 | Arithmetic: 11 x 0.95, 11 x 1.50, 50 x 0.95, 500 / 47.50 = 10.5 | Match |
| 0% revenue share on eligible Forge revenue from 1 January 2026, up to $1 million lifetime per partner; 17% above it from 1 October 2026; Forge only | README section 3; `marketplace-commercial-rules.md` section 5 | Match |
| Payout within 30 days after the month with $500 profit; W-8, 30% default withholding | `marketplace-commercial-rules.md` section 5 | Match |
| No bundles for cloud apps | `marketplace-commercial-rules.md` section 6 ("not supported for cloud as far as found") | Match. The plan states it without "as far as found". |
| 8.4(c) quote (with "[...]" for the middle sentence) and the three rules that follow | Partner Agreement 8.4(c), last revised 1 December 2025 | Match: both quoted parts are verbatim |
| Dates: listed mid to late December 2026, first paid customer late January 2027 | README section 5 | Match |
| Owner decision 3 (FourRealities without the other two apps) | README section 7, item 3 | Match |
| Every listing row named in the proof-point table | The four listing files | All present |
| Video: `node verify-evidence.mjs --evidence evidence.json`, "Five PASS lines" | `tools/verifier/README.md` (that usage; five checks, one line each) | Match |

## 5. Findings

### Critical, High, Medium

None.

### Low

- **L-59. Plan section 6, week 3, is out of date within this branch.** It says `video-scripts.md` "still says 'hard-blocked' and 'Auditors don't have to trust us'". Commit `1c0d0c6` on this same branch removes both, and the file on the branch head has neither. Suggested fix: drop the parenthesis.
- **L-60. Section 4.4 cites the wrong source for "never offer a reward".** It cites Partner Agreement section 8.2. Section 8.2 forbids reviewing your own or a competitor's app, and allows informational answers to support requests in your own reviews. The agreement as fetched on 2026-11-07 has no wording on rewards or incentives for reviews. 8.2 says reviews must follow Atlassian's AUP. The rule may well hold through the AUP or Atlassian's review guidelines, but the plan should cite the text that says it, or drop the citation.
- **L-61. Section 6 and section 7 overstate the readiness review on price changes.** "The readiness review sets no price change before 30 to 50 paying sites (section 4)" is not a rule in README section 4. The only "30 to 50" there is the research recommendation for FourRealities: "Least price evidence; review after the first 30 to 50 paying sites". `trial-conversion.md` section 4 cites it the same way. Suggested fix: make it an owner decision ("no price change before 30 to 50 paying sites, owner, <date>"), or cite it as the research note it is.

## 6. Note on a prompt file

`docs/marketplace/master-suite-launch-prompt.md` is a prompt file. Earlier in this series, a change to it was left out because prompt-layer edits need the owner's approval (`price-docs-followups-merge-review.md`). The new first line only marks it superseded and changes no instruction, but it is now part of the prompt text a model would read. The request lists it as part of the plan; please confirm that the owner approved this line.

## 7. Gate

| Check | Result |
|---|---|
| Changed files | 8 files in `docs/launch/` and `docs/marketplace/` |
| `apps/`, `packages/`, `.github/` | Unchanged |
| Em or en dashes in added lines | None |
