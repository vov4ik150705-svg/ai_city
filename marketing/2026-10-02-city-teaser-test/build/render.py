"""
Corporator city teaser - 32 s / 1920x1080 / 30 fps compositor.

Builds the whole teaser from the original PNGs in assets/ plus an original
synthesised audio bed. Every element lives on an absolute frame timeline, so
motion is continuous across scene boundaries by construction.

Frame map (30 fps, 960 frames, 32.000 s):
  s01 0-119   s02 120-239   s03 240-389
  s04 390-539  s05 540-689   s06 690-839   s07 840-959
"""
import math
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
FONTS = os.path.join(ROOT, "fonts")
OUT = os.path.join(ROOT, "output")
BUILD = os.path.join(ROOT, "build")

W, H, FPS, NF = 1920, 1080, 30, 960
INK = (33, 40, 47)
WARM_WHITE = (252, 250, 247)
F_BOLD = os.path.join(FONTS, "Outfit-Bold.ttf")
F_REG = os.path.join(FONTS, "Outfit-Regular.ttf")

BASE_Y = 870          # shared object base line for scenes 02/03/04
GROUND_Y = 884        # shared graphite ground line
ISO_DX, ISO_DY = 40, 34   # consistent entry offset: settle up-and-right


# ----------------------------------------------------------------- easing --
def clamp01(t):
    return 0.0 if t < 0.0 else (1.0 if t > 1.0 else t)


def ease_out_cubic(t):
    t = clamp01(t)
    return 1.0 - (1.0 - t) ** 3


def ease_in_out_cubic(t):
    t = clamp01(t)
    return 4 * t * t * t if t < 0.5 else 1 - ((-2 * t + 2) ** 3) / 2


def smoothstep(t):
    t = clamp01(t)
    return t * t * (3 - 2 * t)


def ease_out_sine(t):
    t = clamp01(t)
    return math.sin(t * math.pi / 2)


def seg(n, f0, f1):
    return 1.0 if f1 <= f0 else (n - f0) / (f1 - f0)


def ramp(n, f0, f1, easing=ease_out_cubic):
    return easing(seg(n, f0, f1))


def hold_in(n, f0, f1):
    return 0.0 if n < f0 else ramp(n, f0, f1)


def fade_out(n, f0, f1, easing=ease_in_out_cubic):
    return 1.0 - ramp(n, f0, f1, easing)


# ------------------------------------------------------------ asset prep ---
def load(rel):
    return Image.open(os.path.join(ROOT, rel)).convert("RGBA")


def sil_bbox(im, thresh=128):
    return im.getchannel("A").point(
        lambda v: 255 if v >= thresh else 0).getbbox()


def sprite(rel, target_h, pad=0.40):
    """
    Scale so the ALPHA SILHOUETTE height == target_h, aspect preserved.
    The silhouette is centred in a canvas with `pad` headroom so a small
    scale animation can crop-free resize.  Originals are never modified.
    """
    im = load(rel)
    x0, y0, x1, y1 = sil_bbox(im)
    sw, sh = x1 - x0, y1 - y0
    s = (target_h * (1.0 + pad)) / sh
    rs = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))),
                   Image.LANCZOS)
    cw = int(sw * s) + int(sw * s * pad) + 10
    ch = int(sh * s) + int(sh * s * pad) + 10
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    canvas.alpha_composite(rs, (int(cw / 2 - (x0 + sw / 2) * s),
                                int(ch / 2 - (y0 + sh / 2) * s)))
    return canvas, sw * s, sh * s


# ------------------------------------------------------------- utilities ---
_font_cache, _text_cache, _resize_cache, _wash_cache = {}, {}, {}, {}


def font(path, size):
    if (path, size) not in _font_cache:
        _font_cache[(path, size)] = ImageFont.truetype(path, size)
    return _font_cache[(path, size)]


def text_layer(txt, size, bold, color=INK):
    """Pre-render a string once; the glyph ink starts at (PAD, PAD)."""
    PAD = 4
    key = (txt, size, bold, color)
    if key in _text_cache:
        return _text_cache[key]
    f = font(F_BOLD if bold else F_REG, size)
    bb = f.getbbox(txt)
    im = Image.new("RGBA", (int(bb[2] - bb[0]) + 2 * PAD,
                            int(bb[3] - bb[1]) + 2 * PAD), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((PAD - bb[0], PAD - bb[1]), txt, font=f,
                            fill=color + (255,))
    _text_cache[key] = im
    return im


def draw_text(canvas, txt, size, x, y, bold=False, color=INK, alpha=1.0,
              dy=0.0, align="l", backing=0.0, backing_color=WARM_WHITE):
    """
    Place a string by its visual ink box: (x, y) is the top-left for align 'l',
    the horizontal centre for 'c', the right edge for 'r'.  `dy` is the
    entrance offset (+12 -> 0).  `backing` paints a soft light wash behind.
    """
    if alpha <= 0.003:
        return
    lay = text_layer(txt, size, bold, color)
    px = int(round(x if align == "l" else
                   (x - lay.width / 2.0) if align == "c" else (x - lay.width)))
    py = int(round(y - 4 + dy))
    if backing > 0.003:
        bw, bh = lay.width + 52, lay.height + 46
        b = Image.new("RGBA", (bw, bh), (0, 0, 0, 0))
        ImageDraw.Draw(b).rectangle([10, 10, bw - 11, bh - 11],
                                    fill=backing_color + (255,))
        b = b.filter(ImageFilter.GaussianBlur(19))
        b.putalpha(b.getchannel("A").point(lambda v: int(v * backing * alpha)))
        canvas.alpha_composite(b, (px - 26, py - 23))
    if alpha >= 0.999:
        canvas.alpha_composite(lay, (px, py))
    else:
        c = lay.copy()
        c.putalpha(lay.getchannel("A").point(lambda v: int(v * alpha)))
        canvas.alpha_composite(c, (px, py))


_shadow = None


def contact_shadow(canvas, cx, base_y, width, alpha=0.17, squash=0.15):
    global _shadow
    if alpha <= 0.004 or width <= 2:
        return
    if _shadow is None:
        s = 400
        sp = Image.new("L", (s, s), 0)
        ImageDraw.Draw(sp).ellipse([34, 34, s - 34, s - 34], fill=255)
        _shadow = sp.filter(ImageFilter.GaussianBlur(30))
    rx = max(6.0, width * 0.5)
    ry = max(3.0, rx * squash)
    tw, th = int(rx * 2) + 10, int(ry * 2) + 10
    sh = _shadow.resize((tw, th), Image.LANCZOS)
    lay = Image.new("RGBA", (tw, th), (24, 32, 42, 0))
    lay.putalpha(sh.point(lambda v: int(v * alpha)))
    canvas.alpha_composite(lay, (int(cx - tw / 2), int(base_y - th * 0.30)))


def _scaled(key, spr, scale):
    k = (key, round(scale, 4))
    if k not in _resize_cache:
        if len(_resize_cache) > 400:
            _resize_cache.clear()
        _resize_cache[k] = spr.resize((max(1, round(spr.width * scale)),
                                       max(1, round(spr.height * scale))),
                                      Image.LANCZOS)
    return _resize_cache[k]


def place(canvas, spr, sw, sh, key, cx, base_y, alpha, height=None,
          shadow=True, shadow_a=0.17):
    """Paste a silhouette-normalised sprite, centred on cx, standing on base_y."""
    if alpha <= 0.004:
        return
    h = height if height is not None else sh
    scale = h / sh
    w = sw * scale
    if shadow:
        contact_shadow(canvas, cx, base_y, w * 0.80, shadow_a * alpha)
    lay = spr if scale >= 0.9995 else _scaled(key, spr, scale)
    px = int(round(cx - lay.width / 2.0))
    py = int(round(base_y - h - (lay.height - h) / 2.0))
    if alpha < 0.999:
        lay = lay.copy()
        lay.putalpha(lay.getchannel("A").point(lambda v: int(v * alpha)))
    canvas.alpha_composite(lay, (px, py))


def wash(alpha_fn, res=(112, 63), feather=18):
    """Smooth full-frame warm-white wash built from a low-res alpha field."""
    small = Image.new("L", res, 0)
    px = small.load()
    for j in range(res[1]):
        v = j / res[1]
        for i in range(res[0]):
            px[i, j] = max(0, min(255, int(alpha_fn(i / res[0], v) * 255)))
    lay = Image.new("RGBA", (W, H), WARM_WHITE + (0,))
    lay.putalpha(small.resize((W, H), Image.BICUBIC).filter(
        ImageFilter.GaussianBlur(feather)))
    return lay


def ell(cx, cy, rx, ry, gain=1.0, p=1.6):
    def f(u, v):
        d = ((u * W - cx) / rx) ** 2 + ((v * H - cy) / ry) ** 2
        return 0.0 if d >= 1.0 else (1.0 - d) ** p * gain
    return f


def band(y0, y1, gain, x0=None, x1=None, fade=190):
    def f(u, v):
        y = v * H
        if y < y0 or y > y1:
            return 0.0
        a = math.sin(math.pi * (y - y0) / max(1e-6, y1 - y0)) ** 0.5 * gain
        x = u * W
        if x0 is not None and x < x0:
            a *= max(0.0, min(1.0, (x - (x0 - fade)) / fade))
        if x1 is not None and x > x1:
            a *= max(0.0, min(1.0, ((x1 + fade) - x) / fade))
        return a
    return f


def cached_wash(tag, fn):
    if tag not in _wash_cache:
        if len(_wash_cache) > 40:
            _wash_cache.clear()
        _wash_cache[tag] = wash(fn)
    return _wash_cache[tag]


def graphite(canvas, x0, x1, y, alpha, lw=3, progress=1.0, ticks=(),
             tick_len=17, color=INK):
    """Thin graphite rule with a few short vertical ticks - the linking element."""
    if alpha <= 0.004 or progress <= 0.004:
        return
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    xe = x0 + (x1 - x0) * progress
    d.rectangle([x0, y - lw / 2.0, xe, y + lw / 2.0], fill=color + (255,))
    for tx in ticks:
        if tx <= xe - 5:
            d.rectangle([tx - 1.5, y - tick_len, tx + 1.5, y + tick_len],
                        fill=color + (255,))
    lay.putalpha(lay.getchannel("A").point(lambda v: int(v * alpha)))
    canvas.alpha_composite(lay)


def graphite_v(canvas, x, y0, y1, alpha, lw=2, progress=1.0, color=INK):
    if alpha <= 0.004 or progress <= 0.004:
        return
    lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(lay).rectangle(
        [x - lw / 2.0, y0, x + lw / 2.0, y0 + (y1 - y0) * progress],
        fill=color + (255,))
    lay.putalpha(lay.getchannel("A").point(lambda v: int(v * alpha)))
    canvas.alpha_composite(lay)


# ------------------------------------------------------------ backgrounds --
class Stage:
    pass


ST = Stage()

# ---------------------------------------------------------------------------
# island: the WHOLE 3840x2160 source, proportions preserved, no pixel of the
# island ever cut.  Solid island silhouette in source px is
# x 1174..2693, y 496..1885 (measured; sky gradient and cloud excluded).
#
# ISO_PIN is the screen position of the city-building centre and is the FOCUS
# POINT of the push.  It is not free: the pre-render is the source at the 1.06
# scale, so for the frame to stay covered at z = 1.00 the image's left/top edge
# must already be at or outside the frame there, i.e.
#     ISO_PIN.x <= ISO_CORE.x * ISO_S1 * ISO_ZMAX   (1187.5 px here)
#     ISO_PIN.y <= ISO_CORE.y * ISO_S1             (612.7 px here)
# and for the island to keep margins at 1.06:
#     ISO_PIN.y >= 72 + 308*1.06 = 398.5   and   <= 1060 - 545*1.06 = 482.3
# so ISO_PIN.y lands in [398.5, 482.3].  The pre-render is additionally padded
# with the island's own sky colour, so a crop can never reveal black.
#   z = 1.00 -> island  x  713..1647,  y  137..990   (left sky free for type)
#   z = 1.06 -> island  x  685..1673,  y  119..1023  (247 px right, 57 px bottom)
ISO_S1 = 0.61419          # source -> screen scale at z = 1.00
ISO_ZMAX = 1.06
ISO_PAD = 48              # sky-coloured safety border on the pre-render
ISO_CORE = (1933.5, 997.5)  # centre of the city buildings, source px
ISO_PIN = (1180.0, 445.0)   # where that centre sits on screen (the focus point)


def build_island():
    src = Image.open(os.path.join(ASSETS, "island", "island_hero.png")).convert("RGB")
    s = ISO_S1 * ISO_ZMAX
    tw, th = round(src.width * s), round(src.height * s)
    # pad with the island's own corner sky so no crop can ever expose black
    sky = src.getpixel((0, 0))
    canvas = Image.new("RGB", (tw + 2 * ISO_PAD, th + 2 * ISO_PAD), sky)
    canvas.paste(src.resize((tw, th), Image.LANCZOS), (ISO_PAD, ISO_PAD))
    ST.island = canvas
    ST.iso_pad = ISO_PAD


def build_sky():
    sky = Image.open(os.path.join(ASSETS, "background", "sky.png")).convert("RGB")
    s = max(1976 / sky.width, 1122 / sky.height)
    ST.sky = sky.resize((round(sky.width * s) + 2, round(sky.height * s) + 2),
                        Image.LANCZOS)
    ST.sky_base = ((ST.sky.width - W) // 2, (ST.sky.height - H) // 2)


def build_logo():
    lg = Image.open(os.path.join(ASSETS, "brand", "logo_solo.png")).convert("RGB")
    t = 420
    ST.logo = lg.resize((t, t), Image.LANCZOS)
    e = []
    for x in range(t):
        e += [ST.logo.getpixel((x, 0)), ST.logo.getpixel((x, t - 1))]
    for y in range(t):
        e += [ST.logo.getpixel((0, y)), ST.logo.getpixel((t - 1, y))]
    ST.logo_field = tuple(int(sum(c[i] for c in e) / len(e)) for i in range(3))


def build_window():
    """
    Scene 06: the COMPLETE island inside a small rectangular window - rock,
    cliffs and waterfalls all inside, never cut (only empty sky is trimmed).
    Pre-rendered at the 3% push so the per-frame move is a cheap centre crop.
    """
    pwx, pwh, zmax = 640, 560, 1.03
    # island extent incl. waterfalls: x 1174..2693, y 496..1960
    s0 = min(pwx * 0.86 / 1519.0, pwh * 0.86 / 1464.0)
    s = s0 * zmax
    tw, th = math.ceil(3840 * s), math.ceil(2160 * s)
    ST.win_max = Image.open(
        os.path.join(ASSETS, "island", "island_hero.png")).convert("RGB").resize(
        (tw, th), Image.LANCZOS)
    ST.win_c = (1933.5 * s, 1228.0 * s)   # island centre in the pre-render
    ST.win_zmax = zmax


WASH_KEYS = [(0, 0.0), (108, 0.0), (132, 0.24), (240, 0.24), (398, 0.24),
             (526, 0.24), (558, 0.62), (674, 0.62), (708, 0.46), (820, 0.46),
             (844, 0.0), (959, 0.0)]


def wash_amount(n):
    for i in range(len(WASH_KEYS) - 1):
        f0, v0 = WASH_KEYS[i]
        f1, v1 = WASH_KEYS[i + 1]
        if f0 <= n <= f1:
            return v0 + (v1 - v0) * smoothstep(seg(n, f0, f1))
    return WASH_KEYS[-1][1]


def build_background(n, dx=0):
    canvas = Image.new("RGBA", (W, H), WARM_WHITE + (255,))
    a_sky = ramp(n, 110, 130, ease_in_out_cubic) * fade_out(n, 810, 840, ease_in_out_cubic)
    if a_sky > 0.003:
        bx, by = ST.sky_base[0] + dx, ST.sky_base[1]
        lay = Image.new("RGBA", (W, H))
        lay.paste(ST.sky.crop((bx, by, bx + W, by + H)), (0, 0))
        amt = wash_amount(n)
        if amt > 0.005:
            lay.alpha_composite(cached_wash(
                ("sky", round(amt, 2)),
                lambda u, v: amt * (0.60 * ell(430, 300, 1200, 500)(u, v) +
                                    0.58 * ell(1520, 660, 1100, 660, 0.9)(u, v) +
                                    0.34)))
        if a_sky < 0.999:
            lay.putalpha(lay.getchannel("A").point(lambda v: int(v * a_sky)))
        canvas.alpha_composite(lay)
    a_isl = fade_out(n, 110, 130, ease_in_out_cubic)
    if a_isl > 0.003:
        z = 1.0 + 0.06 * smoothstep(seg(n, 0, 134))
        s = ISO_S1 * z
        # screen position of source (0,0) at this zoom, mapped into pre-render px
        x0 = ISO_PIN[0] - ISO_CORE[0] * s
        y0 = ISO_PIN[1] - ISO_CORE[1] * s
        ix = int(round(ISO_PAD - x0 * (ISO_ZMAX / z)))
        iy = int(round(ISO_PAD - y0 * (ISO_ZMAX / z)))
        lay = Image.new("RGBA", (W, H))
        lay.paste(ST.island.crop((ix, iy, ix + W, iy + H)), (0, 0))
        if a_isl < 0.999:
            lay.putalpha(lay.getchannel("A").point(lambda v: int(v * a_isl)))
        canvas.alpha_composite(lay)
    return canvas


# -------------------------------------------------------- scene 01 ---------
def scene01(c, n, d):
    a = hold_in(n, 0, 8) * fade_out(n, 106, 120)
    if a > 0.003:
        c.alpha_composite(cached_wash(
            ("s1", round(a, 2)),
            lambda u, v: a * 0.36 * ell(430, 250, 640, 270)(u, v)))
        draw_text(c, "Corporator", 32, 120, 124, False, INK, a, 12 * (1 - ramp(n, 0, 8)))
        draw_text(c, "Let me show you", 72, 120, 172, True, INK, a, 12 * (1 - ramp(n, 1, 9)))
        draw_text(c, "around.", 72, 120, 250, True, INK, a, 12 * (1 - ramp(n, 2, 10)))
        draw_text(c, "A browser city management game", 32, 120, 352, False, INK,
                  a, 12 * (1 - ramp(n, 3, 11)))
    al = ramp(n, 90, 102) * fade_out(n, 106, 120)
    graphite(c, 120, 745, 880, al * 0.85, lw=3, progress=ramp(n, 90, 102),
             ticks=(290, 440, 590))


# -------------------------------------------------------- scene 02 ---------
B2 = [("workshop", 420, 540, 120), ("power_node", 960, 520, 123),
      ("bank", 1500, 470, 126)]
B2_DUR = 14


def scene02(c, n, d):
    a_out = fade_out(n, 224, 240)
    a_t = hold_in(n, 120, 129) * a_out
    if a_t > 0.003:
        draw_text(c, "The buildings are already here.", 64, 120, 125, True, INK,
                  a_t, 12 * (1 - ramp(n, 120, 129)))
        draw_text(c, "Open them.", 34, 120, 212, False, INK, a_t,
                  12 * (1 - ramp(n, 123, 132)))
    pa = hold_in(n, 132, 148) * a_out
    if pa > 0.003:
        c.alpha_composite(cached_wash(
            ("plane", round(pa, 2), "02"),
            lambda u, v: pa * 0.46 * band(BASE_Y - 26, BASE_Y + 178, 1.0,
                                          140, 1800)(u, v)))
    for i, (key, x, h, f0) in enumerate(B2):
        p = ramp(n, f0, f0 + B2_DUR)
        if p * a_out <= 0.004:
            continue
        spr, sw, sh = SP2[key]
        place(c, spr, sw, sh, ("b2", key),
              x - ISO_DX * (1 - ease_out_cubic(p)) + d,
              BASE_Y + ISO_DY * (1 - ease_out_cubic(p)),
              min(1.0, p * 1.7) * a_out, height=h)
    al = ramp(n, 139, 152) * a_out
    graphite(c, 160, 1760, GROUND_Y, al * 0.8, lw=3, progress=ramp(n, 139, 152),
             ticks=(420, 960, 1500))


# -------------------------------------------------------- roles 03 + 04 ---
ROLE_ORDER = ["engineer", "logistician", "manager", "scientist", "trader"]
ROLE_LABEL = {"engineer": "Engineer", "logistician": "Logistician",
              "manager": "Manager", "scientist": "Scientist", "trader": "Trader"}
ROLE_H3 = {"engineer": 545, "logistician": 530, "manager": 515,
           "scientist": 535, "trader": 505}
ROLE_X3 = {"engineer": 300, "logistician": 630, "manager": 960,
           "scientist": 1290, "trader": 1620}
ROLE_F0 = {"engineer": 240, "logistician": 244.5, "manager": 249,
           "scientist": 253.5, "trader": 258}
ROLE_DUR = 13.5
NAME_F0 = {k: v + ROLE_DUR + 3.0 for k, v in ROLE_F0.items()}

GROUPS = [
    dict(role="engineer", rh=365, cx=376, rel="assets/buildings/workshop.png",
         bname="Workshop", bh=390, f0=396),
    dict(role="scientist", rh=360, cx=960,
         rel="assets/buildings/ai_research_center.png", bname="AI Research Center",
         bh=430, f0=400),
    dict(role="trader", rh=340, cx=1535, rel="assets/buildings/bank.png",
         bname="Bank", bh=350, f0=404),
]
MOVE_F0, MOVE_F1 = 380, 414


def role_state(role, n):
    x3, h3 = ROLE_X3[role], ROLE_H3[role]
    a = hold_in(n, ROLE_F0[role], ROLE_F0[role] + ROLE_DUR)
    if role in ("logistician", "manager"):
        return x3, BASE_Y, h3, a * fade_out(n, 376, 402)
    g = [x for x in GROUPS if x["role"] == role][0]
    p = ramp(n, MOVE_F0, MOVE_F1, ease_in_out_cubic)
    # the three that carry into scene 04 leave with the rest of that scene
    return (x3 + (g["role_x"] - x3) * p, BASE_Y, h3 + (g["rh"] - h3) * p,
            a * fade_out(n, 514, 532))


def draw_roles(c, n, d):
    for role in ROLE_ORDER:
        cx, by, h, a = role_state(role, n)
        if a <= 0.004:
            continue
        spr, sw, sh = SP3[role]
        place(c, spr, sw, sh, ("r3", role), cx + d, by, a, height=h)


def scene03(c, n, d):
    a_out = fade_out(n, 364, 380)
    a_t = hold_in(n, 240, 249) * a_out
    if a_t > 0.003:
        draw_text(c, "They just need the right people.", 64, 120, 118, True, INK,
                  a_t, 12 * (1 - ramp(n, 240, 249)))
    pa = hold_in(n, 260, 276) * a_out
    if pa > 0.003:
        c.alpha_composite(cached_wash(
            ("plane", round(pa, 2), "03"),
            lambda u, v: pa * 0.46 * band(BASE_Y - 26, BASE_Y + 178, 1.0,
                                          140, 1800)(u, v)))
    ph = ramp(n, 244, 258) * a_out
    if ph > 0.004:
        spr, sw, sh = SP3["_hub"]
        place(c, spr, sw, sh, ("hub",), 206 + d, 904, min(1.0, ph * 1.7),
              height=250, shadow=False)
    al = ramp(n, 266, 280) * a_out
    graphite(c, 190, 1730, GROUND_Y, al * 0.8, lw=3, progress=ramp(n, 266, 280),
             ticks=(300, 630, 960, 1290, 1620))
    for role in ROLE_ORDER:
        f0 = NAME_F0[role]
        an = hold_in(n, f0, f0 + 9) * a_out
        if an <= 0.004:
            continue
        cx, by, h, a = role_state(role, n)
        if a <= 0.05:
            continue
        draw_text(c, ROLE_LABEL[role], 31, cx + d, 900, False, INK,
                  an * min(1.0, a * 2.5), 12 * (1 - ramp(n, f0, f0 + 9)), align="c")


def scene04(c, n, d):
    a_out = fade_out(n, 514, 532)
    a_t = hold_in(n, 392, 402) * a_out
    if a_t > 0.003:
        draw_text(c, "Give everyone a place to work.", 64, 120, 112, True, INK,
                  a_t, 12 * (1 - ramp(n, 392, 402)))
        draw_text(c, "Energy and Compute keep the city running.", 34, 120, 196,
                  False, INK, a_t, 12 * (1 - ramp(n, 396, 406)))
    pa = hold_in(n, 402, 418) * a_out
    if pa > 0.003:
        c.alpha_composite(cached_wash(
            ("plane", round(pa, 2), "04"),
            lambda u, v: pa * 0.46 * band(BASE_Y - 26, BASE_Y + 178, 1.0,
                                          100, 1820)(u, v)))
    for g in GROUPS:
        pb = ramp(n, g["f0"], g["f0"] + 14) * a_out
        if pb > 0.004:
            spr, sw, sh = SP4[g["role"]]
            place(c, spr, sw, sh, ("b4", g["role"]),
                  g["bld_x"] - ISO_DX * (1 - ease_out_cubic(pb)) + d,
                  BASE_Y + ISO_DY * (1 - ease_out_cubic(pb)),
                  min(1.0, pb * 1.7), height=g["bh"])
        lf0 = 402 + (g["f0"] - 396)
        pl = ramp(n, lf0, lf0 + 8)
        if pl > 0.004:
            # short segment in the gap only - never across a body or a facade
            x0 = g["role_x"] + g["rw"] / 2.0 + 10 + d
            x1 = g["bld_x"] - g["bw"] / 2.0 - 10 + d
            lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
            ImageDraw.Draw(lay).rectangle(
                [x0, 690, x0 + (x1 - x0) * pl, 693], fill=INK + (255,))
            lay.putalpha(lay.getchannel("A").point(lambda v: int(v * a_out)))
            c.alpha_composite(lay)
            pf = ramp(n, lf0 + 10, lf0 + 20, ease_in_out_cubic)
            if 0.0 < pf < 1.0 and a_out > 0.01:
                px = x0 + (x1 - x0) * pf
                pl_lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                pd = ImageDraw.Draw(pl_lay)
                pd.ellipse([px - 8, 687, px + 8, 701], fill=WARM_WHITE + (255,))
                pd.ellipse([px - 4, 690.5, px + 4, 698.5], fill=INK + (255,))
                pl_lay = pl_lay.filter(ImageFilter.GaussianBlur(1.3))
                pl_lay.putalpha(pl_lay.getchannel("A").point(
                    lambda v: int(v * a_out)))
                c.alpha_composite(pl_lay)
        for who, xpos, size, txt, extra in (
                (0, g["role_x"], 30, ROLE_LABEL[g["role"]], 0),
                (1, g["bld_x"], 28, g["bname"], 4)):
            f0 = 406 + (g["f0"] - 396) + extra
            an = hold_in(n, f0, f0 + 9) * a_out
            if an > 0.004:
                draw_text(c, txt, size, xpos + d, 906, False, INK, an,
                          12 * (1 - ramp(n, f0, f0 + 9)), align="c")


# -------------------------------------------------------- scene 05 ---------
CELLS = [("assets/buildings/ai_research_center.png", "NVDA · Compute", 360, 515),
         ("assets/buildings/energy_plant.png", "TSLA · Energy", 960, 515),
         ("assets/buildings/logistics_hub.png", "AMZN · Logistics", 1560, 515),
         ("assets/buildings/flagship_store.png", "AAPL · Consumer", 360, 850),
         ("assets/buildings/cloud_campus.png", "MSFT · Automation", 960, 850),
         ("assets/buildings/finance_tower.png", "COIN · Finance", 1560, 850)]
CELL_H = 235


def scene05(c, n, d):
    a_out = fade_out(n, 676, 690)
    # light layout field with the sky still reading at the frame edges
    fa = hold_in(n, 540, 566) * a_out
    if fa > 0.004:
        c.alpha_composite(cached_wash(
            ("field5", round(fa, 2)),
            lambda u, v: fa * 0.40 * ell(960, 610, 1060, 500, 1.0)(u, v)))
    a_t = hold_in(n, 542, 552) * a_out
    if a_t > 0.003:
        draw_text(c, "Stake stock tokens. Open industries.", 64, 120, 104, True,
                  INK, a_t, 12 * (1 - ramp(n, 542, 552)))
    for i, (rel, tick, cx, by) in enumerate(CELLS):
        f0 = 544 + i * 2.2
        p = ramp(n, f0, f0 + 14) * a_out
        if p > 0.004:
            spr, sw, sh = SP5[i]
            place(c, spr, sw, sh, ("c5", i),
                  cx - ISO_DX * (1 - ease_out_cubic(p)) + d,
                  by + ISO_DY * (1 - ease_out_cubic(p)),
                  min(1.0, p * 1.7), height=CELL_H, shadow_a=0.15)
        at = hold_in(n, f0 + 7, f0 + 16) * a_out
        if at > 0.004:
            draw_text(c, tick, 32, cx + d, by + 18, False, INK, at,
                      12 * (1 - ramp(n, f0 + 7, f0 + 16)), align="c")
            graphite(c, cx - 80, cx + 80, by + 64, at * 0.8, lw=3,
                     progress=ramp(n, f0 + 10, f0 + 19))


# -------------------------------------------------------- scene 06 ---------
WIN = (1080, 390, 640, 560)
S6_BASE = 830
S6_LINE = 844


def scene06(c, n, d):
    a_out = fade_out(n, 818, 836)
    a_l = hold_in(n, 692, 703) * a_out
    if a_l > 0.003:
        draw_text(c, "Work earns Capital.", 60, 180, 140, True, INK, a_l,
                  12 * (1 - ramp(n, 692, 703)))
    pb = hold_in(n, 700, 714) * a_out
    if pb > 0.003:
        c.alpha_composite(cached_wash(
            ("plane6", round(pb, 2)),
            lambda u, v: pb * 0.48 * band(S6_BASE - 24, S6_BASE + 168, 1.0,
                                          130, 906)(u, v)))
    p = ramp(n, 700, 715) * a_out
    if p > 0.004:
        spr, sw, sh = SP6
        place(c, spr, sw, sh, ("b6",), 510 - ISO_DX * (1 - ease_out_cubic(p)) + d,
              S6_BASE + ISO_DY * (1 - ease_out_cubic(p)), min(1.0, p * 1.7),
              height=380)
    al = hold_in(n, 712, 724) * a_out
    graphite(c, 180, 880, S6_LINE, al * 0.8, lw=3, progress=ramp(n, 712, 724),
             ticks=(180, 880), tick_len=15)
    draw_text(c, "Shared Payroll", 32, 300 + d, S6_LINE + 18, False, INK, al,
              12 * (1 - ramp(n, 714, 725)), align="c")
    draw_text(c, "Capital", 32, 760 + d, S6_LINE + 18, False, INK, al,
              12 * (1 - ramp(n, 717, 728)), align="c")
    # one small marker runs from Shared Payroll to Capital, then stops there
    mp = ramp(n, 706, 718, ease_in_out_cubic) * a_out
    if mp > 0.004:
        lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        pd = ImageDraw.Draw(lay)
        px = 300 + 460 * mp
        pd.ellipse([px - 9, S6_LINE - 9, px + 9, S6_LINE + 9],
                   fill=WARM_WHITE + (255,))
        pd.ellipse([px - 4.5, S6_LINE - 4.5, px + 4.5, S6_LINE + 4.5],
                   fill=INK + (255,))
        c.alpha_composite(lay.filter(ImageFilter.GaussianBlur(1.1)))
    graphite_v(c, 975, 300, 906, al * 0.5, lw=2, progress=ramp(n, 698, 712))
    a_r = hold_in(n, 695, 707) * a_out
    if a_r > 0.003:
        draw_text(c, "Compete for", 54, 1050, 246, True, INK, a_r,
                  12 * (1 - ramp(n, 695, 707)))
        draw_text(c, "stock-token prizes.", 54, 1050, 306, True, INK, a_r,
                  12 * (1 - ramp(n, 698, 710)))
    island_window(c, n, a_r)


def island_window(c, n, alpha):
    if alpha <= 0.004:
        return
    x, y, pw, ph = WIN
    sh = Image.new("RGBA", (pw, ph), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rectangle([0, 0, pw - 1, ph - 1], fill=(24, 32, 42, 255))
    sh = sh.filter(ImageFilter.GaussianBlur(17))
    sh.putalpha(sh.getchannel("A").point(lambda v: int(v * 0.28 * alpha)))
    c.alpha_composite(sh, (x + 5, y + 9))
    z = 1.0 + 0.03 * smoothstep(seg(n, 700, 830))
    cw, chh = pw * z / ST.win_zmax, ph * z / ST.win_zmax
    ox = int(round(ST.win_c[0] - cw / 2.0))
    oy = int(round(ST.win_c[1] - chh / 2.0))
    tile = ST.win_max.crop((ox, oy, ox + round(cw), oy + round(chh)))
    if tile.size != (pw, ph):
        tile = tile.resize((pw, ph), Image.LANCZOS)
    tl = tile.convert("RGBA")
    if alpha < 0.999:
        tl.putalpha(tl.getchannel("A").point(lambda v: int(v * alpha)))
    c.alpha_composite(tl, (x, y))
    ImageDraw.Draw(c, "RGBA").rectangle([x, y, x + pw - 1, y + ph - 1],
                                        outline=INK + (int(64 * alpha),), width=1)


# -------------------------------------------------------- scene 07 ---------
def scene07(c, n, d):
    a = hold_in(n, 840, 853.5)
    lay = Image.new("RGBA", (W, H), ST.logo_field + (0,))
    lay.putalpha(Image.new("L", (W, H), int(255 * min(1.0, a * 1.5))))
    c.alpha_composite(lay)
    if a > 0.004:
        lx, ly, ls = 410, 320, 420
        sc = 0.98 + 0.02 * ease_out_sine(seg(n, 840, 853.5))
        tile = ST.logo if sc >= 0.9995 else ST.logo.resize(
            (round(ls * sc), round(ls * sc)), Image.LANCZOS)
        c.alpha_composite(tile.convert("RGBA"),
                          (int(lx + (ls - tile.width) / 2),
                           int(ly + (ls - tile.height) / 2)))
    draw_text(c, "Corporator", 82, 980, 405, True, INK, hold_in(n, 840, 850),
              12 * (1 - ramp(n, 840, 850)))
    draw_text(c, "See you in the city.", 42, 980, 530, False, INK,
              hold_in(n, 844, 854), 12 * (1 - ramp(n, 844, 854)))
    draw_text(c, "@corporatorcc", 34, 980, 606, False, INK,
              hold_in(n, 848, 858), 12 * (1 - ramp(n, 848, 858)))


# ------------------------------------------------------------ drift loop ---
SCENES = [(0, 120), (120, 240), (240, 390), (390, 540), (540, 690), (690, 840)]


def drift_at(n, amp_obj=13.0, amp_bg=6.0):
    """Gentle in-and-out drift: motion lives inside each scene, never jumps."""
    for f0, f1 in SCENES:
        if f0 <= n < f1:
            k = smoothstep(seg(n, f0, f0 + 30)) * (1.0 - smoothstep(seg(n, f1 - 24, f1)))
            return amp_bg * k, -amp_obj * k
    return 0.0, 0.0


SP2, SP3, SP4, SP5, SP6 = {}, {}, {}, {}, None


def render_frame(n):
    dbg, dobj = drift_at(n)
    c = build_background(n, int(round(dbg)))
    d = dobj
    scene01(c, n, d)
    scene02(c, n, d)
    draw_roles(c, n, d)
    scene03(c, n, d)
    scene04(c, n, d)
    scene05(c, n, d)
    scene06(c, n, d)
    scene07(c, n, d)
    return c.convert("RGB")


def preload():
    global SP6
    build_island()
    check_island_coverage()
    build_sky()
    build_logo()
    build_window()
    for key, x, h, f0 in B2:
        SP2[key] = sprite(os.path.join("assets", "buildings", key + ".png"), h)
    for role in ROLE_ORDER:
        SP3[role] = sprite(os.path.join("assets", "roles", role + ".png"),
                           ROLE_H3[role])
    SP3["_hub"] = sprite("assets/buildings/agent_hub.png", 250)
    for g in GROUPS:
        SP4[g["role"]] = sprite(g["rel"], g["bh"])
        # sprite() returns the silhouette at the padded scale, so recover the
        # true aspect ratio and derive the on-screen width from the target height
        rsw, rsh = SP3[g["role"]][1], SP3[g["role"]][2]
        bsw, bsh = SP4[g["role"]][1], SP4[g["role"]][2]
        g["rw"] = g["rh"] * rsw / rsh
        g["bw"] = g["bh"] * bsw / bsh
        gap = 76.0
        x0 = g["cx"] - (g["rw"] + gap + g["bw"]) / 2.0
        g["role_x"] = x0 + g["rw"] / 2.0
        g["bld_x"] = x0 + g["rw"] + gap + g["bw"] / 2.0
    for i, (rel, tick, cx, by) in enumerate(CELLS):
        SP5[i] = sprite(rel, CELL_H)
    SP6 = sprite("assets/buildings/bank.png", 380)
    print("preload ok; group x:",
          [(g["role"], round(g["role_x"]), round(g["bld_x"])) for g in GROUPS])


def ffmpeg():
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def check_island_coverage():
    """
    Fail loudly if the island would ever leave the frame.  Two things must hold
    for every zoom step used by scene 01:
      1. the crop window lies inside the pre-render  (no black/empty revealed)
      2. the island silhouette stays inside the frame (no lost tower or cliff)
    """
    pw, ph = ST.island.size
    bad = []
    iso = (1174.0, 496.0, 2693.0, 1885.0)
    for i in range(0, 200):
        z = 1.0 + 0.06 * smoothstep(seg(i, 0, 134))
        s = ISO_S1 * z
        x0 = ISO_PIN[0] - ISO_CORE[0] * s
        y0 = ISO_PIN[1] - ISO_CORE[1] * s
        ix = ISO_PAD - x0 * (ISO_ZMAX / z)
        iy = ISO_PAD - y0 * (ISO_ZMAX / z)
        if ix < 0 or iy < 0 or ix + W > pw or iy + H > ph:
            bad.append("frame %d z=%.4f crop (%.1f,%.1f) out of pre-render %s"
                       % (i, z, ix, iy, (pw, ph)))
        L = x0 + iso[0] * s
        R = x0 + iso[2] * s
        T = y0 + iso[1] * s
        B = y0 + iso[3] * s
        if L < 0 or T < 0 or R > W or B > H:
            bad.append("frame %d z=%.4f island L%.0f T%.0f R%.0f B%.0f out of frame"
                       % (i, z, L, T, R, B))
    if bad:
        raise SystemExit("island placement broken:\n  " + "\n  ".join(bad[:8]))
    z1, z2 = 1.0, ISO_ZMAX
    for z in (z1, z2):
        s = ISO_S1 * z
        x0 = ISO_PIN[0] - ISO_CORE[0] * s
        y0 = ISO_PIN[1] - ISO_CORE[1] * s
        print("  island z=%.2f  x %.0f..%.0f  y %.0f..%.0f" % (
            z, x0 + iso[0] * s, x0 + iso[2] * s, y0 + iso[1] * s, y0 + iso[3] * s))


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(BUILD, exist_ok=True)
    preload()
    if len(sys.argv) > 1 and sys.argv[1] == "--stills":
        for n in [int(x) for x in sys.argv[2].split(",")]:
            render_frame(n).save(os.path.join(BUILD, "still_%04d.png" % n))
            print("still %d" % n)
        return
    ff = ffmpeg()
    p = subprocess.Popen(
        [ff, "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "%dx%d" % (W, H),
         "-r", str(FPS), "-i", "pipe:0", "-an", "-c:v", "libx264",
         "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
         "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
         os.path.join(BUILD, "silent.mp4")], stdin=subprocess.PIPE)
    for n in range(NF):
        p.stdin.write(render_frame(n).tobytes())
        if n % 120 == 0:
            print("  frame %d" % n, flush=True)
    p.stdin.close()
    p.wait()
    print("encoded", os.path.join(BUILD, "silent.mp4"))


if __name__ == "__main__":
    main()
