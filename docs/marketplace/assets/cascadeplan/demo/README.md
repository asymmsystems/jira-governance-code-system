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

# CascadePlan full-story video

File: `cascadeplan-full-story.mp4` (4 minutes 59.8 seconds, 11.3 MB).

## What it shows

The project is "Fleet Route Planner" (key FRP), a logistics product. It starts with one epic and two tasks in the Backlog and nothing on the plan.

1. The planner starts empty. The epic "Live driver tracking" and its two tasks are dragged from the Backlog onto the plan, and each one is written to Jira with its dates.
2. A second epic, "Delivery ETA notifications" (FRP-4), is created. A task (FRP-5) is added under it with an assignee, 24 hours and a start week. FRP-2 gets two Jira sub-tasks, each with its own hours.
3. FRP-3 is made to depend on FRP-2 with a trigger at 30% completion. FRP-3 moves to start at that point, and the link label shows the trigger and the date.
4. FRP-2 is dragged later. Before the drop, the preview lists each Jira date write, and FRP-3 moves with it. The end of a bar is then dragged to change its length.
5. A row is dragged by its handle to the top and back to the bottom.
6. The Changes panel lists every Jira field write of the session, with the old and new values. Undo writes the old dates back, and those writes are listed too.
7. The Utilization view shows hours per person per week.
8. The plan is frozen as the baseline "Sprint 3 commitment" (3 items, 96 hours). A new task, "Driver location privacy settings" (16 hours), is added. The baseline panel shows the scope change, a reason is given and approval is requested. The person who made the request tries to accept it, and CascadePlan refuses: "A request cannot be approved or rejected by the person who made it."
9. Integrity checks, with the real messages:
   - FRP-2 is set to wait for FRP-3, which already waits for FRP-2: "Cyclic dependency detected: FRP-2 -> FRP-3 -> FRP-2".
   - FRP-2 is set to wait for its own epic FRP-1: "Invalid dependency: FRP-2 and FRP-1 are parent and child; a parent's dates come from its children."
   - With Enforce deps on, FRP-3 is dragged before its trigger date. The preview says "Enforce dependencies: will snap FRP-3 to 2026-11-23 to satisfy dependency on FRP-2. Jira: no due date change.", and the drop leaves FRP-3 where it was.
10. The finished plan in Compact view, by week and by month.

Frames: `full-story-frame-01-empty-planner.png`, `full-story-frame-02-create-task.png`, `full-story-frame-03-percent-link.png`, `full-story-frame-04-move-preview.png`, `full-story-frame-05-changes-panel.png`, `full-story-frame-06-utilization.png`, `full-story-frame-07-approval-refused.png`, `full-story-frame-08-cyclic-dependency.png`.

## Posted to

Not posted.

## How it was made

- Date: 2026-11-10.
- Build: CascadePlan 3.21.0, the development build of the app on the development site asymmsystems.atlassian.net.
- Recording: real screen recordings (GNOME Shell Screencast) in ten parts, each practised first in a separate project. Each part is cropped to the page, cut to remove waiting time and played 1.25 to 2.2 times faster. A caption bar is added. H.264, 1904x920, constant 60 fps.
- Pointer: one teal page pointer, as above. Frames every half second of the finished video were checked by colour: no frame has more than one pointer. In a few frames the pointer is hidden under a drag image.
