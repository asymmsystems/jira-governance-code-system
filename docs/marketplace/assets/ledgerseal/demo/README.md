<!--
  Copyright (c) 2026 Asymm Systems. All rights reserved.
  @author Fahim Farook
-->

# LedgerSeal demo video

File: `ledgerseal-demo.mp4` (85.0 seconds).

## What it shows

1. Test issue LSP-20 in project LSP is not sealed yet.
2. The approver opens the Approval Seal panel, chooses "Approved", agrees to the declaration and selects Sign and seal. After a reload, the panel and the sidebar both show SEALED.
3. A covered field changes after approval: the description timeout goes from 10s to 50s.
4. After a reload, the panel and the sidebar both show CHANGED. The panel names the field and shows the value at approval, the new value, who changed it and when.
5. The move to Done is refused with "Transition failed": the LedgerSeal validator blocks it until another approver approves the change.

Frames: `frame-01-sealed.png`, `frame-02-covered-field-edited.png`, `frame-03-changed-after-approval.png`, `frame-04-done-blocked.png`.

## Posted to

ECOHELP-182619 (Marketplace Approval for LedgerSeal), as a customer comment on 2026-11-09 (comment 2464033). The file attached there is an earlier take of this flow (88.6 seconds, test issue LSP-15), recorded before the automation pointer was hidden. This file has not been posted.

## How it was made

- Date: 2026-11-09.
- Build: the development build of the app on the development site asymmsystems.atlassian.net. The "DEV" or "Dev" badge in the frames marks it. The exact build version was not recorded at the time of recording.
- Data: test projects and test issues only.
- Recording: a real screen recording (GNOME Shell Screencast), cropped to the page, cut to remove loading time, with a caption bar. H.264, 1904x920, constant 60 fps.
- Pointer: the teal pointer is a page overlay added for the recording. The browser automation's own pointer and border were hidden from the page during the recording, and the system pointer is not shown.
