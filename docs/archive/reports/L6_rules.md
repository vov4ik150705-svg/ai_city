# L6 — правила и пробы

| id | что ловит | вход падения |
|---|---|---|
| L39 | `S_min` в долларах; порог без снимка; снимок без `at`; атомы ≠ `target × 10^18 // answer`; нет тикера / лишний тикер; пустые feeds | `u: "usd"` / `usd_8dec`; `snapshot: null` при непустом `s_min`; `at` снят; NVDA `v+1`; нет COIN; `GOOGL`; `feeds={}` |
| `smin_frozen_in_tokens` | freeze без pending `district_stake_*`; шесть тикеров; `u: "tokens"`; формула снимка | пак 41 без `s_min` → `API_MALFORMED`; pending `district_stake_threshold` ещё открыт |

Атаки L39: `a_l39_s_min_without_snapshot`, `a_l39_s_min_in_dollars`, `a_l39_snapshot_without_at`, `a_l39_formula_drift`, `a_l39_missing_ticker`.

Vitest читает `content/params/pending.json` отдельно: pending не входит в хешируемый пак.
