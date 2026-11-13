#!/bin/bash
# Longboat Cruise: serve this folder on port 8915 (only if nothing is serving yet) and print the URL.
# ./run.sh         start or reuse the server
# ./run.sh --open  same, then open Chrome
cd "$(dirname "$0")"
PORT=8915
URL="http://localhost:$PORT/"
if ! curl -s -o /dev/null --max-time 2 "$URL"; then
  nohup python3 -m http.server $PORT >/tmp/longboat-cruise-server.log 2>&1 &
  for i in 1 2 3 4 5 6 7 8 9 10; do curl -s -o /dev/null --max-time 1 "$URL" && break; sleep 0.3; done
fi
if curl -s -o /dev/null --max-time 2 "$URL"; then echo "Longboat Cruise: $URL"; else echo "Server did not start, see /tmp/longboat-cruise-server.log"; exit 1; fi
if [ "$1" = "--open" ]; then open -a "Google Chrome" "$URL" 2>/dev/null || open "$URL"; fi
