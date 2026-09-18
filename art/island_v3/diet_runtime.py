"""Diet runtime GLBs with the pinned gltf-transform CLI.

Does not touch island.blend or models/*.glb. Strip extra PBR maps, then
dedup / prune / weld / simplify 8k (buildings, I0 owner level) / Pillow
WebP 1024 / meshopt. gltf-transform resize/webp is skipped: libvips on
Windows rejects Blender PNG after ancillary-chunk sanitize.
"""

from __future__ import annotations

import json
import os
import shutil
import struct
import subprocess
import sys
import tempfile
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent
RUNTIME = ROOT / "runtime"
BUILDINGS = RUNTIME / "buildings"
MASS = RUNTIME / "island_mass.glb"
BUILDING_BUDGET = 350 * 1024
MASS_BUDGET = int(1.5 * 1024 * 1024)
VIEWER_BUDGET = 12 * 1024 * 1024
BUILDING_TRIS = 8000
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


def triangle_count(path: Path) -> int:
    doc = read_glb_json(path)
    accessors = list(doc.get("accessors") or [])
    total = 0
    for mesh in doc.get("meshes") or []:
        if not isinstance(mesh, dict):
            continue
        for prim in mesh.get("primitives") or []:
            if not isinstance(prim, dict):
                continue
            mode = int(prim.get("mode", 4))
            indices = prim.get("indices")
            attrs = prim.get("attributes")
            count = 0
            if isinstance(indices, int) and 0 <= indices < len(accessors):
                acc = accessors[indices]
                if isinstance(acc, dict):
                    count = int(acc.get("count") or 0)
            elif isinstance(attrs, dict):
                pos = attrs.get("POSITION")
                if isinstance(pos, int) and 0 <= pos < len(accessors):
                    acc = accessors[pos]
                    if isinstance(acc, dict):
                        count = int(acc.get("count") or 0)
            if mode == 4:
                total += count // 3
            elif mode in (5, 6):
                total += max(count - 2, 0)
            else:
                raise RuntimeError(f"{path.name}: unsupported primitive mode {mode}")
    return total


def view_pieces(doc: dict, bin_data: bytes) -> tuple[list[object], list[bytes]]:
    views = list(doc.get("bufferViews") or [])
    pieces: list[bytes] = []
    for view in views:
        if not isinstance(view, dict):
            pieces.append(b"")
            continue
        off = int(view.get("byteOffset") or 0)
        ln = int(view.get("byteLength") or 0)
        pieces.append(bin_data[off : off + ln])
    return views, pieces


def write_repacked(path: Path, doc: dict, views: list[object], pieces: list[bytes]) -> None:
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


def encode_webp(raw: bytes, max_px: int, quality: int) -> bytes:
    img = Image.open(BytesIO(raw))
    img.load()
    if img.mode == "P":
        img = img.convert("RGBA" if "transparency" in img.info else "RGB")
    elif img.mode in {"LA", "PA"}:
        img = img.convert("RGBA")
    elif img.mode == "L":
        img = img.convert("RGB")
    elif img.mode not in {"RGB", "RGBA"}:
        img = img.convert("RGBA" if "A" in img.mode else "RGB")
    if img.mode == "RGBA":
        mn, mx = img.getchannel("A").getextrema()
        if mn == 255 and mx == 255:
            img = img.convert("RGB")
    width, height = img.size
    if max(width, height) > max_px:
        scale = max_px / max(width, height)
        img = img.resize(
            (max(1, int(width * scale)), max(1, int(height * scale))),
            Image.Resampling.LANCZOS,
        )
    out = BytesIO()
    img.save(out, format="WEBP", quality=quality, method=6)
    return out.getvalue()


def compact_images(path: Path, max_px: int, quality: int) -> None:
    """Resize and WebP-encode images with Pillow so libvips is not required."""
    doc, bin_data = read_glb(path)
    views, pieces = view_pieces(doc, bin_data)
    if not views or not pieces:
        return
    changed = False
    for image in doc.get("images") or []:
        if not isinstance(image, dict):
            continue
        mime = str(image.get("mimeType") or "")
        if mime not in {"image/png", "image/jpeg", "image/webp"}:
            continue
        idx = image.get("bufferView")
        if not isinstance(idx, int) or idx < 0 or idx >= len(pieces):
            continue
        encoded = encode_webp(pieces[idx], max_px, quality)
        if encoded != pieces[idx] or mime != "image/webp":
            pieces[idx] = encoded
            image["mimeType"] = "image/webp"
            changed = True
    if not changed:
        return
    write_repacked(path, doc, views, pieces)
    log(f"pillow webp {path.name}")


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
    views, pieces = view_pieces(doc, bin_data)
    if not views or not pieces:
        return
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
    write_repacked(path, doc, views, pieces)
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
        stripped_mr = False
        if isinstance(pbr, dict) and "metallicRoughnessTexture" in pbr:
            pbr.pop("metallicRoughnessTexture")
            stripped_mr = True
            changed = True
        if not isinstance(pbr, dict):
            pbr = {}
            mat["pbrMetallicRoughness"] = pbr
        missing_metal = "metallicFactor" not in pbr
        if stripped_mr or missing_metal:
            if pbr.get("metallicFactor") != 0:
                pbr["metallicFactor"] = 0
                changed = True
            if "roughnessFactor" not in pbr:
                pbr["roughnessFactor"] = 0.85
                changed = True
    if changed:
        write_glb(path, doc, bin_data)
        log(f"stripped extra PBR maps: {path.name}")


def has_images(path: Path) -> bool:
    return bool(read_glb_json(path).get("images"))


def strip_normals(path: Path) -> int:
    """Drop NORMAL attrs so prune can drop their accessors. Mass is vertex-color; Three recomputes."""
    doc, bin_data = read_glb(path)
    removed = 0
    for mesh in doc.get("meshes") or []:
        if not isinstance(mesh, dict):
            continue
        for prim in mesh.get("primitives") or []:
            if not isinstance(prim, dict):
                continue
            attrs = prim.get("attributes")
            if isinstance(attrs, dict) and "NORMAL" in attrs:
                attrs.pop("NORMAL")
                removed += 1
            if isinstance(attrs, dict) and "TANGENT" in attrs:
                attrs.pop("TANGENT")
                removed += 1
    if removed:
        write_glb(path, doc, bin_data)
        log(f"stripped NORMAL/TANGENT from {removed} primitives: {path.name}")
    return removed


def has_vertex_color(path: Path) -> bool:
    doc = read_glb_json(path)
    for mesh in doc.get("meshes") or []:
        if not isinstance(mesh, dict):
            continue
        for prim in mesh.get("primitives") or []:
            if not isinstance(prim, dict):
                continue
            attrs = prim.get("attributes")
            if isinstance(attrs, dict) and "COLOR_0" in attrs:
                return True
    return False


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

        if keep_leaves:
            log(f"normals kept for lighting: {src.name}")

        if has_vertex_color(current):
            log(f"weld skipped (COLOR_0): {src.name}")
        else:
            nxt = bump()
            gltf_transform("weld", str(current), str(nxt))
            current = nxt

        if not keep_leaves:
            tris = triangle_count(current)
            if tris > BUILDING_TRIS:
                nxt = bump()
                ratio = min(1.0, BUILDING_TRIS / max(tris, 1))
                gltf_transform(
                    "simplify",
                    str(current),
                    str(nxt),
                    "--ratio",
                    f"{ratio:.6f}",
                    "--error",
                    "1",
                    "--lock-border",
                    "false",
                )
                got = triangle_count(nxt)
                log(f"simplify {src.name} {tris} -> {got} target {BUILDING_TRIS}")
                current = nxt
            else:
                log(f"simplify skipped {src.name} ({tris} <= {BUILDING_TRIS})")

        if has_images(current):
            nxt = bump()
            shutil.copy2(current, nxt)
            compact_images(nxt, texture_px, webp_quality)
            current = nxt

        nxt = bump()
        mesh_args = [
            "meshopt",
            str(current),
            str(nxt),
            "--quantize-position",
            "10",
            "--quantize-normal",
            "8",
        ]
        if not keep_leaves:
            mesh_args.extend(
                [
                    "--quantize-texcoord",
                    "8",
                ]
            )
        else:
            mesh_args.extend(["--quantize-color", "8"])
        gltf_transform(*mesh_args)
        current = nxt
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_name(dest.name + ".diettmp")
        shutil.copy2(current, tmp)
        os.replace(tmp, dest)


def diet_file(path: Path, *, keep_leaves: bool, budget: int, label: str) -> int:
    original = path.with_name(path.name + ".src")
    shutil.copy2(path, original)
    attempts = ((1024, 80), (768, 70))
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

    if "--buildings-only" in sys.argv:
        mass_size = MASS.stat().st_size
        log(f"buildings-only, mass left at {mass_size}")
    else:
        mass_size = diet_file(MASS, keep_leaves=True, budget=MASS_BUDGET, label="mass")
        if "--mass-only" in sys.argv:
            log(f"mass-only {mass_size} budget {MASS_BUDGET}")
            if mass_size > MASS_BUDGET:
                raise SystemExit(f"island_mass.glb {mass_size} exceeds 1.5 MiB")
            return

    buildings = sorted(BUILDINGS.glob("*.glb"))
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
        raise SystemExit(f"building budget {detail}")


if __name__ == "__main__":
    main()
