import { isAddr } from "./abi.js"
import type { LiveContracts } from "./live.js"

export type EnvMap = { readonly [key: string]: string | undefined }

export type PlayerReady = {
  readonly depositsOpen: boolean
  readonly contracts: LiveContracts | undefined
  readonly prizeTreasury: string
}

const OPEN = "CORPORATOR_DEPOSITS_OPEN"
const CORP = "CORPORATOR_CORP_TOKEN"
const VAULT = "CORPORATOR_VAULT"
const STAKE = "CORPORATOR_STAKE_REGISTRY"
const ROOTS = "CORPORATOR_MERKLE_ROOTS"
const PRIZES = "CORPORATOR_PRIZE_TREASURY"

function envAddr(env: EnvMap, key: string): string {
  const v = env[key]
  if (v === undefined || !isAddr(v)) return ""
  return v
}

/** Host reads chain addresses from env. Pack fields are the evening fact. D-P-14. */
export function readPlayerReady(env: EnvMap): PlayerReady {
  const corpToken = envAddr(env, CORP)
  const vault = envAddr(env, VAULT)
  const stakeRegistry = envAddr(env, STAKE)
  const merkleRoots = envAddr(env, ROOTS)
  const prizeTreasury = envAddr(env, PRIZES)
  const complete =
    corpToken.length > 0 &&
    vault.length > 0 &&
    stakeRegistry.length > 0 &&
    merkleRoots.length > 0 &&
    prizeTreasury.length > 0
  return {
    depositsOpen: env[OPEN] === "1" && complete,
    contracts: complete ? { corpToken, vault, stakeRegistry, merkleRoots } : undefined,
    prizeTreasury,
  }
}
