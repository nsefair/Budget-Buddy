#!/bin/zsh
set -euo pipefail

cd -- "${0:A:h}"
export PATH="/opt/homebrew/opt/node@22/bin:/opt/homebrew/bin:$PATH"
export DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"

if ! docker --context desktop-linux info >/dev/null 2>&1; then
  print "Start Docker Desktop, wait until it is ready, then run this file again."
  read -r "?Press Return to close."
  exit 1
fi

if [[ ! -f .env || ! -f .env.local ]]; then
  print "Local configuration is missing. See docs/local-setup-and-beta-readiness.md."
  read -r "?Press Return to close."
  exit 1
fi

docker --context desktop-linux compose --env-file .env --env-file .env.local up -d db
docker --context desktop-linux compose --env-file .env --env-file .env.local run --rm migrate
docker --context desktop-linux compose --env-file .env --env-file .env.local up -d --build api
curl --fail --silent http://localhost:8080/readyz
print "\nBackend ready. Opening the native workspace."
open -a Xcode "$PWD/ios/BudgetBuddy.xcworkspace"

if [[ "$(curl --silent --max-time 2 http://localhost:8081/status || true)" == "packager-status:running" ]]; then
  print "Metro is already running on port 8081. Keep its terminal open while using the app."
  exit 0
fi

print "Keep this terminal open. Use your iPhone on the same Wi-Fi as this Mac."
exec npx expo start --dev-client --lan
