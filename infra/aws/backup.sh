#!/bin/bash
# Daily encrypted off-host PostgreSQL backup. Credentials stay in the EC2 role.
set -euo pipefail
cd /opt/budget-buddy
umask 077
bucket=${1:?Pass the private backup bucket}
region=${2:-us-east-2}
backup=$(mktemp /opt/budget-buddy/database.XXXXXX.dump)
trap 'rm -f "$backup"' EXIT
compose=(docker compose --env-file runtime.env --env-file image.env -f compose.aws.yml)
"${compose[@]}" exec -T db pg_dump -U budget_buddy -d budget_buddy --format=custom > "$backup"
test -s "$backup"
aws s3 cp "$backup" "s3://$bucket/database/$(date -u +%Y-%m-%dT%H-%M-%SZ).dump" --region "$region" --sse AES256 --only-show-errors
