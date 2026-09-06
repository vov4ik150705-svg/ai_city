"""M5 prize treasury and vault safety. No I/O.

Settled/unsettled live on the prize kettle. pool_in is a recorded measurement,
never an accumulator (PLAN_MONEY §15 D-M-13/D-M-14, L287–L289, L297–L301, L303).
"""

from __future__ import annotations

import seasons

KETTLE_FARM = "farm"
KETTLE_MONTH = "month"
KETTLES = (KETTLE_FARM, KETTLE_MONTH)
RETURN_FN = "returnUnsettled"
REFUND_FN = "refundPlayer"
POOL_IN_MEASURED = "measured"
DRAIN_FORBIDDEN = ("vault", "fund", "reserve", "fragments")
PORT_GROUPS = (
    "corp_token",
    "vault",
    "stake_registry",
    "merkle_roots",
    "prize_treasury",
)
CODE_UNSETTLED = "PRIZE_UNSETTLED_RETURNED"
CODE_UNCOVERED = "PRIZE_CLAIM_UNCOVERED"
WITNESS_UNSLICED = 1000
WITNESS_SETTLED = 700
WITNESS_PLAYER_BACKING = 100
WITNESS_BOT_BACKING = 40
WITNESS_RESERVE = 60

PROXY_RE = ("delegatecall", "DelegateCall", "upgradeTo", "transparent proxy")


def _custody(data: dict) -> dict:
    return (data.get("arch") or {}).get("custody") or {}


def kettles(data: dict) -> list[str]:
    raw = _custody(data).get("kettles")
    if isinstance(raw, list) and raw:
        return [str(x) for x in raw]
    return list(KETTLES)


def pool_in_kind(data: dict) -> str:
    return str(_custody(data).get("pool_in") or "")


def drain_forbidden(data: dict) -> list[str]:
    raw = _custody(data).get("drain_forbidden")
    if isinstance(raw, list) and raw:
        return [str(x) for x in raw]
    return list(DRAIN_FORBIDDEN)


def port_groups(data: dict) -> list[str]:
    groups = ((data.get("arch") or {}).get("port") or {}).get("groups") or {}
    return list(groups)


def return_unsettled(unsliced: int, owed: dict[str, int]) -> dict[str, int]:
    """Bot takes unsliced only. Player rows stay. docs/PRIZES.md §6.5."""
    kept = {k: int(v) for k, v in owed.items()}
    return {"to_bot": int(unsliced), "owed_sum": sum(kept.values()), "owed": kept}


def return_unsettled_attack(unsliced: int, owed: dict[str, int], eat_settled: bool) -> dict[str, int]:
    kept = {k: int(v) for k, v in owed.items()}
    to_bot = int(unsliced)
    if eat_settled:
        to_bot += sum(kept.values())
        kept = {k: 0 for k in kept}
    return {"to_bot": to_bot, "owed_sum": sum(kept.values()), "owed": kept}


def claim_prize(
    *,
    owed: int,
    pool_in: int,
    paused: bool,
    demo: bool,
    honor_pause: bool = True,
) -> dict[str, object]:
    if demo:
        return {"paid": 0, "code": seasons.CODE_DEMO_NO_PRIZE}
    if paused and honor_pause:
        return {"paid": 0, "code": ""}
    if int(pool_in) < int(owed):
        return {"paid": 0, "code": CODE_UNCOVERED, "owed": int(owed), "asset_pool": int(pool_in)}
    return {"paid": int(owed), "code": ""}


def refund_player(
    *,
    backing: int,
    amount: int,
    capital: int,
    anchor: int,
    corp_in_vault: int,
    total_backing: int,
) -> dict[str, object]:
    if int(amount) > int(backing) or int(amount) <= 0:
        return {"ok": 0, "reason": "over_backing"}
    if int(amount) > int(corp_in_vault):
        return {"ok": 0, "reason": "over_vault"}
    reserve = int(corp_in_vault) - int(total_backing)
    if reserve < 0:
        reserve = 0
    if int(total_backing) - int(amount) < 0:
        return {"ok": 0, "reason": "over_total_backing"}
    new_backing = int(backing) - int(amount)
    cap = new_backing * int(anchor)
    new_capital = int(capital) if int(capital) <= cap else cap
    return {
        "ok": 1,
        "paid": int(amount),
        "backing": new_backing,
        "capital": new_capital,
        "reserve": reserve,
        "corp_left": int(corp_in_vault) - int(amount),
    }


def _sol_bodies(data: dict) -> dict[str, str]:
    overlay = data.get("_sol_source")
    if isinstance(overlay, dict):
        return {str(k).replace("\\", "/"): str(v) for k, v in overlay.items()}
    try:
        import lint

        return {n: b for n, b in lint._sol_src_files(data)}
    except Exception:
        return {}


def _has_proxy(body: str) -> bool:
    low = body.lower()
    return any(p.lower() in low for p in PROXY_RE)


def safety_witness(data: dict) -> dict[str, object]:
    groups = port_groups(data)
    forbidden = drain_forbidden(data)
    owed = {"player": WITNESS_SETTLED}
    eat = bool((data.get("arch") or {}).get("treasury_return_settled"))
    ret_before = return_unsettled_attack(WITNESS_UNSLICED, {}, False)
    ret_after = return_unsettled_attack(
        WITNESS_UNSLICED - WITNESS_SETTLED, owed, eat
    )
    honor_pause = not bool((data.get("arch") or {}).get("treasury_claim_when_paused"))
    claimed = claim_prize(
        owed=WITNESS_SETTLED,
        pool_in=WITNESS_SETTLED,
        paused=True,
        demo=False,
        honor_pause=honor_pause,
    )
    uncovered = claim_prize(owed=50, pool_in=0, paused=False, demo=False)
    total_backing = WITNESS_PLAYER_BACKING + WITNESS_BOT_BACKING
    corp_in = total_backing + WITNESS_RESERVE
    player_ok = refund_player(
        backing=WITNESS_PLAYER_BACKING,
        amount=WITNESS_PLAYER_BACKING,
        capital=WITNESS_PLAYER_BACKING * 2,
        anchor=2000,
        corp_in_vault=corp_in,
        total_backing=total_backing,
    )
    over = refund_player(
        backing=WITNESS_PLAYER_BACKING,
        amount=WITNESS_PLAYER_BACKING + 1,
        capital=1,
        anchor=2000,
        corp_in_vault=corp_in,
        total_backing=total_backing,
    )
    bot_all = refund_player(
        backing=WITNESS_BOT_BACKING,
        amount=corp_in,
        capital=1,
        anchor=2000,
        corp_in_vault=corp_in,
        total_backing=total_backing,
    )
    bot_ok = refund_player(
        backing=WITNESS_BOT_BACKING,
        amount=WITNESS_BOT_BACKING,
        capital=WITNESS_BOT_BACKING,
        anchor=2000,
        corp_in_vault=corp_in,
        total_backing=total_backing,
    )
    files = _sol_bodies(data)
    vault = files.get("Vault.sol") or ""
    treas = files.get("PrizeTreasury.sol") or ""
    all_sol = "\n".join(files.values())
    keys = (data.get("arch") or {}).get("keys") or {}
    codes = ((data.get("codes") or {}).get("codes") or {})
    return {
        "groups_n": len(groups),
        "groups_ok": 1 if list(groups) == list(PORT_GROUPS) or set(groups) == set(PORT_GROUPS) else 0,
        "kettles": ",".join(kettles(data)),
        "kettles_ok": 1 if tuple(kettles(data)) == KETTLES else 0,
        "pool_in_measured": 1 if pool_in_kind(data) == POOL_IN_MEASURED else 0,
        "forbidden_ok": 1 if tuple(forbidden) == DRAIN_FORBIDDEN else 0,
        "return_before": ret_before["to_bot"],
        "return_after": ret_after["to_bot"],
        "settled_kept": ret_after["owed_sum"],
        "return_skips_settled": 1 if ret_after["owed_sum"] == WITNESS_SETTLED and not eat else 0,
        "paused_claim_paid": int(claimed["paid"] or 0),
        "paused_claim_silent": 1 if int(claimed["paid"] or 0) == 0 and (claimed.get("code") or "") == "" else 0,
        "uncovered_code": uncovered.get("code") or "",
        "uncovered_ok": 1 if uncovered.get("code") == CODE_UNCOVERED else 0,
        "player_refund_ok": int(player_ok.get("ok") or 0),
        "over_backing_rejected": 1 if int(over.get("ok") or 0) == 0 else 0,
        "bot_whole_rejected": 1 if int(bot_all.get("ok") or 0) == 0 else 0,
        "bot_own_ok": int(bot_ok.get("ok") or 0),
        "reserve_left": int(bot_ok.get("reserve") or 0),
        "has_returnUnsettled": 1 if "function returnUnsettled" in treas else 0,
        "has_refundPlayer": 1 if "function refundPlayer" in vault else 0,
        "has_refundRoot": 1 if "refundRoot" in vault else 0,
        "has_setSigner": 1 if "function setSigner" in all_sol else 0,
        "has_proposeSigner": 1 if "function proposeSigner" in vault and "function proposeSigner" in treas else 0,
        "has_pauseReadyAt": 1 if "pauseReadyAt" in vault and "pauseReadyAt" in treas else 0,
        "guardian_ne_require": 1 if "guardian" in vault and "!=" in vault and "signer" in vault else 0,
        "proxy": 1 if _has_proxy(all_sol) else 0,
        "recover_in_vault": 1 if "function recoverWrongToken" in vault else 0,
        "recover_in_treasury": 1 if "function recoverWrongToken" in treas else 0,
        "treasury_refundPlayer": 1 if "function refundPlayer" in treas else 0,
        "code_unsettled": 1 if CODE_UNSETTLED in codes else 0,
        "code_uncovered": 1 if CODE_UNCOVERED in codes else 0,
        "keys_guardian": 1 if "guardian" in keys else 0,
        "keys_signer": 1 if "signer" in keys else 0,
        "keys_pending": 1 if "pending_signer" in keys else 0,
        "return_fn_ok": 1 if _custody(data).get("return_fn") == RETURN_FN else 0,
        "refund_fn_ok": 1 if _custody(data).get("refund_fn") == REFUND_FN else 0,
        "refund_root_flag": 1 if int(_custody(data).get("refund_root") or 0) == 1 else 0,
    }
