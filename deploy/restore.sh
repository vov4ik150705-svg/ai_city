# GENERATED from pack 8f0dc753eeee37c59e38184159db4b118eebe107f24af48a996695dafaad01a1; do not edit
#!/bin/sh
set -e
# Restore a SQL dump into DATABASE_URL. Replay witness is restore_replay_matches_origin.
# pack restore_cmd=deploy/restore.sh
dump="${1:?dump path}"
psql "$DATABASE_URL" -f "$dump"
