"""Diet Terra + 19 catalog buildings into runtime_terra19/.

Does not modify models/. LOD0 keeps source
triangle counts (join + compress only). LOD1/LOD2 are simplified copies.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
sys.path.insert(0, str(ROOT))

from diet_runtime import (  # noqa: E402
    compact_images,
    has_images,
    has_vertex_color,
    read_glb_json,
    sanitize_png_images,
    strip_extra_pbr,
    triangle_count,
)

CLI = REPO / "node_modules" / "@gltf-transform" / "cli" / "bin" / "cli.js"
MODELS = REPO / "models"
OUT = ROOT / "runtime_terra19"
BUILDINGS_OUT = OUT / "buildings"
LOD_OUT = OUT / "lod"
MASS_BUDGET = int(1.5 * 1024 * 1024)
BUILDING_BUDGET = 350 * 1024
LOD1_TRIS = 4000
LOD2_TRIS = 800

CATALOG: tuple[tuple[str, str], ...] = (
    ("City Hall.glb", "city_hall"),
    ("AI Research Center.glb", "ai_research_center"),
    ("Cloud Campus.glb", "cloud_campus"),
    ("Finance Tower.glb", "finance_tower"),
    ("Bank.glb", "bank"),
    ("Exchange.glb", "exchange"),
    ("Power Node.glb", "power_node"),
    ("Agent Hub.glb", "agent_hub"),
    ("Workshop.glb", "workshop"),
    ("Energy Plant.glb", "energy_plant"),
    ("Logistics Hub.glb", "logistics_hub"),
    ("Flagship Store.glb", "flagship_store"),
    ("Fleet Yard.glb", "fleet_yard"),
    ("Drone Depot.glb", "drone_depot"),
    ("Data Center.glb", "data_center"),
    ("Retail_complex.glb", "retail_complex"),
    ("Robotics Lab.glb", "robotics_lab"),
    ("Clearing House.glb", "clearing_house"),
    ("neon-residence.glb", "neon_residence"),
)

TERRA_SRC = MODELS / "island 6" / "TERRA_Floating_Island.glb"


def catalog_src(file_name: str) -> Path:
    root = MODELS / file_name
    if root.is_file():
        return root
    experimental = MODELS / "_experimental" / file_name
    if experimental.is_file():
        return experimental
    return root


def log(msg: str) -> None:
    print(msg, flush=True)


def gltf(*args: str) -> None:
    if not CLI.is_file():
        raise RuntimeError(f"missing gltf-transform CLI: {CLI}")
    cmd = ["node", str(CLI), *args]
    log("gltf-transform " + " ".join(args[:3]) + (" ..." if len(args) > 3 else ""))
    result = subprocess.run(cmd, cwd=str(REPO), text=True, capture_output=True)
    if result.stdout:
        sys.stdout.write(result.stdout)
    if result.stderr:
        sys.stderr.write(result.stderr)
    if result.returncode != 0:
        raise RuntimeError(f"gltf-transform failed ({result.returncode}): {' '.join(args[:6])}")


def prim_count(path: Path) -> int:
    doc = read_glb_json(path)
    n = 0
    for mesh in doc.get("meshes") or []:
        if isinstance(mesh, dict):
            n += len(list(mesh.get("primitives") or []))
    return n


def accessor_aabb(path: Path) -> dict[str, float]:
    doc = read_glb_json(path)
    accessors = list(doc.get("accessors") or [])
    min_v = [1e9, 1e9, 1e9]
    max_v = [-1e9, -1e9, -1e9]
    found = False
    for mesh in doc.get("meshes") or []:
        if not isinstance(mesh, dict):
            continue
        for prim in mesh.get("primitives") or []:
            if not isinstance(prim, dict):
                continue
            attrs = prim.get("attributes")
            if not isinstance(attrs, dict):
                continue
            pos = attrs.get("POSITION")
            if not isinstance(pos, int) or pos < 0 or pos >= len(accessors):
                continue
            acc = accessors[pos]
            if not isinstance(acc, dict):
                continue
            mn = acc.get("min")
            mx = acc.get("max")
            if not (isinstance(mn, list) and isinstance(mx, list) and len(mn) >= 3 and len(mx) >= 3):
                continue
            found = True
            for i in range(3):
                min_v[i] = min(min_v[i], float(mn[i]))
                max_v[i] = max(max_v[i], float(mx[i]))
    if not found:
        return {"x": 1.0, "y": 1.0, "z": 1.0}
    return {"x": max_v[0] - min_v[0], "y": max_v[1] - min_v[1], "z": max_v[2] - min_v[2]}


def bump(work: Path, step: list[int], current: Path) -> tuple[Path, Path]:
    nxt = work / f"{step[0]}.glb"
    step[0] += 1
    return current, nxt


def meshopt(current: Path, nxt: Path, *, color: bool, tex: bool) -> None:
    args = [
        "meshopt",
        str(current),
        str(nxt),
        "--quantize-position",
        "10",
        "--quantize-normal",
        "8",
    ]
    if tex:
        args.extend(["--quantize-texcoord", "8"])
    if color:
        args.extend(["--quantize-color", "8"])
    gltf(*args)


def simplify_to(src: Path, dest: Path, target: int) -> None:
    tris = triangle_count(src)
    if tris <= target:
        shutil.copy2(src, dest)
        log(f"simplify skip {src.name} ({tris} <= {target})")
        return
    ratio = min(1.0, target / max(tris, 1))
    gltf(
        "simplify",
        str(src),
        str(dest),
        "--ratio",
        f"{ratio:.6f}",
        "--error",
        "1",
        "--lock-border",
        "false",
    )
    got = triangle_count(dest)
    log(f"simplify {src.name} {tris} -> {got} target {target}")


def make_joined(src: Path, slug: str, work: Path) -> Path:
    """Join/weld authoring GLB. Result is uncompressed and safe to simplify."""
    step = [1]
    current = work / "0.glb"
    shutil.copy2(src, current)
    sanitize_png_images(current)
    strip_extra_pbr(current)

    _, nxt = bump(work, step, current)
    try:
        gltf("palette", str(current), str(nxt))
        current = nxt
    except RuntimeError as err:
        log(f"palette skipped {slug}: {err}")

    _, nxt = bump(work, step, current)
    gltf("join", str(current), str(nxt))
    current = nxt

    _, nxt = bump(work, step, current)
    gltf("prune", str(current), str(nxt))
    current = nxt

    if has_vertex_color(current):
        log(f"weld skipped (COLOR_0): {slug}")
    else:
        _, nxt = bump(work, step, current)
        gltf("weld", str(current), str(nxt))
        current = nxt

    joined = work / "joined.glb"
    shutil.copy2(current, joined)
    return joined


def pack_lod(joined: Path, dest: Path, target: int, px: int, quality: int) -> None:
    tmp = joined.parent / (dest.stem + "_s.glb")
    simplify_to(joined, tmp, target)
    if has_images(tmp):
        compact_images(tmp, px, quality)
    meshopt(tmp, dest, color=False, tex=has_images(tmp))


def diet_building(src: Path, slug: str) -> dict[str, object]:
    BUILDINGS_OUT.mkdir(parents=True, exist_ok=True)
    LOD_OUT.mkdir(parents=True, exist_ok=True)
    lod0 = BUILDINGS_OUT / f"{slug}.glb"
    lod1 = LOD_OUT / f"{slug}_lod1.glb"
    lod2 = LOD_OUT / f"{slug}_lod2.glb"
    with tempfile.TemporaryDirectory(prefix="diet19_", dir=str(OUT)) as tmp:
        work = Path(tmp)
        joined = make_joined(src, slug, work)
        current = joined
        if has_images(current):
            nxt = work / "tex.glb"
            shutil.copy2(current, nxt)
            compact_images(nxt, 1024, 80)
            current = nxt
        meshopt(current, work / "lod0.glb", color=False, tex=has_images(current))
        shutil.copy2(work / "lod0.glb", lod0)
        pack_lod(joined, lod1, LOD1_TRIS, 512, 70)
        pack_lod(joined, lod2, LOD2_TRIS, 256, 60)
    info = refresh_building_row(src.name, slug)
    log(
        f"OK {slug} lod0 {info['tris0']}t/{info['prims0']}p/{info['bytes0']}b "
        f"lod1 {info['tris1']}t lod2 {info['tris2']}t"
    )
    return info


def lod_from_source(src: Path, slug: str) -> dict[str, int]:
    """Rebuild LOD1/2 from authoring GLB. Does not touch lod0."""
    LOD_OUT.mkdir(parents=True, exist_ok=True)
    lod1 = LOD_OUT / f"{slug}_lod1.glb"
    lod2 = LOD_OUT / f"{slug}_lod2.glb"
    with tempfile.TemporaryDirectory(prefix="lodsrc_", dir=str(OUT)) as tmp:
        work = Path(tmp)
        joined = make_joined(src, slug, work)
        pack_lod(joined, lod1, LOD1_TRIS, 512, 70)
        pack_lod(joined, lod2, LOD2_TRIS, 256, 60)
    t0 = triangle_count(BUILDINGS_OUT / f"{slug}.glb")
    t1 = triangle_count(lod1)
    t2 = triangle_count(lod2)
    log(f"LOD-SRC {slug} lod0 {t0} lod1 {t1} lod2 {t2}")
    return {"tris0": t0, "tris1": t1, "tris2": t2}


def diet_terra() -> dict[str, object]:
    if not TERRA_SRC.is_file():
        raise RuntimeError(f"missing {TERRA_SRC}")
    dest = OUT / "island_mass.glb"
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="diet19m_", dir=str(OUT)) as tmp:
        work = Path(tmp)
        step = [1]
        current = work / "0.glb"
        shutil.copy2(TERRA_SRC, current)
        sanitize_png_images(current)

        _, nxt = bump(work, step, current)
        gltf("dedup", str(current), str(nxt))
        current = nxt

        _, nxt = bump(work, step, current)
        gltf("prune", str(current), str(nxt), "--keep-leaves", "true")
        current = nxt

        if has_images(current):
            _, nxt = bump(work, step, current)
            shutil.copy2(current, nxt)
            compact_images(nxt, 1024, 80)
            current = nxt

        _, nxt = bump(work, step, current)
        meshopt(current, nxt, color=True, tex=has_images(current))
        current = nxt
        shutil.copy2(current, dest)

    size = dest.stat().st_size
    info = {
        "bytes": size,
        "tris": triangle_count(dest),
        "prims": prim_count(dest),
        "file": str(dest.relative_to(ROOT)).replace("\\", "/"),
        "over_budget": size > MASS_BUDGET,
    }
    log(f"OK terra mass {info['tris']}t/{info['prims']}p/{size}b budget={MASS_BUDGET}")
    return info


def write_manifest(buildings: list[dict[str, object]], mass: dict[str, object], over: list[str]) -> None:
    manifest = {
        "map": "maps/terra-19.json",
        "mass": mass,
        "buildingBudget": BUILDING_BUDGET,
        "massBudget": MASS_BUDGET,
        "overBuildingBudget": over,
        "buildings": buildings,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    log(f"wrote {OUT / 'manifest.json'}")
    if over:
        log("WARN over 350KiB: " + ", ".join(over))
    if mass.get("over_budget"):
        log(f"WARN island_mass.glb {mass['bytes']} exceeds 1.5 MiB (look kept, not simplified)")


def relod_from_lod0(slug: str) -> dict[str, int]:
    """Re-simplify LOD1/2 from existing lod0. Drops useless copies if simplify fails."""
    lod0 = BUILDINGS_OUT / f"{slug}.glb"
    lod1 = LOD_OUT / f"{slug}_lod1.glb"
    lod2 = LOD_OUT / f"{slug}_lod2.glb"
    if not lod0.is_file():
        raise RuntimeError(f"missing {lod0}")
    base = triangle_count(lod0)
    LOD_OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="relod19_", dir=str(OUT)) as tmp:
        work = Path(tmp)
        src = work / "src.glb"
        shutil.copy2(lod0, src)

        def pack(level: int, dest: Path, target: int, q: int, px: int) -> int:
            simp = work / f"s{level}.glb"
            simplify_to(src, simp, target)
            got = triangle_count(simp)
            if got > int(base * 0.85):
                gltf(
                    "simplify",
                    str(src),
                    str(simp),
                    "--ratio",
                    f"{min(1.0, target / max(base, 1)):.6f}",
                    "--error",
                    "10",
                    "--lock-border",
                    "false",
                )
                got = triangle_count(simp)
                log(f"relod {slug} lod{level} retry error=10 -> {got}")
            if got > int(base * 0.85):
                if dest.is_file():
                    dest.unlink()
                log(f"relod skip {slug} lod{level}: {got}/{base} (keep lod0 only)")
                return base
            if has_images(simp):
                compact_images(simp, px, q)
            meshopt(simp, dest, color=False, tex=has_images(simp))
            return triangle_count(dest)

        t1 = pack(1, lod1, LOD1_TRIS, 70, 512)
        t2 = pack(2, lod2, LOD2_TRIS, 60, 256)
    return {"tris0": base, "tris1": t1, "tris2": t2}


def load_existing_mass() -> dict[str, object]:
    dest = OUT / "island_mass.glb"
    if not dest.is_file():
        return diet_terra()
    size = dest.stat().st_size
    return {
        "bytes": size,
        "tris": triangle_count(dest),
        "prims": prim_count(dest),
        "file": str(dest.relative_to(ROOT)).replace("\\", "/"),
        "over_budget": size > MASS_BUDGET,
    }


def refresh_building_row(src_name: str, slug: str) -> dict[str, object]:
    lod0 = BUILDINGS_OUT / f"{slug}.glb"
    lod1 = LOD_OUT / f"{slug}_lod1.glb"
    lod2 = LOD_OUT / f"{slug}_lod2.glb"
    t1 = triangle_count(lod1) if lod1.is_file() else triangle_count(lod0)
    t2 = triangle_count(lod2) if lod2.is_file() else triangle_count(lod0)
    return {
        "slug": slug,
        "src": src_name,
        "lod0": str(lod0.relative_to(ROOT)).replace("\\", "/"),
        "lod1": str(lod1.relative_to(ROOT)).replace("\\", "/") if lod1.is_file() else "",
        "lod2": str(lod2.relative_to(ROOT)).replace("\\", "/") if lod2.is_file() else "",
        "bytes0": lod0.stat().st_size,
        "bytes1": lod1.stat().st_size if lod1.is_file() else 0,
        "bytes2": lod2.stat().st_size if lod2.is_file() else 0,
        "tris0": triangle_count(lod0),
        "tris1": t1,
        "tris2": t2,
        "prims0": prim_count(lod0),
        "native": accessor_aabb(lod0),
    }


def main() -> None:
    os.chdir(REPO)
    OUT.mkdir(parents=True, exist_ok=True)
    BUILDINGS_OUT.mkdir(parents=True, exist_ok=True)
    LOD_OUT.mkdir(parents=True, exist_ok=True)
    relod_only = "--relod" in sys.argv
    lod_from_src = "--lod-from-src" in sys.argv
    manifest_only = "--manifest" in sys.argv
    buildings: list[dict[str, object]] = []
    over: list[str] = []
    for file_name, slug in CATALOG:
        src = catalog_src(file_name)
        if manifest_only:
            info = refresh_building_row(file_name, slug)
        elif lod_from_src:
            if not src.is_file():
                raise RuntimeError(f"missing {src}")
            lod0 = BUILDINGS_OUT / f"{slug}.glb"
            if not lod0.is_file():
                raise RuntimeError(f"missing {lod0}")
            t0 = triangle_count(lod0)
            lod1 = LOD_OUT / f"{slug}_lod1.glb"
            t1 = triangle_count(lod1) if lod1.is_file() else t0
            if (not lod1.is_file()) or t1 > LOD1_TRIS * 1.5 or t1 > int(t0 * 0.8):
                lod_from_source(src, slug)
            else:
                log(f"lod-src keep {slug} lod1 {t1}/{t0}")
            info = refresh_building_row(file_name, slug)
        elif relod_only:
            lod0 = BUILDINGS_OUT / f"{slug}.glb"
            if not lod0.is_file():
                raise RuntimeError(f"missing {lod0}")
            t0 = triangle_count(lod0)
            lod1 = LOD_OUT / f"{slug}_lod1.glb"
            t1 = triangle_count(lod1) if lod1.is_file() else t0
            if t1 > LOD1_TRIS * 1.2 or t1 > int(t0 * 0.75):
                stats = relod_from_lod0(slug)
                log(f"RELOD {slug} {stats}")
            else:
                log(f"relod keep {slug} lod1 {t1}/{t0}")
            info = refresh_building_row(file_name, slug)
        else:
            if not src.is_file():
                raise RuntimeError(f"missing {src}")
            info = diet_building(src, slug)
        buildings.append(info)
        if int(info["bytes0"]) > BUILDING_BUDGET:
            over.append(f"{slug} {info['bytes0']}")
    mass = load_existing_mass() if (relod_only or lod_from_src or manifest_only) else diet_terra()
    write_manifest(buildings, mass, over)


if __name__ == "__main__":
    main()
