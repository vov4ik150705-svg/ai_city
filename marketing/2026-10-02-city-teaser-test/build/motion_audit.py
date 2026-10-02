"""
Motion audit: prove there are no pops, whip-pans or flashes, and that every
title really holds long enough to be read.

  * inter-frame mean absolute difference -> a jump/pop would spike here
  * per-scene hold length in the title band -> the >= 2.5 s reading rule
"""
import json
import os
import subprocess

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, "build")
MASTER = os.path.join(ROOT, "output", "corporator-teaser-test-v1.mp4")
W, H = 1920, 1080

# title band where the main headline lives, in frame coords
BAND = (110, 95, 1810, 250)
SCENES = [("01", 0, 120), ("02", 120, 240), ("03", 240, 390), ("04", 390, 540),
          ("05", 540, 690), ("06", 690, 840), ("07", 840, 960)]


def ff():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def main():
    p = subprocess.Popen(
        [ff(), "-v", "error", "-i", MASTER, "-f", "rawvideo", "-pix_fmt", "gray",
         "-"], stdout=subprocess.PIPE)
    n = 0
    prev = None
    diffs = []
    band_static = []
    while True:
        buf = p.stdout.read(W * H)
        if len(buf) < W * H:
            break
        a = np.frombuffer(buf, np.uint8).reshape(H, W)
        if prev is not None:
            diffs.append(float(np.abs(a.astype(np.int16) -
                                      prev.astype(np.int16)).mean()))
        band = a[BAND[1]:BAND[3], BAND[0]:BAND[2]]
        band_static.append(float(band.std()))
        prev = a
        n += 1
    p.stdout.close()
    p.wait()
    d = np.array(diffs)
    bs = np.array(band_static)
    out = {
        "frames": n,
        "interframe_diff": {
            "mean": round(float(d.mean()), 3),
            "max": round(float(d.max()), 3),
            "argmax_frame": int(d.argmax()) + 1,
            "p99": round(float(np.percentile(d, 99)), 3),
            "over_8": [int(i) + 1 for i in np.where(d > 8.0)[0]],
            "note": "a whip-pan / cut / flash would show a large spike",
        },
    }
    holds = {}
    for name, f0, f1 in SCENES:
        seg = bs[f0:f1]
        # a frame is "reading-stable" when the title band stops changing
        stable = 0
        run = 0
        best = 0
        for i in range(1, len(seg)):
            if abs(seg[i] - seg[i - 1]) < 0.35:
                run += 1
                stable += 1
                best = max(best, run)
            else:
                run = 0
        holds[name] = {
            "scene_frames": f1 - f0,
            "longest_static_run_frames": best,
            "longest_static_run_seconds": round(best / 30.0, 2),
            "band_std_last_frame": round(float(seg[-1]), 1),
        }
    out["title_band_hold"] = holds
    print(json.dumps(out, indent=1))
    with open(os.path.join(BUILD, "motion.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1)


if __name__ == "__main__":
    main()
