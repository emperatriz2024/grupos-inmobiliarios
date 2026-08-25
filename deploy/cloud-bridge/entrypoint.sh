#!/bin/sh
set -eu
mkdir -p /data/radar-whatsapp-secondary
chown -R node:node /data/radar-whatsapp-secondary
exec gosu node "$@"
