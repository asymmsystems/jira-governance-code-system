#!/bin/bash
# Copyright (c) 2026 Asymm Systems. All rights reserved.
#
# @author Fahim Farook
#
# Makes review sheets from a 60 fps video: one frame for each step, six frames a sheet, each
# frame marked with its exact time. Look at every sheet before the owner sees the video.
# The frames are picked by frame number, so the time on a frame is the true time.
# Usage: review_sheet.sh VIDEO OUT_PREFIX [STEP_SECONDS] [START] [END]
set -euo pipefail
VIDEO=$1; OUT=$2; STEP=${3:-1}; START=${4:-0}; END=${5:-100000}
FF=ffmpeg; if [ -n "${FLATPAK_ID:-}" ] && command -v flatpak-spawn >/dev/null; then FF="flatpak-spawn --host ffmpeg"; fi
FONT=${LISTING_FONT_DIR:-/usr/share/fonts/truetype/noto}/NotoSans-Bold.ttf
N=$(awk -v s="$STEP" 'BEGIN{printf "%d", s*60+0.5}')
N0=$(awk -v s="$START" 'BEGIN{printf "%d", s*60+0.5}')
N1=$(awk -v s="$END" 'BEGIN{printf "%d", s*60+0.5}')
rm -f "${OUT}"-[0-9][0-9].jpg
$FF -v error -y -i "$VIDEO" -vf "select='gte(n,$N0)*lte(n,$N1)*not(mod(n-$N0,$N))',scale=960:-1,drawtext=fontfile=$FONT:text='%{pts}':x=8:y=8:fontsize=26:fontcolor=yellow:box=1:boxcolor=black@0.75,tile=2x3:padding=4:color=red" -fps_mode vfr -q:v 2 "${OUT}-%02d.jpg"
ls "${OUT}"-*.jpg
