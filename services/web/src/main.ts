import { existsSync } from "node:fs"
import { join } from "node:path"
import { startStatic } from "./static.js"

const root = process.env.CORPORATOR_STATIC_ROOT
const portRaw = process.env.CORPORATOR_LISTEN_PORT
const bind = process.env.CORPORATOR_LISTEN_BIND
if (root === undefined || root.length === 0 || portRaw === undefined || portRaw.length === 0 || bind === undefined || bind.length === 0) {
  process.exitCode = 1
} else {
  const port = Number(portRaw)
  if (!Number.isInteger(port) || port <= 0 || !existsSync(join(root, "index.html"))) {
    process.exitCode = 1
  } else {
    void startStatic({ root, port, bind })
  }
}
