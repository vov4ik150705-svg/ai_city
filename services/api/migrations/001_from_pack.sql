-- GENERATED from pack 8f0dc753eeee37c59e38184159db4b118eebe107f24af48a996695dafaad01a1; do not edit

-- key account_id
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT NOT NULL,
  payload BYTEA NOT NULL,
  payload_hash TEXT NOT NULL,
  account_kind TEXT NOT NULL CHECK (account_kind IN ('demo','wallet')),
  PRIMARY KEY (id)
);
-- accounts: money=1; writer is services/api

-- key city_id
CREATE TABLE IF NOT EXISTS cities (
  id TEXT NOT NULL,
  payload BYTEA NOT NULL,
  payload_hash TEXT NOT NULL,
  account_kind TEXT NOT NULL CHECK (account_kind IN ('demo','wallet')),
  PRIMARY KEY (id)
);
-- cities: money=1; writer is services/api

-- key city_id, city_time
CREATE TABLE IF NOT EXISTS tick_inputs (
  id TEXT NOT NULL,
  payload BYTEA NOT NULL,
  payload_hash TEXT NOT NULL,
  PRIMARY KEY (id)
);

-- key city_id, city_time, agent_id
CREATE TABLE IF NOT EXISTS records (
  id TEXT NOT NULL,
  payload BYTEA NOT NULL,
  payload_hash TEXT NOT NULL,
  account_kind TEXT NOT NULL CHECK (account_kind IN ('demo','wallet')),
  PRIMARY KEY (id)
);
-- records: money=1; writer is services/api

-- key city_id, city_time
CREATE TABLE IF NOT EXISTS state_snapshots (
  id TEXT NOT NULL,
  payload BYTEA NOT NULL,
  payload_hash TEXT NOT NULL,
  account_kind TEXT NOT NULL CHECK (account_kind IN ('demo','wallet')),
  PRIMARY KEY (id)
);

-- key id
CREATE TABLE IF NOT EXISTS outbox (
  id TEXT NOT NULL,
  payload BYTEA NOT NULL,
  payload_hash TEXT NOT NULL,
  PRIMARY KEY (id)
);

-- key root_id
CREATE TABLE IF NOT EXISTS attest_roots (
  id TEXT NOT NULL,
  payload BYTEA NOT NULL,
  payload_hash TEXT NOT NULL,
  PRIMARY KEY (id)
);

-- key sampled_at
CREATE TABLE IF NOT EXISTS price_samples (
  id TEXT NOT NULL,
  payload BYTEA NOT NULL,
  payload_hash TEXT NOT NULL,
  PRIMARY KEY (id)
);

-- key batch_id
CREATE TABLE IF NOT EXISTS buyback_batches (
  id TEXT NOT NULL,
  payload BYTEA NOT NULL,
  payload_hash TEXT NOT NULL,
  account_kind TEXT NOT NULL CHECK (account_kind IN ('demo','wallet')),
  PRIMARY KEY (id)
);
-- buyback_batches: money=1; writer is services/api

-- key nonce
CREATE TABLE IF NOT EXISTS vouchers (
  id TEXT NOT NULL,
  payload BYTEA NOT NULL,
  payload_hash TEXT NOT NULL,
  account_kind TEXT NOT NULL CHECK (account_kind IN ('demo','wallet')),
  PRIMARY KEY (id)
);
-- vouchers: money=1; writer is services/api

-- key city_id, intent_id
CREATE TABLE IF NOT EXISTS intents (
  id TEXT NOT NULL,
  payload BYTEA NOT NULL,
  payload_hash TEXT NOT NULL,
  account_kind TEXT NOT NULL CHECK (account_kind IN ('demo','wallet')),
  PRIMARY KEY (id)
);
-- intents: money=1; writer is services/api

-- key city_id, ticker, window
CREATE TABLE IF NOT EXISTS fragments_ledger (
  id TEXT NOT NULL,
  payload BYTEA NOT NULL,
  payload_hash TEXT NOT NULL,
  account_kind TEXT NOT NULL CHECK (account_kind IN ('demo','wallet')),
  PRIMARY KEY (id)
);
-- fragments_ledger: money=1; writer is services/api

-- key city_id, season_id
CREATE TABLE IF NOT EXISTS seasons (
  id TEXT NOT NULL,
  payload BYTEA NOT NULL,
  payload_hash TEXT NOT NULL,
  account_kind TEXT NOT NULL CHECK (account_kind IN ('demo','wallet')),
  PRIMARY KEY (id)
);
-- seasons: money=1; writer is services/api

-- key period_id, kettle, asset
CREATE TABLE IF NOT EXISTS prize_pools (
  id TEXT NOT NULL,
  payload BYTEA NOT NULL,
  payload_hash TEXT NOT NULL,
  account_kind TEXT NOT NULL CHECK (account_kind IN ('demo','wallet')),
  PRIMARY KEY (id)
);
-- prize_pools: money=1; writer is services/api

-- key period_id, kettle, asset, wallet
CREATE TABLE IF NOT EXISTS prize_payouts (
  id TEXT NOT NULL,
  payload BYTEA NOT NULL,
  payload_hash TEXT NOT NULL,
  account_kind TEXT NOT NULL CHECK (account_kind IN ('demo','wallet')),
  PRIMARY KEY (id)
);
-- prize_payouts: money=1; writer is services/api

-- key batch_id
CREATE TABLE IF NOT EXISTS basket_batches (
  id TEXT NOT NULL,
  payload BYTEA NOT NULL,
  payload_hash TEXT NOT NULL,
  account_kind TEXT NOT NULL CHECK (account_kind IN ('demo','wallet')),
  PRIMARY KEY (id)
);
-- basket_batches: money=1; writer is services/api

-- key return_id
CREATE TABLE IF NOT EXISTS prize_returns (
  id TEXT NOT NULL,
  payload BYTEA NOT NULL,
  payload_hash TEXT NOT NULL,
  account_kind TEXT NOT NULL CHECK (account_kind IN ('demo','wallet')),
  PRIMARY KEY (id)
);
-- prize_returns: money=1; writer is services/api

-- key version
CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT NOT NULL,
  payload BYTEA NOT NULL,
  payload_hash TEXT NOT NULL,
  PRIMARY KEY (id)
);

-- key session_id
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT NOT NULL,
  payload BYTEA NOT NULL,
  payload_hash TEXT NOT NULL,
  account_kind TEXT NOT NULL CHECK (account_kind IN ('demo','wallet')),
  PRIMARY KEY (id)
);

-- key subject
CREATE TABLE IF NOT EXISTS city_owners (
  id TEXT NOT NULL,
  payload BYTEA NOT NULL,
  payload_hash TEXT NOT NULL,
  account_kind TEXT NOT NULL CHECK (account_kind IN ('demo','wallet')),
  PRIMARY KEY (id)
);

-- key city_id, tick_index
CREATE TABLE IF NOT EXISTS command_rates (
  id TEXT NOT NULL,
  payload BYTEA NOT NULL,
  payload_hash TEXT NOT NULL,
  PRIMARY KEY (id)
);

-- key city_id
CREATE TABLE IF NOT EXISTS tick_locks (
  id TEXT NOT NULL,
  payload BYTEA NOT NULL,
  payload_hash TEXT NOT NULL,
  PRIMARY KEY (id)
);

-- demo_transfer_edges drives the demo-wallet barrier; empty means same-kind only
CREATE TABLE IF NOT EXISTS demo_wallet_transfers (
  id TEXT NOT NULL,
  from_kind TEXT NOT NULL CHECK (from_kind IN ('demo','wallet')),
  to_kind TEXT NOT NULL CHECK (to_kind IN ('demo','wallet')),
  CONSTRAINT demo_wallet_barrier CHECK (from_kind = to_kind),
  PRIMARY KEY (id)
);
