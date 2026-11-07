<!--
Copyright (c) 2026 Asymm Systems. All rights reserved.

@author Fahim Farook
-->
# Data Center to cloud: the governance app gap, November 2026

Checked: 2026-11-08 (every row, unless a row says otherwise). Research only: no logins, no forms, no contact with any vendor or partner.

This note answers two questions for the regulated migration strategy (`docs/launch/regulated-enterprise-playbook.md`):

1. Which Marketplace apps in our categories exist for Data Center or Server but have no cloud version, or a cloud version that the vendor's own pages say has fewer capabilities?
2. How does Atlassian's migration tooling suggest a cloud alternative, and how does an app become one?

Background dates: new Data Center apps could not be submitted after 2025-12-16 (Atlassian developer blog, "From Data Center to Cloud: The Next Chapter for Marketplace Apps", https://www.atlassian.com/blog/developer/from-data-center-to-cloud-the-next-chapter-for-marketplace-apps, 2025-09-08); the rest from Atlassian, "Data Center end of life", https://www.atlassian.com/licensing/data-center-end-of-life, read 2026-11-07: new customers could not buy Data Center after 2026-03-30; existing customers can buy and expand until 2028-03-30; Data Center products and apps become read-only on 2029-03-28. The full source list is in `.tmp/research/atlassian-dc-regulated-2026-11.md` of the parent repository (not in git); the dates also appear in the playbook, section 3.

## 1. Method

| Step | How | Why it holds |
|---|---|---|
| Find apps | Public Marketplace REST API v2 search, `https://marketplace.atlassian.com/rest/2/addons?text=<term>&application=jira\|confluence`. Terms: approval, sign-off, electronic signature, 21 CFR Part 11, change control, definition of done, checklist, audit trail, audit log, release gate, quality gate, compliance, GxP, FDA, ISO 13485, traceability, document control, workflow validator, release management. 1,527 unique listings. | The same API feeds the listing pages. |
| Hosting per app | `https://marketplace.atlassian.com/rest/2/addons/<key>/versions/latest?hosting=<cloud\|datacenter\|server>`. HTTP 200: the listing has a version for that hosting. HTTP 404: it has none. | The search filter by hosting returns only top results, so each app was checked one by one. |
| Installs | `distribution.totalInstalls` from `https://marketplace.atlassian.com/rest/2/addons/<key>`. | Five listing pages were opened; the "Installs" figure on each matched the API value exactly. |
| Vendor's migration record | `https://marketplace.atlassian.com/rest/2/addons/<key>/migration` (public read). Fields: `cloudAddonKey`, `cloudVersionAvailability`, `migrationPath`. 404 means no record. | This is what the vendor declared to Atlassian's app migration platform. |
| Cloud gaps | Only where the vendor's own comparison page states a gap. Quoted, with the page's date where it shows one. | We state other vendors' facts in their own words only. |

Spot check by hand on 2026-11-08: Electronic Signature for Jira (Deviniti) and Approvals - Advanced Issue Acceptance (Deviniti) both return 404 for `hosting=cloud` and 200 for `hosting=datacenter`, with 56 and 151 installs.

Limits:

- "No cloud version" means no cloud hosting under the same app key. A vendor can sell a cloud app under another key. Where the migration record names another key, the row says so.
- An install count is what the Marketplace reports. It is not the number of active customers.
- Raw evidence (API answers, vendor page text) is in the parent repository at `.tmp/cache/regulated-gtm/raw/` (not in git).

How to read "Our cover" in the tables: the app of ours that answers the same need, and in "Not covered" what we do not do. This is our own product scope, from our listing files in `docs/marketplace/`.

## 2. Apps with no cloud version (Data Center or Server only)

C = Cloud, DC = Data Center, S = Server. URLs are `https://marketplace.atlassian.com/apps/<id>`; the id is in the URL column.

| App | Vendor | Hosting | Installs | Migration record | Our cover | Not covered by us | URL |
|---|---|---|---|---|---|---|---|
| Electronic Signature for Jira. Tagline: "Require electronic signatures to execute issue transitions and changes to comply with CFR 21 part 11" | Deviniti | DC, S | 56 | PRIVATE / UNKNOWN | LedgerSeal: approval seal with date, time and meaning; changes after approval named; Require Valid LedgerSeal validator blocks the transition | Re-authentication at signing. LedgerSeal does not meet 21 CFR 11.200 or 11.300 (listing, "Honest Compliance Boundary"). A team that needs Part 11 signatures keeps its own signing control. | /apps/1212175/electronic-signature-for-jira |
| Approvals - Advanced Issue Acceptance | Deviniti | DC, S | 151 | PRIVATE / UNKNOWN | LedgerSeal (approval bound to issue content; separation of duties) | Multi-step or parallel approver routing (we have one seal and approval of changes, not an approval path). Not checked: the app's own feature list. | /apps/1215680/approvals-advanced-issue-acceptance |
| Issue Approval | Globo Solutions | DC | 64 | none | LedgerSeal | Approval routing, as above | /apps/1229600/issue-approval |
| Bulk Approvals for Jira Service Management | Akeles Consulting | DC, S | 17 | none | None | Bulk approval of JSM requests | /apps/1225095/bulk-approvals-for-jira-service-management |
| Auditor for Jira | Enhancera | DC, S | 148 | PRIVATE / UNKNOWN | FourRealities (delivery evidence per issue); LedgerSeal and DefinitionGuard histories | A general Jira audit log of configuration and admin events. Our apps record their own actions only; Jira's own audit log covers the rest. | /apps/43203/auditor-for-jira |
| Auditor for Confluence | Enhancera | DC, S | 34 | none | None (Jira only) | Confluence | /apps/1214138/auditor-for-confluence |
| Comala Lists (Confluence checklists) | Appfire | DC, S | 199 | PRIVATE / UNKNOWN | DefinitionGuard covers checklists on Jira issues | Confluence page checklists | /apps/154/comala-lists |
| Kanoah Checklist for Jira | The Adaptavist Group | DC, S | 35 | PRIVATE / UNKNOWN | DefinitionGuard | Not checked: the app's own feature list | /apps/1213102/kanoah-checklist-for-jira |
| Structure.Testy (test checklists) | Tempo Software | DC, S | 368 | PRIVATE / UNKNOWN | Partly: DefinitionGuard items with evidence | Test checklists inside Structure | /apps/1212033 |
| Power Utilities for Jira (workflow toolbox) | Appfire | DC, S | 643 | PRIVATE / UNKNOWN | Partly: our two validators | A general workflow toolbox | /apps/1211565 |
| Workflow Essentials for Jira | codecentric | DC, S | 217 | `cloudAddonKey` points to Jira Workflow Toolbox (Decadis), another vendor | Partly: our two validators | A general workflow toolbox | /apps/1214892/workflow-essentials-for-jira |
| Workflow PowerBox | Almarise | DC, S | 86 | PRIVATE / UNKNOWN | Partly: our two validators | A general workflow toolbox | /apps/1213643 |
| Help (Conditions Validator) | Deviniti | DC, S | 90 | PRIVATE / UNKNOWN | Partly: our two validators | General conditions and validators | /apps/39261 |
| Release Management - DC | Release Management | DC, S | 246 | separate cloud listing exists (`app.releasemanagement.rmcloud`) | Partly: LedgerSeal gate on the release transition | Release calendars and roadmaps | /apps/1218705 |
| Release Manager | votazz | DC, S | 82 | PRIVATE / UNKNOWN | Partly: LedgerSeal gate | Release planning | /apps/823187 |
| RY Testing and Compliance | Requirement Yogi | DC, S | 66 | PRIVATE / UNKNOWN | None | Requirements testing and traceability | /apps/1217990/ry-testing-and-compliance |
| SoftComply eQMS (MedTech QMS Starter Pack). The Server view says: "We no longer offer sales and support for server apps." | SoftComply | DC, S (latest DC version 1.4.0, 2024-01-05) | 313 | not read | Partly: DefinitionGuard and LedgerSeal records | A quality management system | /apps/1216218 |
| Risk Management for Jira | jPlugs | DC, S | 133 | PRIVATE / UNKNOWN | None | Risk management | /apps/5245/risk-management-for-jira |
| ProForma: Forms and Checklist | Atlassian | DC, S | 1,139 | NATIVE, AUTOMATED: the function is native in cloud (Jira forms) | Not a gap | Not a gap | /apps/1215833 |

What `PRIVATE / UNKNOWN` means: `cloudVersionAvailability` = PRIVATE and `migrationPath` = UNKNOWN in the vendor's own record. Atlassian's page "Manage app info" (https://developer.atlassian.com/platform/app-migration/manage-app-info, last updated 2024-07-12) defines UNKNOWN as "A migration path isn't available for your app at this time." Atlassian does not document PRIVATE; we do not interpret it.

Server-only apps found (no DC and no cloud; small): Parallel Approval Process for Jira (Unlimax, 19 installs, last version 2022-07-06), Easy Document Signer (EPS, 9), Sign Off Plugin for Jira (Quuboid, 3), Issue Traceability Matrix for Jira (CURVC, 26). Server support ended on 2024-02-15, so these are context only.

## 3. Apps with a cloud version that the vendor says does less

Each gap is in the vendor's own words. We do not say the cloud app is worse; we say which rows the vendor marks as not in cloud.

| App | Vendor | Hosting | Installs | Cloud gap, vendor wording | Vendor source and date | Our cover | Not covered by us |
|---|---|---|---|---|---|---|---|
| Electronic Signatures (Jira) | Appfire | C, DC, S | 293 | DC yes, Cloud no: "Requiring Electronic Signatures on the ticket transition screen", "Bulk operation with Electronic Signatures", "Exception for Signing an Issue", "JQL functions". Both: "Check user credentials before the transition is performed (ES Validator)". | https://support.appfire.com/space/ESF/17498212/ES+cloud+-+FAQ, last updated 2026-11-03. Marketplace: /apps/1211601/electronic-signatures | LedgerSeal: seal, change detection, validator on the transition | Credential check at signing (Appfire cloud has it; we do not). Bulk signing. |
| Checklists for Jira (Enterprise) | HeroCoders | C, DC, S | 4,496 | DC yes, Cloud no: "Workflow condition", "Retrieve global and default items via API", "Edit checklist configuration via API", and others. Cloud: "There are limitation for using Checklists on Create and Transition screens." Workflow validator: both. | https://docs.herocoders.com/checklist/checklist-for-jira-on-prem-vs-cloud-feature-compar (no date on page). Marketplace: /apps/1211562 | DefinitionGuard: validator on moves into Done, evidence-required items, not-the-assignee rule, waivers with reasons, hash-chained history | A workflow condition (hiding a transition). We block with a validator, which the vendor also lists in cloud. |
| Smart Checklists for Jira | TitanApps | C, DC, S | 4,641 | DC yes, Cloud no: "Modify checklist post function", "Smart Checklist REST API". Completion validators: both. Cloud has more features in several rows. | https://railsware.atlassian.net/wiki/spaces/CHK/pages/1836711938, last updated 2026-09-18. Marketplace: /apps/1216451 | DefinitionGuard | A checklist REST API; post functions |
| Jira Misc Workflow Extensions (JMWE) | Appfire | C, DC, S | 16,190 | "Shared Conditions are not migrated as this functionality is not available on Jira Cloud." The same for Shared Validators. | https://support.appfire.com/space/JMWE/461472097, body says "Last updated 06 Nov 2025". Marketplace: /apps/292 | Partly: our two validators | A general workflow toolbox |
| Workflow Enhancer for Jira | TNG | C, DC, S | 1,343 | Post functions: DC "Can execute other Jira or third-party app post functions"; Cloud "Can execute Jira REST API calls". Conditions and validators: both. | https://documentation.appsbytng.com/workflow-enhancer-for-jira/?contextKey=feature-comparison&version=latest&variant=default (no date). Marketplace: /apps/575829 | Partly | A general workflow toolbox |
| Release Management (cloud listing) | Release Management | C | 1,030 | DC only: custom JQL functions ("No workarounds available"), Milestones Report ("no plans so far"). | https://help.releasemanagement.app/space/RM4J/1643544577/Migration+to+Cloud (no date). Marketplace: /apps/1221946 | Partly: LedgerSeal gate | Release planning |
| Page Approval for Confluence | Appfire | C, DC, S | 1,609 | Cloud: "Create approval templates for space": "Not supported." | https://support.appfire.com/space/PAFS/2214953325, last updated 2026-08-26. Marketplace: /apps/144 | None (Jira only) | Confluence page approval |

Cloud apps in the same categories with no gap found or not checked (for awareness, not a wedge): Herzum Approval (STAGIL, C/DC/S, 294), Vera Electronic Signatures for Jira (Tricentis, C/DC/S, 115), Group Sign-Off (Werkstack, C/DC/S, 199), WorkflowWise (DragonSoft, 105), Approvals for Confluence (AppFox, 927; its comparison page returned 404), JSU (Appfire, 11,811; comparison not read), Jira Workflow Toolbox (Decadis, 4,720), Xray (25,168), R4J (1,900).

Cloud-only apps in our categories (they are the natural "alternatives" a migrating admin will also see): eSign Signatures for Jira (Digital Rose, 690), Approval Path for Jira (Warsaw Dynamics, 247), Ketryx Lifecycle Management for Jira (Ketryx, 289), Checklists for Jira Pro (HeroCoders, 7,764), Definition of Done (Chasing Agility, 60), Advanced Audit Log for Jira (SaaSJet, 19), SoftComply Document Manager, Validation and Static Snapshots for Confluence (119, 55, 122), Approval Gate for Jira (Ballon Apps, installs not shown). We did not compare their features in this round.

Not found on the Marketplace by search: Aligned Elements, Elements Checklist, a SoftComply "eSign" app.

## 4. The strongest wedges

Ranked by how directly one of our apps answers the need, then by installs. "Wedge" means a migrating admin will see "not available in cloud" or a vendor-stated cloud gap, and has a need we cover.

| Rank | App (vendor) | Why it is a wedge | Our app | The honest limit to say up front |
|---|---|---|---|---|
| 1 | Electronic Signature for Jira (Deviniti), 56 installs, DC/S | Part 11 transition signature with no cloud version; migration path UNKNOWN | LedgerSeal | LedgerSeal supports the audit trail (11.10(e)) and partly 11.50; it does not meet 11.200 or 11.300 |
| 2 | Approvals - Advanced Issue Acceptance (Deviniti), 151, DC/S | Approval of issues, no cloud version | LedgerSeal | No multi-step approval routing |
| 3 | Appfire Electronic Signatures, 293, C/DC/S | Vendor lists "Requiring Electronic Signatures on the ticket transition screen" as DC only | LedgerSeal (validator on the transition) | Appfire cloud checks credentials; LedgerSeal does not |
| 4 | Checklists for Jira (HeroCoders), 4,496 Enterprise; and Smart Checklists, 4,641 | Large DC bases; vendor-stated cloud gaps (workflow condition, APIs, post function) | DefinitionGuard | Both vendors list a completion validator in cloud. Our difference is evidence-required items, the not-the-assignee rule, waivers with reasons and the hash-chained history, not the gate itself. |
| 5 | Auditor for Jira (Enhancera), 148, DC/S | Audit app with no cloud version | FourRealities (evidence per issue) | Not a general Jira audit log |

These counts are small. The wedge is a message, not a market size: "the governance step you had on Data Center has a cloud answer". The larger buyers are the 4,000+ install checklist apps' DC users and the teams with in-house Data Center scripts and plugins (not visible in Marketplace data).

## 5. How cloud alternatives are suggested

### 5.1 In the customer's migration tools

| Tool | What it shows | Source |
|---|---|---|
| Jira Cloud Migration Assistant (JCMA), app assessment | For an app with no cloud version: a red cross, "a cloud version of the Marketplace app does not exist", and "This app is not available in cloud". The admin can choose "Choose alternative": "Selecting this option for an app will allow you to choose an alternative app later in the flow." | https://support.atlassian.com/migration/docs/assess-apps-with-the-jira-cloud-migration-assistant/ (no page date; read 2026-11-08) |
| JCMA, later screen | "apps that you select Choose alternative option will automatically show you Marketplace alternatives in the next screen." "It's important to understand that these are not recommended by Atlassian, and are selected based on similarity in functionality." | https://support.atlassian.com/migration/docs/audit-apps-for-your-migration-to-cloud/ (no page date) |
| Portfolio Insights | "Alternative needed" decision; selections are "available to view by our Support and Migration teams". No suggestion list is described. | https://support.atlassian.com/portfolio-insights/docs/assess-marketplace-and-custom-apps/ (no page date) |

### 5.2 How Atlassian picks the alternatives

Atlassian Knowledge Base, "Cloud alternatives to your Atlassian Marketplace Data Center/Server apps", https://support.atlassian.com/atlassian-knowledge-base/kb/cloud-alternatives-to-your-atlassian-marketplace-data-center-server-apps/ (last updated 2025-09-25). It lists the data points Atlassian uses:

1. alternatives customers chose when they migrated;
2. Atlassian cloud platform and product features;
3. similar keywords in Marketplace listing descriptions;
4. apps customers also reviewed before they chose one;
5. successor apps from the same partner;
6. insights from Atlassian's migration teams, and listings that set a `cloudAddonKey` through the Migrations API.

The per-product Jira list (https://confluence.atlassian.com/kb/cloud-alternatives-to-your-jira-marketplace-data-center-server-apps-1130372893.html, last modified 2025-04-18) has rows for checklists, audit logs, workflows and release management. It has no rows for approvals, electronic signatures or Definition of Done.

### 5.3 How a vendor gets listed

- **Documented, for the vendor of the DC app:** the ECOHELP form "As a Marketplace Partner, I wish to have my app added / removed from this page" (https://ecosystem.atlassian.net/servicedesk/customer/portal/34/group/129/create/668). The text is about the DC app's own entry. We found no documented way for an unrelated cloud vendor to nominate itself.
- **Documented, through the DC vendor's migration record:** `cloudAddonKey` in `PUT /rest/2/addons/{addonKey}/migration` (https://developer.atlassian.com/platform/marketplace/rest/v2/api-group-migrations/). The page says "Forge and OAuth2 apps cannot access this REST resource", and the record belongs to the DC app. Observed: Workflow Essentials for Jira (codecentric) sets `cloudAddonKey` to Jira Workflow Toolbox (Decadis), another vendor's app. So a DC vendor with no cloud plans could name one of our apps; only that vendor can do it.
- **Indirect:** listing keywords (item 3 above) and customer choices (item 1). This is the part we control: our listing text should use the words of the DC apps' needs ("electronic signature", "approval", "Definition of Done", "checklist", "audit"). The post-approval copy in each listing file does this.

What we cannot claim: that Atlassian recommends our apps, or that JCMA will show them. Atlassian says the suggestions are "not recommended by Atlassian".

## 6. Open points

1. The JCMA suggestion screen itself was not seen (it needs a Data Center instance with JCMA). Whether our apps appear there is unknown.
2. Comala Document Management (Appfire, Confluence): the only comparison page found is archived, so the app is left out of section 3 until the vendor's current comparison page is read.
3. Feature lists of Deviniti Approvals, Kanoah Checklist and Herzum Approval were not read. Read them before a partner brief names a gap of ours against them.
4. Install counts change weekly. Recheck before any number is used in public copy, and give the date.
