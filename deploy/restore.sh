# GENERATED from pack 40351bca10048b7cb46ef95adff689a4210ff36ce3b9716f453515c83d8d9eae; do not edit
#!/bin/sh
set -e
# Restore a SQL dump into DATABASE_URL. Replay witness is restore_replay_matches_origin.
# pack restore_cmd=deploy/restore.sh
dump="${1:?dump path}"
psql "$DATABASE_URL" -f "$dump"
