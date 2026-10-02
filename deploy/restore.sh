# GENERATED from pack 4555d9a00ba1bfdbd4c6fba6e3a0e20f2c623eb16d718b866ce56498ae71a26e; do not edit
#!/bin/sh
set -e
# Restore a SQL dump into DATABASE_URL. Replay witness is restore_replay_matches_origin.
# pack restore_cmd=deploy/restore.sh
dump="${1:?dump path}"
psql "$DATABASE_URL" -f "$dump"
