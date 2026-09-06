# GENERATED from pack e997446659ee88bf3af85481de0a276069cc425ab86dcc74c8d4b498e8e4001c; do not edit
#!/bin/sh
set -e
# Restore a SQL dump into DATABASE_URL. Replay witness is restore_replay_matches_origin.
# pack restore_cmd=deploy/restore.sh
dump="${1:?dump path}"
psql "$DATABASE_URL" -f "$dump"
