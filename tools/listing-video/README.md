<!--
  Copyright (c) 2026 Asymm Systems. All rights reserved.
  @author Fahim Farook
-->

# Short listing videos

This folder holds the tool that cuts a 20 to 30 second Marketplace listing video from a demo
recording. ffmpeg does all the picture and sound work. The tool opens no browser and records no
screen.

| File | What it does |
|---|---|
| `listing_cut.py` | Reads a cut plan (a JSON file) and renders the video with one ffmpeg run. |
| `review_sheet.sh` | Makes review sheets from a video: six frames a sheet, each marked with its exact time. |

The cut plans are next to the demos: `docs/marketplace/assets/<app>/demo/<app>-listing.json`.

## State on 2026-11-19

- The four cut plans were made from the demo recordings of 2026-11-09 and 2026-11-10. Those
  recordings show the old app names and the old icons.
- No final video exists. Only fast drafts were rendered, as style references.
- Only the DefinitionGuard draft was checked frame by frame. The LedgerSeal, CascadePlan and
  FourRealities plans were rendered once and were not checked.
- Nobody has listened to the sound track.
- The final cuts are made from new recordings of the production versions (TASK-00008).

## What you need

- Python 3. The tool uses the standard library only.
- ffmpeg and ffprobe with libx264, drawtext and the `perspective` filter. Version 7.1 was used.
- The Noto Sans fonts in `/usr/share/fonts/truetype/noto`. Set `LISTING_FONT_DIR` for another folder.
- Inside a Flatpak sandbox the tool runs the ffmpeg of the host through `flatpak-spawn --host`.

## How to run

```bash
# Print the start and the end of each shot in the finished video. Nothing is rendered.
tools/listing-video/listing_cut.py docs/marketplace/assets/definitionguard/demo/definitionguard-listing.json --timeline

# Fast draft, about 90 seconds. It goes to ~/.cache/listing-cut/<app>-draft/draft.mp4.
tools/listing-video/listing_cut.py <plan> --draft

# Review sheets of the draft, one frame each half second.
tools/listing-video/review_sheet.sh ~/.cache/listing-cut/definitionguard-draft/draft.mp4 /tmp/dg 0.5

# Final render. It writes the video and the frames of the plan next to the plan.
tools/listing-video/listing_cut.py <plan>
```

`--no-sound` renders without the sound track.

## The picture

The video is 1920 x 1080 at 60 frames a second, H.264 with AAC sound.

- A title strip (72 pixels) shows the app icon, the app name and a short note.
- The app window (1920 x 864) shows the recording. A camera moves over it.
- A caption band (144 pixels) shows a small coloured label and one large line.
- The video starts with the hook: large words on a light band over the dimmed app.
- The video ends with the end card: the icon, the app name, one or two lines, and the company line.

The colours are the Asymm standard colours of `docs/marketplace/assets/<app>/media-src/media.css`.

## The cut plan

All paths in a plan are relative to the plan file.

| Field | Meaning |
|---|---|
| `app` | A short name. It names the work folder in `~/.cache/listing-cut/`. |
| `name` | The app name in the title strip. |
| `src` | The demo recording. |
| `icon` | The app icon. The plans use `../icon.png`, so a new icon comes in with no change to the plan. |
| `out` | The name of the finished video. |
| `note` | Optional. The short note in the title strip. |
| `shots` | The shots, in order. See below. |
| `hook` | `t1` (end time), `kicker` (the small label), `lines` (the large words), `sub` (one smaller line). |
| `captions` | Each has `t0`, `t1`, `kicker`, `tone` (`teal`, `rose` or `sage`) and `text`. |
| `end` | `dur`, `title`, `lines`, `notes`, `by`. |
| `sounds` | Each is `[time, kind, level in dB]`. The kinds are `thump`, `tick`, `air` and `rise`. No music. |
| `frames` | Each is `[time, file name]`. A final render writes these still frames. |

A shot has these fields:

| Field | Meaning |
|---|---|
| `segs` | Parts of the recording, `[start, end]` or `[start, end, speed]`, in seconds. They are joined in order, so waiting time can be left out. |
| `lead`, `hold` | Seconds to freeze the first frame or the last frame. |
| `cam` | Camera keys `[time, centre x, centre y, zoom]`. The time counts from the start of the shot. The centre is in pixels of the recording. Zoom 1 shows the whole recording. The camera eases from key to key. |
| `focus` | Optional. Each has `t0`, `t1` and `rect` (`[x0, y0, x1, y1]`). A light wash covers everything outside the rectangle. |
| `x` | The length of the dissolve from the shot before, in seconds. |

Times in `cam` and `focus` count from the start of the shot. Times in `hook`, `captions`, `sounds`
and `frames` count from the start of the finished video. `--timeline` prints where each shot starts.

The tool stops with a message when a camera view leaves the recording.

## The size of the recording

The tool uses a region of 1902 x 856 pixels of the recording, from x 1 and y 0. That fits the
demos of November 2026 (1904 x 920, with a caption bar in the bottom 64 rows). For a recording
of another size, change `SRC_W`, `SRC_H` and `SRC_X` at the top of `listing_cut.py`.

## Notes for the next cut

1. **New footage needs new times and positions.** Every number in `segs`, `cam` and `focus`
   belongs to the old recordings. The times in `captions`, `sounds` and `frames` follow from
   them. The shot order, the hook, the caption words, the end card and the look carry over.
2. **Measure, do not estimate.** Take a full-size frame with a 100 pixel grid and read the
   positions from it:

   ```bash
   ffmpeg -ss 58.5 -i <demo>.mp4 -vf "crop=1904:856:0:0,drawgrid=w=100:h=100:t=1:c=red@0.3" -frames:v 1 frame.png
   ```

   Find the exact time of a page change (a message appears, a page scrolls) with:

   ```bash
   ffmpeg -ss 14 -to 20 -i <demo>.mp4 -vf "select='gt(scene,0.004)',metadata=print:file=-" -an -f null -
   ```

3. **The CascadePlan caption.** In the old recording, the dependent bar (PAY-12) did not move
   when PAY-11 moved one week. Do not write "dependent work moves with it" unless the new
   recording shows it. Each caption must say only what the picture shows.
4. **Do not cut words or controls with the edge of the frame.** Put each edge of a close-up in
   a gap between rows or cards. Where a close-up must cut a neighbour, use `focus` to wash it.
5. **Pick review frames by frame number.** The ffmpeg `fps` filter at 1 or 2 frames a second
   shows each frame about half a step late. `review_sheet.sh` picks by frame number, so its
   times are exact.
6. **Look at every review sheet** before the owner sees a video, and the frames inside each
   camera move too.
7. **The sound.** The owner must listen to it. The levels and the sounds were set without a
   listening check.
8. **The interface text is small.** At zoom 1 it cannot be read in the small player of a
   listing. The close-ups and the captions carry the message. A new recording with a larger
   browser zoom makes the close-ups sharper.

## Checks before the owner sees a video

- The first frame shows the hook.
- Each key element gets a close-up: the camera pushes in, holds, and pulls back.
- No word and no control is cut by the edge of the frame.
- Each caption is one line and says only what the picture shows.
- The video is 20 to 30 seconds long. The end card holds for 2 seconds or more.
- The names and the icon are the current ones.
