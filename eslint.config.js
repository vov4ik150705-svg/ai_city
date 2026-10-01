import js from "@eslint/js"
import tseslint from "typescript-eslint"

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "content/**",
      "art/**",
      ".dependency-cruiser.cjs",
      "services/api/migrations/**",
      "**/dist-web/**",
      "deploy/**",
      "scripts/**",
      "apps/www/**",
    ],
  },
  {
    files: ["packages/engine/src/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "tick time is city_time; Date is banned in engine src" },
        { name: "Math", message: "integer arithmetic only; Math is banned in engine src" },
        { name: "performance", message: "host clocks are not tick inputs" },
        { name: "process", message: "engine has no I/O" },
        { name: "fetch", message: "engine has no I/O" },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Date", property: "now" },
        { object: "Math", property: "random" },
        { object: "performance", property: "now" },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            "fs",
            "node:fs",
            "path",
            "node:path",
            "crypto",
            "node:crypto",
            "child_process",
            "node:child_process",
            "os",
            "node:os",
            "http",
            "node:http",
            "net",
            "node:net",
          ],
        },
      ],
      "@typescript-eslint/no-magic-numbers": "off",
      "no-magic-numbers": "off",
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[raw=/^-?[0-9]/][value>=2]:not(MemberExpression[computed=true] > Literal), Literal[raw=/^-?[0-9]/][value<=-2]:not(MemberExpression[computed=true] > Literal)",
          message: "engine src allows numeric literals 0 and 1 only; values come from the pack",
        },
        {
          selector: "Literal[bigint=/^(?:-?(?:[2-9]|[0-9]{2,}))$/]",
          message: "engine src allows bigint literals 0n and 1n only; values come from the pack",
        },
      ],
    },
  },
  {
    files: ["packages/render/src/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "render time is city_time; Date is banned in packages/render/src" },
        { name: "performance", message: "host clocks are not city_time" },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Date", property: "now" },
        { object: "Math", property: "random" },
        { object: "performance", property: "now" },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@corporator/engine",
              message: "render is outside the tick and must not import engine (L339, D-V-9)",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Literal[raw=/^-?[0-9]/][value>=2]:not(MemberExpression[computed=true] > Literal), Literal[raw=/^-?[0-9]/][value<=-2]:not(MemberExpression[computed=true] > Literal)",
          message: "render src allows numeric literals 0 and 1 only; values come from the pack",
        },
        {
          selector: "Literal[bigint=/^(?:-?(?:[2-9]|[0-9]{2,}))$/]",
          message: "render src allows bigint literals 0n and 1n only; values come from the pack",
        },
      ],
    },
  },
  {
    files: [
      "packages/engine/src/keccak.ts",
      "packages/engine/src/sha256.ts",
      "packages/engine/src/utf8.ts",
    ],
    rules: {
      "no-magic-numbers": "off",
      "no-restricted-syntax": "off",
    },
  },
  {
    files: ["packages/contentpack/src/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "pack load is not a host clock" },
        { name: "JSON", message: "JSON.parse loses integers above 2 to the 53; use parseJson" },
      ],
      "no-restricted-properties": [
        "error",
        { object: "JSON", property: "parse" },
        { object: "Date", property: "now" },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: ["fs", "node:fs", "path", "node:path", "crypto", "node:crypto"],
        },
      ],
    },
  },
  {
    files: ["services/buyback/src/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "buyback schedule takes city_time; Date is banned on the buyback path; docs/ARCHITECTURE.md §7" },
        { name: "Math", message: "integer arithmetic only; Math is banned on the buyback path" },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Date", property: "now" },
        { object: "Math", property: "random" },
      ],
    },
  },
  {
    files: ["services/sampler/src/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "sampler step takes city_time; Date is banned on the sampler path; docs/TICK.md §7" },
        { name: "Math", message: "integer arithmetic only; Math is banned on the sampler path" },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Date", property: "now" },
        { object: "Math", property: "random" },
      ],
    },
  },
  {
    files: ["services/attestor/src/**/*.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "attestor step takes wall_s; Date is banned on the attestor path; docs/TICK.md §9" },
        { name: "Math", message: "integer arithmetic only; Math is banned on the attestor path" },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Date", property: "now" },
        { object: "Math", property: "random" },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@corporator/engine",
              importNames: ["tick", "catchUp"],
              message: "attestor is fail-open and does not run the tick; docs/TICK.md §9, DESIGN.md §6.4",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["services/api/src/tick_host.ts", "services/api/src/scheduler.ts", "services/api/src/main.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "tick time is city_time; Date is banned on the tick host path" },
        { name: "Math", message: "integer arithmetic only on the tick host path" },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Date", property: "now" },
        { object: "Math", property: "random" },
      ],
    },
  },
  {
    files: ["services/*/src/main.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@corporator/engine",
              importNames: ["tick", "catchUp", "mulBps"],
              message: "main does not run the tick or count the economy; D-L-2, PLAN_LIVE L2",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["apps/client/src/**/*.{ts,tsx}"],
    ignores: ["apps/client/src/clock.ts"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "Date.now is allowlisted in clock.ts only; D-L-4, HUD.md §8" },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Date", property: "now" },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@corporator/chainport",
              message: "client does not see chainport; L230, docs/ARCHITECTURE.md §2",
            },
            {
              name: "@electric-sql/pglite",
              message: "client does not see a DB driver; L230",
            },
            {
              name: "pg",
              message: "client does not see a DB driver; L230",
            },
            {
              name: "@corporator/engine",
              importNames: [
                "tick",
                "catchUp",
                "mulBps",
                "gdpDay",
                "happinessBps",
                "productivityBps",
                "housingTermBps",
                "parksTermBps",
                "energyTermBps",
                "population",
                "newState",
                "spawnCity",
              ],
              message: "HUD.md §8: the client does not run the tick or count the economy",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/[\\u0400-\\u04FF]/]",
          message: "client src strings come from content/strings/ru.json; D-C-12",
        },
        {
          selector: "TemplateElement[value.raw=/[\\u0400-\\u04FF]/]",
          message: "client src strings come from content/strings/ru.json; D-C-12",
        },
        {
          selector: "JSXText[value=/[\\u0400-\\u04FF]/]",
          message: "client src strings come from content/strings/ru.json; D-C-12",
        },
      ],
    },
  },
  {
    files: ["packages/chainport/src/**/*.ts"],
    ignores: ["packages/chainport/src/rpc/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "viem", message: "RPC libraries are legal only under packages/chainport/src/rpc; docs/ARCHITECTURE.md §6" },
            { name: "ethers", message: "RPC libraries are legal only under packages/chainport/src/rpc; docs/ARCHITECTURE.md §6" },
            { name: "web3", message: "RPC libraries are legal only under packages/chainport/src/rpc; docs/ARCHITECTURE.md §6" },
          ],
        },
      ],
    },
  },
)

