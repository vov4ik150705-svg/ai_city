# GENERATED from pack b1cc21aac85c69e360d04e0d9c7e46a7d6cb94619d0ada5b7ea00e95c1bd7186; do not edit
#!/bin/sh
set -e
# Restore a SQL dump into DATABASE_URL. Replay witness is restore_replay_matches_origin.
# pack restore_cmd=deploy/restore.sh
dump="${1:?dump path}"
psql "$DATABASE_URL" -f "$dump"
