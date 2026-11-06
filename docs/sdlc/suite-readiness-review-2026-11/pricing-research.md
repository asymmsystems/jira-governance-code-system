# Pricing research for the four Asymm Systems Jira Cloud apps

Date of research: 2026-11-06 (every page and API call below was fetched on this date).
Scope: CascadePlan, LedgerSeal, DefinitionGuard, FourRealities. Jira Cloud, per-user pricing.
Current plan for all four: free up to 10 users, $1.50 per user per month for 11-100 users, $1.20 for 101-250, $0.90 for 251-1,000, custom above.

Part A and part B hold facts with sources. Part C holds my analysis. Part D holds my recommendation. I kept them apart on purpose.

## Short answer

- CascadePlan is at the market on the 11-100 band and above it on the bigger bands. LedgerSeal and DefinitionGuard are above the market. FourRealities is above the middle of its closest group and below the best-known rivals.
- LedgerSeal is dearer than all 9 signature and approval apps I priced, at every size.
- DefinitionGuard is dearer than all 9 checklist apps I priced, at every size. It is close to the price of workflow-validator apps.
- FourRealities sits between health-check apps (cheap) and requirements apps (about $2.00 on the small tier). It has no direct rival.
- The shape of the plan is the main weakness. Typical apps cut the price much harder at large sizes than your plan does. The median app charges 35 percent of its 11-100 rate at 251-1,000 users. Your plan charges 60 percent.
- Recommended plan (details in part D):

| App | Free 1-10 | 11-100 | 101-250 | 251-1,000 |
|---|---|---|---|---|
| CascadePlan | yes | $1.50 | $1.10 | $0.55 |
| LedgerSeal | yes | $1.30 | $1.05 | $0.75 |
| DefinitionGuard | yes | $1.10 | $0.80 | $0.40 |
| FourRealities | yes | $1.50 | $1.10 | $0.60 |

## Method and source labels

What worked, and what did not:

- Marketplace listing pages (for example `https://marketplace.atlassian.com/apps/1213016/biggantt-gantt-chart-for-jira?tab=pricing&hosting=cloud`) did NOT give prices when fetched. The pricing section loads with JavaScript and the page text had only collapsed FAQ headings.
- The Marketplace REST API WORKED with plain HTTPS GET and no login. I sent no email address and no personal data. I used these calls:
  - `https://marketplace.atlassian.com/rest/2/addons?text=<words>&application=jira&hosting=cloud&limit=50` for search (installs and ratings).
  - `https://marketplace.atlassian.com/rest/2/addons/<addon-key>` for installs and ratings of one app.
  - `https://marketplace.atlassian.com/rest/2/addons/<addon-key>/pricing/cloud/live` for the live price list (fields `items` for annual tiers and the 10-user tier, `perUnitItems` for per-user monthly rates).
- Vendor pages worked for some apps and were used as a cross-check (Planyway, Tempo, Easy Agile, Ketryx). Appfire pages returned HTTP 429 (too many requests), so BigPicture and BigGantt prices rest on the Marketplace API alone.
- Atlassian's own pages worked for Jira prices: `https://www.atlassian.com/licensing/future-pricing/cloud/list/pricing-tables` and `https://www.atlassian.com/software/jira/pricing`.

Source labels used in this file:

- **[API]** = Marketplace REST API pricing endpoint. This is the vendor's own price, stored by Atlassian, and the same data the listing page shows. Treated as primary.
- **[VENDOR]** = the vendor's own web page.
- **[ATLASSIAN]** = an Atlassian web page or Atlassian developer or support page.
- **[SECONDARY]** = a blog, forum, search snippet or aggregator. Used only as a pointer, flagged each time.

Cross-checks that agree with the API (so I trust the API numbers):

- Planyway page `https://planyway.com/jira/pricing`: $3.00 / $1.80 / $1.30 and "Free for teams up to 10 Jira users". API says $3.00 / $1.80 / $1.30 and free. Match. [VENDOR + API], seen 2026-11-06.
- Tempo page `https://www.tempo.io/pricing/jira-gantt-chart`: 1-10 flat $10.00, then $1.46 / $1.05 / $0.59. API says the same. Match. [VENDOR + API], seen 2026-11-06. (A web search snippet showed older Tempo numbers, $1.27 / $0.91 / $0.49. I ignored that snippet. The live page and the API agree with each other.)
- Easy Agile page `https://www.easyagile.com/pricing`: "Free for up to 10 users" for both apps. API says free. Match. The page itself has no rates; it points to the Marketplace.
- The annual tier prices in the API equal ten times the computed monthly total for every app I checked, up to 1,000 users. This confirms how I turned per-user rates into totals (see A1).

The API also has a field `renewalAmount` that is exactly half of `amount` for every item. I ignored it, because the vendor pages above match `amount`, not `renewalAmount`.

Install counts and ratings: from the Marketplace API, 2026-11-06. Where the single-app endpoint returned 0 installs, I used the search endpoint number and marked it with `*`. Ratings come from the single-app endpoint, which matched a check I did against the individual reviews of BigGantt (2.77 average of 273 reviews versus 2.75 in the endpoint). The search endpoint showed a different, higher rating for several apps (for example BigGantt 3.46) so I did not use search ratings. Treat install counts and ratings as approximate.

## Part A. Facts: how Atlassian cloud app pricing works for vendors

A1. User tiers. [API] The monthly per-user rate bands in the API are 1-10 (flat price), 11-100, 101-250, 251-1,000, 1,001-2,500, 2,501-5,000, and so on. This matches your plan. [ATLASSIAN] The developer page `https://developer.atlassian.com/x/1IaI` ("Pricing, payment, and billing", last updated Jun 17, 2025) refers to the [11-100] and [101-250] tiers and says the vendor sets a per-user price per tier. Annual prices are flat prices for fixed user counts (10, 15, 25, 50, 100, 200, 300 ... in the API).

A2. How a total is built from per-user rates. [API, my computation, checked against annual prices] The rate of the tier that holds the customer applies to every user inside the bands up to that tier, in steps. Example: 250 users at your plan = 100 x $1.50 + 150 x $1.20 = $330 per month, an average of $1.32 per user. Inside the 11-100 band every user pays the band rate, including the first 10. So a customer with 11 users pays 11 x $1.50 = $16.50 per month, not 1 x $1.50. [ATLASSIAN] Atlassian's licensing page `https://www.atlassian.com/licensing/future-pricing/cloud` describes the same "progressive per-user pricing model" for its own monthly prices (Jira Standard, 450 users: 100 x $9.70 + 150 x $8.20 + 200 x $6.85 = $3,570).

A3. Free 1-10 tier. [ATLASSIAN] Atlassian Developer Community post of Dec 7, 2021 (`https://community.developer.atlassian.com/t/introducing-a-new-0-price-point-for-your-1-10-cloud-app-user-tier/54225`): vendors can set the 1-10 user tier "to any price including $0". The post sets no minimum and no other eligibility test, and says it is "the only exception to the current progressive discounting rule". Support terms for free users are up to the vendor. So a free 1-10 tier is allowed. [API, my count] Of the 400 most-installed Jira Cloud apps, 376 have a public Marketplace price and 285 of those (76 percent) have a free 1-10 tier. Of the 91 that charge for 1-10 users, the middle flat price is $10 per month (range $0.40 to $50; the most common values are $10 and $5).

A4. Minimum price. [ATLASSIAN] I found no minimum price in the documents I could read (`https://developer.atlassian.com/x/1IaI` and the Dec 2021 post both give none). [API] The lowest 11-100 rate among the 376 priced top apps is $0.10 per user per month (Checklist for Jira (Lite) by Appbox.ai; TraceabilityX for Jira also lists $0.10). So the floor is at most $0.10. I did not find the Partner Portal rules, which may hold a floor that I could not see.

A5. Monthly versus annual. [ATLASSIAN] `https://developer.atlassian.com/x/1IaI`: "we charge 10 times monthly price as annual price for cloud apps". So annual billing costs ten monthly payments (two months free). [API] Confirmed: annual price = 10 x monthly total for every app I checked. Atlassian billing change: [ATLASSIAN] `https://support.atlassian.com/subscriptions-and-billing/docs/how-maximum-quantity-billing-works/` says monthly subscriptions, Marketplace apps included, move to "maximum quantity billing" in phases from July 14, 2025, with all expected by October 2025. A monthly customer pays for the highest user count in the period; added users are prorated; removed users give no credit. Annual billing is not described on that page. Planyway's page says the same for its monthly plans.

A6. Other rules. [ATLASSIAN] `https://developer.atlassian.com/x/1IaI`: price changes go live in 24 hours and can be made as often as wanted; existing customers get a 60-day price override to renew at the lower price if the vendor lowers prices, if they stay on the same user tier; vendors can run sales promotions; Solution Partner discounts are opt-in; the page has a "Price Guidance" tool that compares tiers; Forge-only apps qualify for the Forge revenue share rate; for Forge apps with licensing enabled, "Paid via Atlassian app licenses have to exactly match the Atlassian host app license". [ATLASSIAN] Dev community post of May 22, 2023: new higher tiers start at the price of the tier below until the vendor changes them. [ATLASSIAN] Atlassian says Marketplace app prices "are not changing as a direct result" of Atlassian's own price update of 2026-10-13 (`https://www.atlassian.com/licensing/future-pricing/cloud`).

A7. Which user count sets the tier. [SECONDARY, search result summary of Atlassian community text, not opened] Jira Cloud apps are priced on the highest user count among the Jira products on the instance. Tempo's page agrees in its own words: "Your Tempo license size must match your Jira license size." [VENDOR]

## Part B. Facts: price ranges and rival prices

### B1. Typical price range for small single-purpose Jira Cloud apps

[API, my calculation, 2026-11-06] I priced the 400 most-installed Jira Cloud apps (all have at least 116 installs). 376 had a public price. The table gives monthly price per user in each band.

| Band | 10th percentile | 25th | Median | 75th | 90th |
|---|---|---|---|---|---|
| 11-100 users | $0.45 | $0.70 | $1.10 | $1.91 | $3.31 |
| 101-250 users | $0.30 | $0.50 | $0.77 | $1.20 | $1.77 |
| 251-1,000 users | $0.19 | $0.25 | $0.40 | $0.60 | $1.00 |

- Apps with 100 to 3,000 installs (n = 322, the "small single-purpose" end) have a median of $1.00 / $0.745 / $0.39 and a middle half of $0.65 to $1.64 on the 11-100 band.
- 109 of 376 apps charge $0.50 to $0.99 on the 11-100 band, 89 charge $1.00 to $1.49, 48 charge $1.50 to $1.99, and 88 charge $2.00 or more. 42 charge under $0.50.
- Median shape: the 101-250 rate is 68 percent of the 11-100 rate, and the 251-1,000 rate is 35 percent of it. Your plan has 80 percent and 60 percent.
- Your current rates rank like this among the 376 apps (share of apps that charge less): $1.50 on 11-100 = 64th percentile; $1.20 on 101-250 = 74th; $0.90 on 251-1,000 = 88th.
- Files: scratch data in `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/suite-readiness/pricing/survey.json`.

### B2. What Jira itself costs, and the Premium uplift (CascadePlan)

[ATLASSIAN] `https://www.atlassian.com/licensing/future-pricing/cloud/list/pricing-tables` (seen 2026-11-06). New list prices took effect 2026-10-13. Monthly price per user:

| Users | Jira Standard | Jira Premium | Premium minus Standard |
|---|---|---|---|
| 1-100 | $9.70 | $19.60 | $9.90 |
| 101-250 | $8.20 | $14.65 | $6.45 |
| 251-1,000 | $6.85 | $10.20 | $3.35 |

Average per user per month for a whole instance (my calculation from those bands; monthly billing):

| Instance size | Standard | Premium | Uplift for Premium |
|---|---|---|---|
| 50 users | $9.70 | $19.60 | $9.90 |
| 100 users | $9.70 | $19.60 | $9.90 |
| 250 users | $8.80 | $16.63 | $7.83 |
| 1,000 users | $7.34 | $11.81 | $4.47 |

Annual list (same Atlassian page): 50 users Standard $4,850 versus Premium $9,800 per year; 100 users $9,700 versus $19,500 per year. That is $8.08 versus $16.33 per user per month at 50 users (uplift $8.25) and $8.08 versus $16.25 at 100 users (uplift $8.17).

[ATLASSIAN] `https://www.atlassian.com/software/jira/pricing`: Free plan is "Free forever for 10 users"; the feature list marks "Advanced roadmaps (Premium)". The same page's JSON data shows $8.48 (Standard) and $15.56 (Premium) per user per month; these equal the instance average at 300 users, so they match the table above. [ATLASSIAN] `https://support.atlassian.com/jira-software-cloud/docs/how-do-i-read-my-advanced-roadmaps-plan/`: "the advanced planning features that are only available as part of Jira Cloud Premium and Enterprise". Plans (the new name for Advanced Roadmaps) is therefore Premium and Enterprise only, and the uplift above is what a customer pays to get it.

Jira's built-in project timeline costs nothing extra. [SECONDARY, search snippet of an Atlassian Community article, not opened] The article says Free, Standard and Premium all have a timeline view; an Atlassian support page snippet separates the project timeline from Plans. I did not open an official page that lists the timeline per plan, so treat "included in every plan" as likely, not confirmed. Price: $0 extra.

Third-party summaries of Jira prices gave different figures for different dates and billing types. I used only the Atlassian table.

### B3. Rival apps: CascadePlan (Gantt and timeline)

Columns: rates are the monthly per-user rate for the 11-100 / 101-250 / 251-1,000 bands. The five size columns show the average monthly price per user at that instance size, using the step method in A2 and monthly billing. For annual billing multiply by 10/12 (about 0.83). "Free 1-10" says whether 10 users pay nothing; a flat figure is what 10 users pay per month in total. "Prices last changed" is the `lastModified` date in the API. All rows: source [API], seen 2026-11-06. Feature match to CascadePlan (percent triggers, baselines with hashes, scope-change approval) was NOT checked; the apps are compared on category and price only.

| App (key) | Vendor | Installs | Rating (reviews) | Free 1-10 | Rate 11-100 / 101-250 / 251-1,000 | 10 users | 50 | 100 | 250 | 1,000 | Prices last changed |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BigPicture PPM & Strategic Portfolio Management for Jira (`eu.softwareplant.bigpicture`) | Appfire | 10,326 | 3.11 (528) | yes | $5.73 / $4.80 / $1.58 | free | $5.73 | $5.73 | $5.17 | $2.48 | 2026-10-13 |
| BigGantt - Gantt Chart for Jira (`eu.softwareplant.biggantt`) | Appfire | 5,512 | 2.75 (276) | yes | $2.09 / $1.27 / $0.53 | free | $2.09 | $2.09 | $1.60 | $0.80 | 2026-10-13 |
| Structure by Tempo - Jira Portfolio Management PPM (`com.almworks.jira.structure`) | Tempo Software | 12,539 | 3.59 (423) | no, flat $10/mo | $4.05 / $2.73 / $2.71 | $10 flat | $4.05 | $4.05 | $3.26 | $2.85 | 2026-10-23 |
| Gantt Charts for Structure PPM - Jira Roadmaps - Tempo (`com.almworks.structure.gantt`) | Tempo Software | 6,269 | 3.28 (65) | no, flat $10/mo | $1.46 / $1.05 / $0.59 | $10 flat | $1.46 | $1.46 | $1.21 | $0.75 | 2026-10-13 |
| WBS Gantt-Chart for Jira (Enterprise Project Management) (`jp.ricksoft.plugins.wbsgantt-for-jira`) | Ricksoft, Inc. | 5,314 | 2.76 (167) | yes | $1.32 / $0.90 / $0.47 | free | $1.32 | $1.32 | $1.07 | $0.62 | 2026-10-13 |
| Gantt-Chart for Jira (`de.polscheit.jira.plugins.gantt`) | Werkstack GmbH | 450* | 2.75 (130) | no, flat $6/mo | $1.20 / $0.90 / $0.30 | $6 flat | $1.20 | $1.20 | $1.02 | $0.48 | 2026-10-13 |
| Gantt Cloud (`eu.wisoft.gantt-ondemand`) | WISOFT | 907* | 2.96 (85) | no, flat $2.5/mo | $0.45 / $0.30 / $0.10 | $2.5 flat | $0.45 | $0.45 | $0.36 | $0.17 | 2026-10-13 |
| Advanced Roadmaps, Resource Capacity Planning, Time Tracking (`com.planyway`) | Planyway for Jira | 1,383 | 3.14 (57) | yes | $3.00 / $1.80 / $1.30 | free | $3.00 | $3.00 | $2.28 | $1.54 | 2026-10-13 |
| Swanly: Portfolio Roadmaps Structure Gantt, Release Timeline (`swanly-jexo-release-management`) | Appfire | 1,525 | 4.06 (64) | yes | $2.12 / $1.40 / $0.37 | free | $2.12 | $2.12 | $1.69 | $0.70 | 2026-10-13 |
| Easy Agile Roadmaps for Jira (`com.arijea.easy-agile-roadmaps`) | Easy Agile | 1,241 | 3.54 (65) | yes | $1.65 / $1.14 / $0.49 | free | $1.65 | $1.65 | $1.34 | $0.70 | 2026-10-13 |
| Easy Agile TeamRhythm: Story Map, Insights & Retrospectives (`com.kretar.jira.plugin.user-story-map`) | Easy Agile | 3,299 | 3.49 (171) | yes | $2.80 / $2.40 / $0.80 | free | $2.80 | $2.80 | $2.56 | $1.24 | 2026-10-13 |
| Project Management, Resource Planning & Gantt Chart for Jira (`com.devsamurai.plugin.jira.team-board`) | DevSamurai | 2,951 | 4.34 (178) | yes | $1.75 / $1.25 / $0.50 | free | $1.75 | $1.75 | $1.45 | $0.74 | 2026-10-23 |
| GanttTable: Gantt Charts, Structure Sheets Tables for Jira (`0d9d96c7-3a58-4444-9592-60338db004f4`) | DevSamurai | 1,301 | 4.69 (17) | yes | $1.50 / $1.00 / $0.30 | free | $1.50 | $1.50 | $1.20 | $0.53 | 2026-10-23 |
| Portfolio by HeroCoders (Structure PPM for Jira & Capacity) (`com.herocoders.plugins.jira.epicsmap`) | HeroCoders | 4,941* | 4.45 (77) | yes | $0.90 / $0.70 / $0.30 | free | $0.90 | $0.90 | $0.78 | $0.42 | 2026-10-24 |
| Gantt Suite for Jira: project management & resource planning (`com.brizoit.gantt`) | BrizoIT | 1,082 | 4.42 (16) | yes | $1.60 / $1.10 / $0.45 | free | $1.60 | $1.60 | $1.30 | $0.66 | 2026-10-13 |
| Portfolio Roadmaps, Kanban & Timeline Structure for Jira (`com.devsamurai.plugin.jira.route-map`) | DevSamurai | 1,445 | 4.25 (30) | yes | $1.50 / $1.00 / $0.30 | free | $1.50 | $1.50 | $1.20 | $0.53 | 2026-10-13 |
| Activity Timeline: Resource Capacity Planning, Time Tracking (`com.reliex.activitytimeline.cloud.atlassian.connect`) | Reliex | 3,479 | 3.56 (125) | no, flat $10/mo | $2.50 / $1.80 / $1.30 | $10 flat | $2.50 | $2.50 | $2.08 | $1.50 | 2026-10-13 |

Not in the Marketplace price list:

- Jira Plans / Advanced Roadmaps (Atlassian): not sold as an app. Included in Jira Premium; uplift per user in B2 ($9.90 at 11-100 users, $6.45 at 101-250, $3.35 at 251-1,000).
- Jira built-in timeline: $0 extra (B2).
- "Gantt Chart for Jira by Elements": I found no such Jira Cloud listing in searches for "Elements Gantt". The Elements vendor listings returned were unrelated apps.
- Aha! Roadmaps for Jira (`io.aha.connect`): the listing says "You need a paid Aha! account", and the price endpoint returned 404. Not priced.

### B4. Rival apps: LedgerSeal (signatures, approvals, audit)

Same columns and sources as B3. [API] unless noted.

| App (key) | Vendor | Installs | Rating (reviews) | Free 1-10 | Rate 11-100 / 101-250 / 251-1,000 | 10 users | 50 | 100 | 250 | 1,000 | Prices last changed |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Electronic Signatures (`ru.andreymarkelov.atlas.plugins.signaturefields`) | Appfire | 298* | 3.61 (23) | yes | $1.09 / $0.88 / $0.69 | free | $1.09 | $1.09 | $0.96 | $0.76 | 2026-10-13 |
| eSign Signatures for Jira (`esign`) | Digital Rose | 688 | 5.00 (10) | yes | $1.30 / $1.20 / $1.05 | free | $1.30 | $1.30 | $1.24 | $1.10 | 2026-10-13 |
| Contract Signatures for Jira (`document-sign-jira`) | Warsaw Dynamics | 99 | 4.06 (6) | no, flat $10/mo | $0.95 / $0.65 / $0.55 | $10 flat | $0.95 | $0.95 | $0.77 | $0.60 | 2026-10-13 |
| Herzum Approval (`com.herzum.jira.plugin.approval.herzum-approval-plugin`) | STAGIL by catworkx | 301 | 2.65 (17) | no, flat $10/mo | $1.00 / $0.95 / $0.85 | $10 flat | $1.00 | $1.00 | $0.97 | $0.88 | 2026-10-13 |
| Approval Path for Jira (`ovh.atlassianinc.approval-path.jira`) | Warsaw Dynamics | 249 | 5.00 (29) | no, flat $10/mo | $1.25 / $1.05 / $0.95 | $10 flat | $1.25 | $1.25 | $1.13 | $0.99 | 2026-10-13 |
| Group Sign-Off: parallel Multi-Approvals (`de.polscheit.jira.plugins.group-sign-off`) | Werkstack GmbH | 203* | 4.88 (41) | no, flat $5.5/mo | $0.94 / $0.94 / $0.68 | $5.5 flat | $0.94 | $0.94 | $0.94 | $0.74 | 2026-10-13 |
| Approval for Jira (`com.pascal.reviewhub`) | Candylio Solutions | 29 | 4.64 (8) | no, flat $10/mo | $1.00 / $0.90 / $0.80 | $10 flat | $1.00 | $1.00 | $0.94 | $0.83 | 2026-10-13 |
| Easy Approval For Jira (`com.techdrishti.plugins.eja`) | Easidash Solutions Private Limited | 23 | 4.38 (4) | no, flat $10/mo | $1.25 / $0.88 / $0.60 | $10 flat | $1.25 | $1.25 | $1.03 | $0.71 | 2026-10-13 |
| WorkflowWise - Parallel Approval and Workflow Extension (`com.shdsd.jira.plugin.WorkflowWise`) | DragonSoft | 107 | 4.00 (6) | yes | $1.20 / $0.80 / $0.40 | free | $1.20 | $1.20 | $0.96 | $0.54 | 2026-10-13 |
| Vera Electronic Signatures for Jira (`com.tx3.vera.vera3Plugin`) | Tricentis | 114 | 4.00 (5) | no public Marketplace price (pricing endpoint returned 404) | - | - | - | - | - | - | - |
| Ketryx Lifecycle Management for Jira (`com.ketryx.app.atlassian`) | Ketryx | 288 | 5.00 (14) | no public Marketplace price (pricing endpoint returned 404) | - | - | - | - | - | - | - |
| User Activity Audit Log (`twinit-reports-app`) | Twinit | 223 | 5.00 (7) | yes | $1.60 / $1.20 / $0.40 | free | $1.60 | $1.60 | $1.36 | $0.64 | 2026-10-13 |
| Advanced Audit Log for Jira (`audit.log`) | SaaSJet Studios | 19 | 0.00 (0) | yes | $0.40 / $0.30 / $0.20 | free | $0.40 | $0.40 | $0.34 | $0.23 | 2026-10-13 |
| Doctor Governed: Audit, Optimize & Manage Configuration (`ai.appforge.jira.doctorforjira`) | AppForge.ai | 155 | 5.00 (4) | yes | $1.80 / $1.10 / $0.60 | free | $1.80 | $1.80 | $1.38 | $0.80 | 2026-10-13 |

Notes:

- Ketryx: [VENDOR] `https://www.ketryx.com/pricing`, seen 2026-11-06: one Free plan at $0 per year "for pre-market companies ... that have raised less than $2 million in funding". The Startup, Business and Enterprise plans show no price ("contact sales"). No per-user figure is published. The Marketplace pricing endpoint returned 404.
- Vera Electronic Signatures for Jira (Tricentis): the Marketplace pricing endpoint returned 404; no public price found.
- "Electronic Signatures for Jira", "Approvals for Jira", "Approval Path" and Herzum Approval are in the table under their listing names (Electronic Signatures by Appfire; Approval for Jira by Candylio; Approval Path for Jira by Warsaw Dynamics; Herzum Approval by STAGIL). I did not find a Jira Cloud app that advertises hash snapshots plus a validator that blocks changes after approval, so none is a feature-for-feature rival.
- 21 CFR Part 11 search returned Appfire Electronic Signatures, eSign Signatures, Vera and Ketryx among the relevant results. The first two are priced above; the last two have no public price.

### B5. Rival apps: DefinitionGuard (checklists, Definition of Done, validators)

Same columns and sources as B3. [API] unless noted. Names: "Checklists for Jira (Pro) by HeroCoders" is the app formerly sold as Issue Checklist (Gebsun); "Checklists for Jira (Enterprise) by HeroCoders" is the one formerly sold by Okapya; "Smart Checklists for Jira" is TitanApps (Smart Checklist).

| App (key) | Vendor | Installs | Rating (reviews) | Free 1-10 | Rate 11-100 / 101-250 / 251-1,000 | 10 users | 50 | 100 | 250 | 1,000 | Prices last changed |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Smart Checklists for Jira (`rw-smart-checklist-biz`) | TitanApps | 4,649 | 3.39 (151) | yes | $0.90 / $0.70 / $0.24 | free | $0.90 | $0.90 | $0.78 | $0.38 | 2026-10-13 |
| Checklists for Jira (Pro) by HeroCoders (`com.gebsun.plugins.jira.issuechecklist`) | HeroCoders | 7,774* | 4.54 (278) | yes | $0.82 / $0.60 / $0.22 | free | $0.82 | $0.82 | $0.69 | $0.34 | 2026-10-13 |
| Checklists for Jira (Enterprise) by HeroCoders (`com.okapya.jira.checklist`) | HeroCoders | 4,529 | 3.39 (149) | no, flat $5/mo | $1.00 / $0.80 / $0.25 | $5 flat | $1.00 | $1.00 | $0.88 | $0.41 | 2026-10-13 |
| Checklist for Jira (Lite) (`com.appbox.ai.checklist`) | Appbox.ai | 2,357 | 4.35 (61) | yes | $0.10 / $0.08 / $0.06 | free | $0.10 | $0.10 | $0.09 | $0.07 | 2026-10-28 |
| Checklist for Jira (Enterprise) (`com.appbox.ai.checklist.enterprise`) | Appbox.ai | 217* | 4.64 (26) | yes | $0.50 / $0.40 / $0.30 | free | $0.50 | $0.50 | $0.44 | $0.34 | 2026-10-13 |
| Multiple Checklists for Jira (`com.soldevelo.apps.checklists`) | SolDevelo | 1,054 | 3.81 (36) | yes | $0.50 / $0.35 / $0.15 | free | $0.50 | $0.50 | $0.41 | $0.21 | 2026-10-13 |
| Didit - Checklists for Jira (`checklists-jira`) | Seibert | 490 | 4.86 (40) | yes | $0.70 / $0.55 / $0.20 | free | $0.70 | $0.70 | $0.61 | $0.30 | 2026-10-13 |
| Definition of Done (`definition-of-done`) | Chasing Agility | 60 | 2.81 (4) | no, flat $1.5/mo | $0.25 / $0.25 / $0.15 | $1.5 flat | $0.25 | $0.25 | $0.25 | $0.17 | 2026-10-13 |
| ReDo - Definition of Ready & Done for Jira (`com.monteteam.redo`) | Monteteam | 10 | 5.00 (2) | yes | $0.91 / $0.77 / $0.64 | free | $0.91 | $0.91 | $0.83 | $0.69 | 2026-10-13 |
| Checklists for Jira (Free) by HeroCoders (`com.herocoders.plugins.jira.issuechecklist-free`) | HeroCoders | 30,128* | 4.79 (1026) | no public Marketplace price (pricing endpoint returned 404) | - | - | - | - | - | - | - |
| Smart Checklists & Templates for Jira (Free) (`rw-smart-checklists`) | TitanApps | 4,911 | 4.27 (84) | no public Marketplace price (pricing endpoint returned 404) | - | - | - | - | - | - | - |
| Jira Misc Workflow Extensions (JMWE) (`com.innovalog.jmwe.jira-misc-workflow-extensions`) | Appfire | 16,277 | 3.76 (552) | yes | $2.00 / $1.54 / $0.61 | free | $2.00 | $2.00 | $1.72 | $0.89 | 2026-10-13 |
| JSU Automation Suite for Jira Workflows (`com.googlecode.jira-suite-utilities`) | Appfire | 11,930 | 3.60 (309) | yes | $1.35 / $1.08 / $0.36 | free | $1.35 | $1.35 | $1.19 | $0.57 | 2026-10-13 |
| Jira Workflow Toolbox (`com.fca.jira.plugins.workflowToolbox.workflow-toolbox`) | Decadis AG | 4,761 | 3.91 (550) | yes | $1.50 / $1.20 / $0.45 | free | $1.50 | $1.50 | $1.32 | $0.67 | 2026-10-13 |
| ScriptRunner for Jira (`com.onresolve.jira.groovy.groovyrunner`) | The Adaptavist Group | 34,113 | 3.67 (865) | yes | $2.67 / $1.60 / $0.56 | free | $2.67 | $2.67 | $2.03 | $0.93 | 2026-10-13 |
| Workflow Enhancer for Jira (`com.tng.jira.plugins.workflowenhancer`) | TNG Technology Consulting GmbH | 1,353 | 3.64 (44) | yes | $0.86 / $0.65 / $0.36 | free | $0.86 | $0.86 | $0.73 | $0.45 | 2026-10-30 |
| Power Scripts - Jira Workflow Automation (`com.keplerrominfo.jira.plugins.jjupin`) | Appfire | 1,747 | 3.79 (303) | yes | $2.00 / $1.65 / $0.59 | free | $2.00 | $2.00 | $1.79 | $0.89 | 2026-10-13 |
| Better Commit Policy for Jira (Git, Bitbucket and more!) (`com.midori.jira.plugin.jira-commit-policy-plugin`) | Midori Global Consulting Kft. | 264* | 4.84 (23) | yes | $1.50 / $0.70 / $0.40 | free | $1.50 | $1.50 | $1.02 | $0.56 | 2026-10-13 |

Notes:

- The two Free editions (HeroCoders Free, TitanApps Free) have separate listings with no Marketplace price. HeroCoders Free shows about 30,128 installs, so a free checklist is the default rival.
- Workflow-validator apps (JMWE, JSU, Workflow Toolbox, ScriptRunner, Workflow Enhancer, Power Scripts) are broad toolkits, not Definition of Done apps. They are listed for price context only.

### B6. Rival apps: FourRealities (traceability, compliance, quality)

Same columns and sources as B3. [API] unless noted.

| App (key) | Vendor | Installs | Rating (reviews) | Free 1-10 | Rate 11-100 / 101-250 / 251-1,000 | 10 users | 50 | 100 | 250 | 1,000 | Prices last changed |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Requirements & Test Management for Jira (`com.deviniti.atlassian.apps.rtm`) | Deviniti | 1,935* | 3.41 (68) | no, flat $8/mo | $2.01 / $1.48 / $0.69 | $8 flat | $2.01 | $2.01 | $1.69 | $0.94 | 2026-11-05 |
| easeRequirements - Requirements Management for Jira (R4J) (`com.easesolutions.jira.plugins.requirements`) | Ease Solutions Consulting GmbH | 1,906 | 3.52 (63) | no, flat $10/mo | $1.97 / $1.41 / $0.63 | $10 flat | $1.97 | $1.97 | $1.63 | $0.88 | 2026-10-13 |
| easeRequirements Ultimate - Requirements Management for Jira (`com.easesolutions.jira.plugins.requirements-ultimate`) | Ease Solutions Consulting GmbH | 116* | 5.00 (4) | yes | $1.00 / $0.70 / $0.33 | free | $1.00 | $1.00 | $0.82 | $0.45 | 2026-10-13 |
| Requirement Yogi - Requirements Management for Jira (`com.playsql.requirementyogijira`) | Requirement Yogi | 959 | 3.23 (13) | yes | $0.59 / $0.45 / $0.43 | free | $0.59 | $0.59 | $0.51 | $0.45 | 2026-10-13 |
| Requira - Requirements & Traceability for Jira (`com.deviniti.atlassian.apps.requira`) | Deviniti | 29 | 0.00 (0) | no, flat $13/mo | $2.79 / $2.13 / $1.19 | $13 flat | $2.79 | $2.79 | $2.39 | $1.49 | 2026-11-05 |
| Links Explorer: Traceability Matrix, Hierarchy & Dependency (`com.otpl.jira.plugins.lxp`) | Optimizory Technologies Pvt. Ltd. | 217 | 3.95 (19) | yes | $0.56 / $0.42 / $0.28 | free | $0.56 | $0.56 | $0.48 | $0.33 | 2026-10-13 |
| TraceabilityX for Jira (`es.excentia.jira.plugins.jira-traceabilityx-plugin`) | excentia | 26* | 4.31 (19) | yes | $0.10 / $0.09 / $0.08 | free | $0.10 | $0.10 | $0.09 | $0.08 | 2026-10-13 |
| Xray - Test Management for Jira (`com.xpandit.plugins.xray`) | Xblend | 25,235 | 3.35 (604) | no, flat $10/mo | $7.28 / $3.70 / $2.12 | $10 flat | $7.28 | $7.28 | $5.13 | $2.87 | 2026-10-13 |
| Xray Enterprise - Test Management for Jira (`com.xblend.plugins.xray-enterprise`) | Xblend | 1,180* | 3.27 (15) | no, flat $27.5/mo | $13.20 / $6.11 / $3.69 | $27.5 flat | $13.20 | $13.20 | $8.95 | $5.00 | 2026-10-13 |
| Zephyr - Test Management and Automation for Jira (`com.kanoah.test-manager`) | SmartBear | 14,782 | 3.21 (517) | no, flat $10/mo | $7.42 / $4.72 / $2.31 | $10 flat | $7.42 | $7.42 | $5.80 | $3.18 | 2026-11-03 |
| AIO Tests: QA Testing and Test Management for Jira (`com.kaanha.jira.tcms`) | Navarambh Software Pvt. Ltd. | 3,441 | 3.69 (128) | yes | $2.30 / $1.20 / $1.00 | free | $2.30 | $2.30 | $1.64 | $1.16 | 2026-10-24 |
| TestRay - Requirements and Test Management for Jira (`com.go2group.jira.plugin.synapse`) | Goldfinger Holdings, Inc. | 566 | 4.55 (73) | no, flat $10/mo | $7.27 / $3.70 / $2.12 | $10 flat | $7.27 | $7.27 | $5.13 | $2.87 | 2026-10-13 |
| Ketryx Lifecycle Management for Jira (`com.ketryx.app.atlassian`) | Ketryx | 288 | 5.00 (14) | no public Marketplace price (pricing endpoint returned 404) | - | - | - | - | - | - | - |
| Git Integration for Jira (GitHub, GitLab, & Azure DevOps) (`com.xiplink.jira.git.jira_git_plugin`) | GitKraken | 8,166 | 3.52 (351) | no, flat $10/mo | $2.61 / $1.11 / $0.27 | $10 flat | $2.61 | $2.61 | $1.71 | $0.63 | 2026-10-13 |
| Optimizer for Jira (Health Checks & Cleanup) (`co.uk.jackgraves.jira-optimiser`) | AppFox | 1,092 | 3.71 (34) | no, flat $5/mo | $0.53 / $0.46 / $0.39 | $5 flat | $0.53 | $0.53 | $0.49 | $0.41 | 2026-10-13 |
| Doctor Pro: Audit, Optimize & Manage Configuration for Jira (`ai.appforge.jira.plugins.doctorproforjira`) | AppForge.ai | 185 | 2.80 (10) | yes | $1.80 / $1.10 / $0.60 | free | $1.80 | $1.80 | $1.38 | $0.80 | 2026-10-13 |
| Issue Quality for Jira (`com.jira.plugins.qualitycustodian`) | Effinomics | 3 | 0.00 (0) | yes | $0.91 / $0.77 / $0.64 | free | $0.91 | $0.91 | $0.83 | $0.69 | 2026-10-13 |
| Issue, Sprint & Release  Delivery Health Check for Jira (`release-management.issue-health`) | Release Management | 22 | 5.00 (6) | yes | $0.50 / $0.35 / $0.15 | free | $0.50 | $0.50 | $0.41 | $0.21 | 2026-10-13 |
| Workflow Analyzer for Jira (`de.codecentric.jira.workflow-analyzer`) | codecentric AG | 155* | 4.00 (7) | yes | $0.13 / $0.12 / $0.11 | free | $0.13 | $0.13 | $0.12 | $0.11 | 2026-10-13 |

Notes:

- No app I found scores alignment across decision or spec, Jira process, code pull requests and audit in one number. The closest groups are requirements and traceability apps, test-management apps with requirement links, Git-link apps, and health-check or quality apps. Test-management apps (Xray, Zephyr, TestRay) are a different job and cost about $7 on the small tier (AIO Tests $2.30), so I do not use them as a price anchor.
- Ketryx: no public Marketplace price; see B4.

## Part C. Analysis: where the current plan sits

I compare your current plan with the middle (median) price of the apps in each group, using the tables above. "Cheaper rivals" counts how many rivals charge less than your plan at that instance size. Averages are per user per month, monthly billing. Your plan averages: 50 and 100 users $1.50; 250 users $1.32; 1,000 users $1.005.

| App | Rival group (count) | Rival median at 50-100 / 250 / 1,000 users | Rival range at 50-100 users | Your plan at 50-100 / 250 / 1,000 | Cheaper rivals at 50-100 / 250 / 1,000 | Verdict |
|---|---|---|---|---|---|---|
| CascadePlan | Pure Gantt and roadmap apps (13) | $1.50 / $1.21 / $0.66 | $0.45 to $3.00 | $1.50 / $1.32 / $1.00 | 5 of 13 / 8 of 13 / 12 of 13 | At market on 11-100 users. Premium at 250 and 1,000 users. |
| CascadePlan | Five most-installed (BigPicture, BigGantt, Structure, Structure.Gantt, WBS) (5) | $2.09 / $1.60 / $0.80 | $1.32 to $5.73 | same | 2 of 5 / 2 of 5 / 3 of 5 | Cheaper than the middle of the leaders on small sizes. |
| LedgerSeal | Signature and approval apps (9) | $1.09 / $0.96 / $0.76 | $0.94 to $1.30 | $1.50 / $1.32 / $1.00 | 9 of 9 / 9 of 9 / 8 of 9 | Premium. Dearer than every rival at 250 users and below. |
| DefinitionGuard | Checklist apps (9) | $0.70 / $0.61 / $0.34 | $0.10 to $1.00 | $1.50 / $1.32 / $1.00 | 9 of 9 / 9 of 9 / 9 of 9 | Clear premium. |
| DefinitionGuard | Three most-installed paid checklists (3) | $0.90 / $0.78 / $0.38 | $0.82 to $1.00 | same | 3 of 3 / 3 of 3 / 3 of 3 | Clear premium (about 65 percent above the middle). |
| DefinitionGuard | Validator toolkits (6) | $1.75 / $1.52 / $0.78 | $0.86 to $2.67 | same | 2 of 6 / 2 of 6 / 6 of 6 | At market on small sizes, premium at 1,000 users. |
| FourRealities | Requirements and traceability apps (7) | $1.00 / $0.82 / $0.45 | $0.10 to $2.79 | $1.50 / $1.32 / $1.00 | 4 of 7 / 4 of 7 / 6 of 7 | Above the middle; below the best-known ones ($1.97 to $2.79). Premium at 1,000 users. |
| FourRealities | Health-check and quality apps (5) | $0.53 / $0.49 / $0.41 | $0.13 to $1.80 | same | 4 of 5 / 4 of 5 / 5 of 5 | Premium. |

Points that follow from the facts:

1. On the 11-100 band, your $1.50 is the 64th percentile of the 376 top apps. It is not extreme. The problem is the lower bands: $1.20 (74th percentile) and $0.90 (88th percentile).
2. Rivals with the highest installs have poor ratings in this data (BigPicture 3.11, BigGantt 2.75, WBS Gantt 2.76, Structure.Gantt 3.28, Smart Checklists 3.39). Quality is a selling point, but a new app has no reviews yet. A price at or below the middle of the group is the usual way a new listing gets its first installs. This is my reading, not a sourced fact.
3. The free 1-10 tier is the market norm (76 percent). A 10-user team that tries the app costs nothing. The cost step begins at 11 users, where the whole customer pays at once (11 x $1.50 = $16.50 per month).
4. LedgerSeal and DefinitionGuard are the two with the biggest gap to their closest rivals. FourRealities has no direct rival, so any price is a judgment.

## Part D. Recommendation (my judgment, not sourced fact)

Keep the free 1-10 tier on all four. Seventy-six percent of top apps do it, and a free tier is the way a new listing with no reviews earns installs. Change the shape of the paid ladder: cut the 251-1,000 rate on every app, because the median app charges about 35 percent of its 11-100 rate there and you charge 60 percent.

| App | Free 1-10 | 11-100 | 101-250 | 251-1,000 | Average per user at 100 / 250 / 1,000 users |
|---|---|---|---|---|---|
| CascadePlan | yes | $1.50 | $1.10 | $0.55 | $1.50 / $1.26 / $0.73 |
| LedgerSeal | yes | $1.30 | $1.05 | $0.75 | $1.30 / $1.15 / $0.85 |
| DefinitionGuard | yes | $1.10 | $0.80 | $0.40 | $1.10 / $0.92 / $0.53 |
| FourRealities | yes | $1.50 | $1.10 | $0.60 | $1.50 / $1.26 / $0.77 |

Above 1,000 users, keep "custom". If you want a published number for 1,001-2,500 users, rivals sit at about $0.35 to $0.45 for Gantt, signature and requirements apps and $0.10 to $0.30 for checklist apps. That is a suggestion only.

**CascadePlan, $1.50 / $1.10 / $0.55.** On 11-100 users, Gantt buyers compare you with BigGantt at $2.09, Structure.Gantt at $1.46, WBS Gantt at $1.32, Easy Agile Roadmaps at $1.65 and Planyway at $3.00. The middle of the 13 pure Gantt apps is $1.50, so keep $1.50 there. On the other bands your current rates are the weak point. Rivals charge $0.90 to $1.40 on 101-250 (BigGantt $1.27, Tempo $1.05, WBS $0.90, Easy Agile $1.14), so $1.10 fits the middle. On 251-1,000 they charge $0.47 to $0.59 (BigGantt $0.53, Tempo $0.59, WBS $0.47, Easy Agile $0.49), and your $0.90 is higher than 12 of 13. Moving to $0.55 puts you at the top of the normal band, which leaves room for the extra features (baselines with integrity checks, scope-change approval) without a gap that large customers will notice. The Premium uplift for Plans ($9.90 at 11-100 users) makes a Jira Premium customer look at apps first, but Premium also brings other features, so I would not price against it.

**LedgerSeal, $1.30 / $1.05 / $0.75.** The nine signature and approval apps charge $0.94 to $1.30 on 11-100 users, with a middle of $1.09; the dearest is eSign Signatures at $1.30 (rating 5.00, 10 reviews). At $1.50 you are 15 percent above the dearest and 38 percent above the middle for a product with no reviews. The tamper-evident seal (hash snapshot and a validator that blocks edits after approval) is a real difference, and the compliance-focused rivals do not publish a price for their paid plans (Ketryx says "contact sales"; Vera has no public price). So I suggest a small premium of about 20 percent over the middle, and no more: $1.30 on 11-100 users, $1.05 on 101-250 (eSign $1.20, Approval Path $1.05), and $0.75 on 251-1,000, which matches the middle of the group ($0.76) rather than the dearest ($1.10), because large customers compare totals. If sales to regulated teams go well, you can raise the price later, because Atlassian lets vendors change prices at any time (A6).

**DefinitionGuard, $1.10 / $0.80 / $0.40.** The nine checklist apps sit between $0.10 and $1.00 on 11-100 users (middle $0.70), the three biggest paid ones at $0.82 to $1.00, and the free editions from HeroCoders and TitanApps cost nothing. At $1.50 you charge 50 to 80 percent more than the best-known checklist apps. Your product does more than a checklist (waivers, evidence, a validator that blocks Done), and it overlaps with validator toolkits that charge $1.35 to $2.67 (JSU $1.35, Workflow Toolbox $1.50, JMWE $2.00). So I place it between the two groups: about 10 to 35 percent above the top checklist apps, well under the toolkits. The big-tier rate of $0.40 follows the checklist apps ($0.22 to $0.25 for the top three) and the lower validators ($0.36 to $0.61), because at 251-1,000 users buyers compare cost per seat against free and near-free options.

**FourRealities, $1.50 / $1.10 / $0.60.** I found no rival that gives a per-issue alignment score. Health-check and quality apps charge a median of $0.53 on 11-100 users (range $0.13 to $1.80, with Doctor Pro at $1.80), and requirements and traceability apps charge a median of $1.00, with the best-known ones at $1.97 to $2.79 (Requirements & Test Management $2.01, R4J $1.97, Requira $2.79). Because it links decision, process, code and audit, it competes for the same budget as the requirements apps, not the cheap health checkers. So I keep $1.50 on 11-100 users (below RTM and R4J, above the middle), set $1.10 for 101-250 (RTM $1.48, R4J $1.41, Doctor Pro $1.10) and $0.60 for 251-1,000 (RTM $0.69, R4J $0.63, Requirement Yogi $0.43). This is the app with the least price evidence, so I would treat $1.50 as a starting point and review it after the first 30 to 50 paying sites.

Other points to decide, not covered by price tables:

- The jump at 11 users: a team of 11 pays 11 x rate (for example $16.50 at $1.50). Rivals have the same rule, so it is normal.
- Annual billing is 10 times the monthly total, set by Atlassian, so you cannot choose a different annual discount through the API data I saw.
- Most rival prices in the tables show a last-changed date of 2026-10-13, so rivals do change prices. Re-check before you publish.

## Part E. Limits of this research

- Feature parity is not checked. A price comparison across apps with different features is a guide, not proof of value.
- Install counts and ratings from the API are approximate (see Method). Some search results disagreed with the single-app endpoint, and I used the single-app endpoint.
- I could not open the Atlassian Partner Portal, so any minimum price rule held there is unknown. The public documents I read state none.
- Appfire's own pages (`appfire.com/pricing-updates`, `appfire.com/bigpicture/plans-and-pricing`, `appfire.com/products/bigpicture/pricing`) returned HTTP 429, so Appfire app prices (BigPicture, BigGantt, Swanly, JMWE and others) rest on the Marketplace API only. Most other rows also rest on the API alone; only Planyway, Tempo and Easy Agile were cross-checked on vendor pages.
- Vera, Ketryx (beyond its Free plan) and Aha! have no public Marketplace price.
- The statement that Jira's built-in timeline is in every plan comes from a search snippet and an Atlassian Community article I did not open (B2). Treat it as likely.
- Prices change at any time (A6), and 2026-10-13 was a common change date. Re-run the API calls before publishing prices. The helper scripts are in `/home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/suite-readiness/pricing/` (`calc.py`, `tables.py`, `survey.py`, `groups.py`).

## Sources

- Marketplace REST API, all pricing, install and rating data: `https://marketplace.atlassian.com/rest/2/addons` (search) and `https://marketplace.atlassian.com/rest/2/addons/<addon-key>` and `.../pricing/cloud/live`. Seen 2026-11-06.
- `https://developer.atlassian.com/x/1IaI` Atlassian Marketplace apps: Pricing, payment, and billing (last updated Jun 17, 2025). Seen 2026-11-06.
- `https://community.developer.atlassian.com/t/introducing-a-new-0-price-point-for-your-1-10-cloud-app-user-tier/54225` (Dec 7, 2021). Seen 2026-11-06.
- `https://community.developer.atlassian.com/t/launching-higher-pricing-tiers-upto-50k-for-confluence-cloud-apps/69636` (May 22, 2023). Seen 2026-11-06.
- `https://support.atlassian.com/subscriptions-and-billing/docs/how-maximum-quantity-billing-works/`. Seen 2026-11-06.
- `https://www.atlassian.com/licensing/future-pricing/cloud` and `https://www.atlassian.com/licensing/future-pricing/cloud/list/pricing-tables`. Seen 2026-11-06.
- `https://www.atlassian.com/software/jira/pricing`. Seen 2026-11-06.
- `https://support.atlassian.com/jira-software-cloud/docs/how-do-i-read-my-advanced-roadmaps-plan/`. Seen 2026-11-06.
- `https://planyway.com/jira/pricing`, `https://www.tempo.io/pricing/jira-gantt-chart`, `https://www.easyagile.com/pricing`, `https://www.ketryx.com/pricing`. Seen 2026-11-06.
- [SECONDARY] Web search results used only as pointers (Atlassian Community timeline article, Atlassian community note on Jira app tiers, third-party Jira price summaries). Not relied on for any number in the tables.
