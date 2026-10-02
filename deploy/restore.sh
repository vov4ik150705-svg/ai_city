# GENERATED from pack e8e837109fb0f34e3f125f86dd2195f60e491c86d5e24e2efb65d8aa39ff58fa; do not edit
#!/bin/sh
set -e
# Restore a SQL dump into DATABASE_URL. Replay witness is restore_replay_matches_origin.
# pack restore_cmd=deploy/restore.sh
dump="${1:?dump path}"
psql "$DATABASE_URL" -f "$dump"
