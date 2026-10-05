#!/bin/zsh
set -euo pipefail
cd -- "${0:A:h}"
export PATH="/opt/homebrew/bin:$PATH"
if ! python3 infra/aws/view-users.py; then
  print "Could not load users. If your AWS login expired, run:"
  print "aws login --profile budget-buddy --region us-east-2"
  read -r "?Press Return to close."
  exit 1
fi
open -a Safari "$PWD/.cache/admin/aws-users.html"
