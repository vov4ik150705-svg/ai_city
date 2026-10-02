"""
Verification pass over the delivered master.

Checks, per the brief's pre-delivery list:
  * real container parameters (size, fps, frame count, duration, codecs, audio)
  * exactly 960 frames and 32.000 s
  * no black or near-empty frames anywhere, and specifically no black tail
  * the last steady frame is readable (scene 07 text present)
  * 480x270 legibility sheet
"""
import json
import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build")
OUT = os.path.join(ROOT, "output")
MASTER = os.path.join(OUT, "corporator-teaser-test-v1.mp4")
MUTED = os.path.join(OUT, "corporator-teaser-test-v1-muted.mp4")


def ff():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def container(path):
    s = subprocess.run([ff(), "-hide_banner", "-i", path], capture_output=True,
                       text=True).stderr
    info = {}
    for line in s.splitlines():
        t = line.strip()
        if t.startswith("Duration:"):
            info["duration_hms"] = t.split(",")[0].replace("Duration:", "").strip()
        elif t.startswith("Stream #"):
            k = "video" if "Video:" in t else ("audio" if "Audio:" in t else None)
            if k:
                info[k] = t
        elif "major_brand" in t:
            info["brand"] = t
    return info


def decode_all(path):
    """Decode every frame to raw rgb24 and return stats + a few captures."""
    W, H = 1920, 1080
    p = subprocess.Popen(
        [ff(), "-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-"], stdout=subprocess.PIPE)
    n = 0
    mean_l, min_l, black = [], [], []
    keep = {}
    want = {0, 105, 180, 340, 500, 640, 800, 900, 959}
    while True:
        buf = p.stdout.read(W * H * 3)
        if len(buf) < W * H * 3:
            break
        a = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
        lum = a.astype(np.float32).mean(axis=2)
        mean_l.append(float(lum.mean()))
        min_l.append(float(lum.min()))
        if float(lum.max()) < 12.0:
            black.append(n)
        if n in want:
            keep[n] = Image.fromarray(a.copy())
        n += 1
    p.stdout.close()
    p.wait()
    return n, np.array(mean_l), np.array(min_l), black, keep


def main():
    rep = {}
    for name, path in (("master", MASTER), ("muted", MUTED)):
        rep[name] = {"path": os.path.relpath(path, ROOT).replace("\\", "/"),
                     "bytes": os.path.getsize(path),
                     "container": container(path)}
    n, mean_l, min_l, black, keep = decode_all(MASTER)
    nm, _, _, black_m, _ = decode_all(MUTED)
    rep["frames"] = {
        "master_frame_count": n,
        "muted_frame_count": nm,
        "expected": 960,
        "black_or_blank_frames": black[:20],
        "black_count": len(black),
        "black_in_muted": len(black_m),
        "luma_mean_min": round(float(mean_l.min()), 2),
        "luma_mean_max": round(float(mean_l.max()), 2),
        "luma_min_overall": round(float(min_l.min()), 2),
        "last_10s_mean_luma": [round(float(x), 1) for x in mean_l[-300::30]],
    }

    # scene 07 must stay readable to the very last frame
    last = keep[959]
    a = np.asarray(last.convert("L"), np.float32)
    # ink coverage in the two text blocks of the final frame
    def ink(x0, y0, x1, y1):
        return int((a[y0:y1, x0:x1] < 110).sum())
    rep["final_frame_960x270_check"] = {
        "logo_block_ink_px": ink(410, 320, 830, 740),
        "wordmark_ink_px": ink(975, 400, 1700, 500),
        "tagline_ink_px": ink(975, 525, 1700, 585),
        "handle_ink_px": ink(975, 600, 1700, 660),
    }

    # 480x270 legibility sheet
    order = [105, 180, 340, 500, 640, 800, 900]
    tw, th = 480, 270
    sheet = Image.new("RGB", (2 * (tw + 8) + 8, 4 * (th + 24) + 8), (235, 235, 235))
    d = ImageDraw.Draw(sheet)
    for i, fn in enumerate(order):
        r, cc = divmod(i, 2)
        x = 8 + cc * (tw + 8)
        y = 8 + r * (th + 24)
        sheet.paste(keep[fn].resize((tw, th), Image.LANCZOS), (x, y))
        d.text((x + 3, y + th + 6), "frame %d  t=%.2fs  @480x270" % (fn, fn / 30.0),
               fill=(0, 0, 0))
    sheet.save(os.path.join(BUILD, "check_480x270.png"))

    # full-size per-scene control frames for close reading
    for fn in order:
        keep[fn].save(os.path.join(BUILD, "check_full_%04d.png" % fn))
    print(json.dumps(rep, indent=1))
    with open(os.path.join(BUILD, "verify.json"), "w", encoding="utf-8") as fh:
        json.dump(rep, fh, indent=1)


if __name__ == "__main__":
    main()
