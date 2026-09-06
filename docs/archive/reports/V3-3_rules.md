# V3-3 rules

| id | что ловит | вход падения |
|---|---|---|
| L370 | нет восьми `visual3_*`; CT engine/assets/light ≠ пробам этапа; nonempty CT позднего ключа; минор < 22 | снят `visual3_form`; ghost; CT ghost/пуст у light; `rules_version` 0.21.0 |
| L372 | `--jobs 8` в `gate_cmd` V3-1…V3-6; engine без L371/L373; assets без L374/L375; light без L376/L377 | `--jobs 8` на engine или light; stub `--only L370` на light |
| L376 | нет `sun_*`/`ambient` в фазах; day elevation/intensity ≤ night; `sun_distance_tiles`≤0; нет `sunPose`/`sunDir`/`DirectionalLight`; `void cityTime`; Date в sun/three | invert elevation; invert intensity; distance=0; overlay `void cityTime`; `Date.now` в `sun.ts` |
| L377 | нет Lambert; есть `MeshBasicMaterial`; нет `emissiveIntensity` / window/sign; `NdotL`/`baked sun` в heroes.py; day `lights`≠0 | MeshBasic на острове; нет `"window"`; NdotL overlay; day lights=1 |
| `visual3_sun_from_city_time` | поза от `city_time`; gate не stub | invert elevation → L376; `void cityTime` → L376; stub light gate → L372 |
| `visual3_windows_emissive` | window/sign emissive; day гасит неон | нет window в heroes.py → L377 |
| `visual3_no_baked_sun` | Lambert; нет baked sun | MeshBasic / NdotL → L377 |

L328 в линтере нет (R-V-8). `prize_live_min_rules_minor` 19. Правил 375.
