"""CIDv1 of a city-day aggregate. Codes come from attest.params.cid_*.

Payload is canonical JSON of {city_day, city_id, root}. Digest is sha256.
docs/TICK.md §9; DESIGN.md §6.2; PLAN_CODE R-C-6.
"""

from __future__ import annotations

import hashlib


def cid_v1(payload: bytes, version: int, codec: int, mh_code: int, mh_len: int) -> bytes:
    digest = hashlib.sha256(payload).digest()
    if len(digest) != mh_len:
        raise ValueError("cid mh_len does not match sha256 digest")
    return bytes([version, codec, mh_code, mh_len]) + digest


def cid_from_attest_params(payload: bytes, params: dict) -> bytes:
    version = int(params["cid_version"]["v"])
    codec = int(params["cid_codec"]["v"])
    mh_code = int(params["cid_mh_code"]["v"])
    mh_len = int(params["cid_mh_length"]["v"])
    return cid_v1(payload, version, codec, mh_code, mh_len)
