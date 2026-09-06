"""Shared loading, canonical serialisation and integer helpers for the content pack.

Canonical form is sorted-key, minimal-separator UTF-8 JSON. That exact byte sequence is
what the pack hash is taken over, so a pack built on any machine hashes identically -
which is the precondition for replaying an old shift against the pack it was priced with
(DESIGN.md 6.3).

Every rate in the pack is an integer in basis points. There is no float anywhere on the
hashed path; assert_no_floats() enforces it rather than trusting review.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
PARAM_DIR = ROOT / "params"
OUT_DIR = ROOT / "out"

BPS = 10_000

# Param file -> the $defs entry in schema/corporator.schema.json that validates it.
PARAM_FILES = {
    "meta.json": "meta_file",
    "pending.json": "pending_file",
    "exceptions.json": "exceptions_file",
    "economy.json": "economy_file",
    "launch.json": "launch_file",
    "balance.json": "balance_file",
    "research.json": "research_file",
    "progression.json": "progression_file",
    "time.json": "time_file",
    "districts.json": "districts_file",
    "buildings.json": "buildings_file",
    "agents.json": "agents_file",
    "modifier_keys.json": "modifier_keys_file",
    "modifiers.json": "modifiers_file",
    "resources.json": "resources_file",
    "codes.json": "codes_file",
    "sim.json": "sim_file",
    "fragments.json": "fragments_file",
    "seasons.json": "seasons_file",
    "companion.json": "companion_file",
    "screens.json": "screens_file",
    "placement.json": "placement_file",
    "tick.json": "tick_file",
    "attest.json": "attest_file",
    "render.json": "render_file",
    "arch.json": "arch_file",
    "api.json": "api_file",
}


def load_json(path: Path):
    with path.open(encoding="utf-8") as fh:
        return json.load(fh, parse_float=_reject_float)


def _reject_float(raw: str):
    raise ValueError(f"float literal {raw!r} in content: rates belong in basis points")


def sections() -> dict:
    """All param files keyed by filename stem."""
    return {name.removesuffix(".json"): load_json(PARAM_DIR / name) for name in PARAM_FILES}


def strings(lang: str = "ru") -> dict:
    return load_json(ROOT / "strings" / f"{lang}.json")


def fixture(name: str) -> dict:
    return load_json(ROOT / "fixtures" / f"{name}.json")


def schema() -> dict:
    return load_json(ROOT / "schema" / "corporator.schema.json")


def canonical(obj) -> bytes:
    assert_no_floats(obj)
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def pack_hash(obj) -> str:
    """sha256 of the canonical bytes.

    Deliberately not keccak: this hash is an identifier carried in TickInputHeader, not in
    DecisionRecord. Leaves stay keccak per DESIGN.md 6.2. sha256 keeps the content builder free
    of dependencies in every language a public verifier might be written in.
    """
    return hashlib.sha256(canonical(obj)).hexdigest()


def assert_no_floats(obj, path: str = "$") -> None:
    if isinstance(obj, float):
        raise ValueError(f"float at {path}: hashed content must be integer-only")
    if isinstance(obj, dict):
        for key, value in obj.items():
            assert_no_floats(value, f"{path}.{key}")
    elif isinstance(obj, list):
        for index, value in enumerate(obj):
            assert_no_floats(value, f"{path}[{index}]")


def mul_bps(value: int, rate_bps: int) -> int:
    """value * rate_bps / BPS, floored. The single multiplication primitive."""
    return value * rate_bps // BPS


def keep_after_fee(value: int, fee_bps: int) -> int:
    return mul_bps(value, BPS - fee_bps)


def markup(value: int, markup_bps: int) -> int:
    return mul_bps(value, BPS + markup_bps)


def param(sections_data: dict, section: str, name: str) -> int:
    return sections_data[section]["params"][name]["v"]


def write_out(name: str, text: str) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / name
    path.write_text(text, encoding="utf-8")
    return path


def write_out_bytes(name: str, blob: bytes) -> Path:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / name
    path.write_bytes(blob)
    return path
