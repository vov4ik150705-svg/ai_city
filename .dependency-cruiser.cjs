/* GENERATED from pack 4555d9a00ba1bfdbd4c6fba6e3a0e20f2c623eb16d718b866ce56498ae71a26e; do not edit */
module.exports = {
  "forbidden": [
    {
      "name": "layer-engine",
      "comment": "engine may import only allowed_deps from arch.packages",
      "severity": "error",
      "from": {
        "path": "^packages/engine/src"
      },
      "to": {
        "path": "(^(packages|apps|services)/|^@corporator/)",
        "pathNot": "^(packages/engine|@corporator/engine)"
      }
    },
    {
      "name": "layer-protocol",
      "comment": "protocol may import only allowed_deps from arch.packages",
      "severity": "error",
      "from": {
        "path": "^packages/protocol/src"
      },
      "to": {
        "path": "(^(packages|apps|services)/|^@corporator/)",
        "pathNot": "^(packages/protocol|@corporator/protocol)"
      }
    },
    {
      "name": "layer-contentpack",
      "comment": "contentpack may import only allowed_deps from arch.packages",
      "severity": "error",
      "from": {
        "path": "^packages/contentpack/src"
      },
      "to": {
        "path": "(^(packages|apps|services)/|^@corporator/)",
        "pathNot": "^(packages/protocol|@corporator/protocol|packages/contentpack|@corporator/contentpack)"
      }
    },
    {
      "name": "layer-chainport",
      "comment": "chainport may import only allowed_deps from arch.packages",
      "severity": "error",
      "from": {
        "path": "^packages/chainport/src"
      },
      "to": {
        "path": "(^(packages|apps|services)/|^@corporator/)",
        "pathNot": "^(packages/protocol|@corporator/protocol|packages/chainport|@corporator/chainport)"
      }
    },
    {
      "name": "layer-render",
      "comment": "render may import only allowed_deps from arch.packages",
      "severity": "error",
      "from": {
        "path": "^packages/render/src"
      },
      "to": {
        "path": "(^(packages|apps|services)/|^@corporator/)",
        "pathNot": "^(packages/protocol|@corporator/protocol|packages/contentpack|@corporator/contentpack|packages/render|@corporator/render)"
      }
    },
    {
      "name": "layer-api",
      "comment": "api may import only allowed_deps from arch.packages",
      "severity": "error",
      "from": {
        "path": "^services/api/src"
      },
      "to": {
        "path": "(^(packages|apps|services)/|^@corporator/)",
        "pathNot": "^(packages/engine|@corporator/engine|packages/protocol|@corporator/protocol|packages/contentpack|@corporator/contentpack|packages/chainport|@corporator/chainport|services/api|@corporator/api)"
      }
    },
    {
      "name": "layer-sampler",
      "comment": "sampler may import only allowed_deps from arch.packages",
      "severity": "error",
      "from": {
        "path": "^services/sampler/src"
      },
      "to": {
        "path": "(^(packages|apps|services)/|^@corporator/)",
        "pathNot": "^(packages/engine|@corporator/engine|packages/protocol|@corporator/protocol|packages/contentpack|@corporator/contentpack|packages/chainport|@corporator/chainport|services/sampler|@corporator/sampler)"
      }
    },
    {
      "name": "layer-buyback",
      "comment": "buyback may import only allowed_deps from arch.packages",
      "severity": "error",
      "from": {
        "path": "^services/buyback/src"
      },
      "to": {
        "path": "(^(packages|apps|services)/|^@corporator/)",
        "pathNot": "^(packages/engine|@corporator/engine|packages/protocol|@corporator/protocol|packages/contentpack|@corporator/contentpack|packages/chainport|@corporator/chainport|services/buyback|@corporator/buyback)"
      }
    },
    {
      "name": "layer-attestor",
      "comment": "attestor may import only allowed_deps from arch.packages",
      "severity": "error",
      "from": {
        "path": "^services/attestor/src"
      },
      "to": {
        "path": "(^(packages|apps|services)/|^@corporator/)",
        "pathNot": "^(packages/engine|@corporator/engine|packages/protocol|@corporator/protocol|packages/contentpack|@corporator/contentpack|packages/chainport|@corporator/chainport|services/attestor|@corporator/attestor)"
      }
    },
    {
      "name": "layer-client",
      "comment": "client may import only allowed_deps from arch.packages",
      "severity": "error",
      "from": {
        "path": "^apps/client/src"
      },
      "to": {
        "path": "(^(packages|apps|services)/|^@corporator/)",
        "pathNot": "^(packages/protocol|@corporator/protocol|packages/engine|@corporator/engine|packages/contentpack|@corporator/contentpack|packages/render|@corporator/render|apps/client|@corporator/client)"
      }
    }
  ],
  "options": {
    "doNotFollow": {
      "path": "node_modules"
    },
    "tsPreCompilationDeps": true
  }
};
