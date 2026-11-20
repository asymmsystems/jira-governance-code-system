<!--
  Copyright (c) 2026 Asymm Systems. All rights reserved.
  @author Fahim Farook
-->

# LedgerSeal demo video

File: `ledgerseal-demo.mp4` (145.8 seconds, 1920 x 1080, 60 fps, no sound).

## What it shows

1. Change request CHG-8 "Extend the card refund window from 30 to 60 days" in the project "Change Control" (CHG). LedgerSeal opens from the issue's apps button, which shows the app name and icon. The panel says the issue is not sealed yet.
2. The approver seals it: a role, the declaration and a single-use signing code, then Sign and seal. The panel shows SEALED.
3. A colleague changes the title and the first line of the description (60 days becomes 90 days). The panel shows CHANGED and names both changed items, with the value at approval, the value now, who changed it and when.
4. The move to Done is refused: "LedgerSeal: 2 fields changed after approval (Description, Summary). Ask a project admin who did not make the change to approve it in the LedgerSeal panel."
5. An approver who did not make the change approves it with a role, a reason and a signing code. The issue is sealed again, and the move to Done passes.
6. CHG-1 shows the rule for one person: "You changed this issue, so another approver must approve it."
7. CHG-5 shows the approval route "QA then Regulatory": QA has signed, one of two stages is complete.
8. The details of the seal (signer, role, reason, hash), the history (sealed, two changes found, sealed again with the reason) and the evidence record of CHG-8.
9. The open verifier 1.5.0 checks the exported evidence record without Jira: 8 PASS lines, exit code 0. This picture is not a screen recording. It shows the command and the eight PASS lines of the real run on the evidence record of CHG-8. The two NOTE lines of the output are not shown.

Frames: `frame-01-sealed.png`, `frame-02-changed-items.png`, `frame-03-done-refused.png`, `frame-04-done-passes.png`, `frame-05-approval-route.png`, `frame-06-verifier.png`.

## Recording setup

- Site: asymm-staging.atlassian.net, with LedgerSeal **4.1.0** installed from the Atlassian Marketplace (the production version; no development badge). Browser zoom 125%.
- Project "Change Control" (key CHG). Code signing was on for the project during the recording.
- Two people: the owner's account seals and approves; a second company user, under their own sign-in, changes the title and the description after the seal.
- Data: our own project and work items on asymm-staging; no customer data.

## How it was made

- Date: 2026-11-20.
- Recording: five takes, each run by a script inside the Jira page, recorded as a screen recording without the system pointer. The pointer is a teal page overlay drawn by the script, so the video shows exactly one pointer. The six digits of each signing code were typed with real key presses.
- Cut: a dark brand background, the app in a rounded card, Montserrat for every added word, and a camera that shows the panel, moves in on each click and on typing, holds, and moves out. H.264, 60 fps.
- The short listing video (25.4 seconds, two soft mouse-click sounds and no other sound) is cut from the same takes.

## Earlier version

The first demo (85.0 seconds, issue LSP-20 on the development site, with the development badge and the old name and icon) was recorded on 2026-11-09. An earlier take of it (88.6 seconds) was posted to ECOHELP-182619 (Marketplace Approval for LedgerSeal) on 2026-11-09, comment 2464033. The 85-second file is in the git history of this folder.
