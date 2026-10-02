# GENERATED from pack dce4eda1ce60fe048dab7a299c70af2aee892e8ca8928d482d5c6e59d30613c4; do not edit
#!/bin/sh
set -e
# Restore a SQL dump into DATABASE_URL. Replay witness is restore_replay_matches_origin.
# pack restore_cmd=deploy/restore.sh
dump="${1:?dump path}"
psql "$DATABASE_URL" -f "$dump"
