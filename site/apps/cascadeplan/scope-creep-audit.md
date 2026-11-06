# Baselines and Scope Reviews

A baseline is the plan as it was when a plan approver froze it. Comparing it with the current plan shows how the scope changed. This page explains what CascadePlan measures and how to use it in a review or a retrospective.

---

## 1. What CascadePlan measures

For a baseline against the current plan, or against another baseline version, CascadePlan shows:

- **Added:** work items on the timeline now that were not in the baseline.
- **Removed:** work items of the baseline that are no longer on the timeline.
- **Changed:** work items whose Jira estimate, start or end changed, with the old and new values.
- **Later:** how many work items now end later than in the baseline.
- **Hours:** the total Jira estimate of the baseline and of now, the difference in hours, and the difference in percent of the baseline:

  `change % = (hours now - baseline hours) / baseline hours x 100`

A work item with no Jira estimate counts as an item, not as hours; the number of unestimated items is shown with each version.

---

## 2. Run a scope review

1. Open **Baseline** in the toolbar. The top section lists every change since the active baseline.
2. If the change is agreed, write the reason, for example the customer request or the defect found, and choose **Request approval of this scope**.
3. A plan approver other than the requester accepts or rejects it. Accepting freezes a new baseline version, so later reviews measure from the agreed scope. Each request keeps who asked, when, the reason, who reviewed it, when, and the comment.

---

## 3. In a retrospective

Under **Baseline versions**, choose **Compare with now** on the version frozen at the start of the period, or **Compare with active** to see what each accepted request changed. Questions that help:

- Did the added work come from discoveries inside the team or from requests outside it?
- Was work removed to make room, or did the team absorb the change?
- Which work items ended later, and why?

---

## 4. Export

**Export CSV** downloads one row per work item of a baseline: issue id, issue key, Jira estimate in hours, start, end and whether it was done. The first line names the baseline, when it was frozen, and its SHA-256 digest.

Each read of a baseline recomputes the digest. If the stored baseline no longer matches it, CascadePlan says so. The digest detects a baseline that changed after it was frozen, for example by a partial write. It is not a signature: it does not prove who made the export.
