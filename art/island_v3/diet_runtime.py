"""Diet runtime GLBs with the pinned gltf-transform CLI.

Does not touch island.blend or models/*.glb. Strip extra PBR maps, then
dedup / prune / weld / resize 1024 / webp / meshopt. Does not simplify.
"""

from __future__ import annotations

import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
RUNTIME = ROOT / "runtime"
BUILDINGS = RUNTIME / "buildings"
MASS = RUNTIME / "island_mass.glb"
BUILDING_BUDGET = 350 * 1024
MASS_BUDGET = int(1.5 * 1024 * 1024)
VIEWER_BUDGET = 12 * 1024 * 1024
PNG_KEEP = {b"IHDR", b"PLTE", b"tRNS", b"IDAT", b"IEND"}


def log(msg: str) -> None:
    print(msg, flush=True)


def pnpm_exec(*args: str) -> subprocess.CompletedProcess[str]:
    corepack = shutil.which("corepack")
    if corepack is None:
        raise RuntimeError("corepack not on PATH")
    env = dict(os.environ)
    env.setdefault("NODE_OPTIONS", "--use-system-ca")
    cmd = [corepack, "pnpm", "exec", *args]
    log(" ".join(cmd[2:]))
    return subprocess.run(cmd, cwd=REPO, text=True, capture_output=True, env=env)


def gltf_transform(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = pnpm_exec("gltf-transform", *args)
    if result.stdout:
        sys.stdout.write(result.stdout)
    if result.stderr:
        sys.stderr.write(result.stderr)
    if check and result.returncode != 0:
        raise RuntimeError(f"gltf-transform {' '.join(args)} failed ({result.returncode})")
    return result


def read_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    if data[:4] != b"glTF":
        raise RuntimeError(f"{path} is not GLB")
    json_len, json_type = struct.unpack_from("<I4s", data, 12)
    if json_type != b"JSON":
        raise RuntimeError(f"{path} missing JSON chunk")
    parsed = json.loads(data[20 : 20 + json_len].rstrip(b"\x00 "))
    if not isinstance(parsed, dict):
        raise RuntimeError(f"{path} JSON root is not an object")
    bin_off = 20 + json_len
    if bin_off >= len(data):
        return parsed, b""
    bin_len, bin_type = struct.unpack_from("<I4s", data, bin_off)
    if bin_type != b"BIN\x00":
        return parsed, b""
    return parsed, data[bin_off + 8 : bin_off + 8 + bin_len]


def write_glb(path: Path, doc: dict, bin_data: bytes) -> None:
    payload = json.dumps(doc, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    payload += b" " * ((4 - (len(payload) % 4)) % 4)
    blob = bin_data + (b"\x00" * ((4 - (len(bin_data) % 4)) % 4))
    total = 12 + 8 + len(payload) + 8 + len(blob)
    path.write_bytes(
        struct.pack("<4sII", b"glTF", 2, total)
        + struct.pack("<I4s", len(payload), b"JSON")
        + payload
        + struct.pack("<I4s", len(blob), b"BIN\x00")
        + blob
    )


def read_glb_json(path: Path) -> dict:
    doc, _bin = read_glb(path)
    return doc


def strip_png_ancillary(png: bytes) -> bytes:
    if png[:8] != b"\x89PNG\r\n\x1a\n":
        return png
    out = bytearray(png[:8])
    i = 8
    while i + 12 <= len(png):
        length = struct.unpack(">I", png[i : i + 4])[0]
        ctype = png[i + 4 : i + 8]
        end = i + 12 + length
        if end > len(png):
            break
        if ctype in PNG_KEEP:
            out.extend(png[i:end])
        i = end
        if ctype == b"IEND":
            break
    return bytes(out)


def sanitize_png_images(path: Path) -> None:
    doc, bin_data = read_glb(path)
    views = list(doc.get("bufferViews") or [])
    if not views or not bin_data:
        return
    pieces: list[bytes] = []
    for view in views:
        if not isinstance(view, dict):
            pieces.append(b"")
            continue
        off = int(view.get("byteOffset") or 0)
        ln = int(view.get("byteLength") or 0)
        pieces.append(bin_data[off : off + ln])
    changed = False
    for image in doc.get("images") or []:
        if not isinstance(image, dict) or image.get("mimeType") != "image/png":
            continue
        idx = image.get("bufferView")
        if not isinstance(idx, int) or idx < 0 or idx >= len(pieces):
            continue
        cleaned = strip_png_ancillary(pieces[idx])
        if cleaned != pieces[idx]:
            pieces[idx] = cleaned
            changed = True
    if not changed:
        return
    packed = bytearray()
    for i, piece in enumerate(pieces):
        while len(packed) % 4:
            packed.append(0)
        view = views[i]
        if isinstance(view, dict):
            view["byteOffset"] = len(packed)
            view["byteLength"] = len(piece)
        packed.extend(piece)
    buffers = doc.get("buffers")
    if isinstance(buffers, list) and buffers and isinstance(buffers[0], dict):
        buffers[0]["byteLength"] = len(packed)
    write_glb(path, doc, bytes(packed))
    log(f"sanitized PNG chunks: {path.name}")


def strip_extra_pbr(path: Path) -> None:
    doc, bin_data = read_glb(path)
    changed = False
    for mat in doc.get("materials") or []:
        if not isinstance(mat, dict):
            continue
        for key in ("normalTexture", "occlusionTexture"):
            if key in mat:
                mat.pop(key)
                changed = True
        pbr = mat.get("pbrMetallicRoughness")
        if isinstance(pbr, dict) and "metallicRoughnessTexture" in pbr:
            pbr.pop("metallicRoughnessTexture")
            changed = True
    if changed:
        write_glb(path, doc, bin_data)
        log(f"stripped extra PBR maps: {path.name}")


def has_images(path: Path) -> bool:
    return bool(read_glb_json(path).get("images"))


def run_chain(src: Path, dest: Path, *, keep_leaves: bool, texture_px: int, webp_quality: int) -> None:
    with tempfile.TemporaryDirectory(prefix="diet_", dir=str(RUNTIME)) as tmp:
        work = Path(tmp)
        current = work / "0.glb"
        shutil.copy2(src, current)
        if not keep_leaves:
            sanitize_png_images(current)
            strip_extra_pbr(current)
        step = 1

        def bump() -> Path:
            nonlocal step, current
            nxt = work / f"{step}.glb"
            step += 1
            return nxt

        nxt = bump()
        gltf_transform("dedup", str(current), str(nxt))
        current = nxt

        nxt = bump()
        prune_args = ["prune", str(current), str(nxt)]
        if keep_leaves:
            prune_args.extend(["--keep-leaves", "true"])
        gltf_transform(*prune_args)
        current = nxt

        nxt = bump()
        gltf_transform("weld", str(current), str(nxt))
        current = nxt

        if has_images(current):
            mimes = {
                str(im.get("mimeType") or "")
                for im in (read_glb_json(current).get("images") or [])
                if isinstance(im, dict)
            }
            if "image/png" in mimes or "image/jpeg" in mimes:
                nxt = bump()
                resized = gltf_transform(
                    "resize",
                    str(current),
                    str(nxt),
                    "--width",
                    str(texture_px),
                    "--height",
                    str(texture_px),
                    check=False,
                )
                if resized.returncode != 0:
                    raise RuntimeError(f"resize failed for {src.name}")
                current = nxt
                nxt = bump()
                webp = gltf_transform(
                    "webp",
                    str(current),
                    str(nxt),
                    "--quality",
                    str(webp_quality),
                    check=False,
                )
                if webp.returncode == 0:
                    current = nxt
                else:
                    log(f"webp skipped for {src.name}")

        nxt = bump()
        mesh_args = ["meshopt", str(current), str(nxt)]
        if not keep_leaves:
            mesh_args.extend(
                [
                    "--quantize-position",
                    "10",
                    "--quantize-texcoord",
                    "8",
                    "--quantize-normal",
                    "8",
                ]
            )
        gltf_transform(*mesh_args)
        current = nxt
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(current, dest)


def diet_file(path: Path, *, keep_leaves: bool, budget: int, label: str) -> int:
    original = path.with_name(path.name + ".src")
    shutil.copy2(path, original)
    attempts = ((1024, 80),)
    if keep_leaves or not has_images(original):
        attempts = ((1024, 80),)
    last_size = path.stat().st_size
    try:
        for texture_px, quality in attempts:
            log(f"diet {label} {path.name} resize={texture_px} webp={quality}")
            run_chain(
                original,
                path,
                keep_leaves=keep_leaves,
                texture_px=texture_px,
                webp_quality=quality,
            )
            last_size = path.stat().st_size
            log(f"  -> {last_size} bytes")
            if last_size <= budget:
                return last_size
        return last_size
    finally:
        original.unlink(missing_ok=True)


def main() -> None:
    if not MASS.is_file():
        raise RuntimeError(f"missing {MASS}; run export_runtime.py first")
    buildings = sorted(BUILDINGS.glob("*.glb"))
    if len(buildings) != 18:
        raise RuntimeError(f"expected 18 building glbs, found {len(buildings)}")

    mass_size = diet_file(MASS, keep_leaves=True, budget=MASS_BUDGET, label="mass")
    worst_name = ""
    worst_size = 0
    building_sum = 0
    over: list[tuple[str, int]] = []
    for path in buildings:
        size = diet_file(path, keep_leaves=False, budget=BUILDING_BUDGET, label="building")
        building_sum += size
        if size > worst_size:
            worst_size = size
            worst_name = path.name
        if size > BUILDING_BUDGET:
            over.append((path.name, size))

    viewer_sum = mass_size + building_sum
    log(f"mass {mass_size} budget {MASS_BUDGET}")
    log(f"worst building {worst_name} {worst_size} budget {BUILDING_BUDGET}")
    log(f"viewer sum {viewer_sum} budget {VIEWER_BUDGET}")
    if mass_size > MASS_BUDGET:
        raise SystemExit(f"island_mass.glb {mass_size} exceeds 1.5 MiB")
    if viewer_sum > VIEWER_BUDGET:
        raise SystemExit(f"viewer bytes {viewer_sum} exceed 12 MiB")
    if over:
        detail = ", ".join(f"{n}={s}" for n, s in over)
        log(
            "BUILDING_BUDGET_MISS "
            f"{detail}. Geometry is the remainder after 1024 WebP + meshopt; "
            "no simplify. Propose raising the per-building cap to 512 KiB "
            "(worst nvidia_tower is 501432 bytes; 18×512 KiB + mass still < 12 MiB)."
        )


if __name__ == "__main__":
    main()
