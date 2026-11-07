# DPA template merge review

- Date: 2026-11-08. Reviewer: independent merge review session.
- Branch: `feature/dpa-template` at `653f9dd` (one commit), cut from master `762f109`. Merged onto master `fd2ff71`, without conflict; the CI SAST merge touched other files.
- Change: `docs/legal/dpa-template.md` (a DRAFT GDPR Article 28 Data Processing Agreement for the owner's lawyer, marked "not legal advice") and `docs/legal/README.md` (the questions for the lawyer).
- Scope as asked:
  - check every factual claim against the code, the manifests, `/security`, the privacy policy and the listings;
  - check the halal terms;
  - confirm two facts the drafter could not confirm.

  I did not judge the legal questions; the README lists them.
- Sources:
  - master code and manifests;
  - the website `asymm-corporate-code-pfw` at `develop` `f9fed05` and `main` `aa77706`;
  - the Bonterms Standard End User Agreement v1.0 (https://www.atlassian.com/licensing/marketplace/end-user-agreement-v1, fetched 2026-11-08);
  - `forge deploy list -e production` for each app.
- Clones and pages, not committed: `jira-governance/repository/tmp/` (`review-cli-package-name`, `review-site`, `review-dpa-out`).

## 1. Verdict

**Merge.**
- The factual claims match their sources, with two Low findings (section 5).
- The halal terms hold.
- The two facts the drafter could not confirm are confirmed by deploy timing (section 3).
- The README lists the lawyer's questions clearly, one row per section.

## 2. Factual claims

| Claim (section) | Source checked | Result |
|---|---|---|
| Apps run only on Forge, no external servers, call only Jira, Confluence (FourRealities) and the personal data reporting service (2.3, II.2) | each `manifest.yml`: no `permissions.external`, no `remotes`; the `/security` section 7 wording | Match |
| Storage in Forge KVS and in issue properties (2.3, Annex I) | `@forge/kvs` imports; issue property names in the questionnaires and listings | Match |
| Data residency, "for example the EU, the US or Australia" (7.4, Annex I) | `privacy.html` | Match, word for word |
| No App stores email addresses (Annex I, II.2) | `git grep emailAddress apps/*/src`: no hit (`launch-day-readiness-merge-review.md`) | Match |
| CascadePlan personal data, including the administrator who last saved the approver groups; `cascadeplan.create` holds 12 hex digits of a SHA-256 of the account id | `privacy.html`; CascadePlan questionnaire, Privacy & Security tab | Match |
| LedgerSeal: tokens, one link record per person, the raw account id of the administrator who last saved the approver groups | `privacy.html`; `apps/ledgerseal/src/service/policy-admin.ts` (`setByPartyId: caller`) | Match |
| DefinitionGuard: random pseudonyms, including the approver-group author | `apps/definitionguard/src/security/policy-admin.ts:108` (`pseudonymFor`) and `:131` | Match |
| FourRealities: account ids for Code exceptions, rework reasons and the "My issues" assignee; no names; also writes remote links and comments | `privacy.html`; FourRealities questionnaire Q7 (`write:jira-work`: remote link, comment, property) | Match |
| Erasure: CascadePlan hourly job, each id at most once every 7 days; the other three weekly | `apps/*/manifest.yml` (`interval: hour`, `week`); `privacy.html` | Match |
| LedgerSeal and DefinitionGuard write to Jira only through `write:issue.property:jira` (II.2) | both manifests | Match |
| Access control: calls for a user run as the user; App calls on user actions follow a permission check as the user; admin functions check Administer Jira (II.2) | merge reviews of `696c763`, `bc22524`, `67b6fd6`, `9673c8c`, `0d58bba` | Match. CascadePlan calls Jira only as the user. |
| Company measures II.1 (MFA, password manager, ClamAV, patching, quarterly access review, branch review, CI and `npm audit`, OWASP, secrets, key rotation, 72 hours, 30 days, incident steps) | `/security`, sections 2 to 6 (reviewed in `security-policy-site-merge-review.md`) | Match, section by section |
| Breach notice "within 72 hours of confirming the breach" (10.1) | `/security`, section 6 | Match |
| Data requests within 30 days (8.3) | `privacy.html`, "Privacy contact" | Match |
| Uninstall: Forge keeps storage 28 days, then deletes it (11.1, II.3) | `privacy.html` | Match |
| Encryption at rest and in transit by the Atlassian platform (II.3) | compliance page, "Data Encryption" | Match (Atlassian's own documents not checked, as the README says) |
| LedgerSeal record "can be copied as standalone JSON" (11.1) | compliance page | Match |
| End User Agreement: 3.3 DPA "identified in the Provider-Specific Terms"; 12.4(b) deletion "within 60 days of request"; 14 Enhanced Cap; 19.2(b) California and San Francisco | The agreement, fetched | Match. "Enhanced Claims" means "Provider's breach of Section 3.2 (Security) or either party's breach of Section 3.3 (DPA)". |
| README: the compliance page says LedgerSeal stores account ids "to record who did each action" | compliance page on `develop` and `main` | Confirmed: it says this of "LedgerSeal, DefinitionGuard and FourRealities" |

## 3. The two facts the drafter could not confirm

| App | Permission-check merge (commit time, UTC) | Latest production deploy (`forge deploy list -e production`) | Result |
|---|---|---|---|
| LedgerSeal | `696c763`, 2026-11-06 16:14:39 | 2026-11-06 16:22:58, major version 3; no later production deploy | Deployed after the merge |
| FourRealities | `67b6fd6`, 2026-11-06 16:41:38 | 2026-11-06 16:46:52, major version 2; no later production deploy | Deployed after the merge |

`apps/ledgerseal` and `apps/fourrealities` have not changed on master since those merges. The deploy list does not record the source commit, so the evidence is the timing. With it, the `[CONFIRM]` in Annex II, "Access control", and README item 3 can be closed. The versions 3.1.0 and 2.2.0 are as the coordinator gives them; the list shows only major versions.

## 4. Halal terms

- **DPA:** "interest", "fee", "penalt", "liquidated", "service credit", "insurance" and "deposit" appear only in section 13.3, "no late fee, no interest, no penalty charge and no liquidated damages, and no amount payable under it grows because of delay". The one other "interest" is GDPR's "important grounds of public interest" (3.2).
- **Liability by reference:** section 13.1 refers to the End User Agreement, section 14. That agreement, as fetched, has no interest, late-payment, penalty or liquidated-damages wording, so none comes in by reference.
- **README:** states the owner's rule: leave out a disputed clause rather than reword it.

## 5. Findings

### Critical, High, Medium

None.

### Low

- **L-64. The compliance page has a second gap that the README does not list.** Its Personal Data answer says CascadePlan stores account ids "of who froze a baseline, of who requested or reviewed a scope change, and of each person who works on a task through a Jira sub-task". It leaves out the Jira administrator who last saved the approver groups. The privacy policy, the FAQ (since `23226e3`) and the DPA all name it. Add it to the README's "Inconsistency to fix on the site".
- **L-65. Annex II "Logs" states as a measure what the code does not guarantee.** The row reads: "Backend log lines hold no account id, name, email, issue text, token or key", citing questionnaire question 8. DefinitionGuard (`personal-data.ts:199`, `:219`, `issue-deleted.ts:48`) and FourRealities (`src/index.ts:187`) write an error's message (L-49, L-51). So that statement depends on what Forge storage and the personal data reporting API put in their errors. Annex I already words this as "The questionnaire answers state ...". Either word Annex II the same way, or first change those lines to log only an error's name, code and status, as LedgerSeal does (`apps/ledgerseal/src/service/log.ts`). This also answers README item 9 ("log lines were not checked again").

## 6. Gate

| Check | Result |
|---|---|
| Changed files | `docs/legal/dpa-template.md`, `docs/legal/README.md` (new) |
| `apps/`, `packages/`, `.github/` | Unchanged |
| Em or en dashes in added lines | None |
