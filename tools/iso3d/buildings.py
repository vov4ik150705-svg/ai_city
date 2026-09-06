"""Procedural buildings matching assets/buildings/*.png mockup extracts."""
from __future__ import annotations

import bpy

from geom import box, cyl, hip_roof, mat, torus_c, windows_x, windows_y


def make_mats() -> dict[str, bpy.types.Material]:
    return {
        "white": mat("white", (0.84, 0.81, 0.77), rough=0.52),
        "red": mat("red", (0.70, 0.13, 0.10), rough=0.48),
        "red_deep": mat("red_deep", (0.38, 0.08, 0.06), rough=0.62, wear=0.25),
        "roof": mat("roof", (0.22, 0.23, 0.25), rough=0.72),
        "dark": mat("dark", (0.06, 0.07, 0.08), rough=0.65),
        "steel": mat("steel", (0.48, 0.50, 0.54), rough=0.38, metal=0.35),
        "stone": mat("stone", (0.78, 0.77, 0.73), rough=0.78),
        "blue_roof": mat("blue_roof", (0.16, 0.34, 0.72), rough=0.58),
        "moss": mat("moss", (0.38, 0.50, 0.28), rough=0.82),
        "gold": mat("gold", (0.85, 0.68, 0.22), rough=0.32, metal=0.4),
        "glass_blue": mat("glass_blue", (0.40, 0.62, 0.90), rough=0.18, emit=0.35),
        "black": mat("black", (0.05, 0.055, 0.06), rough=0.55),
        "nvidia": mat("nvidia", (0.30, 0.82, 0.18), rough=0.28, emit=2.8),
        "amber": mat("amber", (0.95, 0.70, 0.18), rough=0.35, emit=2.2),
        "coin_blue": mat("coin_blue", (0.22, 0.55, 0.95), rough=0.22, emit=0.9),
        "navy": mat("navy", (0.08, 0.12, 0.22), rough=0.45, metal=0.25),
        "tan": mat("tan", (0.62, 0.50, 0.36), rough=0.7),
        "tan_roof": mat("tan_roof", (0.78, 0.66, 0.38), rough=0.65),
        "brick": mat("brick", (0.42, 0.16, 0.14), rough=0.72),
        "concrete": mat("concrete", (0.62, 0.62, 0.60), rough=0.8),
        "green_scr": mat("green_scr", (0.12, 0.85, 0.22), rough=0.2, emit=3.2),
        "glass_win": mat("glass_win", (0.35, 0.48, 0.62), rough=0.15, emit=0.15),
        "lobby": mat("lobby", (0.82, 0.72, 0.52), rough=0.7),
    }


def tesla_t(face_y: float, z: float, white: bpy.types.Material) -> None:
    box("t_bar", 0.10, face_y, z + 0.68, 1.70, 0.07, 0.22, white, bevel=0.01)
    box("t_stem", 0.10, face_y, z - 0.12, 0.18, 0.07, 1.05, white, bevel=0.01)


def build_energy_plant(mats: dict[str, bpy.types.Material]) -> None:
    white, red, dark, steel, roof = (
        mats["white"],
        mats["red"],
        mats["dark"],
        mats["steel"],
        mats["roof"],
    )
    # Massing from the mockup: white tower, red logo slab on -Y (right in frame),
    # stepped red on -X (left), garage in the white base, roof kit. Not a red cube.
    box("tower", 0.12, 0.22, 1.85, 2.35, 2.40, 3.40, white, bevel=0.05)
    box("red_logo", 0.10, -1.20, 1.32, 2.50, 0.95, 2.50, red, bevel=0.06)
    box("red_mid", -1.22, 0.12, 1.55, 0.90, 2.15, 1.85, red, bevel=0.05)
    box("red_low", -1.38, -0.22, 0.62, 0.95, 1.55, 0.92, red, bevel=0.04)
    box("base", -0.22, -0.42, 0.22, 2.55, 1.70, 0.44, white, bevel=0.03)
    box("garage", -0.70, -1.22, 0.24, 0.90, 0.14, 0.32, dark, bevel=0.02)
    tesla_t(-1.72, 1.22, white)
    box("win_main", 0.10, -1.00, 2.88, 0.90, 0.10, 0.36, dark, bevel=0.02)
    box("win_l1", -1.65, 0.35, 1.70, 0.10, 0.28, 0.22, dark, bevel=0.0)
    box("win_l2", -1.78, -0.18, 0.78, 0.10, 0.22, 0.18, dark, bevel=0.0)
    box("roof_deck", 0.12, 0.22, 3.62, 2.45, 2.50, 0.14, roof, bevel=0.03)
    box("lip_s", 0.12, -1.00, 3.74, 2.45, 0.12, 0.12, white, bevel=0.02)
    box("lip_w", -1.02, 0.22, 3.74, 0.12, 2.50, 0.12, white, bevel=0.02)
    box("mech", 0.18, 0.28, 3.95, 0.70, 0.55, 0.32, dark, bevel=0.04)
    cyl("dome", 0.18, 0.28, 4.16, 0.22, 0.16, steel)
    cyl("cable", 0.48, 0.58, 3.85, 0.04, 0.70, dark, axis="Y")


def amazon_a(x: float, y: float, z: float, white: bpy.types.Material) -> None:
    cyl("a_bowl", x, y, z, 0.22, 0.08, white, axis="Y", verts=12)
    box("a_stem", x + 0.18, y, z - 0.05, 0.10, 0.08, 0.55, white, bevel=0.01)


def coin_c(cx: float, cy: float, cz: float, white: bpy.types.Material) -> None:
    torus_c("coin_c", cx, cy, cz, major=0.42, minor=0.11, material=white)


def build_city_hall(mats: dict[str, bpy.types.Material]) -> None:
    stone, roof, dark, gold, moss = (
        mats["stone"],
        mats["blue_roof"],
        mats["dark"],
        mats["gold"],
        mats["moss"],
    )
    box("plinth", 0.0, 0.0, 0.16, 5.4, 5.4, 0.32, stone, bevel=0.05)
    box("body", 0.0, 0.0, 1.45, 3.9, 3.9, 2.3, dark, bevel=0.05)
    cols_s = (-1.35, -0.45, 0.45, 1.35)
    for i, x in enumerate(cols_s):
        cyl(f"col_s_{i}", x, -2.05, 1.25, 0.13, 1.95, stone)
        cyl(f"col_w_{i}", -2.05, x, 1.25, 0.13, 1.95, moss)
    box("arch_s", 0.0, -2.12, 2.32, 3.1, 0.42, 0.22, stone, bevel=0.02)
    box("arch_w", -2.12, 0.0, 2.32, 0.42, 3.1, 0.22, moss, bevel=0.02)
    hip_roof("ped_s", 0.0, -2.15, 2.42, 2.2, 0.7, 0.55, stone)
    hip_roof("ped_w", -2.15, 0.0, 2.42, 0.7, 2.2, 0.55, moss)
    box("cornice", 0.0, 0.0, 2.72, 4.4, 4.4, 0.28, stone, bevel=0.03)
    hip_roof("roof_main", 0.0, 0.0, 2.85, 4.6, 4.6, 1.55, roof)
    box("lantern", 0.0, 0.0, 4.55, 1.45, 1.45, 0.85, dark, bevel=0.03)
    windows_y("lan_s", [-0.35, 0.35], -0.74, [4.55], 0.42, 0.08, 0.5, mats["glass_blue"])
    windows_x("lan_w", -0.74, [-0.35, 0.35], [4.55], 0.08, 0.42, 0.5, mats["glass_blue"])
    hip_roof("roof_top", 0.0, 0.0, 4.95, 1.7, 1.7, 0.7, roof)
    cyl("spire", 0.0, 0.0, 5.55, 0.045, 0.55, gold)


def build_ai_research_center(mats: dict[str, bpy.types.Material]) -> None:
    black, green, steel, amber = mats["black"], mats["nvidia"], mats["steel"], mats["amber"]
    moss = mats["moss"]
    box("base", 0.1, 0.0, 1.45, 4.6, 3.7, 2.9, black, bevel=0.06)
    box("tower", 0.55, 0.2, 3.85, 2.5, 2.3, 2.0, black, bevel=0.05)
    box("wing", -1.65, -0.15, 2.35, 1.55, 2.3, 1.5, black, bevel=0.05)
    box("logo_recess", -1.72, -1.28, 2.55, 1.15, 0.10, 1.05, mats["dark"], bevel=0.0)
    box("logo_mark", -1.72, -1.36, 2.55, 0.72, 0.08, 0.72, green, bevel=0.01)
    cyl("logo_eye", -1.72, -1.40, 2.55, 0.22, 0.06, green, axis="Y", verts=12)
    for i in range(6):
        for j in range(2):
            box(
                f"win_col_{i}_{j}",
                1.72,
                -0.85 + j * 0.55,
                1.15 + i * 0.42,
                0.10,
                0.38,
                0.30,
                green,
                bevel=0.0,
            )
    windows_x("mid_w", -2.18, [-0.7, 0.0, 0.7], [1.55, 2.15], 0.08, 0.38, 0.28, mats["glass_win"])
    for i, x in enumerate((-0.9, 0.0, 0.9)):
        box(f"arch_{i}", x, -1.88, 0.48, 0.7, 0.18, 0.72, amber, bevel=0.02)
    box("moss_ledge", 0.55, -0.95, 4.92, 2.4, 0.2, 0.12, moss, bevel=0.01)
    box("roof_unit", 0.55, 0.25, 4.95, 0.75, 0.65, 0.32, steel, bevel=0.03)
    box("side_block", 2.15, 0.9, 1.15, 1.3, 1.6, 1.5, black, bevel=0.04)


def build_finance_tower(mats: dict[str, bpy.types.Material]) -> None:
    glass, white, navy, lobby = mats["coin_blue"], mats["white"], mats["navy"], mats["lobby"]
    box("plinth", 0.0, 0.0, 0.35, 3.1, 3.1, 0.7, lobby, bevel=0.05)
    for i, t in enumerate((-0.95, -0.32, 0.32, 0.95)):
        cyl(f"col_s_{i}", t, -1.48, 0.55, 0.09, 0.95, mats["stone"])
        cyl(f"col_w_{i}", -1.48, t, 0.55, 0.09, 0.95, mats["stone"])
    box("shaft", 0.0, 0.0, 3.55, 2.35, 2.35, 5.5, navy, bevel=0.05)
    zs = [1.35, 1.95, 2.55, 3.15, 3.75, 4.35, 4.95, 5.55]
    windows_y("band_s", [0.0], -1.20, zs, 2.05, 0.06, 0.28, glass)
    windows_x("band_w", -1.20, [0.0], zs, 0.06, 2.05, 0.28, glass)
    box("mid", 0.0, 0.0, 6.55, 1.85, 1.85, 1.15, navy, bevel=0.04)
    box("billboard", 0.0, -1.28, 4.35, 1.35, 0.12, 1.35, glass, bevel=0.02)
    coin_c(0.0, -1.40, 4.35, white)
    box("crown", 0.0, 0.0, 7.35, 1.35, 1.35, 0.55, glass, bevel=0.03)
    box("cap_mark", 0.0, -0.70, 7.35, 0.55, 0.06, 0.28, white, bevel=0.0)


def build_logistics_hub(mats: dict[str, bpy.types.Material]) -> None:
    tan, roof, dark, white, steel = (
        mats["tan"],
        mats["roof"],
        mats["dark"],
        mats["white"],
        mats["steel"],
    )
    glass = mats["glass_win"]
    box("body", 0.0, 0.1, 1.55, 4.4, 3.4, 3.1, tan, bevel=0.06)
    box("bay", 2.35, 0.2, 0.85, 1.4, 2.2, 1.7, tan, bevel=0.05)
    windows_y("w_s", [-1.4, -0.5, 0.4, 1.3], -1.62, [1.15, 2.15], 0.55, 0.08, 0.55, glass)
    windows_x("w_w", -2.22, [-0.9, 0.0, 0.9], [1.15, 2.15], 0.08, 0.55, 0.55, glass)
    box("parapet", 0.0, 0.1, 3.22, 4.55, 3.55, 0.22, mats["concrete"], bevel=0.02)
    box("roof_tan", -0.55, 0.15, 3.42, 2.6, 2.4, 0.18, mats["tan_roof"], bevel=0.02)
    box("roof_grey", 1.35, 0.15, 3.38, 2.0, 2.2, 0.14, roof, bevel=0.02)
    box("hvac", 1.55, 0.4, 3.62, 0.7, 0.55, 0.35, steel, bevel=0.02)
    cyl("vent", 1.9, -0.4, 3.58, 0.18, 0.28, steel)
    box("crate", 1.15, -0.7, 3.52, 0.4, 0.35, 0.22, dark, bevel=0.01)
    box("banner_a", -2.05, -1.55, 1.85, 0.08, 0.55, 1.7, dark, bevel=0.0)
    box("banner_b", -1.55, -1.72, 1.85, 0.55, 0.08, 1.7, dark, bevel=0.0)
    amazon_a(-2.12, -1.55, 1.95, white)
    amazon_a(-1.55, -1.80, 1.95, white)


def build_exchange(mats: dict[str, bpy.types.Material]) -> None:
    navy, green, steel, amber, roof = (
        mats["navy"],
        mats["green_scr"],
        mats["steel"],
        mats["amber"],
        mats["roof"],
    )
    box("base", 0.0, 0.0, 0.85, 4.6, 3.6, 1.7, mats["dark"], bevel=0.05)
    for i, x in enumerate((-1.4, -0.45, 0.45, 1.4)):
        box(f"glow_{i}", x, -1.82, 0.55, 0.55, 0.10, 0.45, amber, bevel=0.0)
    box("upper", 0.0, 0.0, 2.35, 4.1, 3.2, 1.4, navy, bevel=0.05)
    box("screen_s", 0.0, -1.64, 2.4, 3.2, 0.08, 0.95, green, bevel=0.0)
    box("screen_w", -2.08, 0.0, 2.4, 0.08, 2.4, 0.95, green, bevel=0.0)
    box("parapet", 0.0, 0.0, 3.12, 4.25, 3.35, 0.18, mats["concrete"], bevel=0.02)
    box("tank_a", -0.9, 0.4, 3.45, 0.55, 0.5, 0.45, steel, bevel=0.03)
    cyl("tank_b", 0.3, 0.6, 3.5, 0.28, 0.55, mats["white"])
    box("crate", 1.1, -0.3, 3.38, 0.5, 0.4, 0.3, mats["steel"], bevel=0.02)
    cyl("pipe", 0.8, 0.9, 3.35, 0.06, 1.2, steel, axis="X")
    box("green_pad", -1.4, -0.7, 3.28, 0.55, 0.4, 0.08, green, bevel=0.0)


def build_robotics_lab(mats: dict[str, bpy.types.Material]) -> None:
    brick, roof, conc, amber = mats["brick"], mats["roof"], mats["concrete"], mats["amber"]
    box("core", 0.1, 0.1, 1.85, 3.2, 2.8, 3.7, brick, bevel=0.06)
    box("wing_l", -2.15, 0.0, 0.95, 1.7, 2.4, 1.9, brick, bevel=0.05)
    box("wing_r", 2.05, 0.15, 0.95, 1.6, 2.5, 1.9, brick, bevel=0.05)
    box("arch", 2.15, -1.15, 0.7, 1.15, 0.55, 1.25, mats["dark"], bevel=0.03)
    box("win_glow", 0.55, -1.32, 2.15, 0.7, 0.08, 0.55, amber, bevel=0.0)
    box("win_g", -1.55, -1.22, 1.15, 0.55, 0.08, 0.4, mats["nvidia"], bevel=0.0)
    box("parapet", 0.1, 0.1, 3.82, 3.4, 3.0, 0.28, conc, bevel=0.03)
    box("parapet_l", -2.15, 0.0, 2.02, 1.85, 2.55, 0.22, conc, bevel=0.02)
    box("parapet_r", 2.05, 0.15, 2.02, 1.75, 2.65, 0.22, conc, bevel=0.02)
    box("penthouse", 0.1, 0.1, 4.25, 1.15, 1.05, 0.55, conc, bevel=0.03)
    box("hvac", -0.7, 0.55, 4.12, 0.45, 0.4, 0.28, mats["steel"], bevel=0.02)


BUILDERS = {
    "energy_plant": build_energy_plant,
    "city_hall": build_city_hall,
    "ai_research_center": build_ai_research_center,
    "finance_tower": build_finance_tower,
    "logistics_hub": build_logistics_hub,
    "exchange": build_exchange,
    "robotics_lab": build_robotics_lab,
}

RIG = {
    "energy_plant": {"look_z": 1.95, "ortho": 8.0},
    "city_hall": {"look_z": 2.7, "ortho": 15.0},
    "ai_research_center": {"look_z": 2.5, "ortho": 14.5},
    "finance_tower": {"look_z": 3.8, "ortho": 16.5},
    "logistics_hub": {"look_z": 2.0, "ortho": 13.5},
    "exchange": {"look_z": 2.0, "ortho": 13.0},
    "robotics_lab": {"look_z": 2.2, "ortho": 13.5},
}
