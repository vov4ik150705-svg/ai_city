# V11 recon — `attest_live`

`launch.deployed` empty (token/curve/pool/hook/tx). P7 not started. V10 closed: pack 80, hash `e5a1e96cbbd54c7400529201826b2185018a4a6156a5411758c9708bda92d3cd`, lint 354/0, round 1445 / entry 200 / exit 910, `missions_live=0`, NFT cranes 0, `companion_revenue_live=0`.

## Tree

- `tick_host.ts` COMMIT then `void attestor` — submit never runs. `services_do_not_block_tick` asserts `called === false`.
- Attestor computes root/CID locally; `drainRootOutbox` retries `putRoot`; `main.ts` is ready-only. No IPFS port.
- `MerkleRootsPort` mock+rpc already round-trips `getRoot`. Env name `CORPORATOR_MERKLE_ROOTS` exists in `readPlayerReady`. No hex in src.
- HUD log has no badge. `log.events` projects `{}`.
- `attest_live` stub: `gate_cmd` only L221, `construction_tests` empty. L349/L350 absent from RULES.
- **R-V-5 unanswered.** No testnet name, RPC, MerkleRoots deploy, attestor key, or IPFS pin. Do not invent.

## This step

Wire submit after COMMIT (fail-open); IPFS port mock+http; badge `logged`/`verified`/`degraded` only from server; L349/L350; probes `verified_badge_needs_root_and_cid`, `attest_failure_keeps_payout`; mock `getRoot` roundtrip. Live testnet `getRoot` stays owner (R-V-5). No `--jobs 8`, no `sim.py`, no P7, `missions_live` stays 0.
