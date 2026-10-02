"""One-way codegen from the pack. Hand edits are a gate failure.

    python content/codegen.py
    python content/codegen.py --check

Artifact set equals arch.codegen. Header: GENERATED from pack <hash>; do not edit.
docs/ARCHITECTURE.md §4; PLAN_CODE D-C-7, D-C-8.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import arch
import build
from pack import REPO, schema

BANNER_TS = "/* GENERATED from pack {hash}; do not edit */\n"
BANNER_SQL = "-- GENERATED from pack {hash}; do not edit\n"
BANNER_HASH = "# GENERATED from pack {hash}; do not edit\n"


def banner(pack_hash: str, kind: str) -> str:
    if kind == "sql":
        return BANNER_SQL.format(hash=pack_hash)
    if kind == "hash":
        return BANNER_HASH.format(hash=pack_hash)
    return BANNER_TS.format(hash=pack_hash)


def _ts_const_keys(keys: list[str]) -> str:
    lines = ["{"]
    for key in keys:
        lines.append(f"  {key}: {json.dumps(key, ensure_ascii=False)},")
    lines.append("} as const;")
    return "\n".join(lines)


def _ts_string_array(values: list[str]) -> str:
    inner = ", ".join(json.dumps(v, ensure_ascii=False) for v in values)
    return f"[{inner}] as const;"


def emit_codes(pack: dict) -> str:
    codes = list(((pack["sections"].get("codes") or {}).get("codes") or {}).keys())
    http_map = arch.transport_http_map(pack["sections"])
    lines = [
        banner(pack["hash"], "ts"),
        "export const codes = " + _ts_const_keys(codes),
        "export type CodeId = keyof typeof codes;",
        "export const transportHttp = {",
    ]
    for cid in sorted(http_map):
        val = http_map[cid]
        if not isinstance(val, int):
            continue
        lines.append(f"  {cid}: {val}n,")
    lines.append("} as const;")
    return "\n".join(lines) + "\n"


def emit_screens(pack: dict) -> str:
    screens = list(((pack["sections"].get("screens") or {}).get("screens") or {}).keys())
    return (
        banner(pack["hash"], "ts")
        + "export const screens = "
        + _ts_const_keys(screens)
        + "\nexport type ScreenId = keyof typeof screens;\n"
    )


def emit_modifier_keys(pack: dict) -> str:
    keys = list(((pack["sections"].get("modifier_keys") or {}).get("keys") or {}).keys())
    return (
        banner(pack["hash"], "ts")
        + "export const modifierKeys = "
        + _ts_const_keys(keys)
        + "\nexport type ModifierKeyId = keyof typeof modifierKeys;\n"
    )


def emit_districts(pack: dict) -> str:
    keys = list(((pack["sections"].get("districts") or {}).get("districts") or {}).keys())
    return (
        banner(pack["hash"], "ts")
        + "export const districts = "
        + _ts_const_keys(keys)
        + "\nexport type DistrictId = keyof typeof districts;\n"
    )


def emit_buildings(pack: dict) -> str:
    keys = list(((pack["sections"].get("buildings") or {}).get("buildings") or {}).keys())
    return (
        banner(pack["hash"], "ts")
        + "export const buildings = "
        + _ts_const_keys(keys)
        + "\nexport type BuildingId = keyof typeof buildings;\n"
    )


def emit_units_for(pack: dict) -> str:
    units = list(((schema().get("$defs") or {}).get("unit") or {}).get("enum") or [])
    return (
        banner(pack["hash"], "ts")
        + "export const units = "
        + _ts_string_array([str(u) for u in units])
        + "\nexport type UnitId = (typeof units)[number];\n"
    )


def emit_versions(pack: dict) -> str:
    meta = pack["sections"]["meta"]
    rules = str(meta.get("rules_version") or "")
    version = int(meta.get("pack_version") or 0)
    return (
        banner(pack["hash"], "ts")
        + f"export const rulesVersion = {json.dumps(rules)};\n"
        + f"export const packVersion = {version}n;\n"
        + f"export const packHash = {json.dumps(pack['hash'])};\n"
        + f"export const layoutVersion = {int(((pack['sections'].get('tick') or {}).get('params') or {}).get('layout_version', {}).get('v') or 0)}n;\n"
    )


def emit_schema_ddl(pack: dict) -> str:
    tables = (pack["sections"].get("arch") or {}).get("schema_tables") or {}
    lines = [banner(pack["hash"], "sql")]
    for tid, spec in tables.items():
        key = spec.get("key") or "id"
        cols = [
            "  id TEXT NOT NULL",
            "  payload BYTEA NOT NULL",
            "  payload_hash TEXT NOT NULL",
        ]
        if int(spec.get("account_kind") or 0) == 1:
            cols.append("  account_kind TEXT NOT NULL CHECK (account_kind IN ('demo','wallet'))")
        lines.append(f"-- key {key}")
        lines.append(f"CREATE TABLE IF NOT EXISTS {tid} (")
        lines.append(",\n".join(cols) + ",\n  PRIMARY KEY (id)")
        lines.append(");")
        if int(spec.get("money") or 0) == 1:
            lines.append(f"-- {tid}: money=1; writer is services/api")
        lines.append("")
    edges = list((pack["sections"].get("arch") or {}).get("demo_transfer_edges") or [])
    lines.append("-- demo_transfer_edges drives the demo-wallet barrier; empty means same-kind only")
    lines.append("CREATE TABLE IF NOT EXISTS demo_wallet_transfers (")
    lines.append("  id TEXT NOT NULL,")
    lines.append("  from_kind TEXT NOT NULL CHECK (from_kind IN ('demo','wallet')),")
    lines.append("  to_kind TEXT NOT NULL CHECK (to_kind IN ('demo','wallet')),")
    if not edges:
        lines.append("  CONSTRAINT demo_wallet_barrier CHECK (from_kind = to_kind),")
    lines.append("  PRIMARY KEY (id)")
    lines.append(");")
    lines.append("")
    return "\n".join(lines)


def emit_command_routes(pack: dict) -> str:
    endpoints = list((pack["generated"].get("arch") or {}).get("command_endpoints") or [])
    http_map = arch.transport_http_map(pack["sections"])
    lines = [
        banner(pack["hash"], "ts"),
        "export const commandRoutes = " + _ts_string_array(endpoints),
        "export const transportHttp = {",
    ]
    for cid in sorted(http_map):
        val = http_map[cid]
        if isinstance(val, int):
            lines.append(f"  {cid}: {val}n,")
    lines.append("} as const;")
    domain = int(
        (((pack["sections"].get("api") or {}).get("params") or {}).get("domain_conflict_http") or {}).get(
            "v"
        )
        or 0
    )
    lines.append(f"export const domainConflictHttp = {domain}n;")
    return "\n".join(lines) + "\n"


def emit_layer_cruiser(pack: dict) -> str:
    packages = (pack["sections"].get("arch") or {}).get("packages") or {}
    rules = []
    for pid, spec in packages.items():
        path = str(spec.get("path") or "").replace("\\", "/")
        src = f"^{path}/src"
        allowed: list[str] = []
        for d in spec.get("allowed_deps") or []:
            if d not in packages:
                continue
            dep_path = str(packages[d]["path"]).replace("\\", "/")
            allowed.append(dep_path)
            allowed.append(f"@corporator/{d}")
        allowed.append(path)
        allowed.append(f"@corporator/{pid}")
        path_not = "^(" + "|".join(p.replace("\\", "/") for p in allowed) + ")"
        rules.append(
            {
                "name": f"layer-{pid}",
                "comment": f"{pid} may import only allowed_deps from arch.packages",
                "severity": "error",
                "from": {"path": src},
                "to": {
                    "path": "(^(packages|apps|services)/|^@corporator/)",
                    "pathNot": path_not,
                },
            }
        )
    config = {
        "forbidden": rules,
        "options": {
            "doNotFollow": {"path": "node_modules"},
            "tsPreCompilationDeps": True,
        },
    }
    body = json.dumps(config, indent=2, ensure_ascii=False)
    return banner(pack["hash"], "cjs") + "module.exports = " + body + ";\n"


def emit_ws_channels(pack: dict) -> str:
    ch_map = (pack["generated"].get("arch") or {}).get("channel_map") or {}
    lines = [banner(pack["hash"], "ts"), "export const channelMap = {"]
    for sid in sorted(ch_map):
        lines.append(f"  {json.dumps(sid)}: {json.dumps(ch_map[sid])},")
    lines.append("} as const;")
    lines.append("export type StateSourceId = keyof typeof channelMap;")
    return "\n".join(lines) + "\n"


def _entrypoint_service_ids(arch: dict) -> list[str]:
    packages = arch.get("packages") or {}
    return sorted(
        str(pid)
        for pid, spec in packages.items()
        if spec.get("root") == "services" and int(spec.get("entrypoint") or 0) == 1
    )


def emit_listen(pack: dict) -> str:
    listen = ((pack.get("sections") or {}).get("arch") or {}).get("listen") or {}
    paths = ((pack.get("sections") or {}).get("api") or {}).get("path_rules") or {}
    gen_api = (pack.get("generated") or {}).get("api") or {}
    bind = listen.get("bind") or ""
    ports = listen.get("ports") or {}
    ready = ((paths.get("ready") or {}).get("template")) or ""
    rating = ((paths.get("rating") or {}).get("template")) or ""
    ws_path = ((paths.get("ws") or {}).get("template")) or ""
    pack_path = ((paths.get("pack") or {}).get("template")) or ""
    state_path = ((paths.get("state") or {}).get("template")) or ""
    command_path = ((paths.get("command") or {}).get("template")) or ""
    auth_nonce = ((paths.get("auth_nonce") or {}).get("template")) or ""
    auth_session = ((paths.get("auth_session") or {}).get("template")) or ""
    session = ((pack.get("sections") or {}).get("arch") or {}).get("session") or {}
    message_fields = list(session.get("message_fields") or [])
    postgres = ((pack.get("sections") or {}).get("arch") or {}).get("postgres") or {}
    container_bind = listen.get("container_bind") or ""
    pg_major = str(
        ((((pack.get("sections") or {}).get("arch") or {}).get("toolchain") or {}).get("postgres") or {}).get(
            "version"
        )
        or ""
    )
    lines = [
        banner(pack["hash"], "ts").rstrip("\n"),
        f"export const listenBind = {json.dumps(bind)};",
        f"export const listenContainerBind = {json.dumps(container_bind)};",
        "export const listenPorts = {",
    ]
    for name in sorted(ports):
        lines.append(f"  {name}: {int(ports[name])}n,")
    lines.extend(
        [
            "} as const;",
            f"export const postgresPort = {int(postgres.get('port') or 0)}n;",
            f"export const postgresDatabase = {json.dumps(postgres.get('database') or '')};",
            f"export const postgresUser = {json.dumps(postgres.get('user') or '')};",
            f"export const postgresService = {json.dumps(postgres.get('service') or '')};",
            f"export const postgresPasswordEnv = {json.dumps(postgres.get('password_env') or '')};",
            f"export const postgresImageMajor = {json.dumps(pg_major)};",
            "export function listenBindOrEnv(raw: string | undefined): string {",
            "  if (raw !== undefined && raw.length > 0) return raw;",
            "  return listenBind;",
            "}",
            f"export const readyTemplate = {json.dumps(ready)};",
            f"export const ratingTemplate = {json.dumps(rating)};",
            f"export const packTemplate = {json.dumps(pack_path)};",
            f"export const stateTemplate = {json.dumps(state_path)};",
            f"export const commandTemplate = {json.dumps(command_path)};",
            f"export const authNonceTemplate = {json.dumps(auth_nonce)};",
            f"export const authSessionTemplate = {json.dumps(auth_session)};",
            f"export const sessionMessageFields = {_ts_string_array(message_fields)}",
            f"export const sessionDomain = {json.dumps(session.get('domain') or '')};",
            f"export const sessionHeader = {json.dumps(session.get('authorization_header') or '')};",
            f"export const sessionScheme = {json.dumps(session.get('authorization_scheme') or '')};",
            f"export const wsTemplate = {json.dumps(ws_path)};",
            f"export const wsHeartbeatMs = {int(gen_api.get('ws_heartbeat_ms') or 0)}n;",
            f"export const samplerPeriodMs = {int(gen_api.get('sampler_period_ms') or 0)}n;",
            f"export const tickLengthRealMs = {int(gen_api.get('tick_length_real_ms') or 0)}n;",
        ]
    )
    return "\n".join(lines) + "\n"


def emit_tsconfig_refs(pack: dict) -> str:
    packages = (pack["sections"].get("arch") or {}).get("packages") or {}
    order, _cycle = arch.topo_sort(arch.layer_graph(pack["sections"].get("arch") or {}))
    refs = []
    for pid in order or list(packages):
        spec = packages.get(pid) or {}
        path = str(spec.get("path") or "")
        if path:
            refs.append({"path": path})
    doc = {"files": [], "references": refs}
    return banner(pack["hash"], "jsonc") + json.dumps(doc, indent=2, ensure_ascii=False) + "\n"


def _node_major(pack: dict) -> str:
    engines = str(
        ((((pack.get("sections") or {}).get("arch") or {}).get("toolchain") or {}).get("node") or {}).get(
            "engines"
        )
        or ""
    )
    digits: list[str] = []
    for ch in engines:
        if ch.isdigit():
            digits.append(ch)
        elif digits:
            break
    return "".join(digits) if digits else "0"


def emit_dockerfile(pack: dict) -> str:
    major = _node_major(pack)
    tag = f"node:{major}-bookworm-slim"
    arch_sec = ((pack.get("sections") or {}).get("arch") or {})
    listen = arch_sec.get("listen") or {}
    api_port = int((listen.get("ports") or {}).get("api") or 0)
    container_bind = str(listen.get("container_bind") or "")
    services = _entrypoint_service_ids(arch_sec)
    pnpm_v = str(((arch_sec.get("toolchain") or {}).get("pnpm") or {}).get("version") or "")
    pack_rt = str((arch_sec.get("image") or {}).get("pack_runtime_path") or "pack.json")
    copies_rt = [
        f"COPY --from=build --chown=node:node /app/services/{sid}/dist ./services/{sid}/dist"
        for sid in services
    ]
    exposes = [f"EXPOSE {int((listen.get('ports') or {}).get(sid) or 0)}" for sid in services]
    lines = [
        banner(pack["hash"], "hash").rstrip("\n"),
        "ARG PACK_HASH",
        f"FROM {tag} AS build",
        "WORKDIR /app",
        f"ENV PACK_HASH=$PACK_HASH",
        "RUN corepack enable",
        f"RUN corepack prepare pnpm@{pnpm_v} --activate",
        "COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./",
        "COPY packages ./packages",
        "COPY services ./services",
        "COPY apps ./apps",
        f"COPY content/out/pack.json /app/{pack_rt}",
        "RUN pnpm install --frozen-lockfile",
        "RUN pnpm exec tsc -b",
        f"FROM {tag}",
        "ARG PACK_HASH",
        "ENV PACK_HASH=$PACK_HASH",
        f"ENV PACK_PATH=/app/{pack_rt}",
        f"ENV CORPORATOR_LISTEN_PORT={api_port}",
        f"ENV CORPORATOR_LISTEN_BIND={container_bind}",
        "WORKDIR /app",
        f"COPY --from=build --chown=node:node /app/{pack_rt} /app/{pack_rt}",
        *copies_rt,
        "COPY --from=build --chown=node:node /app/packages ./packages",
        "COPY --from=build --chown=node:node /app/node_modules ./node_modules",
        "COPY --from=build --chown=node:node /app/services/api/migrations ./services/api/migrations",
        "USER node",
        *exposes,
        'CMD ["node", "services/api/dist/main.js"]',
        "",
    ]
    return "\n".join(lines)


def _compose_healthcheck(user: str) -> list[str]:
    return [
        "    healthcheck:",
        f'      test: ["CMD-SHELL", "pg_isready -U {user}"]',
        "      interval: 5s",
        "      timeout: 5s",
        "      retries: 10",
    ]


def _compose_http_healthcheck(port: int, ready: str) -> list[str]:
    return [
        "    healthcheck:",
        f'      test: ["CMD", "node", "-e", "fetch(\'http://127.0.0.1:{port}{ready}\').then(r=>process.exit(r.ok?0:1))"]',
        "      interval: 5s",
        "      timeout: 5s",
        "      retries: 10",
    ]


def _compose_postgres(pack: dict, env_names: list[str]) -> list[str]:
    arch_sec = ((pack.get("sections") or {}).get("arch") or {})
    postgres = arch_sec.get("postgres") or {}
    pg_major = str(((arch_sec.get("toolchain") or {}).get("postgres") or {}).get("version") or "0")
    pg_name = str(postgres.get("service") or "")
    pg_port = int(postgres.get("port") or 0)
    user = str(postgres.get("user") or "")
    database = str(postgres.get("database") or "")
    password_env = str(postgres.get("password_env") or "")
    pg_image = f"postgres:{pg_major}"
    lines = [f"  {pg_name}:"]
    lines.append("    profiles:")
    for env in env_names:
        lines.append(f"      - {env}")
    lines.append(f"    image: {pg_image}")
    lines.append("    ports:")
    lines.append(f'      - "{pg_port}:{pg_port}"')
    lines.append("    environment:")
    lines.append(f"      POSTGRES_USER: {user}")
    lines.append(f"      POSTGRES_DB: {database}")
    lines.append(f"      POSTGRES_PASSWORD: ${{{password_env}}}")
    lines.append("    restart: unless-stopped")
    lines.extend(_compose_healthcheck(user))
    return lines


def emit_compose(pack: dict) -> str:
    arch_sec = ((pack.get("sections") or {}).get("arch") or {})
    listen = arch_sec.get("listen") or {}
    postgres = arch_sec.get("postgres") or {}
    ports = listen.get("ports") or {}
    container_bind = str(listen.get("container_bind") or "")
    env_names = sorted((arch_sec.get("environments") or {}).keys())
    mount_envs = [e for e in env_names if e != "prod"]
    services = _entrypoint_service_ids(arch_sec)
    node_major = _node_major(pack)
    pg_name = str(postgres.get("service") or "")
    pg_port = int(postgres.get("port") or 0)
    user = str(postgres.get("user") or "")
    database = str(postgres.get("database") or "")
    password_env = str(postgres.get("password_env") or "")
    node_image = f"node:{node_major}-bookworm-slim"
    dsn = f"postgres://{user}:${{{password_env}}}@{pg_name}:{pg_port}/{database}"
    lines = [banner(pack["hash"], "hash").rstrip("\n"), "services:"]
    lines.extend(_compose_postgres(pack, env_names))
    for sid in services:
        port = int(ports.get(sid) or 0)
        lines.append(f"  {sid}:")
        lines.append("    profiles:")
        for env in mount_envs:
            lines.append(f"      - {env}")
        lines.append(f"    image: {node_image}")
        lines.append("    working_dir: /app")
        lines.append("    volumes:")
        lines.append("      - ..:/app")
        lines.append(f'    command: ["node", "--experimental-strip-types", "services/{sid}/src/main.ts"]')
        lines.append("    environment:")
        lines.append("      PACK_HASH: ${PACK_HASH}")
        lines.append("      PACK_PATH: /app/content/out/pack.json")
        lines.append(f"      CORPORATOR_LISTEN_BIND: {json.dumps(container_bind)}")
        lines.append(f"      CORPORATOR_LISTEN_PORT: {json.dumps(str(port))}")
        if sid == "api" or sid == "sampler":
            lines.append(f"      DATABASE_URL: {dsn}")
        lines.append("    ports:")
        lines.append(f'      - "{port}:{port}"')
        lines.append("    depends_on:")
        lines.append(f"      {pg_name}:")
        lines.append("        condition: service_healthy")
    lines.append("")
    return "\n".join(lines)


def emit_compose_prod(pack: dict) -> str:
    arch_sec = ((pack.get("sections") or {}).get("arch") or {})
    listen = arch_sec.get("listen") or {}
    postgres = arch_sec.get("postgres") or {}
    ports = listen.get("ports") or {}
    container_bind = str(listen.get("container_bind") or "")
    services = _entrypoint_service_ids(arch_sec)
    pg_name = str(postgres.get("service") or "")
    pg_port = int(postgres.get("port") or 0)
    user = str(postgres.get("user") or "")
    database = str(postgres.get("database") or "")
    password_env = str(postgres.get("password_env") or "")
    pack_rt = str((arch_sec.get("image") or {}).get("pack_runtime_path") or "pack.json")
    dsn = f"postgres://{user}:${{{password_env}}}@{pg_name}:{pg_port}/{database}"
    ready_rule = (((pack.get("sections") or {}).get("api") or {}).get("path_rules") or {}).get("ready") or {}
    ready = str(ready_rule.get("template") or "/ready")
    lines = [banner(pack["hash"], "hash").rstrip("\n"), "services:"]
    lines.extend(_compose_postgres(pack, ["prod"]))
    lines.append("  migrate:")
    lines.append("    profiles:")
    lines.append("      - prod")
    lines.append("    image: corporator:${PACK_HASH}")
    lines.append("    env_file:")
    lines.append("      - .env")
    lines.append("    environment:")
    lines.append("      PACK_HASH: ${PACK_HASH}")
    lines.append(f"      PACK_PATH: /app/{pack_rt}")
    lines.append(f"      DATABASE_URL: {dsn}")
    lines.append('    command: ["node", "services/api/dist/migrate_main.js"]')
    lines.append('    restart: "no"')
    lines.append("    depends_on:")
    lines.append(f"      {pg_name}:")
    lines.append("        condition: service_healthy")
    for sid in services:
        port = int(ports.get(sid) or 0)
        lines.append(f"  {sid}:")
        lines.append("    profiles:")
        lines.append("      - prod")
        lines.append("    image: corporator:${PACK_HASH}")
        lines.append("    env_file:")
        lines.append("      - .env")
        lines.append("    environment:")
        lines.append("      PACK_HASH: ${PACK_HASH}")
        lines.append(f"      PACK_PATH: /app/{pack_rt}")
        lines.append(f"      CORPORATOR_LISTEN_BIND: {json.dumps(container_bind)}")
        lines.append(f"      CORPORATOR_LISTEN_PORT: {json.dumps(str(port))}")
        if sid == "api" or sid == "sampler":
            lines.append(f"      DATABASE_URL: {dsn}")
        lines.append(f'    command: ["node", "services/{sid}/dist/main.js"]')
        lines.append("    ports:")
        lines.append(f'      - "{port}:{port}"')
        lines.append("    restart: unless-stopped")
        lines.extend(_compose_http_healthcheck(port, ready))
        lines.append("    depends_on:")
        lines.append("      migrate:")
        lines.append("        condition: service_completed_successfully")
    lines.append("")
    return "\n".join(lines)


def emit_env_example(pack: dict) -> str:
    arch_sec = ((pack.get("sections") or {}).get("arch") or {})
    password_env = str((arch_sec.get("postgres") or {}).get("password_env") or "POSTGRES_PASSWORD")
    roles = ((arch_sec.get("secrets") or {}).get("roles") or {})
    names = [password_env, "PACK_HASH", "DATABASE_URL"]
    for spec in roles.values():
        env = str(spec.get("env") or "")
        if env and env not in names:
            names.append(env)
    lines = [banner(pack["hash"], "hash").rstrip("\n")]
    for name in names:
        lines.append(f"{name}=")
    env_vars = ((arch_sec.get("env") or {}).get("vars") or {})
    api_g = (pack.get("generated") or {}).get("api") or {}
    for env_name in sorted(env_vars):
        if env_name in names:
            continue
        if env_name == "CORPORATOR_UNSTAKE_COOLDOWN_S":
            lines.append(f"{env_name}={int(api_g.get('unstake_cooldown_s') or 0)}")
        else:
            lines.append(f"{env_name}=")
    lines.append("")
    return "\n".join(lines)


def emit_restore_sh(pack: dict) -> str:
    cmd = str((((pack.get("sections") or {}).get("arch") or {}).get("backup") or {}).get("restore_cmd") or "")
    lines = [
        banner(pack["hash"], "hash").rstrip("\n"),
        "#!/bin/sh",
        "set -e",
        "# Restore a SQL dump into DATABASE_URL. Replay witness is restore_replay_matches_origin.",
        f"# pack restore_cmd={cmd}",
        'dump="${1:?dump path}"',
        'psql "$DATABASE_URL" -f "$dump"',
        "",
    ]
    return "\n".join(lines)


CI_PUSH_TRACK = "push"
CI_NIGHTLY_TRACK = "nightly"
CI_NIGHTLY_IDS = ("attack_full", "sim", "forge_test", "image_smoke")


def ci_step_rows(pack: dict) -> list[dict]:
    steps = []
    for sid, spec in (((pack.get("sections") or {}).get("arch") or {}).get("ci_steps") or {}).items():
        steps.append(
            {
                "id": sid,
                "cmd": spec.get("cmd"),
                "catches": spec.get("catches"),
                "red_input": spec.get("red_input"),
                "track": spec.get("track"),
            }
        )
    return steps


def emit_ci_runner(pack: dict) -> str:
    body = json.dumps(ci_step_rows(pack), indent=2, ensure_ascii=False)
    return (
        banner(pack["hash"], "ts")
        + "import { spawnSync } from \"node:child_process\";\n"
        + "import { dirname, join, resolve } from \"node:path\";\n"
        + "import { fileURLToPath, pathToFileURL } from \"node:url\";\n"
        + "\n"
        + "export const ciSteps = "
        + body
        + ";\n"
        + "\n"
        + "export function stepsOnTrack(steps, track) {\n"
        + "  return steps.filter((step) => step.track === track);\n"
        + "}\n"
        + "\n"
        + "export function runCiSteps(steps, exec) {\n"
        + "  const out = [];\n"
        + "  for (const step of steps) {\n"
        + "    out.push({ id: step.id, code: exec(step) });\n"
        + "  }\n"
        + "  return out;\n"
        + "}\n"
        + "\n"
        + "function main() {\n"
        + "  const root = join(dirname(fileURLToPath(import.meta.url)), \"..\");\n"
        + "  const results = runCiSteps(stepsOnTrack(ciSteps, \"push\"), (step) => {\n"
        + "    const r = spawnSync(step.cmd, { cwd: root, shell: true, stdio: \"inherit\" });\n"
        + "    return r.status === null ? 1 : r.status;\n"
        + "  });\n"
        + "  let failed = 0;\n"
        + "  for (const row of results) {\n"
        + "    if (row.code !== 0) failed = failed + 1;\n"
        + "  }\n"
        + "  process.exit(failed === 0 ? 0 : 1);\n"
        + "}\n"
        + "\n"
        + "const argv1 = process.argv[1];\n"
        + "if (argv1 !== undefined && pathToFileURL(resolve(argv1)).href === import.meta.url) {\n"
        + "  main();\n"
        + "}\n"
    )


def emit_ci_workflow(pack: dict) -> str:
    arch_sec = (pack.get("sections") or {}).get("arch") or {}
    toolchain = arch_sec.get("toolchain") or {}
    node_ver = str((toolchain.get("node") or {}).get("version") or "")
    py_ver = str((toolchain.get("python") or {}).get("version") or "")
    foundry_ver = str((toolchain.get("foundry") or {}).get("version") or "")
    rows = ci_step_rows(pack)
    push_cmds = [(r["id"], str(r["cmd"])) for r in rows if r.get("track") == CI_PUSH_TRACK]
    nightly_cmds = [(r["id"], str(r["cmd"])) for r in rows]
    lines = [
        banner(pack["hash"], "hash").rstrip("\n"),
        "name: ci",
        "on:",
        "  push:",
        "  pull_request:",
        "  schedule:",
        '    - cron: "17 3 * * *"',
        "  workflow_dispatch:",
        "jobs:",
        "  push:",
        "    if: github.event_name != 'schedule'",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - uses: actions/checkout@v4",
        "      - uses: actions/setup-python@v5",
        "        with:",
        f'          python-version: "{py_ver}"',
        "      - uses: actions/setup-node@v4",
        "        with:",
        f'          node-version: "{node_ver}"',
        "      - name: pip_install",
        "        run: python -m pip install -r requirements.txt",
    ]
    for sid, cmd in push_cmds:
        lines.append(f"      - name: {sid}")
        lines.append(f"        run: {cmd}")
    lines.extend(
        [
            "  nightly:",
            "    if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'",
            "    runs-on: ubuntu-latest",
            "    steps:",
            "      - uses: actions/checkout@v4",
            "      - uses: actions/setup-python@v5",
            "        with:",
            f'          python-version: "{py_ver}"',
            "      - uses: actions/setup-node@v4",
            "        with:",
            f'          node-version: "{node_ver}"',
            "      - uses: foundry-rs/foundry-toolchain@v1",
            "        with:",
            f'          version: "{foundry_ver}"',
            "      - name: pip_install",
            "        run: python -m pip install -r requirements.txt",
        ]
    )
    for sid, cmd in nightly_cmds:
        lines.append(f"      - name: {sid}")
        lines.append(f"        run: {cmd}")
    lines.append("")
    return "\n".join(lines)


def emit_env_manifests(pack: dict) -> str:
    envs = ((pack.get("sections") or {}).get("arch") or {}).get("environments") or {}
    doc = {}
    for name, spec in envs.items():
        doc[name] = {"migrations": spec.get("migrations")}
    return banner(pack["hash"], "jsonc") + json.dumps(doc, indent=2, ensure_ascii=False) + "\n"


def _toolchain_solc(pack: dict) -> str:
    return str(
        ((((pack.get("sections") or {}).get("arch") or {}).get("toolchain") or {}).get("solc") or {}).get(
            "version"
        )
        or ""
    )


def _param_v(pack: dict, section: str, name: str) -> int:
    row = ((((pack.get("sections") or {}).get(section) or {}).get("params") or {}).get(name) or {})
    return int(row.get("v") or 0)


def emit_foundry_toml(pack: dict) -> str:
    solc = _toolchain_solc(pack)
    lines = [
        banner(pack["hash"], "hash").rstrip("\n"),
        "[profile.default]",
        'src = "src"',
        'out = "out"',
        'test = "test"',
        'script = "script"',
        "libs = []",
        f'solc_version = "{solc}"',
        "auto_detect_solc = false",
        "optimizer = false",
        "",
    ]
    return "\n".join(lines)


def emit_pack_constants(pack: dict) -> str:
    solc = _toolchain_solc(pack)
    tax = _param_v(pack, "economy", "creator_tax_bps")
    anchor = _param_v(pack, "economy", "capital_anchor")
    ttl = int(((pack.get("generated") or {}).get("api") or {}).get("voucher_ttl_s") or 0)
    share = _param_v(pack, "launch", "launch_buy_share_bps")
    return (
        banner(pack["hash"], "ts")
        + f"pragma solidity {solc};\n"
        + "\n"
        + "library PackConstants {\n"
        + f"    uint16 internal constant CREATOR_TAX_BPS = {tax};\n"
        + f"    uint256 internal constant CAPITAL_ANCHOR = {anchor};\n"
        + f"    uint256 internal constant VOUCHER_TTL_S = {ttl};\n"
        + f"    uint16 internal constant LAUNCH_BUY_SHARE_BPS = {share};\n"
        + "}\n"
    )


EMITTERS = {
    "codes": emit_codes,
    "screens": emit_screens,
    "modifier_keys": emit_modifier_keys,
    "districts": emit_districts,
    "buildings": emit_buildings,
    "units": emit_units_for,
    "versions": emit_versions,
    "schema_ddl": emit_schema_ddl,
    "command_routes": emit_command_routes,
    "layer_cruiser": emit_layer_cruiser,
    "ws_channels": emit_ws_channels,
    "listen": emit_listen,
    "tsconfig_refs": emit_tsconfig_refs,
    "dockerfile": emit_dockerfile,
    "compose": emit_compose,
    "compose_prod": emit_compose_prod,
    "env_example": emit_env_example,
    "restore_sh": emit_restore_sh,
    "ci_runner": emit_ci_runner,
    "ci_workflow": emit_ci_workflow,
    "env_manifests": emit_env_manifests,
    "foundry_toml": emit_foundry_toml,
    "pack_constants": emit_pack_constants,
}


def artifact_paths() -> list[str]:
    return sorted(EMITTERS)


def render(pack: dict) -> dict[str, str]:
    rows = (pack["sections"].get("arch") or {}).get("codegen") or {}
    out: dict[str, str] = {}
    for kid, spec in rows.items():
        fn = EMITTERS.get(kid)
        if fn is None:
            raise RuntimeError(f"codegen has no emitter for {kid}")
        path = str(spec.get("artifact") or "")
        if not path:
            raise RuntimeError(f"codegen row {kid} has no artifact")
        out[path] = fn(pack)
    extra = set(EMITTERS) - set(rows)
    if extra:
        raise RuntimeError("codegen emitters not in arch.codegen: " + ",".join(sorted(extra)))
    missing = set(rows) - set(EMITTERS)
    if missing:
        raise RuntimeError("arch.codegen rows without emitter: " + ",".join(sorted(missing)))
    return out


def write_artifacts(rendered: dict[str, str]) -> None:
    for rel, text in rendered.items():
        path = REPO / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_name(path.name + ".tmp")
        tmp.write_text(text, encoding="utf-8", newline="\n")
        tmp.replace(path)


def check_artifacts(rendered: dict[str, str]) -> list[str]:
    errors: list[str] = []
    for rel, text in rendered.items():
        path = REPO / rel
        if not path.exists():
            errors.append(f"missing {rel}")
            continue
        got = path.read_text(encoding="utf-8")
        if got != text:
            errors.append(f"drift {rel}")
    return errors


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    pack, problems = build.build_pack()
    if problems:
        print("pack has canon mismatches; codegen refuses to run")
        return 1
    rendered = render(pack)
    if args.check:
        errors = check_artifacts(rendered)
        if errors:
            print("codegen --check FAILED")
            for line in errors:
                print(f"  {line}")
            return 1
        print(f"codegen    : {len(rendered)} artifacts match pack {pack['hash'][:16]}")
        return 0
    write_artifacts(rendered)
    print(f"codegen    : wrote {len(rendered)} artifacts")
    print(f"hash       : {pack['hash']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
