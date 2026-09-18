"""Generate or edit an image with OpenAI GPT Image 2.5.

Reads OPENAI_API_KEY from the environment. Does not write secrets to disk.

  python tools/gen_image.py "low-poly character, front view, black background"
  python tools/gen_image.py --ref path/to/ref.png "same character, eye-level, waist-up"
  python tools/gen_image.py --model flare --size 1024x1536 "portrait"
"""

from __future__ import annotations

import argparse
import base64
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    from openai import OpenAI
except ImportError:
    sys.stderr.write("pip install openai\n")
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "art" / "gen"
MODELS = {
    "sunburst": "gpt-image-2.5-sunburst",
    "flare": "gpt-image-2.5-flare",
}


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("prompt", help="text prompt")
    p.add_argument("--ref", action="append", default=[], help="reference image; repeatable")
    p.add_argument("--model", choices=sorted(MODELS), default="sunburst")
    p.add_argument("--size", default="1024x1536", help="WxH, e.g. 1024x1024 or 1024x1536")
    p.add_argument("--quality", default="high", help="auto|low|medium|high|xhigh|max")
    p.add_argument("--out", help="output png path")
    args = p.parse_args()

    if not os.environ.get("OPENAI_API_KEY"):
        sys.stderr.write("Set OPENAI_API_KEY in this terminal, then rerun.\n")
        return 2

    client = OpenAI()
    model = MODELS[args.model]
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    dest = Path(args.out) if args.out else OUT_DIR / f"{args.model}-{stamp}.png"

    if args.ref:
        images = [open(path, "rb") for path in args.ref]
        try:
            result = client.images.edit(
                model=model,
                image=images if len(images) > 1 else images[0],
                prompt=args.prompt,
                size=args.size,
                quality=args.quality,
            )
        finally:
            for fh in images:
                fh.close()
    else:
        result = client.images.generate(
            model=model,
            prompt=args.prompt,
            size=args.size,
            quality=args.quality,
            output_format="png",
        )

    dest.write_bytes(base64.b64decode(result.data[0].b64_json))
    print(dest)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
