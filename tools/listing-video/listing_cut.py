#!/usr/bin/env python3
# Copyright (c) 2026 Asymm Systems. All rights reserved.
#
# @author Fahim Farook
"""Cuts a short Marketplace listing video from an existing demo recording.

ffmpeg does all the picture and sound work: the cuts, the camera moves, the words, the end
card and the sound. This script only reads a JSON spec and writes the ffmpeg filter graph.
It opens no browser and records no screen.

Output: 1920 x 1080, 60 frames a second, H.264 with an AAC sound track.

Usage:
  listing_cut.py SPEC.json                 render the video and its frames
  listing_cut.py SPEC.json --draft         fast render at lower quality, for checking
  listing_cut.py SPEC.json --timeline      print the shot times and stop
  listing_cut.py SPEC.json --no-sound      render without the sound track

The spec is described in README.md, next to this file.
"""
import json
import math
import os
import shutil
import subprocess
import sys

FPS = 60
W, H = 1920, 1080                 # output frame
TOP, CH, BAND = 72, 864, 144      # title strip, content window, caption band
SRC_W, SRC_H = 1902, 856          # the part of the recording that is used (old caption bar cut off)
SRC_X = 1                         # left offset of that part in the recording

# The Asymm standard colours, as in docs/marketplace/assets/<app>/media-src/media.css.
INK, INK_SOFT, MUTED = "0x1A1C1E", "0x333333", "0x5E6C84"
OFF_WHITE, SAND_LIGHT, SAND = "0xF9F7F6", "0xFDF5E5", "0xF8DBA9"
TONES = {                          # lozenge background, lozenge text
    "teal": ("0xDCEBEE", "0x2E6470"),
    "rose": ("0xE9C9D7", "0x8E3F62"),
    "sage": ("0xDCE6CF", "0x4A6130"),
}
FONT_DIR = os.environ.get("LISTING_FONT_DIR", "/usr/share/fonts/truetype/noto")
F_BOLD = f"{FONT_DIR}/NotoSans-Bold.ttf"
F_SEMI = f"{FONT_DIR}/NotoSans-SemiBold.ttf"
F_REG = f"{FONT_DIR}/NotoSans-Regular.ttf"


def tool(name):
    """ffmpeg and ffprobe run on the host when this script runs inside a Flatpak sandbox."""
    if os.environ.get("FLATPAK_ID") and shutil.which("flatpak-spawn"):
        return ["flatpak-spawn", "--host", name]
    return [name]


def smooth(u):
    u = min(1.0, max(0.0, u))
    return u * u * (3 - 2 * u)


def piecewise(times, vals):
    """An ffmpeg expression: smoothstep between the keys, in the variable (on/FPS)."""
    t = f"(on/{FPS})"
    expr = f"{vals[-1]:.6f}"
    for i in range(len(times) - 2, -1, -1):
        t0, t1, v0, v1 = times[i], times[i + 1], vals[i], vals[i + 1]
        if abs(v1 - v0) < 1e-9:
            seg = f"{v0:.6f}"
        else:
            seg = (f"(st(0,clip(({t}-{t0:.4f})/{t1 - t0:.4f},0,1));"
                   f"{v0:.6f}+({v1 - v0:.6f})*ld(0)*ld(0)*(3-2*ld(0)))")
        expr = f"if(lt({t},{t1:.4f}),{seg},{expr})"
    return expr


def camera(cam, ww, wh):
    """perspective options for the camera keys [time, centre x, centre y, zoom]."""
    times = [k[0] for k in cam]
    kx, ky = ww / SRC_W, wh / SRC_H
    cx = piecewise(times, [k[1] * kx for k in cam])
    cy = piecewise(times, [k[2] * ky for k in cam])
    lz = piecewise(times, [math.log(k[3]) for k in cam])
    hw, hh = f"({ww / 2:.3f}/exp({lz}))", f"({wh / 2:.3f}/exp({lz}))"
    c = {"x0": f"({cx})-{hw}", "y0": f"({cy})-{hh}", "x1": f"({cx})+{hw}", "y1": f"({cy})-{hh}",
         "x2": f"({cx})-{hw}", "y2": f"({cy})+{hh}", "x3": f"({cx})+{hw}", "y3": f"({cy})+{hh}"}
    opts = ":".join(f"{k}='{v}'" for k, v in c.items())
    return f"perspective={opts}:sense=source:eval=frame:interpolation=cubic"


def check_camera(i, cam, dur):
    """Stops when a camera view leaves the recording: the frame would show smeared edges."""
    times = [k[0] for k in cam]
    for n in range(int(dur * FPS) + 1):
        t = n / FPS
        j = max(0, max(a for a in range(len(times)) if times[a] <= t or a == 0))
        if j >= len(cam) - 1:
            cx, cy, z = cam[-1][1:4]
        else:
            s = smooth((t - times[j]) / (times[j + 1] - times[j]))
            cx = cam[j][1] + (cam[j + 1][1] - cam[j][1]) * s
            cy = cam[j][2] + (cam[j + 1][2] - cam[j][2]) * s
            z = math.exp(math.log(cam[j][3]) + (math.log(cam[j + 1][3]) - math.log(cam[j][3])) * s)
        hw, hh = SRC_W / 2 / z, SRC_H / 2 / z
        if cx - hw < -0.6 or cx + hw > SRC_W + 0.6 or cy - hh < -0.6 or cy + hh > SRC_H + 0.6:
            sys.exit(f"shot {i}: the camera leaves the recording at {t:.2f} s "
                     f"(centre {cx:.0f},{cy:.0f}, zoom {z:.2f})")


def alpha(t0, t1, fin=0.18, fout=0.14):
    """drawtext alpha: fade in after t0, fade out before t1."""
    if fin <= 0:
        return f"if(lt(t,{t1 - fout:.3f}),1,max(0,({t1:.3f}-t)/{fout:.3f}))"
    return (f"if(lt(t,{t0:.3f}),0,if(lt(t,{t0 + fin:.3f}),(t-{t0:.3f})/{fin:.3f},"
            f"if(lt(t,{t1 - fout:.3f}),1,max(0,({t1:.3f}-t)/{fout:.3f}))))")


class Graph:
    def __init__(self, work):
        self.work, self.parts, self.n = work, [], 0

    def textfile(self, text):
        self.n += 1
        p = os.path.join(self.work, f"text{self.n:02d}.txt")
        with open(p, "w", encoding="utf-8") as f:
            f.write(text)
        return p

    def text(self, text, font, size, color, x, y, t0, t1, fin=0.18, fout=0.14, rise=10, box=None):
        """One drawtext filter. The words fade in, rise a little, and fade out."""
        yy = f"{y}+{rise}*(1-min(1,(t-{t0:.3f})/{fin:.3f}))" if (rise and fin > 0) else f"{y}"
        s = (f"drawtext=fontfile={font}:textfile={self.textfile(text)}:fontsize={size}:fontcolor={color}"
             f":x='{x}':y='{yy}':alpha='{alpha(t0, t1, fin, fout)}':enable='between(t,{t0:.3f},{t1:.3f})'")
        if box:
            s += f":box=1:boxcolor={box}:boxborderw=9|20"
        return s

    def add(self, s):
        self.parts.append(s)

    def script(self):
        return ";\n".join(self.parts) + "\n"


def sound_source(kind, dur=None):
    """Quiet, non-musical sounds made by ffmpeg itself."""
    if kind == "thump":      # a soft low knock
        return ("aevalsrc='sin(2*PI*(52+58*exp(-t*26))*t)*exp(-t*11)*min(1,t*400)':d=0.6:s=48000,"
                "lowpass=f=240")
    if kind == "tick":       # a short soft click
        return ("aevalsrc='(random(0)*2-1)*exp(-t*120)*min(1,t*2000)':d=0.06:s=48000,"
                "bandpass=f=2800:w=1600")
    d = dur or (1.3 if kind == "rise" else 0.7)
    if kind == "air":        # air on a camera move
        return (f"aevalsrc='(random(0)*2-1)*pow(sin(PI*t/{d}),2)':d={d}:s=48000,"
                "bandpass=f=1100:w=900,lowpass=f=2600")
    if kind == "rise":       # a longer breath for the end card
        return (f"aevalsrc='(random(0)*2-1)*pow(sin(PI*t/{d}),2)':d={d}:s=48000,"
                "bandpass=f=1700:w=1400,lowpass=f=4200")
    sys.exit(f"unknown sound: {kind}")


def build(spec, base, work, draft, with_sound):
    ss = 1 if draft else 2
    ww, wh = W * ss, CH * ss
    g = Graph(work)
    shots = spec["shots"]

    # 1. Each shot: cut the parts from the recording, join them, then move the camera over them.
    nseg = sum(len(s["segs"]) for s in shots)
    g.add("[0:v]split=" + str(nseg) + "".join(f"[r{k}]" for k in range(nseg)))
    k, durs = 0, []
    for i, s in enumerate(shots):
        labels, dur = "", 0.0
        for seg in s["segs"]:
            a, b, sp = seg[0], seg[1], (seg[2] if len(seg) > 2 else 1.0)
            g.add(f"[r{k}]trim=start={a}:end={b},setpts=(PTS-STARTPTS)/{sp},fps={FPS},"
                  f"crop={SRC_W}:{SRC_H}:{SRC_X}:0,setsar=1[g{k}]")
            labels += f"[g{k}]"
            dur += (b - a) / sp
            k += 1
        lead, hold = s.get("lead", 0), s.get("hold", 0)     # freeze the first or the last frame
        chain = f"{labels}concat=n={len(s['segs'])}:v=1:a=0,"
        if lead or hold:
            chain += (f"tpad=start_mode=clone:start_duration={lead}:stop_mode=clone:stop_duration={hold},"
                      f"setpts=PTS-STARTPTS,")
        dur = round((dur + lead + hold) * FPS) / FPS
        cam = s["cam"]
        check_camera(i, cam, dur)
        # Focus: a soft light wash over everything but one rectangle, so the eye goes to it.
        for n, f in enumerate(s.get("focus", [])):
            x0, y0, x1, y1 = f["rect"]
            t0, t1, fd = f["t0"], f["t1"], f.get("fade", 0.3)
            g.add(f"color=c={OFF_WHITE}:s={SRC_W}x{SRC_H}:r={FPS}:d={dur:.4f},format=rgba,"
                  f"colorchannelmixer=aa={f.get('dim', 0.72)},"
                  f"drawbox=x={x0}:y={y0}:w={x1 - x0}:h={y1 - y0}:color=white@0:t=fill:replace=1,"
                  f"format=yuva444p,boxblur=lr=1:lp=1:cr=1:cp=1:ar={f.get('feather', 7)}:ap=2,"
                  f"fade=t=in:st={t0:.3f}:d={fd}:alpha=1,fade=t=out:st={t1 - fd:.3f}:d={fd}:alpha=1[f{i}_{n}]")
            chain += f"format=yuv444p[q{i}_{n}];[q{i}_{n}][f{i}_{n}]overlay=eof_action=pass:format=yuv444,"
        sharpen = f",cas=strength={s['sharpen']}" if s.get("sharpen") else ""
        chain += (f"scale={ww}:{wh}:flags=lanczos,format=yuv444p,{camera(cam, ww, wh)},"
                  f"scale={W}:{CH}:flags=lanczos{sharpen},trim=duration={dur:.4f},setpts=PTS-STARTPTS,"
                  f"fps={FPS},settb=AVTB,setsar=1[s{i}]")
        g.add(chain)
        durs.append(dur)

    # 2. Join the shots. "x" is the length of the dissolve into a shot (0 = a plain cut).
    starts, t, prev = [0.0], durs[0], "s0"
    for i in range(1, len(shots)):
        x = max(shots[i].get("x", 0.25), 1 / FPS)
        off = t - x
        g.add(f"[{prev}][s{i}]xfade=transition=fade:duration={x:.4f}:offset={off:.4f}[j{i}]")
        starts.append(off)
        t, prev = off + durs[i], f"j{i}"
    tm = t                                             # length of the app footage
    end = spec["end"]
    xe, de = 0.45, end.get("dur", 3.8)
    total = tm + de - xe
    te = tm - xe                                       # the end card starts to appear here

    # 3. The end card: the app window gives way to the name, in the frame that stays.
    e, y = [], 176
    e.append(g.text(end["title"], F_BOLD, 118, INK, "(w-text_w)/2", str(y + 168), 0.2, de + 1, fin=0.3))
    yy = y + 168 + 176
    for ln in end["lines"]:
        e.append(g.text(ln, F_SEMI, 46, INK_SOFT, "(w-text_w)/2", str(yy), 0.45, de + 1, fin=0.3))
        yy += 64
    yy += 22
    for ln in end.get("notes", []):
        e.append(g.text(ln, F_REG, 34, MUTED, "(w-text_w)/2", str(yy), 0.7, de + 1, fin=0.3))
        yy += 48
    g.add("[1:v]split=2[i1][i2]")
    g.add("[i1]scale=46:46:flags=lanczos,format=rgba[ic]")
    g.add("[i2]scale=132:132:flags=lanczos,format=rgba[eic]")
    g.add(f"color=c={OFF_WHITE}:s={W}x{CH}:r={FPS}:d={de:.3f},format=yuv444p[eb]")
    g.add(f"[eb][eic]overlay=x=(W-w)/2:y={y}[e0]")
    g.add("[e0]" + ",".join(e) + f",fps={FPS},settb=AVTB[ew]")
    g.add(f"[{prev}][ew]xfade=transition=fade:duration={xe}:offset={te:.4f}[allv]")

    # 4. The frame: title strip on top, the app in the middle, the caption band below.
    g.add(f"color=c={OFF_WHITE}:s={W}x{H}:r={FPS}:d={total:.4f},format=yuv444p,"
          f"drawbox=x=0:y={TOP + CH}:w={W}:h={BAND}:color={SAND_LIGHT}:t=fill,"
          f"drawbox=x=0:y={TOP - 2}:w={W}:h=2:color={INK}@0.10:t=fill,"
          f"drawbox=x=0:y={TOP + CH}:w={W}:h=2:color={INK}@0.10:t=fill[bg]")
    g.add(f"[bg][allv]overlay=x=0:y={TOP}:eof_action=repeat[c0]")
    g.add("[c0][ic]overlay=x=26:y=13[c1]")
    cur = "c1"
    strip = [g.text(spec["name"], F_BOLD, 32, INK, "86", "17", 0, total + 1, fin=0, rise=0),
             g.text(spec.get("note", "Screen recording of a test project with test data"), F_REG, 23, MUTED,
                    "w-text_w-30", "24", 0, te + 0.2, fin=0, rise=0, fout=0.3)]

    # 5. The hook: large words on a light band over the dimmed app, from the first frame.
    hook = spec["hook"]
    h0, h1 = 0.0, hook["t1"]
    mid = CH / 2
    lines = hook["lines"]
    size = hook.get("size", 92)
    lh = int(size * 1.22)
    block = 66 + len(lines) * lh + (70 if hook.get("sub") else 0)
    y = int(mid - block / 2)
    g.add(f"color=c={OFF_WHITE}:s={W}x{CH}:r={FPS}:d={h1:.3f},format=rgba,colorchannelmixer=aa={hook.get('dim', 0.6)},"
          f"drawbox=x=0:y={y - 54}:w={W}:h={block + 108}:color={OFF_WHITE}@0.95:t=fill:replace=1,"
          f"fade=t=out:st={h1 - 0.5:.3f}:d=0.5:alpha=1[scrim]")
    g.add(f"[{cur}][scrim]overlay=x=0:y={TOP}:eof_action=pass[c2]")
    cur = "c2"
    y += TOP
    words = [g.text(hook["kicker"], F_SEMI, 28, TONES["teal"][1], "(w-text_w)/2", str(y), h0, h1 - 0.1, fin=0, rise=0,
                    box=TONES["teal"][0])]
    y += 66
    for ln in lines:
        words.append(g.text(ln, F_BOLD, size, INK, "(w-text_w)/2", str(y), h0, h1 - 0.1, fin=0, rise=0))
        y += lh
    if hook.get("sub"):
        words.append(g.text(hook["sub"], F_REG, 42, INK_SOFT, "(w-text_w)/2", str(y + 14), 0.3, h1 - 0.1, fin=0.3))

    # 6. The captions: a small coloured label and one large line. The last line names the company.
    for c in spec["captions"]:
        tone = TONES[c.get("tone", "teal")]
        t0, t1 = c["t0"], min(c["t1"], te + 0.1)
        words.append(g.text(c["kicker"], F_SEMI, 25, tone[1], "(w-text_w)/2", str(TOP + CH + 26), t0, t1, box=tone[0]))
        words.append(g.text(c["text"], F_SEMI, c.get("size", 50), INK, "(w-text_w)/2", str(TOP + CH + 68), t0 + 0.06, t1))
    words.append(g.text(end["by"], F_BOLD, 38, TONES["teal"][1], "(w-text_w)/2", str(TOP + CH + 48), te + 0.75, total + 1,
                        fin=0.3))
    g.add(f"[{cur}]" + ",".join(strip + words) + ",format=yuv420p[v]")

    # 7. The sound: a few quiet, non-musical events, never a tune.
    maps = ["-map", "[v]"]
    if with_sound and spec.get("sounds"):
        outs = ""
        for n, ev in enumerate(spec["sounds"]):
            t, kind, db = ev[0], ev[1], ev[2]
            dur = ev[3] if len(ev) > 3 else None
            g.add(f"{sound_source(kind, dur)},volume={db}dB,adelay={int(t * 1000)}:all=1[a{n}]")
            outs += f"[a{n}]"
        g.add(f"{outs}amix=inputs={len(spec['sounds'])}:normalize=0:duration=longest,"
              f"apad=whole_dur={total:.3f},atrim=duration={total:.3f},alimiter=limit=0.7,"
              f"aformat=sample_fmts=fltp:channel_layouts=stereo[a]")
        maps += ["-map", "[a]"]
    return g, starts, durs, tm, total, maps


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    if len(args) != 1:
        sys.exit(__doc__)
    spec_path = os.path.abspath(args[0])
    base = os.path.dirname(spec_path)
    spec = json.load(open(spec_path, encoding="utf-8"))
    draft = "--draft" in flags
    work = os.path.join(os.path.expanduser("~/.cache/listing-cut"), spec["app"] + ("-draft" if draft else ""))
    os.makedirs(work, exist_ok=True)
    g, starts, durs, tm, total, maps = build(spec, base, work, draft, "--no-sound" not in flags)

    print(f"{spec['app']}: app footage {tm:.2f} s, with end card {total:.2f} s")
    for i, (a, d) in enumerate(zip(starts, durs)):
        print(f"  shot {i}: {a:6.2f} to {a + d:6.2f}  ({d:.2f} s)")
    if not 20.0 <= total <= 30.0:
        print(f"  WARNING: {total:.2f} s is outside 20 to 30 seconds")
    if "--timeline" in flags:
        return

    script = os.path.join(work, "graph.txt")
    with open(script, "w", encoding="utf-8") as f:
        f.write(g.script())
    out = os.path.join(work, "draft.mp4") if draft else os.path.join(base, spec["out"])
    enc = (["-c:v", "libx264", "-preset", "veryfast", "-crf", "22"] if draft else
           ["-c:v", "libx264", "-preset", "slow", "-crf", "16", "-profile:v", "high", "-level", "4.2",
            "-g", "120", "-bf", "2"])
    cmd = tool("ffmpeg") + ["-v", "error", "-stats", "-y", "-i", os.path.join(base, spec["src"]),
                            "-i", os.path.join(base, spec["icon"]), "-filter_complex_script", script] + maps + \
        ["-r", str(FPS)] + enc + ["-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709",
                                  "-colorspace", "bt709", "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
                                  "-movflags", "+faststart", "-t", f"{total:.3f}", out]
    subprocess.run(cmd, check=True)
    print("\nwrote", out)
    if not draft:
        for t, name in spec.get("frames", []):
            subprocess.run(tool("ffmpeg") + ["-v", "error", "-y", "-ss", str(t), "-i", out, "-frames:v", "1",
                                             os.path.join(base, name)], check=True)
    print(subprocess.run(tool("ffprobe") + ["-v", "error", "-show_entries",
                                            "stream=codec_name,width,height,r_frame_rate,sample_rate:format=duration,size",
                                            "-of", "default=nw=1", out], capture_output=True, text=True).stdout)


if __name__ == "__main__":
    main()
