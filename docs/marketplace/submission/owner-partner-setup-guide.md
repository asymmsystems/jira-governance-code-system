# Owner guide: Marketplace partner set-up

Account for every step: fahim@asymm.systems.

## Status (2026-11-06)

| # | Step | Status |
|---|---|---|
| 1 | Partner profile | Done. Vendor ID 334643263 |
| 2 | Team roles | Done. You are Admin and Primary |
| 3 | Partner verification (ticket ECOHELP-182280) | Identity form submitted. Waiting for the security questionnaire, then the Stripe ID check. Deadline 6 Dec 2026 |
| 4 | Payment tab | Done |
| 5 | Tax form question | Asked; waiting for support |
| 6 | Developer space | Next: finish setting up the "Asymm Systems" space; later, move the four apps into it |
| 7 | Forge billing card | In the "Asymm Systems" space, during step 6 |
| 8 | Two-step verification, end old sessions | Later, when I say |

## 3. Partner verification

- If the Partner Security Questionnaire is not on the ticket, click **Request for Help** and write: "Please attach the Partner Security Questionnaire."
- When it appears, paste its questions to me. I draft the answers.
- Then do the Stripe ID check (passport, selfie, phone).
- Do not submit "Re-Assign This Ticket": it restarts everything.

## 5. Tax form question

Portal: https://ecosystem.atlassian.net/servicedesk/customer/portal/34, then **App listing**, then **Questions about Marketplace**. Paste:

> We are [registered company name], Sri Lanka, Vendor ID 334643263. Where do we submit Form W-8BEN-E so that no US tax is withheld from our payouts? The Payment tab asks only for a tax ID.

## 6. Developer space

The apps are in the space "asymm-dev". The Marketplace vendor became its own space, "Asymm Systems". Atlassian requires each app to be in the space of the vendor that lists it, so the apps move to "Asymm Systems".

1. Now: switch to the "Asymm Systems" space, click **Continue** on "Add the admin and billing admin" and choose yourself.
2. Step 7 (the card) is part of that set-up.
3. Later, when I say (after the agents finish their deploys): in "asymm-dev", on each app's **...** menu, choose **Transfer app**, destination "Asymm Systems". Not on the 1st or 2nd day of a month.
4. Do not publish any space.

## 7. Forge billing card

In the "Asymm Systems" space: add the payment method when the set-up asks for it, or later under **Settings**.

## 8. Later, when I say

https://id.atlassian.com/manage-profile/security: turn on two-step verification, then log out the other sessions. Not now: the agents' live tests use your session.

## Reference values

| Field | Value |
|---|---|
| Partner name | Asymm Systems |
| Website | https://asymm.systems |
| Support email | support@asymm.systems |
| Support and SLA URL | https://asymm.systems/support |
| Support hours | Asia/Colombo, 09:00 to 17:00, Monday to Friday, not 24 hours |
| Logo | asymm-corporate/repository/code/asymm-corporate-code-brand/dist/asymm-mark-dark-400.png |

Partner page description (620 characters):

> Asymm Systems builds software for teams that must show how their work was planned, approved and done. Our Jira Governance Suite runs entirely on Atlassian Forge, with no outside servers: CascadePlan, a Jira timeline with percent-trigger dependencies, baselines and undo; LedgerSeal, approval seals that show any change made after sign-off; DefinitionGuard, an enforceable Definition of Done with evidence and a workflow gate; and FourRealities, which checks each issue for evidence of its decision, process, code and audit. We also publish Eliya, an OpenJDK distribution. Documentation and support: https://asymm.systems
