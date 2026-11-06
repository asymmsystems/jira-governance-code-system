# Owner guide: register Asymm Systems as a Marketplace partner

Date: 2026-11-06 (rewritten). For: Fahim Farook.
Sources: Atlassian pages fetched on 2026-11-06 ("Become a partner", "Register as an Atlassian Marketplace Partner", "Due diligence business and identity verification"), and `docs/sdlc/suite-readiness-review-2026-11/marketplace-commercial-rules.md`. Where Atlassian does not say something clearly, the step says "not confirmed".

## Before you start: which account

Use **fahim@asymm.systems**, the Atlassian account you already use. It owns the four Forge apps, and it is the account my live tests sign in with. You do not create a new account, and you do not change any email.

Can it be a shared address such as sudo@asymm.systems? Not for these steps:
- Atlassian's email rule is about the domain: it refuses Gmail, Yahoo and similar domains for paid apps. Any `@asymm.systems` address passes that rule.
- But the partner verification checks a **person**: the primary contact uploads a passport and takes a selfie. And every partner contact must be an Atlassian account. So the profile and the verification are done by you, as fahim@asymm.systems.
- A shared mailbox is not needed. You can add one later as an extra contact, but only if it has its own Atlassian account.

## Step 1. Create the partner profile (15 minutes)

1. Open https://marketplace.atlassian.com/login?redirect=%2F and sign in as fahim@asymm.systems.
2. Open https://marketplace.atlassian.com/manage/vendor/create.
3. Fill in the form with these values (the form decides which fields it asks for):

   | Field | Value |
   |---|---|
   | Partner (company) name | Asymm Systems |
   | Website | https://asymm.systems |
   | Contact email | fahim@asymm.systems |
   | Support email or page | support@asymm.systems, https://asymm.systems/support |
   | Address | the company's registered address |
   | "Describe your organization in 750 characters or less" (shown on your partner page) | the text below (620 characters) |

   Partner page description (copy it exactly):

   ```text
   Asymm Systems builds software for teams that must show how their work was planned, approved and done. Our Jira Governance Suite runs entirely on Atlassian Forge, with no outside servers: CascadePlan, a Jira timeline with percent-trigger dependencies, baselines and undo; LedgerSeal, approval seals that show any change made after sign-off; DefinitionGuard, an enforceable Definition of Done with evidence and a workflow gate; and FourRealities, which checks each issue for evidence of its decision, process, code and audit. We also publish Eliya, an OpenJDK distribution. Documentation and support: https://asymm.systems
   ```

   Every statement in it is true of the apps today; it makes no compliance or customer claim. If the form refuses the link, remove the last sentence (571 characters).

4. If the form asks you to accept the Marketplace Partner Agreement, read it first. If you want, send me the agreement link before you accept, and I will list any clause about interest or late-payment charges.
5. Result: at https://marketplace.atlassian.com your profile menu (top right) now has **Manage vendor account**.

## Step 2. Give yourself the contact roles (5 minutes)

1. At https://marketplace.atlassian.com, open the profile menu, then **Manage vendor account**, then **Contacts**, then **Manage**.
2. Give fahim@asymm.systems these roles: Primary Contact, Support Contact, Licensing/Finance Contact, Security, Engineering, Sales support & approvals.
3. Why: Atlassian contacts the person in each role (refunds, security reports, API changes). With one person, that is you for all of them.

## Step 3. Start the partner verification now (30 minutes of forms, then waiting)

Atlassian normally opens this ticket only when you first ask for an app approval. Start it now so it does not delay the launch.

1. Signed in as fahim@asymm.systems, open the "Submit Partner Verification" form: https://ecosystem.atlassian.net/servicedesk/customer/portal/34/group/110/create/4219 and submit it.
2. A **Partner Verification** ticket appears in the Developer and Marketplace Support portal (https://ecosystem.atlassian.net/servicedesk/customer/portal/34). Two forms are attached to it. Submit both **within 14 days**, or Atlassian rejects the ticket:
   - **Identity Information Collection**: the business name, physical address, business registration number or tax identification number, and your passport (or driving licence or national ID).
   - **Partner Security Questionnaire**: questions about the company's security practices. Atlassian uses it for information only; it does not block approval. Paste the questions to me and I will draft answers from what the apps and the company really do.
3. Then the ticket gives you a link to **Stripe Identity**. Have your phone and passport ready: you give your phone number and email, photograph the document, and take a selfie.
4. Business verification then runs by itself. The ticket ends as **Verified** (or Rejected, with an appeal form).
5. Time: Atlassian says 2 to 3 business days; one sole trader reported about 3 weeks.

## Step 4. Ask support two questions (5 minutes)

In the Developer and Marketplace Support portal (https://ecosystem.atlassian.net/servicedesk/customer/portal/34), open a new request (not a comment on the verification ticket) and paste:

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
