# CascadePlan: Marketplace external-requirements research and URL checks

- Scope: external requirements, URL checks, checklist comparison and media checks only. No file in the checkout was edited. Nothing was deployed, signed in to, or submitted. No email address or credential was sent anywhere. All HTTP requests used User-Agent "review-bot".
- Checkout: /home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/cascadeplan-marketplace-review/checkout (branch master, HEAD db08009, "feat(planner): keep one set of task dates across every plan", 2026-11-05 13:11 +0530).
- All Atlassian pages were fetched on 2026-11-05 with curl and read as text. Each page's own "Last updated" date is shown in the table. Quotes are verbatim except where marked [paraphrase]. Some Atlassian text contains typographic dashes; those passages are paraphrased so this file stays ASCII.
- Raw fetched pages (text): /tmp/claude-1001/-home-fahimfarookme-Documents-projects/249b789e-d4bd-4827-b237-0a7a35210c9f/scratchpad/atl/*.body (scratch, not durable).

## Section A: Requirements table

Date fetched for every row: 2026-11-05. "Page date" is the page's own "Last updated" value.

### A.a Marketplace approval and listing requirements (Cloud, Forge)

| ID | Requirement | Source URL (page date) | Quote / paraphrase |
|---|---|---|---|
| A1 | All new public apps need Atlassian approval. | https://developer.atlassian.com/platform/marketplace/app-approval-guidelines/ (May 15, 2026) | "All new publicly listed apps need to be approved by Atlassian." |
| A2 | Prerequisites checked before review. | same | "Pre-requisites, if not complete, could delay the app review process. Verify the following and be ready to share them: Privacy and security tab and ticket approval; Partner verification ticket; Any pending security vulnerability ticket if there are vulnerabilities detected" |
| A3 | App must perform as described. | same | "Performs as described : Your app does what it advertises." |
| A4 | Marketing assets required (logo, banner, screenshots). | same | "Provide marketing assets like a logo, banner, and screenshots as defined by Building your presence on Marketplace ... This is recommended but not required for free apps." |
| A5 | Documentation required. | same | "Provide documentation : Your listing should reference documentation that describes how to set up and use your app." |
| A6 | Company email for paid-via-Atlassian. | same | "Personal or generic domains (like Gmail or Yahoo) are not permitted for paid-via-Atlassian apps. The email must clearly match the submitting organization and be active for business use." |
| A7 | Accept Marketplace Partner Agreement, meet security workflow, create privacy policy, register with Developer Community. | same | "Accept the Marketplace Partner Agreement ... Fulfill the security requirements outlined in the security workflow ... Create a privacy policy ... At least one contact from your partner profile is registered with the Atlassian Developer Community" |
| A8 | Trademark: no name starting with an Atlassian product name. | same | "Trademark infringement is an automatic rejection ... Jira App X would be rejected, but App X for Jira would be approved." |
| A9 | Approval time (Atlassian states three different figures). | approval page; https://developer.atlassian.com/platform/marketplace/app-approval-security-workflow/ (Jul 24, 2025); https://developer.atlassian.com/platform/marketplace/listing-forge-apps/ (Aug 26, 2026) | Approval page: "Approvals take 10-15 business days". Security workflow: "New app submissions : 5-10 business days (may be longer if security issues need resolution)". List a Forge app: "we aim to provide a decision within one week". |
| A10 | App name: 60 characters or less, title case, banned words. | https://developer.atlassian.com/platform/marketplace/building-your-presence-on-marketplace/ (Jun 5, 2020); https://developer.atlassian.com/platform/marketplace/marketplace-app-listing-principles/ (Aug 24, 2026) | "Ensure your Marketplace app name does NOT include the following words and names: Atlassian, plugin, beta, BETA, Beta, add-on, or app." Name "60 characters or less". |
| A11 | App name must be unique. | https://developer.atlassian.com/platform/marketplace/atlassian-brand-guidelines-for-marketplace-partners/ (Jul 18, 2025) | "Ensure your app name is unique and does not exactly match any existing active app names in the Atlassian Marketplace." |
| A12 | Tagline 130 chars; summary 250 chars; exactly 3 highlights. | listing principles (Aug 24, 2026) | "Tagline (max 130 characters)"; "Summary (max 250 characters)"; "Provide exactly 3 highlights. Each requires: Highlight title (max 50 characters) ... Highlight summary (max 220 characters) ... Cropped screenshot (580x330 px)" |
| A13 | Screenshots must show the app inside the Atlassian UI, each with a caption. | listing principles | "Show the app in action within the Atlassian UI - not as a standalone marketing graphic." [dash normalised] "Every screenshot must have a caption (max 220 characters)" |
| A14 | No unsubstantiated claims. | brand guidelines (Jul 18, 2025) | "Not making any unsubstantiated claims in your marketing assets." |
| A15 | No representations on behalf of Atlassian. | https://www.atlassian.com/licensing/marketplace/publisheragreement (redirects to /partneragreement), section 8.1 | "You agree not to make any representations, guarantees or warranties ... (2) with respect to Atlassian, the Atlassian Marketplace, Atlassian Apps, or any other Atlassian products or services" |
| A16 | Review checks function, security, performance, support, branding. | https://developer.atlassian.com/platform/marketplace/creating-a-marketplace-listing/ (Apr 9, 2026) | "Support: End User License Agreement, Marketplace app documentation and partner support information is available for customers on the Marketplace listing." |
| A17 | Missing compliance info blocks review. | https://developer.atlassian.com/platform/marketplace/onboarding-hub/launch/create-your-marketplace-listing-and-link-your-forge-app/ (May 19, 2026) | "Add links to your privacy policy, EULA/terms, documentation, and support contact ... Incomplete compliance information will block your review." |
| A18 | Forge listing flow: enable sharing, publish the Developer Space (creates partner profile, requires accepting the Partner Agreement and billing consent). | listing-forge-apps; https://developer.atlassian.com/platform/forge/developer-space/publish-developer-space/ (Jan 6, 2026) | "Firstly, you'll need to make sure you've enabled sharing for your app in the developer console. Then follow the steps to publish the developer space." Prereqs: "The space has a billing account setup, and you've provided billing consent." |
| A19 | Reviewer will ask for scope justification and egress hosts. | listing-forge-apps | "The API scope permissions that your app requires, and why each scope is necessary ... The remote hostnames or IP addresses that your Forge app sends requests to (if any)" |

### A.b Runs on Atlassian, data residency, trust badges

| ID | Requirement | Source URL (page date) | Quote / paraphrase |
|---|---|---|---|
| B1 | Badge is automatic; partners cannot apply. | https://developer.atlassian.com/platform/forge/runs-on-atlassian/ (Aug 24, 2026); https://developer.atlassian.com/platform/marketplace/runs-on-atlassian/ (Aug 24, 2026) | "Eligibility for the Runs on Atlassian badge is automatically detected and applied on apps that meet the qualifications. Partners do not need to apply or opt in to receive the badge." |
| B2 | What it means. | same | "Apps exclusively use Atlassian-hosted compute and storage. Apps support data residency that matches data residency provided by the host Atlassian app. Customers can control external data egress ... via admin controls." |
| B3 | Eligibility rules (manifest). | https://developer.atlassian.com/platform/forge/runs-on-atlassian-apps/ (Jul 14, 2026) | "Eligible apps do not list any of the following in the manifest: External resource domains, except when these domains are used for the purpose of analytics ... Remotes; Connect modules; Providers; Dynamic web triggers". "Eligible apps must also do either of the following: use data residency-enabled Forge storage, or store data in Atlassian apps using Atlassian app entity properties." |
| B4 | How shown. | marketplace runs-on-atlassian page | "Runs on Atlassian apps are marked with a badge on the Marketplace listing. Customers can also filter for apps by the badge." Also shown in app management. |
| B5 | How to verify. | runs-on-atlassian-apps; https://developer.atlassian.com/platform/forge/cli-reference/eligibility/ (Oct 12, 2026) | "forge eligibility" reports eligible / not eligible with reasons; deploy also prints eligibility. |
| B6 | KVS is data residency-enabled; developer must publish in-scope data list. | https://developer.atlassian.com/platform/forge/data-residency/ (Sep 28, 2026) | "Every persistent Forge hosted storage capability is data residency-enabled: the Key-Value Store, the Custom Entity Store, Forge SQL, and the Forge Object Store." "You'll need to publish what data your app considers in-scope and out-of-scope for data residency in your own documentation." Advertise via the P&S tab questions. |
| B7 | Cloud Fortified is closed to new apps. | https://developer.atlassian.com/platform/marketplace/atlassian-enterprise-certified-program/ (Oct 28, 2026) | "We are no longer accepting new submissions for the Cloud Fortified Apps Program. Cloud Fortified will be phased out by the end of CY2026." |
| B8 | SOC 2 / ISO 27001 are only partly inherited from Forge. | https://developer.atlassian.com/platform/forge/forge-soc2-iso27001/ (Sep 10, 2025) | "Building apps on Forge can help you inherit controls to meet: Up to 20% of ISO 27001 requirements (focused on Annex A); 30% of SOC 2 ..." and "Forge helps you meet a subset of requirements, but you must ensure your organization meets all relevant SOC 2 and ISO 27001 requirements" |
| B9 | Badges listed as trust programs. | listing principles | "Enroll in Atlassian trust programs, such as Runs on Atlassian or Bug Bounty, to display trust badges on your listing." No fetched page defines a "100% Data Residency Compliant" badge. |

### A.c Security requirements and questionnaires

| ID | Requirement | Source URL (page date) | Quote / paraphrase |
|---|---|---|---|
| C1 | Forge apps: default to asUser; check permissions before asApp. | https://developer.atlassian.com/platform/marketplace/security-requirements/ (Feb 19, 2026; "last revised on February 19, 2026") | "An application must default to using asUser() when performing an operation on behalf of the user." "Before making calls using asApp() , you must verify the expected permissions (for example, from product context) with the permissions REST APIs." |
| C2 | Least privilege scopes. | same | "An application should only request scopes required to perform its intended functionality, and nothing more." |
| C3 | No PII in logs; tenant isolation. | same | "Any Atlassian End User Data written to application logs must exclude Personally Identifiable Information (PII), credentials, and sensitive data." "An application must ensure strict tenant isolation during runtime." |
| C4 | Input validation; no vulnerable or EOL dependencies or runtimes. | same | Req 10, 11, 12: validate untrusted input; "must not use versions of third-party libraries and dependencies with known critical or high vulnerabilities"; "must not use EOL (end-of-life) Node.js runtimes". Manifest uses nodejs22.x; Node.js schedule (https://raw.githubusercontent.com/nodejs/Release/main/schedule.json) gives v22 end 2027-04-30. |
| C5 | Security contact and incident notification. | same | "You must identify at least one email as a security contact and have them create an account on ecosystem.atlassian.net"; "You must notify Atlassian of all security incidents via ECOHELP." Partner Agreement 8.4(g): notify "within 48 hours". |
| C6 | Security workflow for new apps. | https://developer.atlassian.com/platform/marketplace/app-approval-security-workflow/ (Jul 24, 2025) | Checks: "App Security Questionnaires; Partner Identity Verification; Vulnerability Scanning; Mandatory Privacy & Security Tab questions for Cloud Apps". "Fail signals will block your app from listing". Scan: "If Critical or certain High severity vulnerabilities are found, the approval process will be blocked". KYC/KYB "when onboarding new apps". |
| C7 | P&S tab required disclosures. | same | "Completing questions for the Privacy & Security Tab will be mandatory for cloud app onboarding": "Personal Access Tokens (PATs)", "Permission justification", "Trust Center link ... (Optional)". |
| C8 | Forge app security questionnaire (fail items). | https://developer.atlassian.com/platform/marketplace/app-security-questionnaires/ (Jul 16, 2025) | Fail (blocking) items for Forge: Q3 asApp permission check; Q10 "Did you review the app's 3rd party dependencies for vulnerabilities using automated tools?"; Q11 collecting Atlassian credentials; Q13 secrets in plain text. Warning items include Q1a asUser, Q7 least privilege, Q8 logging PII, Q9 input validation. |
| C9 | Partner security questionnaire is informational. | same workflow page | "Partner Security Questionnaire responses are for informational purposes and are not evaluated or block the app approval process." |
| C10 | Security Self Assessment is deprecated. | https://developer.atlassian.com/platform/marketplace/security-privacy-tab/ (Aug 24, 2026) | "we will be deprecating the Security Self Assessment program on August 13, 2023". |
| C11 | Conflicting text on whether the P&S tab is mandatory. | security-privacy-tab FAQ vs workflow page | FAQ: "It is not mandatory to answer the Privacy & Security questionnaire." Workflow (newer, 2025): "mandatory for cloud app onboarding". Treat as mandatory. |

### A.d Privacy, data processing, Personal Data Reporting

| ID | Requirement | Source URL (page date) | Quote / paraphrase |
|---|---|---|---|
| D1 | Privacy policy URL required. | https://developer.atlassian.com/platform/marketplace/data-privacy-guidelines/ (May 19, 2026) | "If you are listing your app on the Marketplace, you are required to include a URL for your privacy policy." |
| D2 | Privacy policy content. | Partner Agreement 8.4(e) | "You must provide a clear, complete, and conspicuous End User Privacy Policy that notifies end users (1) how you access, collect and process End User Data, (2) with whom you share End User Data, (3) in which country or countries the End User Data will be stored and (4) that you (not Atlassian) are responsible for your processing of End User Data" |
| D3 | P&S tab privacy policy question. | security-privacy-tab | "Please provide your privacy policy which governs how you collect, access or otherwise process End-User Data. This is a requirement for all partners, as set out in Atlassian's Marketplace Partner Agreement." |
| D4 | Personal data reporting is the developer's job. | https://developer.atlassian.com/platform/forge/user-privacy-guidelines/ (Oct 30, 2024) | "As an app developer, you are required to periodically report the user personal data that your apps are storing. You must report each accountId". "By default, the cycle period is 7 days." Endpoint "POST https://api.atlassian.com/app/report-accounts/", "Add the scope report:personal-data to your app manifest". Up to 90 accounts per request; 429 with Retry-After. |
| D5 | Atlassian's preferred approach. | same | "we recommend that your apps do not store any user personal data and always retrieve current user data at the time of use using Atlassian APIs ... If you choose this approach, you don't need to read the rest of this guide." |
| D6 | Forge does not do the reporting for you. | https://developer.atlassian.com/platform/forge/faq-privacy-security/ (Oct 30, 2024) | "Atlassian has built a Personal Data Reporting API to help Forge developers comply with data subject requests." The user-privacy page gives a sample built from scheduled triggers in the app. No fetched page says Forge reports account IDs automatically. Note: Atlassian's text does not say in words whether a bare accountId (without name or email) counts as "personal data"; the page asks apps to report "the user accounts that your apps are storing personal data for". |
| D7 | Listing a Forge app: report and erase. | listing-forge-apps | "If your app stores personal data, it must comply with user privacy requirements ... Follow the Forge user privacy guidelines to implement flows to report and erase personal data as appropriate." |
| D8 | Data processing addendum. | listing-forge-apps; https://developer.atlassian.com/platform/marketplace/list-customizable-end-user-agreement/ (May 16, 2025) | "if you are a Data Processor under GDPR, or process personal data under other personal data laws and/or regulations, you'll need a DPA." |
| D9 | Hosted storage retention after uninstall. | https://developer.atlassian.com/platform/forge/storage-reference/hosted-storage-data-lifecycle/ (Sep 28, 2026) | "When an app is uninstalled, the data is first 'soft deleted' and then retained for the rest of the retention period"; relink possible "within 21 days of uninstallation". |

### A.e Legal and support

| ID | Requirement | Source URL (page date) | Quote / paraphrase |
|---|---|---|---|
| E1 | End User Terms (EULA) required. | listing-forge-apps; Partner Agreement 5.6 | "To transact with customers in cloud, you'll need End User Terms, also known as a customer agreement or Terms of Service (TOS)." 5.6: "you must provide your own End User Terms and End User Privacy Policy with any Marketplace App." |
| E2 | Standard agreement option. | list-customizable-end-user-agreement | Bonterms-based standard agreement can be selected per version under the Links tab, with "Provider Specific Terms". |
| E3 | Missing legal docs block listing. | https://developer.atlassian.com/platform/marketplace/onboarding-hub/launch/decide-pricing-and-licensing-model/ (May 19, 2026) | "missing legal documents (EULA, DPA) will block your listing during review." |
| E4 | End User Terms must mention Forge limits. | Partner Agreement 8.4(d) | "your End User Terms ... must ... clearly describe how the platform quotas and limits for Forge Apps, Atlassian Platform rate limits, or any other applicable usage limits may impact an end user's use of your Marketplace Apps." |
| E5 | Support URL required for paid-via-Atlassian; generic email. | https://developer.atlassian.com/platform/marketplace/cloud-app-operations-guide/ (Apr 26, 2026) | "Provide a support URL: This is REQUIRED for all paid-via-Atlassian apps." "If a technical support contact is provided it must be generic". |
| E6 | Support hours, tracker, emergency contact, SLA. | same | "Offer support at least 8 hours a day, 5 days a week in your local time zone"; use a work item tracker; "Provide Atlassian with 24x7 emergency contact information ... REQUIRED for all paid-via-Atlassian apps"; "Defining your service level agreement (SLA)" listed as REQUIRED; "You should publish a SLA". |
| E7 | Response times in the agreement. | Partner Agreement 6.3 | "At a minimum you agree to respond within 24 hours to any support request that Atlassian identifies as critical, and in all other cases within five business days". |
| E8 | Documentation URL and support. | building-your-presence | Documentation URL "Required for for paid via Atlassian apps"; "Paid via Atlassian apps must be supported by the partner". |
| E9 | Support channel before listing. | https://developer.atlassian.com/platform/marketplace/onboarding-hub/launch/prepare-branding-support-privacy-and-security/ (May 19, 2026) | "Marketplace requires a working support channel before listing." |

### A.f Media rules

| ID | Requirement | Source URL (page date) | Quote / paraphrase |
|---|---|---|---|
| F1 | App logo. | building-your-presence (Jun 5, 2020) | "App logo: 144 x 144px PNG/JPG ... Use transparent or bounded, chiclet-style backgrounds. Marketplace automatically creates an app icon from your logo." No Atlassian product logo. |
| F2 | App banner. | same | "App banner: 1120 x 548px PNG/JPG for high-resolution images or 560 x 274px PNG/JPG for standard images". "Include your app name, your partner name, and brief text". |
| F3 | Highlight screenshots. | same; listing principles (Aug 24, 2026) | "Highlight screenshot (3): 1840 x 900px PNG/JPG or 920 x 450px PNG/JPG". "Highlight screenshot - cropped (3): 580 x 330px PNG/JPG". Principles: "Use 1840x900 px (hi-res) for primary highlights." |
| F4 | Captions and extra media. | building-your-presence | Captions "220 characters or less"; "Up to 5 additional screenshots per highlight". |
| F5 | Partner logo. | same | "Partner logo: 144 x 144px PNG/JPG/GIF ... Make sure it has a transparent background." |
| F6 | Logo/icon must not use Atlassian marks. | brand guidelines | "Do not use Atlassian logos or assets ... either on their own or combined with your own branding." [paraphrase of dash] |

Note: the media size page is dated Jun 5, 2020, but the Aug 24, 2026 listing principles page repeats the 1840x900 and 580x330 sizes. No newer banner size was found on any fetched page.

### A.g Licensing and pricing (paid Forge apps)

| ID | Requirement | Source URL (page date) | Quote / paraphrase |
|---|---|---|---|
| G1 | Manifest flag. | listing-forge-apps; https://developer.atlassian.com/platform/forge/licensing-overview/ (Jul 14, 2026) | "add the app.licensing.enabled attribute to the manifest.yml file and set its value to true." This is "standard billing" (all users). User-based billing is EAP and not yet publishable. |
| G2 | Check license at runtime. | listing-forge-apps | "you should check the license status of your Marketplace app when your functions are invoked, and implement reduced functionality if your Marketplace app is unlicensed." Back end: resolver "context.license.active". Front end: view.getContext(). "The license object is only present for apps in the production environment. license is undefined for free apps, apps not listed on the Atlassian Marketplace, and apps in custom environments." |
| G3 | Is enforcement mandatory? | Partner Agreement section 3 (Paid-via-Atlassian); creating-a-marketplace-listing; https://developer.atlassian.com/platform/marketplace/cloud-app-licensing/ (Jun 30, 2023, Connect-era) | Agreement: "You must use Atlassian's licensing mechanisms ... for all Paid-via-Atlassian Apps." Listing page: "Paid via Atlassian apps include the Atlassian app licensing API in order to be listed in the Marketplace." Cloud licensing: "Any app you intend to sell on the Atlassian Marketplace must have licensing features implemented." The Forge page itself uses "should" for the runtime check. |
| G4 | Testing paid apps. | listing-forge-apps | "If you're listing a paid app, you must always use the development or staging environment to test your app ... all installations of production paid apps are billed." "Once deployed, you won't be able to install the app from the production environment until your Marketplace listing is approved." Use "forge install --environment development --license active" (values active, inactive, trial). |
| G5 | Triggers can skip unlicensed calls. | listing-forge-apps | "filter.appIsLicensed to automatically skip invocations when the app is unlicensed". |
| G6 | Annual price and revenue share. | https://developer.atlassian.com/platform/marketplace/pricing-payment-and-billing/ (Jun 17, 2025, with 2026 content) | "we charge 10 times monthly price as annual price for cloud apps." Forge revenue share 84% from 1 April 2026, "On 1 October 2026 ... Forge apps: 83%"; "As of 1 January 2026, partners will receive 100% of gross revenue earned on Forge, up to $1 million in lifetime Forge revenue." |
| G7 | Free 1-10 user tier. | https://developer.atlassian.com/platform/marketplace/app-discount-programs/ (Feb 25, 2026) | Only reference found: "Starter tiers (10 users or less) and Social Impact License holders are not eligible" (for a discount). No fetched page states how a partner sets a 1-10 user price. Not verified (needs the partner portal). |

### A.h Forge platform limits and Jira rate limits

| ID | Limit | Source URL (page date) | Quote / value |
|---|---|---|---|
| H1 | Resolver runtime. | https://developer.atlassian.com/platform/forge/limits-invocation/ (Sep 1, 2026) (linked from https://developer.atlassian.com/platform/forge/platform-quotas-and-limits/, Jul 13, 2026) | Runtime seconds: 25 for user/UI invocations; 55 for web trigger, action, rovo:agentConnector; 900 for async events and scheduled triggers ("Default timeout is 55 seconds. Use timeoutSeconds to extend it."). |
| H2 | Memory. | same | "1,024MB Available memory per invocation. Default memory limit is 512MB. To change it, use the memoryMB setting". |
| H3 | Payload sizes. | same | Invocation request payload 5MB; "Front-end invocation request payload size 500KB"; "Front-end invocation response payload size 5MB". |
| H4 | Invocation rate. | same | Per user 1,200 per minute; per install "7,000 per minute and 300 per second (whichever is hit first)"; "If a request is rate limited ( 429 ), wait until the current window resets". |
| H5 | KVS key and value. | https://developer.atlassian.com/platform/forge/limits-kvs-ce/ (Sep 28, 2026) | Key length 500; key regex /^(?!\s+$)[a-zA-Z0-9:._\s-#]+$/; "Value size 240 KiB"; object depth 31; reads 12 MB/s per key; writes 1 MB/s per key. |
| H6 | KVS rate limits per installation. | same | Request rate 1000 RPS; Read 4000 and Write 4000 "(10KB request per min)"; sizes rounded up to 10KB. Transactions: 25 operations, 4MB. Batch: "maximum of 25 keys" (https://developer.atlassian.com/platform/forge/storage-reference/kvs-batch/). Over limit: "429 status with an error code of RATE_LIMIT_EXCEEDED" (https://developer.atlassian.com/platform/forge/storage-reference/kvs-errorhandling/). |
| H7 | KVS query page size. | https://developer.atlassian.com/platform/forge/storage-reference/kvs-api-query/ (Aug 21, 2026) | "The query API returns up to 10 values by default, this can be increased to a maximum of 100." The same page's code comment says "up to a maximum of 20". Atlassian's page is inconsistent; the prose says 100. |
| H8 | Jira REST rate limiting. | https://developer.atlassian.com/cloud/jira/platform/rate-limiting/ (Nov 4, 2026) | Three systems: points-based hourly quota, per-endpoint burst limits, per-issue write limits. "When any limit is exceeded, Jira returns an HTTP 429 Too Many Requests response. Your app should handle this gracefully by respecting the Retry-After header". Retry-After: "Indicates how many seconds to wait before retrying." Enforcement of points-based limits "will begin on March 2, 2026" for Forge apps. Global pool 65,000 points/hour. Per-issue writes: "20 write operations per 2 seconds" and "100 write operations per 30 seconds". |
| H9 | Custom UI resource limits. | https://developer.atlassian.com/platform/forge/limits-resource/ (Jul 7, 2026) | 5000 files and 100 MB per resource bundle; 50 resources; 25000 files and 1 GB total. |

### A.i Custom UI CSP: styles 'unsafe-inline'

| ID | Requirement | Source URL (page date) | Quote / paraphrase |
|---|---|---|---|
| I1 | Inline styles are allowed when declared. | https://developer.atlassian.com/platform/forge/add-content-security-and-egress-controls/ (Oct 7, 2026); https://developer.atlassian.com/platform/forge/manifest-reference/permissions/ (Sep 16, 2026) | "By default, Atlassian blocks any policies that are considered unsafe for your Custom UI app. To include capabilities, such as inline CSS , you will need to declare these policies in the manifest.yml file" with permissions.content.styles "unsafe-inline". |
| I2 | Security requirement targets script-src only. | security-requirements, Forge table, req 9 | "Do not use unsafe-inline or unsafe-eval directives in script-src when possible." Nothing about style-src. The Forge security questionnaire has no CSP question (the CSP question is in the Connect questionnaire only). |
| I3 | Adding unsafe-* CSP can need a major version. | add-content-security-and-egress-controls | "A major version upgrade of your app may be needed for any of the following: ... Addition of any CSPs in the unsafe-* category" |
| I4 | Effect on Runs on Atlassian. | same page header; runs-on-atlassian-apps | Page header (generic for the whole page, which also covers egress): "Using the capabilities discussed on this page may make your app ineligible for Runs on Atlassian." The explicit eligibility list (B3) names external domains, remotes, Connect modules, providers, dynamic web triggers, and storage type. It does not name content CSP. The permissions page puts its Runs on Atlassian warning under "External permissions", not under content styles. Conclusion: no fetched text says styles 'unsafe-inline' alone breaks eligibility; confirm with "forge eligibility". |

## Section B: URL status table

Method: curl -sS -o /dev/null -w '%{http_code} %{url_effective}' -L --max-time 20, User-Agent review-bot, 2026-11-05. Site markdown links are root-relative; the site CNAME (site/public/CNAME) is docs.asymm.systems, so they resolve to https://docs.asymm.systems/...

| URL | Where (file:line) | HTTP status | Final URL | Comment |
|---|---|---|---|---|
| https://asymm.systems/product/jira-governance/user-guide/cascadeplan.html | docs/marketplace/cascadeplan-listing.md:75; docs/marketplace/submission/cascadeplan-submission-notes.md:8; docs/marketplace/submission/developer-console-checklist.md:70 (as `<app>.html`) | 308 then 200 | https://asymm.systems/product/jira-governance/user-guide/cascadeplan | Live, title "CascadePlan User & Admin Guide". It documents WBS, baseline freeze, scope creep, shift approval, resource heatmap. It has 0 hits for "percent", "undo", "canvas", "Ctrl", which are the listing's headline features. No in-scope End-User Data list. |
| https://asymm.systems/privacy | cascadeplan-listing.md:76; developer-console-checklist.md:66 | 200 | https://asymm.systems/privacy | Live, title "Privacy practices". Covers waitlist emails, GitHub, website logs only. 0 hits for Atlassian, Forge, CascadePlan, Marketplace, account ID. Does not cover End User Data, sharing, storage country, or responsibility (Partner Agreement 8.4(e)). |
| https://asymm.systems/terms | cascadeplan-listing.md:77; developer-console-checklist.md:67 | 404 | https://asymm.systems/terms | BROKEN. Title "404 Not Found". Also 404: /terms-of-service, /legal, /eula. |
| https://asymm.systems/support | cascadeplan-listing.md:78; developer-console-checklist.md:68 | 404 | https://asymm.systems/support | BROKEN. Also 404: /contact (the site nav "Contact" item). The FAQ page https://asymm.systems/product/jira-governance/faq (200) has a support section with an SLA ("Within 24 business hours ... within 4 hours for production blocking transition defects"). |
| support@asymm.systems | cascadeplan-listing.md:79; cascadeplan-submission-notes.md:7; developer-console-checklist.md:69 | n/a (email) | n/a | Not mailed (forbidden). DNS: asymm.systems has MX records route1/2/3.mx.cloudflare.net (Cloudflare Email Routing). Mailbox delivery not verified. Generic address, which matches E5. |
| https://asymm.systems | cascadeplan-submission-notes.md:6 | 200 | https://asymm.systems/ | OK. |
| https://developer.atlassian.com/console | developer-console-checklist.md:3 and :23 | 200 | https://developer.atlassian.com/console | 271-byte shell page (needs sign-in). Not a CascadePlan URL. |
| asymmsystems.atlassian.net (as https://) | cascadeplan-submission-notes.md:35; developer-console-checklist.md:16 | 302, final 202 | https://id.atlassian.com/login?... | Site exists; login required. Reviewer access cannot be checked without sign-in. |
| https://docs.asymm.systems/assets/cascadeplan/01-wbs-tree.png | site/apps/cascadeplan/index.md:5; user-guide.md:11 | 000 (DNS) | none | docs.asymm.systems does not resolve. Cloudflare DoH returned Status 3 (NXDOMAIN). Same path on asymm.systems is 404. |
| https://docs.asymm.systems/assets/cascadeplan/03-scope-creep-alert.png | index.md:34; user-guide.md:42 | 000 (DNS) | none | As above. |
| https://docs.asymm.systems/assets/cascadeplan/05-shift-approval.png | index.md:39; user-guide.md:71 | 000 (DNS) | none | As above. |
| https://docs.asymm.systems/assets/cascadeplan/02-resource-heatmap.png | index.md:46; user-guide.md:85 | 000 (DNS) | none | As above. |
| https://docs.asymm.systems/assets/cascadeplan/04-baseline-settings.png | admin-guide.md:5; user-guide.md:32 | 000 (DNS) | none | As above. |
| https://docs.asymm.systems/apps/cascadeplan/admin-guide | index.md:60 | 000 (DNS) | none | As above; https://asymm.systems/apps/cascadeplan/user-guide is also 404. |
| https://docs.asymm.systems/apps/cascadeplan/user-guide | index.md:61 | 000 (DNS) | none | As above. |
| https://docs.asymm.systems/apps/cascadeplan/scope-creep-audit | index.md:62 | 000 (DNS) | none | As above. |
| https://docs.asymm.systems/permissions-standard | admin-guide.md:11 | 000 (DNS) | none | As above; https://asymm.systems/permissions-standard is 404. |

Summary: the site/apps/cascadeplan VitePress docs are not published anywhere reachable. The public documentation that does exist is the asymm.systems user guide page, and it is not in the sitemap under any /apps/ path.

## Section C: Checklist open items (developer-console-checklist.md, CascadePlan rows, compared with Section A)

Blocking or likely blocking:

1. Terms of Service URL is 404 (checklist:67, listing:77). E1, E3, A17: End User Terms are required and missing legal documents block review. Fix: publish terms, or select Atlassian's standard (Bonterms) agreement in the version Links tab (E2).
2. Support URL is 404 (checklist:68, listing:78). E5, E9: "REQUIRED for all paid-via-Atlassian apps"; "working support channel before listing". The SLA text exists only on /product/jira-governance/faq.
3. Privacy policy does not cover the app (checklist:66, listing:76). The URL is live, but the page is about waitlist and website data. D1, D2, D3: Partner Agreement 8.4(e) needs End User Data processing, sharing, storage country, and responsibility statements.
4. Banner shows a different product name. docs/marketplace/assets/cascadeplan/banner.png shows the wordmark "PlanShift" and footer text "Jira Cloud Marketplace". 05-shift-approval.png also says "authorized PlanShift approvers". A3 ("Performs as described"), F2 ("Include your app name"), A13.
5. Listing text and product evidence describe two different products. The listing (cascadeplan-listing.md:25-43) sells percent-trigger dependencies, 20-step undo, canvas at 60 fps, keyboard mode, estimation units. The submission notes, site docs, live guide, banner, and screenshots show WBS tree, baseline freeze, scope creep, shift approval, and resource grid. The checklist tagline (checklist:39, "Visual sprint baseline control, scope creep detection, and WBS planning for Jira") differs from the listing tagline (listing:5). A3: "Your app does what it advertises."
6. Badge claims (listing:6). "Cloud Fortified": B7 says the program accepts no new submissions and ends in CY2026; the live FAQ (https://asymm.systems/product/jira-governance/faq) says "Are Asymm Systems apps Cloud Fortified? Not yet." "100% Data Residency Compliant" is not an Atlassian badge in any fetched page (B9). "Runs on Atlassian" is applied automatically (B1), so the listing cannot award it to itself; it is likely eligible (no external permissions, remotes, providers, or web triggers in apps/cascadeplan/manifest.yml; KVS is residency-enabled), but "forge eligibility" was not run. A14, A15.
7. Compliance claim (listing:51) "Inherits enterprise SOC 2, ISO 27001, and GDPR compliance natively from Atlassian Cloud". B8 says Forge covers "Up to 20%" of ISO 27001 and "30%" of SOC 2 and the partner must meet the rest. A14, A15.
8. Media sizes. Banner 2280x1140 (checklist:41 says 2280x1140) does not match the 1120x548 or 560x274 rule (F2). Screenshots are 1840x1150, not 1840x900 (F3). No 580x330 cropped highlight images exist (A12, F3). Checklist:42 says "copy the manifest captions", but the manifest has no captions.
9. Screenshot content. 02, 03 and 05 are modal dialogs on a plain dark background, not inside the Jira UI (A13). 01 and 04 show "DEV" environment badges in the Jira sidebar. 01 shows only 2 tasks (TEST-1, TEST-2) in a project named "Test", not the Epic, Story, Subtask WBS tree that the caption and notes describe.
10. Security self-assessment section (checklist:57-62). C10: the Security Self Assessment was deprecated on August 13, 2023. The current gates are the Forge app security questionnaire (C8, with blocking fail items), the partner security questionnaire (C9), KYC/KYB verification, vulnerability scanning, and mandatory P&S tab disclosures including "Permission justification" (C6, C7). The checklist AI answer cites "SHA-256, Ed25519"; the CascadePlan docs mention SHA-256 baseline hashes but not Ed25519, so the answer reads as LedgerSeal-specific.
11. Production install row (checklist:16, "Ready"). G4: paid production installs are billed, and with licensing enabled "you won't be able to install the app from the production environment until your Marketplace listing is approved." The row's claim and command conflict with Atlassian's guidance. Needs confirmation.
12. Personal data reporting. The scope-creep-audit doc (site/apps/cascadeplan/scope-creep-audit.md:56) says CascadePlan records "the exact Atlassian Account ID", and the code persists account IDs (for example apps/cascadeplan/src/domain/models.ts:460, partyId: c.accountId; resourceAccountId fields). The manifest has no report:personal-data scope, and a grep found no report-accounts call. D4, D6, D7: the developer must report each accountId every cycle (default 7 days) and erase or refresh on response. Forge does not do this automatically. Open item for the code reviewer.
13. Data residency documentation. B6: the developer must publish which data is in-scope and out-of-scope for data residency. No such list exists in the CascadePlan docs or on the live guide page.
14. Pricing inconsistency. Listing:68 says "Enterprise Tier (251+ users): Volume pricing down to $0.60"; checklist:54-55 says 251 to 1,000 at $0.90 and 1,001+ custom; the live FAQ matches the checklist ($0.90). "2 months free" annual matches G6 (annual equals 10x monthly). The free 1-10 user tier could not be verified against any fetched Atlassian page (G7).
15. End User Terms content. E4: terms must describe how Forge limits and Atlassian rate limits may affect use. No terms exist yet.
16. Support operations not in the checklist: 24x7 emergency contact for Atlassian (E6), issue tracker (E6), security contact registered on ecosystem.atlassian.net (C5), company-domain email (A6), Developer Space publish with billing consent (A18), bank details for paid-via-Atlassian.

Non-blocking or informational:

17. "No External Icon URLs" row (checklist:14, "Fix Needed"). For CascadePlan this is already satisfied: apps/cascadeplan/manifest.yml:5 uses `icon: resource:main;icon.svg`, and apps/cascadeplan/static/frontend/build/icon.svg exists and is tracked in git. No fetched Atlassian page states this rule; it is an internal rule. The row is suite-wide (it names LedgerSeal).
18. "Licensing Enabled" row (checklist:13, "Ready"). Matches apps/cascadeplan/manifest.yml:40-41. apps/cascadeplan/src/index.ts:2429 has isLicenseActive, which returns true when context.license is absent; that matches G2 (license undefined outside production). Not reviewed in depth.
19. Review time (checklist:79, "3 to 7 business days"). Atlassian states 10-15, 5-10, or about one week (A9).
20. Clean lint and tests row (checklist:17). Not an Atlassian-published requirement; not verified here.
21. App name "CascadePlan: Timeline, Dependencies and Fast Planning" is 53 characters, has no banned words, and does not start with an Atlassian product name (A8, A10). The public Marketplace API (https://marketplace.atlassian.com/rest/2/addons?text=CascadePlan) returned count 0, so no exact-name conflict was found (A11). Listing tagline is 124 characters (limit 130); short description is 205 characters (limit 250).
22. styles 'unsafe-inline' (manifest.yml:27-29). Allowed (I1). Not a stated security requirement breach (I2 is script-src only). No fetched text says it removes Runs on Atlassian eligibility (I4). Adding it later would be a major version change (I3).

## Section D: Media assets vs rules

Location: /home/fahimfarookme/Documents/projects/jira-governance/.tmp/cache/cascadeplan-marketplace-review/checkout/docs/marketplace/assets/cascadeplan/. Identical copies (same md5) exist in site/public/assets/cascadeplan/. Sizes from `file`; icon alpha checked by decoding the PNG.

| File | Format and size | Rule (ID) | Meets rule? | Notes |
|---|---|---|---|---|
| icon.png | PNG, 144 x 144, 8-bit RGBA, 4,632 bytes | F1: 144 x 144 PNG/JPG, transparent or bounded chiclet | Yes | Corners transparent (alpha 0); white rounded chiclet with blue document glyph; no Atlassian marks seen. Same glyph as manifest icon.svg. |
| banner.png | PNG, 2280 x 1140, 8-bit RGB, 1,078,153 bytes | F2: 1120 x 548 or 560 x 274 PNG/JPG | No | Wrong size and ratio (2.00 vs 2.04). Shows the name "PlanShift", not "CascadePlan". Footer claims "Zero External Egress", "Customer Tenant Data Residency". |
| 01-wbs-tree.png | PNG, 1840 x 1150, RGB | F3: 1840 x 900 or 920 x 450 | No (height) | In Jira UI, but sidebar shows "DEV"; only 2 tasks; no WBS hierarchy visible. |
| 02-resource-heatmap.png | PNG, 1840 x 1150, RGB | F3; A13 (in Atlassian UI) | No | Standalone modal on dark background, not in Jira UI. Sample names (Alice, Bob, Charlie). |
| 03-scope-creep-alert.png | PNG, 1840 x 1150, RGB | F3; A13 | No | Standalone modal on dark background. |
| 04-baseline-settings.png | PNG, 1840 x 1150, RGB | F3 | No (height) | In Jira admin UI ("CascadePlan approvers"), shows "DEV" badges and other suite apps. File name says baseline settings; image is the approvers admin page. |
| 05-shift-approval.png | PNG, 1840 x 1150, RGB | F3; A13 | No | Standalone modal on dark background; text says "PlanShift approvers"; requester shown as pm-lead@asymm.systems. |
| (missing) cropped highlights | none | F3 / A12: three 580 x 330 cropped images | Missing | Required with each of the 3 highlights. |
| (missing) captions | none | A13 / F4: caption per screenshot, max 220 chars | Missing | Checklist says to copy "manifest captions"; the manifest has none. |
| (optional) video | none | F4 / A12: recommended, under 30 s | n/a | Optional. |

## Section E: Could not fetch or could not verify

| Item | Reason |
|---|---|
| https://docs.asymm.systems/* (all site/apps/cascadeplan links and images) | DNS NXDOMAIN (Cloudflare DoH Status 3; local resolver "Could not resolve host"). The host is not published. |
| https://developer.atlassian.com/platform/forge/license-api/ | 404 (guessed URL). Licensing facts were taken from listing-forge-apps and licensing-overview instead. |
| https://developer.atlassian.com/platform/forge/manifest-reference/scopes/ | 404 (guessed URL). Not needed; permissions page used. |
| Developer console, partner portal, Marketplace pricing UI, P&S tab form | Require sign-in; not attempted by instruction. So the free 1-10 user tier setting, current submission form fields, and actual P&S tab questions could not be confirmed live. |
| forge eligibility for CascadePlan | Needs Forge CLI login; not run by instruction. Runs on Atlassian eligibility is inferred from the manifest only. |
| support@asymm.systems mailbox | Not tested; sending email was forbidden. Only MX records were checked. |
| asymmsystems.atlassian.net reviewer access, DEMO project data | Requires Atlassian login. |
| Atlassian security scan (Ecoscanner) results | Only run by Atlassian on submission. |
| Pages that may be client-rendered | All Atlassian pages used here returned full server-rendered text; none had to be skipped. |
