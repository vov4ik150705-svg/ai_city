# GENERATED from pack 1053fda2283e116cf4706ae3910b046f3a66594e8bf4bffc958e52a53b8d4bd8; do not edit
#!/bin/sh
set -e
# Dump DATABASE_URL to stdout. The operator schedules this; the pack has no cron.
# restore_replay_matches_origin stays on deploy/restore.sh and is not replaced here.
pg_dump "$DATABASE_URL"
