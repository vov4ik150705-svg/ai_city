"""Stitch diet stills into one labeled comparison sheet."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from _diet_measure import triangle_count  # noqa: E402
RUNTIME = ROOT / "runtime"
SHOTS = RUNTIME / "_diet_shots"
OUT = RUNTIME / "_diet_compare.png"

ROWS = ("nvidia_tower", "bank", "city_hall", "clearinghouse")
COLS: tuple[tuple[str, str, Path], ...] = (
    ("исходник", "src", RUNTIME / "buildings"),
    ("8k", "8k", RUNTIME / "_diet_a"),
    ("4k", "4k", RUNTIME / "_diet_b"),
    ("2k", "2k", RUNTIME / "_diet_c"),
)

CELL = 512
PAD = 16
HEADER = 56
LABEL = 44
ROW_LABEL = 168
BG = (34, 38, 44)
INK = (236, 240, 244)
MUTED = (168, 176, 184)


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for name in ("segoeui.ttf", "arial.ttf", "calibri.ttf"):
        path = Path(r"C:\Windows\Fonts") / name
        if path.is_file():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def caption(slug: str, folder: Path) -> str:
    glb = folder / f"{slug}.glb"
    tris = triangle_count(glb)
    kb = glb.stat().st_size / 1024
    return f"{tris:,} △   {kb:.0f} КБ".replace(",", " ")


def main() -> None:
    title_font = font(22)
    cell_font = font(16)
    row_font = font(18)
    width = ROW_LABEL + PAD + len(COLS) * (CELL + PAD) + PAD
    height = HEADER + len(ROWS) * (CELL + LABEL + PAD) + PAD
    sheet = Image.new("RGB", (width, height), BG)
    draw = ImageDraw.Draw(sheet)
    draw.text((PAD, 16), "I0 · прореживание зданий · один ракурс", font=title_font, fill=INK)

    for ci, (title, _key, _folder) in enumerate(COLS):
        x = ROW_LABEL + PAD + ci * (CELL + PAD)
        draw.text((x, HEADER - 28), title, font=title_font, fill=INK)

    for ri, slug in enumerate(ROWS):
        y0 = HEADER + ri * (CELL + LABEL + PAD)
        draw.text((PAD, y0 + CELL // 2 - 10), slug, font=row_font, fill=INK)
        for ci, (_title, key, folder) in enumerate(COLS):
            x = ROW_LABEL + PAD + ci * (CELL + PAD)
            shot = SHOTS / f"{slug}_{key}.png"
            if not shot.is_file():
                raise SystemExit(f"missing shot {shot}")
            img = Image.open(shot).convert("RGB")
            if img.size != (CELL, CELL):
                img = img.resize((CELL, CELL), Image.Resampling.LANCZOS)
            sheet.paste(img, (x, y0))
            draw.text((x, y0 + CELL + 8), caption(slug, folder), font=cell_font, fill=MUTED)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT, "PNG")
    print(f"wrote {OUT} {OUT.stat().st_size} bytes {sheet.size}")


if __name__ == "__main__":
    main()
