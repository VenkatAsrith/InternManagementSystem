#!/usr/bin/env bash
# Restarts ONLY the QA API (port 5100) so server code changes take effect while the QA UI keeps running.
cd "$(dirname "$0")/.."
for pid in $(netstat -ano | grep ":5100 " | grep LISTENING | awk '{print $5}' | sort -u); do taskkill //PID $pid //F >/dev/null 2>&1; done
(cd server && ENV_FILE="$(pwd)/../.env.qa" nohup node src/server.js > ../qa-artifacts/qa-api.log 2>&1 &)
for i in $(seq 1 40); do curl -s localhost:5100/health >/dev/null && { echo "QA API restarted"; exit 0; }; sleep 0.5; done
echo "QA API did not come back"; exit 1
