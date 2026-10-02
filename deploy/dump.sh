# GENERATED from pack 40351bca10048b7cb46ef95adff689a4210ff36ce3b9716f453515c83d8d9eae; do not edit
#!/bin/sh
set -e
# Dump DATABASE_URL to stdout. The operator schedules this; the pack has no cron.
# restore_replay_matches_origin stays on deploy/restore.sh and is not replaced here.
pg_dump "$DATABASE_URL"
