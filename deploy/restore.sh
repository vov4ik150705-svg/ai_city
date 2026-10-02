# GENERATED from pack 16ed396bc2a980853a03c3f96783c892b9ec4974b464c47e35e307fdd406698d; do not edit
#!/bin/sh
set -e
# Restore a SQL dump into DATABASE_URL. Replay witness is restore_replay_matches_origin.
# pack restore_cmd=deploy/restore.sh
dump="${1:?dump path}"
psql "$DATABASE_URL" -f "$dump"
