# Vendor Security Assessment Questionnaire (CAIQ / SIG Lite)

> Pre-filled security and compliance responses for enterprise procurement and InfoSec reviews.

This document provides standardized answers to common questions found in enterprise security assessments (Consensus Assessments Initiative Questionnaire / CAIQ, Standardized Information Gathering / SIG Lite, and internal vendor risk assessments).

---

## 1. Company & Product Information

| Question | Answer |
|---|---|
| **Vendor / Publisher Name** | Asymm Systems (`https://asymm.systems`) |
| **Product Suite** | Asymm Systems Jira Governance Suite (**LedgerSeal**, **DefinitionGuard**, **FourRealities**, **PlanShift**) |
| **Primary Contact** | `security@asymm.systems` / `support@asymm.systems` |
| **Application Delivery Model** | 100% Atlassian Forge Native Cloud App |

---

## 2. Architecture & Data Flow

| Question | Answer | Details |
|---|---|---|
| **Where is customer data stored?** | Customer Atlassian Cloud Tenant | All app data is persisted in Atlassian Forge Key-Value Storage (KVS) within the customer tenant. |
| **Does the app transmit data outside Atlassian Cloud?** | **No (Zero Egress)** | The app manifest declares zero external egress endpoints. Outbound HTTP/HTTPS requests are blocked by the Forge runtime. |
| **Does the vendor host external databases or servers?** | **No** | Asymm Systems maintains zero external servers, databases, message queues, or storage buckets for app execution. |
| **Does the app use AI, LLMs, or third-party inference APIs?** | **No** | All cryptographic hashing (SHA-256), digital signatures (Ed25519), and scoring execute deterministically on local Forge compute. |
| **Does the vendor have access to customer Jira data?** | **No** | Because code runs serverless within Forge, Asymm Systems staff have zero access to customer tickets, code, or stored data. |

---

## 3. Data Protection & Encryption

| Question | Answer | Details |
|---|---|---|
| **Encryption at Rest** | AES-256 | Managed natively by Atlassian Cloud infrastructure. |
| **Encryption in Transit** | TLS 1.3 | All browser-to-Jira communications are encrypted via modern TLS protocols enforced by Atlassian. |
| **Tenant Isolation** | Logical & Physical Partitioning | Forge KVS partitions data by installation context. Cross-tenant queries are impossible. |
| **Data Retention & Deletion** | Automated on Uninstall | When an app is uninstalled from Jira, Atlassian Forge automatically deletes all tenant KVS data according to Atlassian data retention schedules. |

---

## 4. Compliance & Certifications

| Question | Answer | Details |
|---|---|---|
| **Does the vendor have an independent SOC 2 Type II report?** | Inherited from Atlassian | Asymm Systems maintains zero independent cloud servers or databases. All infrastructure controls are inherited directly from Atlassian's SOC 2 Type II, ISO 27001, and FedRAMP Moderate certified platform. |
| **Can customers verify data residency?** | **Yes** | Forge native apps store data in the customer's chosen Atlassian data residency region (e.g., US, EU, Germany, Australia, Singapore). |
| **Is the app GDPR / CCPA compliant?** | **Yes** | Zero personal data is transmitted externally. All user references are resolved dynamically via Atlassian account IDs. |

---

## 5. Vulnerability Management & Incident Response

| Question | Answer |
|---|---|
| **Vulnerability Reporting Policy** | Dedicated security inbox (`security@asymm.systems`) with initial acknowledgement within 24 hours. |
| **Incident Response SLA** | Critical security incidents evaluated within 24 hours; patches deployed through Forge automated pipelines. |
| **Offline Verifiability** | Cryptographic evidence can be verified offline using our open-source, zero-dependency Node.js verifier. |
