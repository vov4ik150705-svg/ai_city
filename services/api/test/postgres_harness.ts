import { spawnSync } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { createServer, connect } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { postgresDatabase, postgresImageMajor, postgresPort, postgresUser } from "@corporator/protocol"

export type PostgresHandle = {
  readonly url: string
  stop(): Promise<void>
}

function portNumber(port: bigint): number {
  const n = Number(port)
  if (n.toString() !== port.toString()) throw new Error("postgres port")
  return n
}

function dsn(host: string, port: number, password: string): string {
  return (
    "postgres://" +
    postgresUser +
    ":" +
    encodeURIComponent(password) +
    "@" +
    host +
    ":" +
    port.toString() +
    "/" +
    postgresDatabase
  )
}

function unusedPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer()
    s.once("error", reject)
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address()
      if (addr === null || typeof addr === "string") {
        s.close()
        reject(new Error("listen"))
        return
      }
      const port = addr.port
      s.close((err) => {
        if (err) reject(err)
        else resolve(port)
      })
    })
  })
}

function envUrl(): string | undefined {
  const raw = process.env.DATABASE_URL
  if (raw === undefined || raw.length === 0) return undefined
  return raw
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function isBusy(err: unknown): boolean {
  if (typeof err !== "object" || err === null || !("code" in err)) return false
  const code = err.code
  return code === "EBUSY" || code === "ENOTEMPTY" || code === "EPERM"
}

async function rmDir(dir: string): Promise<void> {
  let i = 0
  while (i < 40) {
    try {
      await rm(dir, { recursive: true, force: true })
      return
    } catch (err) {
      if (!isBusy(err) || i === 39) throw err
      await sleep(250)
      i += 1
    }
  }
}

function canConnect(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const c = connect({ host: "127.0.0.1", port }, () => {
      c.end()
      resolve(true)
    })
    c.once("error", () => resolve(false))
  })
}

async function waitTcp(port: number): Promise<void> {
  let i = 0
  while (i < 80) {
    if (await canConnect(port)) return
    await sleep(250)
    i += 1
  }
  throw new Error("postgres not ready")
}

async function waitSql(url: string): Promise<void> {
  const pg = (await import("pg")).default
  let streak = 0
  let i = 0
  while (i < 40) {
    const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 2000 })
    try {
      await client.connect()
      await client.query("SELECT 1")
      await client.end()
      streak += 1
      if (streak >= 3) return
    } catch {
      streak = 0
      try {
        await client.end()
      } catch {
        // The postmaster dropped this socket while it was still starting.
      }
    }
    await sleep(500)
    i += 1
  }
  throw new Error("postgres not ready")
}

async function startDocker(password: string, hostPort: number): Promise<PostgresHandle | undefined> {
  const internal = portNumber(postgresPort)
  const run = spawnSync(
    "docker",
    [
      "run",
      "-d",
      "--rm",
      "--name",
      "corporator-l4-pg",
      "-e",
      "POSTGRES_USER=" + postgresUser,
      "-e",
      "POSTGRES_PASSWORD=" + password,
      "-e",
      "POSTGRES_DB=" + postgresDatabase,
      "-e",
      "PGPORT=" + internal.toString(),
      "-p",
      hostPort.toString() + ":" + internal.toString(),
      "--shm-size=256m",
      "postgres:" + postgresImageMajor,
      "-c",
      "dynamic_shared_memory_type=mmap",
      "-c",
      "shared_buffers=32MB",
    ],
    { encoding: "utf8" },
  )
  if (run.status !== 0) return undefined
  try {
    await waitTcp(hostPort)
    await waitSql(dsn("127.0.0.1", hostPort, password))
  } catch (err) {
    spawnSync("docker", ["rm", "-f", "corporator-l4-pg"], { encoding: "utf8" })
    throw err
  }
  return {
    url: dsn("127.0.0.1", hostPort, password),
    async stop(): Promise<void> {
      spawnSync("docker", ["rm", "-f", "corporator-l4-pg"], { encoding: "utf8" })
    },
  }
}

async function startEmbedded(password: string, hostPort: number): Promise<PostgresHandle> {
  const dir = await mkdtemp(join(tmpdir(), "corporator-l4-"))
  const mod = (await import("embedded-postgres")) as {
    default: new (opts: {
      databaseDir: string
      port: number
      user: string
      password: string
      persistent: boolean
      onLog: (message: string) => void
    }) => {
      initialise(): Promise<void>
      start(): Promise<void>
      stop(): Promise<void>
      createDatabase(name: string): Promise<void>
    }
  }
  const Embedded = mod.default
  const cluster = new Embedded({
    databaseDir: dir,
    port: hostPort,
    user: postgresUser,
    password,
    persistent: false,
    onLog: () => {
      return
    },
  })
  await cluster.initialise()
  await cluster.start()
  try {
    await cluster.createDatabase(postgresDatabase)
  } catch {
    // Cluster may already have a database named after the role.
  }
  await waitSql(dsn("127.0.0.1", hostPort, password))
  return {
    url: dsn("127.0.0.1", hostPort, password),
    async stop(): Promise<void> {
      await cluster.stop()
      await sleep(500)
      await rmDir(dir)
    },
  }
}

export async function startPostgres(): Promise<PostgresHandle> {
  const existing = envUrl()
  if (existing !== undefined) {
    return {
      url: existing,
      async stop(): Promise<void> {
        return
      },
    }
  }
  const password = "l4gate"
  const hostPort = await unusedPort()
  const docker = await startDocker(password, hostPort)
  if (docker !== undefined) return docker
  return startEmbedded(password, hostPort)
}
