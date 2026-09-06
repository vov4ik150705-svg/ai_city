# R-V-48 rules

| id | ловит | вход падения |
|---|---|---|
| L359 | ширина > футпринт+overhang | `agent_hub.w=235` |
| L359 | кадр растянут относительно исходника | `agent_hub.h` ×2 при той же ширине |

Проба construction: `sprite_fits_footprint_width` (wide + stretch). Затронутые: L330 (байты атласа), L351 (GATE_VISUAL).
