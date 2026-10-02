"""
Finish the teaser: mux picture + original audio, write the muted master,
the cover frame and the 7-frame review contact sheet, then verify the files.
"""
import json
import os
import shutil
import subprocess
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build")
OUT = os.path.join(ROOT, "output")
PROJ = os.path.join(OUT, "project")

MASTER = "corporator-teaser-test-v1.mp4"
MUTED = "corporator-teaser-test-v1-muted.mp4"


def ff():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def run(args, **kw):
    r = subprocess.run(args, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        print(r.stdout[-3000:])
        print(r.stderr[-3000:])
        raise SystemExit("ffmpeg failed: %s" % args[1:])
    return r


def mux():
    exe = ff()
    silent = os.path.join(BUILD, "silent.mp4")
    audio = os.path.join(BUILD, "mix.wav")
    # full master: picture + AAC 48 kHz, faststart
    run([exe, "-y", "-i", silent, "-i", audio,
         "-map", "0:v:0", "-map", "1:a:0",
         "-c:v", "libx264", "-preset", "slow", "-crf", "19",
         "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1",
         "-color_primaries", "bt709", "-color_trc", "bt709",
         "-colorspace", "bt709",
         "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
         "-movflags", "+faststart", "-shortest",
         os.path.join(OUT, MASTER)])
    # muted master: identical picture, no audio track, still faststart
    run([exe, "-y", "-i", os.path.join(OUT, MASTER),
         "-map", "0:v:0", "-an", "-c:v", "copy", "-movflags", "+faststart",
         os.path.join(OUT, MUTED)])


def cover():
    """Scene 01 frame with city + headline, straight from the render."""
    import render
    render.preload()
    im = render.render_frame(105)          # 3.50 s - title in, rule drawn, push on
    im.save(os.path.join(OUT, "cover.png"))


SHEET = [(105, "01  00:00-00:04  city reveal"),
         (180, "02  00:04-00:08  buildings already here"),
         (340, "03  00:08-00:13  the five roles"),
         (500, "04  00:13-00:18  role to workplace"),
         (640, "05  00:18-00:23  stock tokens to industries"),
         (800, "06  00:23-00:28  Capital and prizes"),
         (900, "07  00:28-00:32  Corporator")]


def contact_sheet():
    import render
    render.preload()
    tw = 940
    th = int(tw * 1080 / 1920)
    cols = 2
    rows = 4
    sheet = Image.new("RGB", (cols * (tw + 10) + 10, rows * (th + 34) + 40),
                      (238, 238, 238))
    d = ImageDraw.Draw(sheet)
    for i, (n, label) in enumerate(SHEET):
        r, c = divmod(i, cols)
        x = 10 + c * (tw + 10)
        y = 10 + r * (th + 34)
        im = render.render_frame(n).resize((tw, th), Image.LANCZOS)
        sheet.paste(im, (x, y))
        d.rectangle([x, y, x + tw - 1, y + th - 1], outline=(150, 150, 150))
        d.text((x + 4, y + th + 12),
               "frame %d  t=%.2fs   scene %s" % (n, n / 30.0, label),
               fill=(15, 15, 15))
    d.line([(10, rows * (th + 34) + 14), (sheet.width - 10,
           rows * (th + 34) + 14)], fill=(200, 200, 200))
    d.text((10, rows * (th + 34) + 22),
           "REVIEW MATERIAL - one control frame per scene, not for publication",
           fill=(120, 20, 20))
    sheet.save(os.path.join(OUT, "preview-contact-sheet.png"))


def copy_project():
    os.makedirs(PROJ, exist_ok=True)
    for f in ("render.py", "audio.py", "finish.py", "verify.py",
              "motion_audit.py", "transitions.py",
              "inspect_assets.py", "analyze_island2.py", "analyze_island3.py",
              "island_grid.py", "text_metrics.py", "signs_check.py", "sheet.py",
              "RENDER.md", "AUDIO_SOURCES.md"):
        p = os.path.join(BUILD, f)
        if os.path.exists(p):
            shutil.copy2(p, os.path.join(PROJ, f))
    for f in ("mix.wav", "music.wav", "sfx.wav"):
        src = os.path.join(BUILD, f)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(PROJ, f))
    for f in ("verify.json", "motion.json"):
        v = os.path.join(BUILD, f)
        if os.path.exists(v):
            shutil.copy2(v, os.path.join(PROJ, f))


def probe():
    exe = ff()
    out = {}
    for name in (MASTER, MUTED):
        p = os.path.join(OUT, name)
        r = subprocess.run([exe.replace("ffmpeg", "ffmpeg"), "-hide_banner"],
                           capture_output=True, text=True)
        # no ffprobe in this build: read the container via ffmpeg -i stderr
        s = subprocess.run([exe, "-hide_banner", "-i", p], capture_output=True,
                           text=True).stderr
        info = {"bytes": os.path.getsize(p)}
        for line in s.splitlines():
            line = line.strip()
            if line.startswith("Duration:"):
                info["duration"] = line
            if "Video:" in line:
                info["video"] = line
            if "Audio:" in line:
                info["audio"] = line
        out[name] = info
    return out


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    if what in ("all", "stills"):
        cover()
        contact_sheet()
    if what in ("all", "mux"):
        mux()
    if what in ("all", "project"):
        copy_project()
    if what in ("all", "verify"):
        print(json.dumps(probe(), indent=1))
