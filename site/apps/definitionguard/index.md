# DefinitionGuard: Enforceable Definition of Done for Jira

> Enforce your Definition of Done at workflow transitions with verified evidence links, peer review rules, and audited waivers.

DefinitionGuard turns your Definition of Done (DoD) from an unenforced text checklist into an automated quality gate that prevents incomplete work from transitioning into Done.

---

## Why Standard Jira Checklists Fail

In standard Jira projects, teams document their Definition of Done in a wiki page or in ticket descriptions. This creates four major quality risks:
1. **Unverified Checkboxes:** Anyone can tick a checkbox without attaching proof.
2. **Assignee Self-Reviews:** Developers can sign off on their own code reviews.
3. **Silent Waivers:** Items are skipped informally in chat without an audit reason.
4. **Ungated Done Status:** Tickets move to Done even when critical testing or documentation is missing.

---

## How DefinitionGuard Works

1. **Templates by Issue Type:** Project admins configure distinct checklist templates for Stories, Bugs, and Epics.
2. **Evidence Requirements:** Specific checklist items require a verified link (CI/CD build, documentation PR) or a note before they can be marked complete.
3. **Peer Review Rules:** Certain items (e.g. Code Review) require non-assignee verification, preventing self-approval.
4. **Audited Waivers:** Authorized leads can waive an item with an obligatory justification, recorded in a hash-chained audit history.
5. **Workflow Transition Gate:** The DefinitionGuard validator blocks transitions into Done while mandatory items remain open.

---

## Visual Tour

![DefinitionGuard Checklist](/assets/definitionguard/01-checklist-open.png)

*Figure 1: Issue panel displaying Definition of Done checklist with open mandatory items and evidence requirements.*

---

## Documentation Sections

- [Admin Guide](./admin-guide) - Setting up DoD templates and configuring workflow transition gates.
- [User Guide](./user-guide) - Completing items, attaching evidence, and requesting waivers.
- [Transition Coverage Report](./coverage-report) - Eliminating unprotected workflow paths into Done.
- [Compliance Mapping](./compliance-mapping) - Mapping DoD evidence to SOC 2, ISO 27001, and internal controls.
