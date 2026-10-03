# GENERATED from pack 1053fda2283e116cf4706ae3910b046f3a66594e8bf4bffc958e52a53b8d4bd8; do not edit
#!/bin/sh
set -e
# Restore a SQL dump into DATABASE_URL. Replay witness is restore_replay_matches_origin.
# pack restore_cmd=deploy/restore.sh
dump="${1:?dump path}"
psql "$DATABASE_URL" -f "$dump"
