<!--
  Copyright (c) 2026 Asymm Systems. All rights reserved.
  @author Fahim Farook
-->

# DefinitionGuard demo video

File: `definitionguard-demo.mp4` (60.5 seconds).

## What it shows

1. Test issue LSP-21 has the Definition of Done panel with 6 items, 5 of them mandatory.
2. With mandatory items open, the panel states that the move to Done is blocked and names each open item.
3. Tick with evidence on "Automated test suite passes with zero regressions": a link to a test CI run and a note are entered, then Save and tick.
4. The item is ticked with who and when, and Evidence attached. Show evidence displays the link and the note.

Not shown:
- The refused move to Done. No workflow on the development site has the DefinitionGuard validator, and adding it changes the site's workflow configuration.
- The refusal of the assignee on a not-the-assignee item. The checklist used on project LSP does not mark any item as not-the-assignee, so the assignee's tick was accepted and that part was cut.

Frames: `frame-01-done-blocked-items-open.png`, `frame-02-evidence-form.png`, `frame-03-evidence-ticked.png`, `frame-04-evidence-shown.png`.

## Posted to

Not posted yet. The owner stopped the posting before this video was attached to ECOHELP-182684.

## How it was made

- Date: 2026-11-09.
- Build: the development build of the app on the development site asymmsystems.atlassian.net. The "DEV" or "Dev" badge in the frames marks it. The exact build version was not recorded at the time of recording.
- Data: test projects and test issues only.
- Recording: a real screen recording (GNOME Shell Screencast), cropped to the page, cut to remove loading time, with a caption bar. H.264, 1904x920, constant 60 fps.
- Pointer: the teal pointer is a page overlay added for the recording. The browser automation's own pointer and border were hidden from the page during the recording, and the system pointer is not shown.
