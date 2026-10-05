#!/bin/bash
# Run through SSM on the pilot host after uploading the deployment bundle.
set -euo pipefail
image=${1:?Pass the immutable ECR image digest}
hostname=${2:?Pass the API DNS hostname}
region=${3:?Pass the AWS region}
[[ "$image" =~ ^[0-9]{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com/budget-buddy-pilot@sha256:[a-f0-9]{64}$ ]]
[[ "$hostname" =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ && "$hostname" == *.* ]]
[[ "$region" =~ ^[a-z]+-[a-z]+-[0-9]+$ ]]
cd /opt/budget-buddy
test -f bootstrap.ready
# Deployment archives can retain a developer's Mac UID and mode 0700.
# The restricted Caddy container must be able to read its non-secret config.
chown root:root infra/aws/Caddyfile
chmod 0644 infra/aws/Caddyfile
umask 077
aws ssm get-parameter --region "$region" --name /budget-buddy/pilot/runtime \
  --with-decryption --query Parameter.Value --output text > runtime.env.new
test -s runtime.env.new
mv runtime.env.new runtime.env
printf 'API_IMAGE=%s\nAPI_HOSTNAME=%s\n' "$image" "$hostname" > image.env

docker_config=$(mktemp -d)
trap 'rm -rf "$docker_config"' EXIT
aws ecr get-login-password --region "$region" |
  docker --config "$docker_config" login --username AWS --password-stdin "${image%%/*}"
compose=(docker --config "$docker_config" compose --env-file runtime.env --env-file image.env -f compose.aws.yml)
"${compose[@]}" config --quiet
"${compose[@]}" pull db api caddy migrate
"${compose[@]}" up -d --wait --wait-timeout 120 db
"${compose[@]}" run --rm migrate
"${compose[@]}" up -d --wait --wait-timeout 120 api caddy
"${compose[@]}" exec -T api wget -q -O - http://127.0.0.1:8080/readyz
