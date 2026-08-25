#!/usr/bin/env bash
# Manually invoke the check-reminders Edge Function — bypasses the daily
# 08:00 WIB pg_cron schedule so you can test reminder alerts / auto-record
# without waiting for the next cron tick.
#
# Usage:
#   CRON_SECRET=<value> ./scripts/trigger-check-reminders.sh
#
# CRON_SECRET is the value set via `supabase secrets set CRON_SECRET=...`
# (Task 4 of docs/superpowers/plans/2026-08-25-recurring-reminders.md).
# It is intentionally NOT hardcoded here — never commit secrets.

set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${CRON_SECRET:-}" ]; then
  echo "Set CRON_SECRET first, e.g.:" >&2
  echo "  CRON_SECRET=your-secret-here ./scripts/trigger-check-reminders.sh" >&2
  exit 1
fi

set -a
source .env
set +a

curl -s -X POST "${EXPO_PUBLIC_SUPABASE_URL}/functions/v1/check-reminders" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "apikey: ${EXPO_PUBLIC_SUPABASE_ANON_KEY}"
echo
