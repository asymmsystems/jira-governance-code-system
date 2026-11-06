# Launch-Day Runbook: Jira Governance Suite

The ordered steps for the day Atlassian approves an app. Each step has a check and a rollback. The owner does the clicks; everything else is prepared.

Prepared 2026-11-07. Apps and their Marketplace app ids:

| App | App id | Listing URL (before the slug is known) | Site commit with its links |
|---|---|---|---|
| CascadePlan | 1796314853 | https://marketplace.atlassian.com/apps/1796314853 | `6dab75f` |
| FourRealities | 2752796967 | https://marketplace.atlassian.com/apps/2752796967 | `f32e165` |
| DefinitionGuard | 4212324863 | https://marketplace.atlassian.com/apps/4212324863 | `5591db5` |
| LedgerSeal | 1226135152 | https://marketplace.atlassian.com/apps/1226135152 | `8061270` |

Site branch: `feature/marketplace-live-links` in `asymmsystems/asymm-corporate-code-pfw` (head `b3b80d5`, not merged). Its commits:

1. `9a3f876` Site claims match the four listings (FourRealities unverified records, CascadePlan personal data, FAQ response times, LedgerSeal evidence visibility). Safe to release at any time.
2. `6dab75f`, `8061270`, `5591db5`, `f32e165`: one commit per app. Each adds a "Get it on Atlassian Marketplace" button to that app's card on the suite page, its quick start card in the user guide hub, and the header of its guide.
3. `b3b80d5` FAQ "Where do I get the apps?" links all four listings. Release it only when all four listings are public.

Each app commit and the FAQ commit reverts cleanly on its own (checked with `git apply -R --check` on 2026-11-07).

## How the id URL behaves (checked 2026-11-07)

- A public listing: `https://marketplace.atlassian.com/apps/6820` answers `301` to `/apps/6820/scriptrunner-for-jira`. So an id URL redirects to the slug URL once the listing is public. The links on the site and in the posts use the id URL and need no change when the slug is known.
- Our four ids answer `200` with a generic page whose title is only "Atlassian Marketplace". That is the state before approval. A `200` alone does not prove the listing is public.
- The Marketplace REST search (`https://marketplace.atlassian.com/rest/2/addons?text=<name>&hosting=cloud`) returned no result for DefinitionGuard, FourRealities or CascadePlan, and no Asymm Systems app for LedgerSeal.

Check command for one app (public when the first line is `301` with a slug):

```bash
curl -sS -o /dev/null -D - https://marketplace.atlassian.com/apps/1226135152 | grep -iE '^(HTTP|location)'
```

## If the apps are approved on different days

Atlassian reviews each app on its own, so approvals may come on different days.

- Do steps 1 and 2 for each app on the day it is approved.
- Release the site (step 3) with only the approved apps: on the release branch, revert the link commit of every app that is not yet public, and leave out `b3b80d5` until all four are public. When the next app is approved, release again without that revert.
- The posts (step 5) start when LedgerSeal is public, because every post is about LedgerSeal. The r/compliance post also names DefinitionGuard; hold it until DefinitionGuard is public, or post it one day later.

---

## Step 1. Confirm the listing is public and correct (per app, about 15 minutes)

Do this from a private browser window, signed out of Atlassian.

1. Run the check command above. Expect `301` and a `location` with a slug. Write the slug in the table at the end of this file.
2. Open the listing and compare it with the listing file in `docs/marketplace/` (`cascadeplan-listing.md`, `fourrealities-listing.md`, `definitionguard-listing-v2.md`, `ledgerseal-listing.md`):
   - **Name and tagline.** CascadePlan: "CascadePlan: Timeline and Dependencies"; the others: the bare app name. Taglines as in `docs/marketplace/submission/developer-console-checklist.md`, step 2.2.
   - **Publisher:** Asymm Systems.
   - **Prices** (per user per month, the pricing tab, monthly and annual):

     | App | 1 to 10 | 11 to 100 | 101 to 250 | 251 and more (every tier above 1,000 too) | Annual |
     |---|---|---|---|---|---|
     | CascadePlan | Free | $1.50 | $1.20 | $0.90 | 10 x monthly |
     | FourRealities | Free | $1.40 | $1.10 | $0.80 | 10 x monthly |
     | DefinitionGuard | Free | $0.95 | $0.75 | $0.24 | 10 x monthly |
     | LedgerSeal | Free | $0.95 | $0.75 | $0.24 | 10 x monthly |

     Use the Marketplace price calculator for 50, 500 and 5,000 users. The 5,000-user price per user must equal the 251 to 1,000 price.
   - **Media:** the banner, the three highlights and the five screenshots named in the listing file, in order, with their captions. No image is cropped or blurred.
   - **Privacy & Security tab:** matches the app's `docs/marketplace/submission/<app>-security-questionnaires.md`. Check in particular: no data egress, data stored in Atlassian (Forge storage), personal data stored (yes: account ids, as the listing's Personal Data section says), data residency supported, privacy policy `https://asymm.systems/privacy`.
   - **Links:** documentation, privacy, terms, support and the support email `support@asymm.systems` open the right pages.
   - **Hosting and compatibility:** Jira Cloud.
3. Install the app on the test site from the public listing (not from the Forge CLI). Open its main view once. For one paid-tier site, run licence test MK-08 (`docs/sdlc/cascadeplan-marketplace-review-2026-11/fix-plan-v2.md`): an active evaluation licence works; a cancelled licence shows the app's licence message.

**If something is wrong:** correct it in the developer console (listing text, media and the Privacy & Security tab can be edited after approval; a price change follows Atlassian's pricing rules). Do not start step 3 for this app until the listing is right.

**Rollback:** if the listing is wrong in a way that misleads buyers (for example a wrong price), do not release the site links for it, and hide the listing until it is corrected: use the console's visibility setting for the listing if it offers one (not checked, because the listings are not public yet), otherwise ask Marketplace support to hide it.

## Step 2. Check the app's production health (per app, 5 minutes)

```bash
(cd apps/<app> && forge logs -e production --since 1d)
```

Expect no unhandled error from the test install in step 1. **Rollback:** if the install shows an error a buyer would hit, keep the site links back for that app (step 3) and fix the app first.

## Step 3. Release the site with the live links (owner, about 20 minutes)

Do this after step 1 passes for at least one app.

1. Open a pull request from `feature/marketplace-live-links` to `develop` in `asymmsystems/asymm-corporate-code-pfw`. If an app is not public yet, first add a commit on the branch that reverts that app's link commit (and `b3b80d5`):

   ```bash
   git revert --no-edit <app commit>   # for each app that is not public yet
   git revert --no-edit b3b80d5        # unless all four are public
   ```

2. Merge into `develop`. The `preview.yml` workflow deploys `https://develop.asymm-corporate-code-pfw.pages.dev`. Check there: the suite page, the user guide hub, each released app guide, and the FAQ. Each "Get it on Atlassian Marketplace" button opens that app's public listing.
3. Release to production as the site README says: merge `develop` into `main` with `--no-ff`, tag the merge with the next tag in the existing pattern (for example `07.11.2026-1`; the last tags are `06.11.2026-1` to `06.11.2026-6`), push `main` and the tag.
4. Open the GitHub Actions run of `production.yml` for that tag and wait until it is green. Then open `https://asymm.systems/product/jira-governance.html` and click each button.

**Rollback:** in the Cloudflare Pages project, choose the previous production deployment and roll back to it (immediate). Then revert the merge on `main` (`git revert -m 1 <merge commit>`), tag, push, and revert it on `develop` too, so the next release does not bring the links back.

## Step 4. Update the launch documents (5 minutes)

1. Fill in the slug of each public app in the table at the end of this file.
2. Optional: replace the id URLs in the "Live variants" section of `docs/launch/distribution-kit.md` with the slug URLs. The id URLs keep working, so this is cosmetic.
3. Review requests follow `docs/launch/go-to-market-plan.md`, section 4.4. When you need the reviews URL, open the public listing, click its Reviews tab and copy that URL (the exact form of the reviews URL was not checked: the Marketplace answers 200 to any path under `/apps/`). See `docs/launch/trial-conversion.md` for when a review request is allowed.

**Rollback:** documentation only; revert the commit.

## Step 5. Posts, one channel a day

Post only the "Live variants" in `docs/launch/distribution-kit.md`, section 6. Start on the first weekday after the site release (step 3) is live. One channel a day, in the order of the kit. Before each post, read the channel's current rules for self-promotion and say in the post that you built the app (each post already says "I built" or "We built").

| Day | Channel | Needs public | Kit section |
|---|---|---|---|
| D+1 | Hacker News (Show HN) and the first comment | LedgerSeal | 6.1 |
| D+2 | Reddit r/devops | LedgerSeal | 6.2 |
| D+3 | Reddit r/jira | LedgerSeal | 6.3 |
| D+4 | Reddit r/compliance | LedgerSeal, DefinitionGuard | 6.4 |
| D+5 | LinkedIn post | LedgerSeal | 6.5 |
| D+6 | Atlassian Community article | LedgerSeal | 6.6 |
| D+7 and later | LinkedIn direct messages (templates A, B, C), a few a day, to people you do not find through Marketplace data | LedgerSeal | 6.7 |

Answer comments on the day of each post. Every answer about a feature uses the listing file's wording.

**Rollback for every post:** delete the post (Hacker News: within the edit window, otherwise ask the moderators at hn@ycombinator.com; Reddit, LinkedIn, Atlassian Community: delete or edit from the post menu). If a claim in a post is found wrong, post a correction under it first, then edit or delete. Stop the next day's post until the claim is fixed in the kit.

### The claims each post makes, and where each is proven

Proof paths are in the Jira repo unless they start with `https://`. "Listing" means `docs/marketplace/ledgerseal-listing.md` (or the named listing).

**6.1 Hacker News**

| Claim | Proof |
|---|---|
| Jira lets an approved ticket change and still move on; `jira.issue.editable = false` freezes comments and integrations | Listing, "The Unaddressed Native Problem"; `docs/launch/approved-ticket-problem.md` |
| The issue is canonicalised and hashed with SHA-256 over covered fields, attachments and sign-offs | `apps/ledgerseal/src/domain/canonical-json.ts`, `apps/ledgerseal/src/domain/canonicalizer.ts`, `apps/ledgerseal/test/canonicalizer.test.ts` |
| "(RFC 8785)" | **Weak.** The code implements canonical JSON with keys sorted by UTF-16 code unit and no whitespace (`canonical-json.ts`). It does not name RFC 8785, and a non-finite number becomes `null` where RFC 8785 rejects it. Be ready to say "RFC 8785-style canonical JSON" if asked. |
| Signed with Ed25519, appended to a hash chain in Forge storage | Listing rows "Ed25519 Signed Attestation" and "Tamper-Evident History Chain"; `apps/ledgerseal/src/domain/attestation.ts`, `apps/ledgerseal/src/domain/history.ts` |
| A workflow validator blocks the transition after a covered change until another approver approves it, and names the changed fields | `apps/ledgerseal/manifest.yml` (`ledgerseal-validator`, "Require Valid LedgerSeal"), `apps/ledgerseal/src/validator/workflow-validator.ts` (`changedItemsMessage`), `apps/ledgerseal/test/workflow-validator.test.ts`, `apps/ledgerseal/test/separation-of-duties.test.ts`. The validator blocks only on the transitions where a Jira admin adds it. |
| No outbound fetch, no external servers | Listing, "No External Egress" (`permissions.external` absent in `apps/ledgerseal/manifest.yml`) |
| Open-source, zero-dependency offline verifier | `tools/verifier/package.json` (no dependencies, Apache-2.0), https://github.com/asymmsystems/ledgerseal-verifier |
| Free up to 10 users, then $0.95 per user per month, less for larger sites | Listing, "Transparent Pricing"; the public listing's pricing tab (step 1) |

**6.2 r/devops**

| Claim | Proof |
|---|---|
| Approval fields are metadata; edits after approval still deploy | Listing, "The Unaddressed Native Problem" |
| "an open solution called LedgerSeal" | **Weak.** The app is not open source; only the verifier is (Apache-2.0). If asked, say so plainly. |
| SHA-256 of canonical JSON, Ed25519 seal in Forge storage | As in 6.1 |
| The validator blocks after a covered field, comment or attachment change; the panel shows what changed | As in 6.1; listing row "Post-Approval Change Detection" |
| Zero external egress | Listing, "No External Egress" |
| Offline verifier with only the Node standard library | `tools/verifier/package.json`, `tools/verifier/verify-evidence.mjs` |

**6.3 r/jira**

| Claim | Proof |
|---|---|
| Snapshot of covered fields, comments, attachments and work logs | Listing row "Content Snapshot"; `apps/ledgerseal/src/domain/canonicalizer.ts` |
| A Rank or Sprint change passes | `apps/ledgerseal/src/domain/canonicalizer.ts`, `BASE_CUSTOM_EXCLUDED` (`gh-lexo-rank`, `gh-sprint`) |
| On the Marketplace, free for up to 10 users | The public listing (step 1) |

**6.4 r/compliance**

| Claim | Proof |
|---|---|
| SOC 2 CC8.1 and ISO 27001 auditors ask whether the approved ticket is the deployed one | Listing, "Enterprise Compliance Grounding"; `https://asymm.systems/product/jira-governance/compliance.html` |
| LedgerSeal hashes and signs; gated transitions reject a changed issue | As in 6.1 |
| DefinitionGuard: mandatory checklists, items the assignee may not tick, waiver reasons in a hash-chained history | `docs/marketplace/definitionguard-listing-v2.md`, rows "Not-the-Assignee Rule", "Waivers with Reasons", "Hash-Chained History" |
| Evidence JSON verified offline | LedgerSeal only: the verifier checks LedgerSeal evidence, not the DefinitionGuard history export. If asked, say so. |
| Forge native, zero egress | Both listings, "No External Egress" |

**6.5 LinkedIn post**

| Claim | Proof |
|---|---|
| SHA-256 snapshot on approval, validator before Done, blocked until another approver approves | As in 6.1 |
| Forge native, zero egress | As in 6.1 |
| Open-source offline verifier | As in 6.1 |

**6.6 Atlassian Community**

| Claim | Proof |
|---|---|
| Approvers seal with their approver group permissions | Listing row "Approver Groups Admin Page"; `apps/ledgerseal/test/approver-policy.test.ts` |
| SHA-256 snapshot in Forge KVS; the validator on Done or Released blocks a changed issue | As in 6.1 |
| On the Marketplace, free for up to 10 users | The public listing (step 1) |

**6.7 Direct messages (templates A, B, C)**

| Claim | Proof |
|---|---|
| "hard-blocks the Done transition if any covered field was modified" (A) | True only on transitions where a Jira admin adds the validator (`https://asymm.systems/product/jira-governance/user-guide/ledgerseal.html`, section 5). Say so if asked. |
| Zero egress, Forge storage, free for up to 10 users (B) | As in 6.1 |
| Supports 21 CFR Part 11 section 11.10(e) audit trails and SOC 2 CC8.1 (C) | Listing, "Enterprise Compliance Grounding" (also says it is not a Part 11 electronic signature by itself) |
| "append-only cryptographic hash chain" (C) | **Weak.** The listing and the guide say tamper-evident, not immutable: someone who can rewrite the app's storage, including the vendor, can write a new consistent chain. Say "tamper-evident" if asked. |

The weak claims are in text the owner approved, so the live variants keep them. Changing them is an owner decision.

## Step 6. After the posts

- Daily: the checks in `docs/launch/trial-conversion.md`, "Weekly metrics checklist", reduced to new installs, new evaluations and support mail.
- Support: `docs/launch/support-playbook.md`.

---

## Slugs (fill in on the day)

| App | Approved on | Slug URL | Site released in tag |
|---|---|---|---|
| CascadePlan | | | |
| FourRealities | | | |
| DefinitionGuard | | | |
| LedgerSeal | | | |
