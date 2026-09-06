"""DecisionRecord layout v1, tick header, and positional merkle (TICK.md §8, §9).

Field names are not baked in: validate_record / encode_record take a spec the pack
will later store in tick.json. encode_* refuses to serialise until validate_* is
empty — a crooked record must not become a signed leaf.

pack_hash lives on TickInputHeader (merkle leaf 0), not on each DecisionRecord
(R-T11-3). Repeating the same hash in every record is a T0 dual-source defect;
replay DESIGN.md §6.3 already loads the header, so the record does not need it.

Merkle domain bytes are arguments (leaf_prefix, node_prefix). This module does
not know their values; mixing a leaf with a node is a failed proof, not a param.
"""

from __future__ import annotations

import json
import sys

try:
    from keccak import keccak256
    from pack import assert_no_floats, canonical
except ImportError:
    from content.keccak import keccak256
    from content.pack import assert_no_floats, canonical


def _is_bool(value: object) -> bool:
    return type(value) is bool


def _is_int(value: object) -> bool:
    return type(value) is int and not _is_bool(value)


def _is_str(value: object) -> bool:
    return type(value) is str


def _is_dict(value: object) -> bool:
    return type(value) is dict


def _validate_value(value: object, field_spec: dict, path: str, field_name: str) -> list[str]:
    errors: list[str] = []
    if value is None:
        errors.append(f"{path}: null is forbidden in layout v1 (use empty string)")
        return errors
    if type(value) is float:
        errors.append(f"{path}: float is forbidden")
        return errors
    if not _is_dict(field_spec):
        errors.append(f"{path}: spec field is not an object")
        return errors
    ftype = field_spec.get("type")
    unit = field_spec.get("unit")
    if unit == "bps" and not field_name.endswith("_bps"):
        errors.append(f"{path}: bps value must use a _bps suffix")
    if ftype == "int":
        if _is_bool(value):
            errors.append(f"{path}: bool is not a legal int (True serialises as true, changing bytes)")
        elif not _is_int(value):
            errors.append(f"{path}: expected int, got {type(value).__name__}")
    elif ftype == "str":
        if not _is_str(value):
            errors.append(f"{path}: expected str, got {type(value).__name__}")
    elif ftype == "object":
        if not _is_dict(value):
            errors.append(f"{path}: expected object, got {type(value).__name__}")
        else:
            inner = field_spec.get("of")
            if inner is None:
                inner = {}
            if not _is_dict(inner):
                errors.append(f"{path}: spec of must be an object")
            else:
                errors.extend(_validate_object(value, inner, path))
    else:
        errors.append(f"{path}: unknown spec type {ftype!r}")
    return errors


def _validate_object(obj: dict, fields: dict, path: str) -> list[str]:
    errors: list[str] = []
    if not _is_dict(obj):
        return [f"{path}: expected object"]
    if not _is_dict(fields):
        return [f"{path}: spec fields must be an object"]
    for key in obj:
        if key not in fields:
            errors.append(f"{path}.{key}: extra field")
    for key, fspec in fields.items():
        child = f"{path}.{key}"
        if key not in obj:
            errors.append(f"{child}: missing field")
        else:
            errors.extend(_validate_value(obj[key], fspec, child, key))
    return errors


def _validate(obj: object, spec: dict, kind: str) -> list[str]:
    errors: list[str] = []
    if not _is_dict(obj):
        return [f"{kind}: expected dict"]
    if not _is_dict(spec):
        return [f"{kind}: spec must be a dict"]
    try:
        assert_no_floats(obj)
    except ValueError as exc:
        errors.append(str(exc))
    fields = spec.get("fields")
    if not _is_dict(fields):
        errors.append(f"{kind}: spec.fields must be an object")
        return errors
    if "layout_version" not in spec:
        errors.append(f"{kind}: spec.layout_version missing")
    errors.extend(_validate_object(obj, fields, kind))
    if "layout_version" in obj and "layout_version" in spec:
        if _is_int(obj["layout_version"]) and obj["layout_version"] != spec["layout_version"]:
            errors.append(
                f"{kind}.layout_version {obj['layout_version']!r} != spec {spec['layout_version']!r}"
            )
    return errors


def validate_record(rec: dict, spec: dict) -> list[str]:
    """Return objection strings; empty means the record is legal under spec (TICK.md §8)."""
    return _validate(rec, spec, "record")


def validate_header(hdr: dict, spec: dict) -> list[str]:
    """Return objection strings; empty means the header is legal under spec (TICK.md §8)."""
    return _validate(hdr, spec, "header")


def encode_record(rec: dict, spec: dict) -> bytes:
    """canonical(rec) only after validate_record is empty. Crooked records must not become leaves."""
    errors = validate_record(rec, spec)
    if errors:
        raise ValueError("encode_record: " + "; ".join(errors))
    return canonical(rec)


def encode_header(hdr: dict, spec: dict) -> bytes:
    """canonical(hdr) only after validate_header is empty. Same gate as encode_record."""
    errors = validate_header(hdr, spec)
    if errors:
        raise ValueError("encode_header: " + "; ".join(errors))
    return canonical(hdr)


def leaf_hash(blob: bytes, leaf_prefix: bytes) -> bytes:
    """keccak256(leaf_prefix || blob). Prefix is a pack argument so a leaf cannot pose as a node."""
    return keccak256(leaf_prefix + blob)


def node_hash(left: bytes, right: bytes, node_prefix: bytes) -> bytes:
    """keccak256(node_prefix || left || right), positional. Sorting the pair is forbidden: it drops index."""
    return keccak256(node_prefix + left + right)


def _parents(level: list[bytes], node_prefix: bytes) -> list[bytes]:
    """Pair left-to-right. An odd last node is promoted unchanged — never duplicated."""
    out: list[bytes] = []
    i = 0
    n = len(level)
    while i < n:
        if i + 1 == n:
            out.append(level[i])
        else:
            out.append(node_hash(level[i], level[i + 1], node_prefix))
        i += 2
    return out


def merkle_root(blobs: list[bytes], leaf_prefix: bytes, node_prefix: bytes) -> bytes:
    """Root of a positional tree. One leaf => root is that leaf hash. Empty list raises ValueError."""
    if not blobs:
        raise ValueError("merkle_root: empty leaf list has no root (refusing a silent zero hash)")
    level = [leaf_hash(blob, leaf_prefix) for blob in blobs]
    while len(level) > 1:
        level = _parents(level, node_prefix)
    return level[0]


def merkle_proof(
    blobs: list[bytes],
    index: int,
    leaf_prefix: bytes,
    node_prefix: bytes,
) -> list[tuple[str, str]]:
    """Proof as (side, hex32) pairs. side is where the neighbour sits: L left, R right."""
    if not blobs:
        raise ValueError("merkle_proof: empty leaf list has no proof (refusing a silent zero hash)")
    if not _is_int(index) or index < 0 or index >= len(blobs):
        raise ValueError(f"merkle_proof: index {index!r} out of range for {len(blobs)} leaves")
    level = [leaf_hash(blob, leaf_prefix) for blob in blobs]
    proof: list[tuple[str, str]] = []
    idx = index
    while len(level) > 1:
        if idx % 2 == 1:
            proof.append(("L", level[idx - 1].hex()))
        elif idx + 1 < len(level):
            proof.append(("R", level[idx + 1].hex()))
        idx = idx // 2
        level = _parents(level, node_prefix)
    return proof


def verify_proof(
    blob: bytes,
    proof: list[tuple[str, str]],
    root: bytes,
    leaf_prefix: bytes,
    node_prefix: bytes,
) -> bool:
    """Recompute the root from blob + proof. False on a bad side, bad hex, or mismatch."""
    acc = leaf_hash(blob, leaf_prefix)
    for item in proof:
        if type(item) is not tuple or len(item) != 2:
            return False
        side, hx = item
        if side not in ("L", "R") or not _is_str(hx):
            return False
        try:
            neigh = bytes.fromhex(hx)
        except ValueError:
            return False
        if len(neigh) != 32:
            return False
        if side == "L":
            acc = node_hash(neigh, acc, node_prefix)
        else:
            acc = node_hash(acc, neigh, node_prefix)
    return acc == root


def _as_object(value: object, label: str) -> dict:
    if _is_dict(value):
        return value
    if isinstance(value, (bytes, bytearray)):
        parsed = json.loads(bytes(value))
        if not _is_dict(parsed):
            raise ValueError(f"batch_leaves: {label} bytes are not an object")
        return parsed
    raise TypeError(f"batch_leaves: {label} must be dict or canonical bytes")


def _as_blob(value: object, label: str) -> bytes:
    if isinstance(value, (bytes, bytearray)):
        return bytes(value)
    if _is_dict(value):
        return canonical(value)
    raise TypeError(f"batch_leaves: {label} must be dict or canonical bytes")


def batch_leaves(ticks: list[dict]) -> list[bytes]:
    """Deterministic leaf bytes for a minute-batch.

    Sort ticks by (city_id UTF-8 bytes, tick_index). Inside a tick the header is
    leaf 0; records follow sorted by agent_id UTF-8 bytes. Input shuffle cannot
    change the concatenated leaf sequence: the order is a function of ids, not
    of arrival.
    """
    prepared: list[tuple[bytes, int, bytes, list[bytes]]] = []
    for i, tick in enumerate(ticks):
        if not _is_dict(tick):
            raise TypeError(f"batch_leaves: tick {i} is not a dict")
        if "header" not in tick or "records" not in tick:
            raise ValueError(f"batch_leaves: tick {i} needs header and records")
        header_obj = _as_object(tick["header"], f"tick {i} header")
        if "city_id" not in header_obj or "tick_index" not in header_obj:
            raise ValueError(f"batch_leaves: tick {i} header missing city_id or tick_index")
        if not _is_str(header_obj["city_id"]) or not _is_int(header_obj["tick_index"]):
            raise ValueError(f"batch_leaves: tick {i} city_id must be str and tick_index int")
        rec_rows: list[tuple[bytes, bytes]] = []
        records = tick["records"]
        if type(records) is not list:
            raise TypeError(f"batch_leaves: tick {i} records must be a list")
        for j, rec in enumerate(records):
            rec_obj = _as_object(rec, f"tick {i} record {j}")
            if "agent_id" not in rec_obj or not _is_str(rec_obj["agent_id"]):
                raise ValueError(f"batch_leaves: tick {i} record {j} missing agent_id str")
            rec_rows.append((rec_obj["agent_id"].encode("utf-8"), _as_blob(rec, f"tick {i} record {j}")))
        rec_rows.sort(key=lambda row: row[0])
        prepared.append(
            (
                header_obj["city_id"].encode("utf-8"),
                header_obj["tick_index"],
                _as_blob(tick["header"], f"tick {i} header"),
                [blob for _aid, blob in rec_rows],
            )
        )
    prepared.sort(key=lambda row: (row[0], row[1]))
    leaves: list[bytes] = []
    for _cid, _idx, header_blob, rec_blobs in prepared:
        leaves.append(header_blob)
        leaves.extend(rec_blobs)
    return leaves


def _sample_spec() -> dict:
    return {
        "layout_version": 1,
        "fields": {
            "layout_version": {"type": "int"},
            "city_id": {"type": "str"},
            "tick_index": {"type": "int"},
            "agent_id": {"type": "str"},
            "reason": {"type": "str"},
            "output": {"type": "int"},
            "payroll_ratio_bps": {"type": "int", "unit": "bps"},
            "inputs": {
                "type": "object",
                "of": {
                    "compute": {"type": "int"},
                    "energy": {"type": "int"},
                    "materials": {"type": "int"},
                },
            },
        },
    }


def _sample_header_spec() -> dict:
    return {
        "layout_version": 1,
        "fields": {
            "layout_version": {"type": "int"},
            "city_id": {"type": "str"},
            "tick_index": {"type": "int"},
            "pack_hash": {"type": "str"},
        },
    }


def _good_record() -> dict:
    return {
        "layout_version": 1,
        "city_id": "city-a",
        "tick_index": 3,
        "agent_id": "agent-1",
        "reason": "",
        "output": 40,
        "payroll_ratio_bps": 10000,
        "inputs": {"compute": 1, "energy": 2, "materials": 0},
    }


def _check_key_permutation() -> str | None:
    spec = _sample_spec()
    rec_a = _good_record()
    rec_b = {
        "inputs": {"materials": 0, "energy": 2, "compute": 1},
        "payroll_ratio_bps": 10000,
        "output": 40,
        "reason": "",
        "agent_id": "agent-1",
        "tick_index": 3,
        "city_id": "city-a",
        "layout_version": 1,
    }
    if encode_record(rec_a, spec) != encode_record(rec_b, spec):
        return "key permutation changed record bytes"
    hdr_spec = _sample_header_spec()
    hdr_a = {"layout_version": 1, "city_id": "city-a", "tick_index": 3, "pack_hash": "ab"}
    hdr_b = {"pack_hash": "ab", "tick_index": 3, "city_id": "city-a", "layout_version": 1}
    if encode_header(hdr_a, hdr_spec) != encode_header(hdr_b, hdr_spec):
        return "key permutation changed header bytes"
    return None


def _check_none_reason() -> str | None:
    rec = _good_record()
    rec["reason"] = None
    errors = validate_record(rec, _sample_spec())
    if not errors:
        return "None in reason was accepted"
    try:
        encode_record(rec, _sample_spec())
    except ValueError:
        return None
    return "None in reason encoded instead of raising"


def _check_bool_int() -> str | None:
    rec = _good_record()
    rec["output"] = True
    errors = validate_record(rec, _sample_spec())
    if not errors:
        return "True in int field was accepted"
    return None


def _check_float_int() -> str | None:
    rec = _good_record()
    rec["output"] = 1.0
    errors = validate_record(rec, _sample_spec())
    if not errors:
        return "1.0 in int field was accepted"
    return None


def _check_extra_missing() -> str | None:
    spec = _sample_spec()
    extra = _good_record()
    extra["foo"] = 1
    if not validate_record(extra, spec):
        return "extra field was accepted"
    missing = _good_record()
    del missing["reason"]
    if not validate_record(missing, spec):
        return "missing field was accepted"
    hdr_spec = _sample_header_spec()
    hdr = {"layout_version": 1, "city_id": "c", "tick_index": 0, "pack_hash": "", "nope": 1}
    if not validate_header(hdr, hdr_spec):
        return "extra header field was accepted"
    hdr_miss = {"layout_version": 1, "city_id": "c", "tick_index": 0}
    if not validate_header(hdr_miss, hdr_spec):
        return "missing header field was accepted"
    return None


def _tree_blobs(n: int) -> list[bytes]:
    return [f"leaf-{i}".encode("utf-8") for i in range(n)]


def _check_trees() -> str | None:
    leaf_p = bytes([10])
    node_p = bytes([11])
    for n in (1, 2, 3, 5, 7, 8):
        blobs = _tree_blobs(n)
        root_a = merkle_root(blobs, leaf_p, node_p)
        root_b = merkle_root(list(blobs), leaf_p, node_p)
        if root_a != root_b or len(root_a) != 32:
            return f"n={n}: root unstable or not 32 bytes"
        if n == 1 and root_a != leaf_hash(blobs[0], leaf_p):
            return "n=1: root != leaf hash"
        if n == 2:
            left = leaf_hash(blobs[0], leaf_p)
            right = leaf_hash(blobs[1], leaf_p)
            if root_a != node_hash(left, right, node_p):
                return "n=2: root != positional node(left, right)"
            if node_hash(left, right, node_p) == node_hash(right, left, node_p):
                return "n=2: pair hash ignored position"
        for i, blob in enumerate(blobs):
            proof = merkle_proof(blobs, i, leaf_p, node_p)
            if not verify_proof(blob, proof, root_a, leaf_p, node_p):
                return f"n={n} index={i}: proof did not verify"
    return None


def _check_corrupt_leaf() -> str | None:
    leaf_p = bytes([10])
    node_p = bytes([11])
    blobs = _tree_blobs(2)
    root = merkle_root(blobs, leaf_p, node_p)
    proof = merkle_proof(blobs, 0, leaf_p, node_p)
    ruined = bytearray(blobs[0])
    ruined[0] ^= 1
    if verify_proof(bytes(ruined), proof, root, leaf_p, node_p):
        return "corrupted leaf still verified"
    return None


def _check_side_swap() -> str | None:
    leaf_p = bytes([10])
    node_p = bytes([11])
    blobs = _tree_blobs(2)
    root = merkle_root(blobs, leaf_p, node_p)
    proof = merkle_proof(blobs, 0, leaf_p, node_p)
    if not proof:
        return "two-leaf proof was empty"
    flipped: list[tuple[str, str]] = []
    for side, hx in proof:
        flipped.append(("R" if side == "L" else "L", hx))
    if verify_proof(blobs[0], flipped, root, leaf_p, node_p):
        return "L-R swapped proof still verified"
    return None


def _check_domain_mix() -> str | None:
    leaf_p = bytes([10])
    node_p = bytes([11])
    left = leaf_hash(b"alpha", leaf_p)
    right = leaf_hash(b"beta", leaf_p)
    real_node = node_hash(left, right, node_p)
    fake_leaf = leaf_hash(left + right, leaf_p)
    if real_node == fake_leaf:
        return "domain mix: leaf(prefix || H || H) collided with node"
    return None


def _check_duplication() -> str | None:
    leaf_p = bytes([10])
    node_p = bytes([11])
    three = [b"a", b"b", b"c"]
    four = [b"a", b"b", b"c", b"c"]
    if merkle_root(three, leaf_p, node_p) == merkle_root(four, leaf_p, node_p):
        return "duplication: 3 leaves matched 4 with last duplicated"
    return None


def _check_batch_shuffle() -> str | None:
    ticks = [
        {
            "header": {"layout_version": 1, "city_id": "beta", "tick_index": 2, "pack_hash": "x"},
            "records": [
                {"agent_id": "zulu", "output": 1},
                {"agent_id": "able", "output": 2},
            ],
        },
        {
            "header": {"layout_version": 1, "city_id": "alpha", "tick_index": 1, "pack_hash": "y"},
            "records": [{"agent_id": "mike", "output": 3}],
        },
    ]
    shuffled = [
        {
            "header": ticks[1]["header"],
            "records": list(ticks[1]["records"]),
        },
        {
            "header": ticks[0]["header"],
            "records": list(reversed(list(ticks[0]["records"]))),
        },
    ]
    leaf_p = bytes([10])
    node_p = bytes([11])
    a = merkle_root(batch_leaves(ticks), leaf_p, node_p)
    b = merkle_root(batch_leaves(shuffled), leaf_p, node_p)
    if a != b:
        return "batch_leaves shuffle changed the merkle root"
    expected_ids = [b"alpha", b"mike", b"beta", b"able", b"zulu"]
    got = []
    for blob in batch_leaves(ticks):
        obj = json.loads(blob)
        if "pack_hash" in obj:
            got.append(obj["city_id"].encode("utf-8"))
        else:
            got.append(obj["agent_id"].encode("utf-8"))
    if got != expected_ids:
        return f"batch leaf order {got!r} != {expected_ids!r}"
    return None


def _check_empty_tree() -> str | None:
    leaf_p = bytes([10])
    node_p = bytes([11])
    try:
        merkle_root([], leaf_p, node_p)
    except ValueError:
        pass
    else:
        return "empty merkle_root did not raise ValueError"
    try:
        merkle_proof([], 0, leaf_p, node_p)
    except ValueError:
        return None
    return "empty merkle_proof did not raise ValueError"


_CHECKS: tuple[tuple[str, object], ...] = (
    ("key_permutation", _check_key_permutation),
    ("none_reason", _check_none_reason),
    ("bool_int", _check_bool_int),
    ("float_int", _check_float_int),
    ("extra_missing", _check_extra_missing),
    ("trees", _check_trees),
    ("corrupt_leaf", _check_corrupt_leaf),
    ("side_swap", _check_side_swap),
    ("domain_mix", _check_domain_mix),
    ("duplication", _check_duplication),
    ("batch_shuffle", _check_batch_shuffle),
    ("empty_tree", _check_empty_tree),
)


def selftest() -> list[str]:
    """Run the twelve probes. Each must fail on the planted bad input. Empty list = all held."""
    misses: list[str] = []
    for name, fn in _CHECKS:
        try:
            err = fn()
        except Exception as exc:
            err = f"raised {type(exc).__name__}: {exc}"
        if err:
            misses.append(f"{name}: {err}")
    return misses


def main() -> int:
    misses = selftest()
    print(f"record selftest: {len(_CHECKS)} checks, {len(misses)} failures")
    for row in misses:
        print(row)
    return 1 if misses else 0


if __name__ == "__main__":
    sys.exit(main())
