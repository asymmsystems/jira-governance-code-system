# FourRealities User Guide

![Four Realities issue panel](/assets/fourrealities/02-issue-panel.png)

## The issue panel

Open **Four Realities** from an issue's app actions, or in the issue context on the right. The panel shows the four checks as a chain, one sentence about the first gap, the next step, and **Gate findings** with each check's state and source.

| State | Meaning | Scored |
|---|---|---|
| Evidence found | FourRealities read the evidence (a link, a page Confluence returned, or a record whose signature it verified) | Yes, 100 |
| Evidence found (heuristic) | A merged or open pull request in the Development field | Yes, 100 |
| Evidence found (link only) | A Confluence link whose page could not be checked | Yes, 100 |
| Evidence missing | The check applies and there is no evidence, or a record failed its signature check | Yes, 0 |
| Reported, not verified | Another app's record that FourRealities cannot verify | No |
| Not used on this site | The administrator does not use this check | No |
| Not applicable | The check does not apply yet (for example, work not started or not done) | No |
| Excepted | An approved Code exception | No |

**Why N%?** lists what each check adds to the Reality Alignment Index (RAI).

## Actions

- **Link decision record:** search Confluence by title, or enter a page address on this site, and add a Jira remote link as you.
- **Request Code exception:** for finished work with no pull request. An approver who is not you and not the assignee decides.
- **Add rework reason:** when the issue went back from done, or from in progress to to do. Reasons never change a check.
- **Request retrospective review:** posts a comment as you when a pull request was merged. It does not claim a review happened.

## The project dashboard

![Four Realities dashboard](/assets/fourrealities/01-dashboard.png)

Open **Four Realities** in the project navigation: audit readiness, one card per check (or "Not used"), the checks in use on this site, Priority actions, Coverage at a glance, the Issue triage table with filters (search, assignee, sprint, gate, risk and presets) and a four-week trend for the whole project. You see only the issues you can browse in Jira.
