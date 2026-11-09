<!--
  Copyright (c) 2026 Asymm Systems. All rights reserved.
  @author Fahim Farook
-->

# CascadePlan demo video

File: `cascadeplan-demo.mp4` (60.5 seconds).

## What it shows

1. The CascadePlan Planner on test project PAY: epics, stories and sub-tasks on the timeline, with their links.
2. A percent-trigger link: the label opens the link, which says PAY-12 starts when PAY-11 reaches 30%. It is closed without a change.
3. PAY-11 is dragged one week later with a real mouse drag. Before the drop, the preview lists the Jira dates it will write.
4. The drop applies the move, and a message offers Undo.
5. The Changes panel lists the Jira writes of the session, with the old and new values.
6. Undo restores the dates of PAY-11, and the reverse writes are listed too.

Frames: `frame-01-percent-trigger-link.png`, `frame-02-move-preview.png`, `frame-03-move-applied.png`, `frame-04-changes-panel.png`.

## Posted to

Not posted yet: no review ticket.

## How it was made

- Date: 2026-11-09.
- Build: the development build of the app on the development site asymmsystems.atlassian.net. The "DEV" or "Dev" badge in the frames marks it. The exact build version was not recorded at the time of recording.
- Data: test projects and test issues only.
- Recording: a real screen recording (GNOME Shell Screencast), cropped to the page, cut to remove loading time, with a caption bar. H.264, 1904x920, constant 60 fps.
- Pointer: the teal pointer is a page overlay added for the recording. The browser automation's own pointer and border were hidden from the page during the recording, and the system pointer is not shown.
