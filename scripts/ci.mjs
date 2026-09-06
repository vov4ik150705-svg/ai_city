/* GENERATED from pack e997446659ee88bf3af85481de0a276069cc425ab86dcc74c8d4b498e8e4001c; do not edit */
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ciSteps = [
  {
    "id": "pack_lint",
    "cmd": "python content/lint.py",
    "catches": "schema, derived, friction, L259 L260",
    "red_input": "drop vault_fee_bps.why so L01 refuses the file",
    "track": "push"
  },
  {
    "id": "pack_build",
    "cmd": "python content/build.py",
    "catches": "canon mismatch, pack hash, round-trip",
    "red_input": "corrupt DESIGN.md 5.8 fixture so L05 fails the build",
    "track": "push"
  },
  {
    "id": "codegen_check",
    "cmd": "python content/codegen.py --check",
    "catches": "hand-edited generated files, missing artifacts",
    "red_input": "edit packages/protocol/src/codes.ts by hand",
    "track": "push"
  },
  {
    "id": "vector_oracle",
    "cmd": "python content/vectors.py",
    "catches": "python oracle drift, missing vector class",
    "red_input": "corrupt content/out/vectors/empty_tick.json bytes",
    "track": "push"
  },
  {
    "id": "install_frozen",
    "cmd": "pnpm -w install --frozen-lockfile",
    "catches": "lockfile drift, undeclared dependency",
    "red_input": "change pnpm-lock.yaml without a matching package.json",
    "track": "push"
  },
  {
    "id": "workspace_gate",
    "cmd": "pnpm -w run gate",
    "catches": "tsc, eslint, depcruise, vitest construction names",
    "red_input": "add an it() name missing from construction_tests",
    "track": "push"
  },
  {
    "id": "attack_full",
    "cmd": "python content/attack.py --jobs 8",
    "catches": "a lint rule that never fires, construction that never fails",
    "red_input": "add attack.py --jobs 8 to a push track cmd",
    "track": "nightly"
  },
  {
    "id": "sim",
    "cmd": "python content/sim.py",
    "catches": "window A drift, return bands, bank measure",
    "red_input": "put content/sim.py on a push track cmd",
    "track": "nightly"
  },
  {
    "id": "forge_test",
    "cmd": "forge test --root contracts",
    "catches": "solc pin drift, vault invariant, pause path",
    "red_input": "drop forge_test from the nightly track",
    "track": "nightly"
  },
  {
    "id": "image_smoke",
    "cmd": "docker build -f deploy/Dockerfile --build-arg PACK_HASH=ci -t corporator:ci-smoke .",
    "catches": "image without PACK_HASH, root user, python in runtime",
    "red_input": "drop USER node from deploy/Dockerfile",
    "track": "nightly"
  }
];

export function stepsOnTrack(steps, track) {
  return steps.filter((step) => step.track === track);
}

export function runCiSteps(steps, exec) {
  const out = [];
  for (const step of steps) {
    out.push({ id: step.id, code: exec(step) });
  }
  return out;
}

function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const results = runCiSteps(stepsOnTrack(ciSteps, "push"), (step) => {
    const r = spawnSync(step.cmd, { cwd: root, shell: true, stdio: "inherit" });
    return r.status === null ? 1 : r.status;
  });
  let failed = 0;
  for (const row of results) {
    if (row.code !== 0) failed = failed + 1;
  }
  process.exit(failed === 0 ? 0 : 1);
}

const argv1 = process.argv[1];
if (argv1 !== undefined && pathToFileURL(resolve(argv1)).href === import.meta.url) {
  main();
}
