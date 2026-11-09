<!--
  Copyright (c) 2026 Asymm Systems. All rights reserved.
  @author Fahim Farook
-->

# DefinitionGuard demo video

File: `definitionguard-demo.mp4` (88.2 seconds).

## What it shows

1. Test issue DGD-3 in the test project "DG Demo" (DGD). Its Definition of Done has 4 mandatory items. Two need evidence, and "Peer code review approved" may not be ticked by the assignee.
2. The move to Done is refused: the DefinitionGuard validator on DGD's Done transition names each open mandatory item.
3. "Automated tests pass in CI" and "Security and dependency scan clear" are ticked with a link to a test CI run or scan and a note. Each tick shows who and when, and "Evidence attached".
4. "Acceptance criteria verified" is ticked.
5. The assignee tries to tick "Peer code review approved" and is refused: "The assignee cannot complete this item. Ask a reviewer."
6. The assignee, who is also a project administrator, tries to waive the item with a written reason and is refused: "The assignee cannot waive this item, and you are or were the assignee of this issue after the item was opened. Ask another approver." This is the separation of duties working, so the issue stays out of Done.
7. The checklist audit history: the chain check ("Chain intact", "Property signed") and each event with who and when, including the evidence links and notes.

The refused tick and the refused waiver are not written to the audit history. Only saved changes are.

Frames: `frame-01-done-refused.png`, `frame-02-evidence-ticked.png`, `frame-03-assignee-refused.png`, `frame-04-audit-history.png`.

## Test setup on the development site

- Project "DG Demo" (key DGD), company-managed, with its own workflow "Software Simplified Workflow for Project DGD" and scheme "DGD: Software Simplified Workflow Scheme". No other project uses them.
- The DefinitionGuard DoD Enforcement validator is on the DGD transition into Done.
- The DGD template for Task is "Checkout team DoD" version 1. Waivers stay at the default, Administer projects.

## Posted to

Posted to ECOHELP-182684 (Marketplace Approval for DefinitionGuard) on 2026-11-09, comment 2464312, as a customer comment with this file attached.

## How it was made

- Date: 2026-11-09.
- Build: the development build of the app on the development site asymmsystems.atlassian.net. The "DEV" badge in the frames marks it. The exact build version was not recorded at the time of recording.
- Data: test project and test issues only.
- Recording: a real screen recording (GNOME Shell Screencast) without the system pointer, cropped to the page, cut to remove loading time, with a caption bar. H.264, 1904x920, constant 60 fps.
- Pointer: the teal pointer is a page overlay added for the recording. The browser automation's own pointer and border were hidden from the page during the recording.
