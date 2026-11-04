# DefinitionGuard Compliance Mapping

This document provides a technical audit mapping between DefinitionGuard capabilities and standard enterprise regulatory frameworks: **SOC 2 Type II**, **ISO/IEC 27001:2022**, and **FDA 21 CFR Part 11 / GxP Software Quality Assurance**.

> [!IMPORTANT]
> **Audit Boundary Statement:** DefinitionGuard provides technical enforcement mechanisms within Atlassian Jira Cloud. Installing DefinitionGuard does not automatically confer compliance certification. Formal compliance requires documented policies, organizational governance, operational procedures, and auditor evaluation of your organization's entire software development lifecycle (SDLC).

---

## 1. Regulatory Framework Summary

| Framework | Control Ref | Requirement Summary | DefinitionGuard Enforcement Mechanism |
| :--- | :--- | :--- | :--- |
| **SOC 2 Type II** | CC8.1 | Change authorization, specification, testing, and approval prior to production deployment. | Workflow transition validator blocks transition to terminal statuses (Done/Released) until all mandatory DoD checklist items are satisfied and reviewed by an authorized non-assignee. |
| **SOC 2 Type II** | CC7.2 | Monitoring and segregation of duties across development and release processes. | Strict Non-Assignee Review Rule prevents ticket assignees from marking their own items as complete or signing off on Definition of Done checklists. |
| **ISO/IEC 27001:2022** | Control A.8.29 | Security testing in development and acceptance testing prior to release. | Mandatory evidence requirements attach automated test links, static analysis reports, and peer verification notes directly to individual checklist criteria before acceptance. |
| **ISO/IEC 27001:2022** | Control A.8.32 | Change management and verification records. | Comprehensive immutable audit event stream logging item checks, unchecks, evidence attachments, waiver grants, and transition validator evaluations in Forge KVS. |
| **FDA 21 CFR Part 11** | § 11.10(e) | Secure, computer-generated, time-stamped audit trails to independently record actions. | Chronological audit trail recording actor Atlassian Account ID, exact timestamp, prior state, new state, and waiver justification notes. |
| **FDA 21 CFR Part 11** | § 11.50 / § 11.70 | Electronic signature manifestation and linking to records. | Reviewer attestation is recorded with user identity, timestamp, and review role, persistently associated with the ticket state in tenant storage. |

---

## 2. SOC 2 Type II Control Mapping (Trust Services Criteria)

### Common Criteria 8.1 (Change Management)
- **Criterion:** The entity authorizes, designs, develops or acquires, configures, documents, tests, approves, and implements changes to infrastructure, data, software, and procedures to meet its objectives.
- **Auditor Verification Objective:** Demonstrate that no Jira issue represents a completed production change without verified test execution, documented peer review, and authorized release sign-off.
- **DefinitionGuard Evidence:**
  1. **Transition Validator Block:** Jira workflow transitions to terminal statuses (`Done`, `Closed`, `Resolved`) enforce `definitionguard-validator`. If mandatory criteria are missing, the transition fails with clear explanatory messages.
  2. **Mandatory Evidence Requirements:** Items flagged as requiring evidence cannot be checked without entering a valid URL (such as a CI/CD build run, PR link, or test management execution report) or verified documentation text.
  3. **Transition Coverage Report:** The administrator Transition Coverage Report displays all active workflows and confirms whether a DefinitionGuard validator is bound to transitions targeting terminal categories.

### Common Criteria 7.2 (System Operations & Segregation of Duties)
- **Criterion:** The entity monitors system components and the operation of those components for anomalies, vulnerabilities, and deviations from policy, including segregation of duties.
- **Auditor Verification Objective:** Ensure that software developers cannot unilaterally declare their own work compliant without independent peer oversight.
- **DefinitionGuard Evidence:**
  1. **Strict Non-Assignee Rule:** Configured per project or per issue type. When enabled, any attempt by the ticket assignee to verify checklist items is rejected.
  2. **Role-Based Checklists:** Distinct criteria can be assigned to Quality Assurance, Security, or Product roles, requiring appropriate permissions within Jira.

---

## 3. ISO/IEC 27001:2022 Control Mapping

### Control A.8.29 (Security Testing in Development and Acceptance)
- **Control Objective:** Security testing and validation are performed during software development prior to release.
- **DefinitionGuard Evidence:**
  - Standardized checklist templates enforce requirements such as SAST/DAST scanning, dependency vulnerability audit passing, peer code review, and acceptance criteria verification.
  - Issues lacking required security verification artifacts cannot bypass workflow validation.

### Control A.8.32 (Change Management)
- **Control Objective:** Changes to information processing facilities and systems are subject to formal change management procedures.
- **DefinitionGuard Evidence:**
  - Every change to Definition of Done completion state is captured in the audit log.
  - When exceptions occur, authorized users must provide an explicit waiver reason. The waiver reason, approver identity, and timestamp are permanently recorded in the audit trail.

---

## 4. FDA 21 CFR Part 11 / GxP Software Quality Assurance

### § 11.10(e) Time-Stamped Audit Trails
- **Requirement:** Use of secure, computer-generated, time-stamped audit trails to independently record the date and time of operator entries and actions that create, modify, or delete electronic records.
- **DefinitionGuard Implementation:**
  - Audit trail entries are created automatically by the Forge backend upon any state change.
  - Audit logs are stored in Atlassian Forge Key-Value Storage (KVS) within the customer's cloud site.
  - The audit log is append-only from the user perspective and can be exported as structured JSON for compliance archives.

### § 11.10(k) Document Controls and Sequence of Steps
- **Requirement:** Use of appropriate controls over systems documentation and determination that persons who develop, maintain, or use electronic records have the education, training, and experience to perform their assigned tasks.
- **DefinitionGuard Implementation:**
  - Project configuration history documents which checklist version applied at the time an issue was resolved.
  - Workflow transitions cannot proceed out of sequence when configured with transition gates.

---

## 5. Auditor Verification Checklist

When preparing for an audit, follow this verification procedure:

1. **Verify Workflow Gates:**
   - Navigate to **Jira Settings > Apps > DefinitionGuard Admin > Transition Coverage**.
   - Verify that 100% of workflows leading to Done/Resolved have the DefinitionGuard validator applied.
2. **Sample Sampled Tickets:**
   - Select a randomized sample of production-release Jira issues from the audit period.
   - Open the DefinitionGuard issue panel on each ticket.
   - Confirm that all mandatory checklist items are marked complete with verified reviewer identities.
   - Confirm that any attached evidence links point to valid CI/CD or testing records.
3. **Inspect Audit History:**
   - Expand the DefinitionGuard **Audit History** tab on sampled tickets.
   - Review timestamps and verify that item verification occurred prior to the ticket transition to Done.
   - If any item was waived, verify that the waiver was granted by an authorized team member and that the recorded justification matches organizational change policies.
