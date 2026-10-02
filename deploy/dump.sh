# GENERATED from pack 16ed396bc2a980853a03c3f96783c892b9ec4974b464c47e35e307fdd406698d; do not edit
#!/bin/sh
set -e
# Dump DATABASE_URL to stdout. The operator schedules this; the pack has no cron.
# restore_replay_matches_origin stays on deploy/restore.sh and is not replaced here.
pg_dump "$DATABASE_URL"
