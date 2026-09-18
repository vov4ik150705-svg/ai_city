# GENERATED from pack dc58998f9a46f00a8cddcb575abcbde9ed17061717e9f500357bab8dda30efc4; do not edit
#!/bin/sh
set -e
# Restore a SQL dump into DATABASE_URL. Replay witness is restore_replay_matches_origin.
# pack restore_cmd=deploy/restore.sh
dump="${1:?dump path}"
psql "$DATABASE_URL" -f "$dump"
