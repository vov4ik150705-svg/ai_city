"""Build three simplify variants of runtime buildings. Does not overwrite runtime/buildings."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from _diet_measure import triangle_count  # noqa: E402
REPO = ROOT.parent.parent
SRC = ROOT / "runtime" / "buildings"
VARIANTS: tuple[tuple[str, int], ...] = (
    ("_diet_a", 8000),
    ("_diet_b", 4000),
    ("_diet_c", 2000),
)
JOBS = 4


def log(msg: str) -> None:
    print(msg, flush=True)


def gltf_transform(*args: str) -> None:
    corepack = shutil.which("corepack")
    if corepack is None:
        raise RuntimeError("corepack not on PATH")
    env = dict(os.environ)
    env.setdefault("NODE_OPTIONS", "--use-system-ca")
    cmd = [corepack, "pnpm", "exec", "gltf-transform", *args]
    result = subprocess.run(cmd, cwd=REPO, text=True, capture_output=True, env=env)
    if result.returncode != 0:
        err = (result.stderr or result.stdout or "").strip()
        raise RuntimeError(f"gltf-transform {' '.join(args)} failed ({result.returncode}): {err}")


def simplify_one(src: Path) -> list[str]:
    notes: list[str] = []
    slug = src.stem
    src_tris = triangle_count(src)
    with tempfile.TemporaryDirectory(prefix=f"diet_{slug}_", dir=str(ROOT / "runtime")) as tmp:
        work = Path(tmp)
        welded = work / f"{slug}.weld.glb"
        gltf_transform("weld", str(src), str(welded))
        weld_tris = triangle_count(welded)
        if weld_tris != src_tris:
            notes.append(f"{slug}: weld {src_tris} -> {weld_tris}")
        base = max(weld_tris, 1)
        for folder, target in VARIANTS:
            dest_dir = SRC.parent / folder
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest = dest_dir / src.name
            ratio = min(1.0, target / base)
            simplified = work / f"{slug}.{target}.glb"
            gltf_transform(
                "simplify",
                str(welded),
                str(simplified),
                "--ratio",
                f"{ratio:.6f}",
                "--error",
                "1",
                "--lock-border",
                "false",
            )
            got = triangle_count(simplified)
            if abs(got - target) > max(80, int(target * 0.08)):
                notes.append(f"{slug} {folder}: target {target} got {got} ratio {ratio:.6f}")
            gltf_transform(
                "meshopt",
                str(simplified),
                str(dest),
                "--quantize-position",
                "10",
                "--quantize-texcoord",
                "8",
                "--quantize-normal",
                "8",
            )
            notes.append(
                f"{slug} {folder}: {src_tris} -> {triangle_count(dest)} tris, {dest.stat().st_size} B"
            )
    return notes


def main() -> None:
    buildings = sorted(SRC.glob("*.glb"))
    if len(buildings) != 18:
        raise SystemExit(f"expected 18 buildings, found {len(buildings)}")
    for folder, _target in VARIANTS:
        out = SRC.parent / folder
        if out.exists():
            for old in out.glob("*.glb"):
                old.unlink()
        out.mkdir(parents=True, exist_ok=True)

    errors: list[str] = []
    with ThreadPoolExecutor(max_workers=JOBS) as pool:
        futs = {pool.submit(simplify_one, path): path.name for path in buildings}
        for fut in as_completed(futs):
            name = futs[fut]
            try:
                for line in fut.result():
                    log(line)
            except Exception as exc:  # noqa: BLE001 — surface worker failure
                errors.append(f"{name}: {exc}")
                log(f"FAIL {name}: {exc}")
    if errors:
        raise SystemExit("simplify failed:\n" + "\n".join(errors))
    log("diet variants ready")


if __name__ == "__main__":
    main()
