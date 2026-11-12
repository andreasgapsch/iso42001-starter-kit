#!/bin/bash
# Wie begrenzt.sh, aber Chromium kann seinen eigenen systemd-Scope nicht anlegen (kein D-Bus), bleibt also im Limit.
M=$1; shift
exec systemd-run --user --scope --quiet --collect -p MemoryMax=$M -p MemorySwapMax=0 -- env DBUS_SESSION_BUS_ADDRESS=unix:path=/nonexistent "$@"
