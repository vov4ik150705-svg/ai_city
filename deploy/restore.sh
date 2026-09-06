# GENERATED from pack 1d6fa473503c17de13a04a3dc3217001412e599810628b5a8cc603aede9da9e3; do not edit
#!/bin/sh
set -e
# Restore a SQL dump into DATABASE_URL. Replay witness is restore_replay_matches_origin.
# pack restore_cmd=deploy/restore.sh
dump="${1:?dump path}"
psql "$DATABASE_URL" -f "$dump"
