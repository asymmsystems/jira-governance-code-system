# Owner guide: register Asymm Systems as a Marketplace partner

Date: 2026-11-06 (rewritten). For: Fahim Farook.
Sources: Atlassian pages fetched on 2026-11-06 ("Become a partner", "Register as an Atlassian Marketplace Partner", "Due diligence business and identity verification"), and `docs/sdlc/suite-readiness-review-2026-11/marketplace-commercial-rules.md`. Where Atlassian does not say something clearly, the step says "not confirmed".

## Progress (updated 2026-11-06)

| Step | Status |
|---|---|
| 1. Partner profile | DONE: vendor "Asymm Systems", Vendor ID 334643263 |
| 2. Contact roles | DONE: you are Admin and Primary (nothing else is needed while you are the only member) |
| 3. Partner verification | IN PROGRESS: ticket ECOHELP-182280; Identity Information Collection SUBMITTED; Partner Security Questionnaire not attached yet; Stripe ID check not yet |
| 4. Support questions | NEXT: only the tax questions now (W-8BEN-E: where and when; withholding and the US-Sri Lanka treaty) |
| 5. Payout and tax details | MOSTLY DONE: Payment tab filled (contact, Sri Lankan bank, company tax ID); check with the bank: exact account holder name (must match the verification form) and whether USD SWIFT needs an intermediary bank; W-8BEN-E waits on step 4 |
| 6. Forge billing | to do |
| 7. Developer space check | to do |
| 8. Two-step verification, old sessions | later, when I tell you |

## Before you start: which account

Use **fahim@asymm.systems**, the Atlassian account you already use. It owns the four Forge apps, and it is the account my live tests sign in with. You do not create a new account, and you do not change any email.

Can it be a shared address such as sudo@asymm.systems? Not for these steps:
- Atlassian's email rule is about the domain: it refuses Gmail, Yahoo and similar domains for paid apps. Any `@asymm.systems` address passes that rule.
- But the partner verification checks a **person**: the primary contact uploads a passport and takes a selfie. And every partner contact must be an Atlassian account. So the profile and the verification are done by you, as fahim@asymm.systems.
- A shared mailbox is not needed. You can add one later as an extra contact, but only if it has its own Atlassian account.

## Step 1. Create the partner profile (DONE)

1. Open https://marketplace.atlassian.com/login?redirect=%2F and sign in as fahim@asymm.systems.
2. Open https://marketplace.atlassian.com/manage/vendor/create.
3. Fill in the form with these values (the form decides which fields it asks for):

   | Field | Value |
   |---|---|
   | Partner (company) name | Asymm Systems |
   | Website | https://asymm.systems |
   | Contact email | fahim@asymm.systems |
   | Support email or page | support@asymm.systems, https://asymm.systems/support |
   | Logo | `/home/fahimfarookme/Documents/projects/asymm-corporate/repository/code/asymm-corporate-code-brand/dist/asymm-mark-dark-400.png` (400 x 400, the `[ }` mark on a dark square; `asymm-mark-dark-1000.png` if a larger image is asked for). BRAND-SPEC.md uses the square mark for avatars; the wordmark is not readable below about 120 px. |
   | SLA statement URL | https://asymm.systems/support (it states the response times; after the next site release the Jira section is also at https://asymm.systems/support#jira-apps) |
   | Address | the company's registered address |
   | "Describe your organization in 750 characters or less" (shown on your partner page) | the text below (620 characters) |

   Partner page description (copy it exactly):

   ```text
   Asymm Systems builds software for teams that must show how their work was planned, approved and done. Our Jira Governance Suite runs entirely on Atlassian Forge, with no outside servers: CascadePlan, a Jira timeline with percent-trigger dependencies, baselines and undo; LedgerSeal, approval seals that show any change made after sign-off; DefinitionGuard, an enforceable Definition of Done with evidence and a workflow gate; and FourRealities, which checks each issue for evidence of its decision, process, code and audit. We also publish Eliya, an OpenJDK distribution. Documentation and support: https://asymm.systems
   ```

   Every statement in it is true of the apps today; it makes no compliance or customer claim. If the form refuses the link, remove the last sentence (571 characters).

   **Support hours** section (it must match https://asymm.systems/support, which promises a first answer within 24 business hours, Monday to Friday):

   | Field | Value |
   |---|---|
   | Provide support hours | ticked |
   | Region | the Asia Pacific option |
   | Time zone | Asia/Colombo (UTC+05:30) |
   | 24 hour support | **not ticked**: ticking it promises support at every hour, which the support page does not offer |
   | Support time from / until | 09:00 / 17:00 (8 hours, the Top Partner minimum) |
   | Days supported | Monday to Friday |

   **Support contact details** section:

   | Field | Value |
   |---|---|
   | Provide support contact details | ticked |
   | Support name | leave blank (the partner name, Asymm Systems, is used) |
   | Support email | support@asymm.systems |
   | Support URL | https://asymm.systems/support |
   | Support phone | leave blank: one mode is enough, and a phone number adds a channel you must answer |

4. If the form asks you to accept the Marketplace Partner Agreement, read it first. If you want, send me the agreement link before you accept, and I will list any clause about interest or late-payment charges.
5. Result: at https://marketplace.atlassian.com your profile menu (top right) now has **Manage vendor account**.

## Step 2. Give yourself the contact roles (DONE)

What happened: the vendor page's **Team** tab (Atlassian's documentation calls it Contacts) lists you as **Admin** and **Primary**. Your own row cannot be edited, which is normal for the only admin. Primary is the contact for every area, so nothing else is needed. The roles below matter only when you add a second person with **Add team member**.

1. At https://marketplace.atlassian.com, open the profile menu, then **Manage partner account**, then the **Team** tab.
2. Give fahim@asymm.systems these roles: Primary Contact, Support Contact, Licensing/Finance Contact, Security, Engineering, Sales support & approvals.
3. Why: Atlassian contacts the person in each role (refunds, security reports, API changes). With one person, that is you for all of them.

## Step 3. Partner verification (IN PROGRESS)

Where it stands: ticket **ECOHELP-182280** in the support portal. Identity Information Collection: **Submitted**. Partner Security Questionnaire: **not attached** to the ticket yet. Deadline for both forms: **6 December 2026**. Do NOT submit the "Re-Assign This Ticket" form: it restarts the verification.

Next in this step:
- Reload the ticket later. If the questionnaire is still not attached, click **Request for Help** and write: "I submitted the Identity Information Collection form. The Partner Security Questionnaire mentioned in the ticket is not attached. Please attach it so I can complete it."
- When the questionnaire appears, paste its questions to me; I draft the answers.
- Then the Stripe ID link arrives (passport photo, selfie, phone).
- Keep a scan of the business registration certificate (and the tax registration, if any) ready, in case Atlassian asks for it on the ticket.

How it was started (for the record): the support portal (ecosystem.atlassian.net) is a separate Atlassian site; the first visit asked you to set a password. The request type is under **App listing**: "Submit Partner Verification to publish your app on the Marketplace". The Partner / Vendor ID is the number in the vendor page's address after `/vendors/`.

Atlassian normally opens this ticket only when you first ask for an app approval. Start it now so it does not delay the launch.

1. Signed in as fahim@asymm.systems, open the "Submit Partner Verification" form: https://ecosystem.atlassian.net/servicedesk/customer/portal/34/group/110/create/4219 and submit it.
2. A **Partner Verification** ticket appears in the Developer and Marketplace Support portal (https://ecosystem.atlassian.net/servicedesk/customer/portal/34). Two forms are attached to it. Submit both **within 14 days**, or Atlassian rejects the ticket:
   - **Identity Information Collection**: the business name, physical address, business registration number or tax identification number, and your passport (or driving licence or national ID).
   - **Partner Security Questionnaire**: questions about the company's security practices. Atlassian uses it for information only; it does not block approval. Paste the questions to me and I will draft answers from what the apps and the company really do.
3. Then the ticket gives you a link to **Stripe Identity**. Have your phone and passport ready: you give your phone number and email, photograph the document, and take a selfie.
4. Business verification then runs by itself. The ticket ends as **Verified** (or Rejected, with an appeal form).
5. Time: Atlassian says 2 to 3 business days; one sole trader reported about 3 weeks.

## Step 4. Ask support two questions (NEXT)

In the Developer and Marketplace Support portal (https://ecosystem.atlassian.net/servicedesk/customer/portal/34), choose **App listing**, then **Questions about Marketplace**, and paste (as a new request, not a comment on the verification ticket):

> We are Asymm Systems, a company registered in Sri Lanka, preparing four paid Forge apps for Jira Cloud.
> 1. Can Atlassian pay our Marketplace payouts by SWIFT transfer in USD to a bank account in Sri Lanka in the company's legal name? Is there anything we must set up first?
> 2. Which tax form should a Sri Lankan company submit (W-8BEN-E?), and does Atlassian apply the US-Sri Lanka tax treaty to app income, or withhold tax?

Send me the answers. If payouts to Sri Lanka are not possible, we need another plan before the launch.

## Step 5. Payout and tax details (30 minutes)

1. Have a USD bank account in the company's exact legal name. Atlassian pays in USD by bank transfer, monthly, once the profit since the last payout reaches $500. PayPal is not offered.
2. In **Manage vendor account**, find the payment (payout) details and enter the bank account. Not confirmed: the exact page name.
3. Submit the tax form Atlassian asks for there. For a company this is probably W-8BEN-E; confirm with your tax adviser, and keep a copy.

## Step 6. Forge billing (5 minutes)

1. Since 1 January 2026, Atlassian bills developers for Forge use above a free allowance, and needs a payment method on file. Four small apps are likely to stay inside the allowance.
2. Open https://developer.atlassian.com/console, open the developer space that holds the four apps, and add a card in its billing settings. Not confirmed: the exact menu name.

## Step 7. Check the developer space (5 minutes, look only)

1. In https://developer.atlassian.com/console, check that CascadePlan, LedgerSeal, DefinitionGuard and FourRealities are in one developer space, and that this space belongs to the Asymm Systems partner account. Atlassian's onboarding page asks for this ("Ensure the developer space is correctly setup for the corresponding Marketplace partner account").
2. Tell me what you see. Do not publish the developer space: publishing creates the public partner page and cannot be undone. I will ask you on launch day.

## Step 8. Later, when I tell you: two-step verification and old sessions

1. Turn on two-step verification for fahim@asymm.systems: https://id.atlassian.com/manage-profile/security, then "Two-step verification". Atlassian requires it for partners.
2. Log out the other sessions on the same page. This ends the sessions whose cookies are committed in `docs/design/in-jira-automated-testing-guide.md`.
3. Why later: my live tests run in a signed-in session of this same account. Ending the sessions stops the tests, and turning on two-step verification may end them too (not confirmed). After that, I need a fresh test session from you.

## Tell me when

1. the partner profile exists (step 1),
2. the verification ticket is Verified (step 3), and paste me the security questionnaire questions when you see them,
3. support has answered (step 4),
4. what the developer space shows (step 7).
