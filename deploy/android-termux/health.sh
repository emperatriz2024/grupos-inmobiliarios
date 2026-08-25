#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
curl --fail --silent --show-error --max-time 5 http://127.0.0.1:8080/health; echo
curl --silent --show-error --max-time 5 http://127.0.0.1:8080/ready; echo
