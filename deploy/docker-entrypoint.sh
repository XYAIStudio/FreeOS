#!/bin/sh
set -eu

# Docker creates fresh named volumes as root. Set ownership only for the two
# explicitly writable data locations, then drop privileges before Node starts.
mkdir -p /app/backend/data /app/uploads
chown -R xyos:xyos /app/backend/data /app/uploads
exec gosu xyos "$@"
