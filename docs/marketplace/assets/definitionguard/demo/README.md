<!--
  Copyright (c) 2026 Asymm Systems. All rights reserved.
  @author Fahim Farook
-->

# DefinitionGuard demo video

File: `definitionguard-demo.mp4` (104.2 seconds).

## What it shows

1. Task HBR-3 "Show a banner when the app is offline" in the test project "Harbor Notes" (HBR). DefinitionGuard opens from the issue's apps button, which shows the app name and icon. The task's Definition of Done has 4 mandatory items: two need evidence, and "Peer code review approved" may not be ticked by the assignee.
2. The move to Done is refused: Jira names each open mandatory item.
3. "Automated tests pass in CI" and "Security and dependency scan clear" are ticked with a link and a note. Each tick shows who and when, and "Evidence attached".
4. "Acceptance criteria verified" is ticked.
5. The assignee tries to tick "Peer code review approved" and is refused: "The assignee cannot complete this item. Ask a reviewer."
6. The assignee, who is also a project administrator, tries to waive the item with a written reason and is refused: "The assignee cannot waive this item, and you are or were the assignee of this issue after the item was opened. Ask another approver."
7. The move to Done is refused again: one mandatory item is open.
8. The checklist audit history: the chain check shows "Chain intact" and "Property signed".

The refused tick and the refused waiver are not written to the audit history. Only saved changes are.

Frames: `frame-01-done-refused.png`, `frame-02-evidence-ticked.png`, `frame-03-assignee-refused.png`, `frame-04-waiver-refused.png`, `frame-05-history.png`.

## Test setup

- Site: asymm-staging.atlassian.net, with DefinitionGuard **3.4.0** installed from the Atlassian Marketplace (the production version; no development badge).
- Project "Harbor Notes" (key HBR), company-managed, with its own workflow "Software Simplified Workflow for Project HBR". The DefinitionGuard DoD Enforcement validator is on its transition into Done.
- The HBR template for Task is "Harbor Notes Definition of Done" version 1. Waivers stay at the default, Administer projects.
- Data: a test project with made-up work items. The evidence links use the `example.com` domain.

## How it was made

- Date: 2026-11-19.
- Recording: a real screen recording (GNOME Shell Screencast) without the system pointer, cropped to the Jira page, cut to remove waiting time, with a caption bar. H.264, 1904 x 920, constant 60 fps.
- Pointer: the teal pointer is a page overlay. A script in the page moved it to each control before clicking, so the video shows exactly one pointer. The browser automation was idle during the recording, so none of its own pointer or border is in the video.
- The short listing video is cut from this file with `tools/listing-video/listing_cut.py` and the plan `definitionguard-listing.json` (branch `docs/listing-videos`).

## Earlier version

The first demo (88.2 seconds, test issue DGD-3 on the development site, with the development badge and the old name and icon) was recorded on 2026-11-09. It was posted to ECOHELP-182684 (Marketplace Approval for DefinitionGuard) on 2026-11-09, comment 2464312. It is in the git history of this folder.
