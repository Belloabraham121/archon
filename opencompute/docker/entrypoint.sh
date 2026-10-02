#!/bin/sh
set -e
# ROLE=worker | validator (see IMPLEMENTATION_PLAN.md §4)
ROLE="${ROLE:-worker}"
echo "Starting opencompute node — role=$ROLE"
exec python -m node start --role "$ROLE" "$@"
