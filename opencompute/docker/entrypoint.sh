#!/bin/sh
set -e
# ROLE=worker | validator (see IMPLEMENTATION_PLAN.md §4)
# `relay` runs the discovery/relay server instead of a node agent.
if [ "$1" = "relay" ]; then
  echo "Starting opencompute relay"
  exec python -m node "$@"
fi
ROLE="${ROLE:-worker}"
echo "Starting opencompute node — role=$ROLE"
exec python -m node start --role "$ROLE" "$@"
