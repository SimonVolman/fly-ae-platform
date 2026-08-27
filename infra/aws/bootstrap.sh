#!/usr/bin/env bash
set -euo pipefail

EXPECTED_ACCOUNT_ID="808906610083"
APPLICATION_REGION="eu-central-1"
GLOBAL_REGION="us-east-1"
HOSTED_ZONE_ID="Z10483352SBZ9U6ULG9OH"
FRONTEND_DOMAIN="fly.ae"
LEGACY_HOSTED_ZONE_ID="Z07421363JCB3HEDXSCDK"
LEGACY_FRONTEND_DOMAIN="fly.turbulencesimtrading.com"
BUDGET_EMAIL="simon.volman@gmail.com"
ARTIFACT_BUCKET="fly-ae-sam-artifacts-${EXPECTED_ACCOUNT_ID}-${APPLICATION_REGION}"
RAW_BASE_URL="https://raw.githubusercontent.com/SimonVolman/fly-ae-platform/main/infra/aws"

actual_account_id="$(aws sts get-caller-identity --query Account --output text)"
if [[ "${actual_account_id}" != "${EXPECTED_ACCOUNT_ID}" ]]; then
  echo "Refusing to continue: expected AWS account ${EXPECTED_ACCOUNT_ID}, got ${actual_account_id}." >&2
  exit 1
fi

bootstrap_dir="$(mktemp -d)"
trap 'rm -rf "${bootstrap_dir}"' EXIT

curl -fsSL "${RAW_BASE_URL}/bootstrap-global.yml" -o "${bootstrap_dir}/bootstrap-global.yml"
curl -fsSL "${RAW_BASE_URL}/bootstrap-regional.yml" -o "${bootstrap_dir}/bootstrap-regional.yml"

aws cloudformation deploy \
  --region "${GLOBAL_REGION}" \
  --stack-name fly-ae-bootstrap-global \
  --template-file "${bootstrap_dir}/bootstrap-global.yml" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    FrontendDomainName="${FRONTEND_DOMAIN}" \
    HostedZoneId="${HOSTED_ZONE_ID}" \
    CreateLegacyCertificate="true" \
    LegacyFrontendDomainName="${LEGACY_FRONTEND_DOMAIN}" \
    LegacyHostedZoneId="${LEGACY_HOSTED_ZONE_ID}" \
    BudgetEmail="${BUDGET_EMAIL}" \
    GitHubOidcProviderArn="arn:aws:iam::${EXPECTED_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"

aws cloudformation deploy \
  --region "${APPLICATION_REGION}" \
  --stack-name fly-ae-bootstrap-regional \
  --template-file "${bootstrap_dir}/bootstrap-regional.yml" \
  --parameter-overrides ArtifactBucketName="${ARTIFACT_BUCKET}"

aws cloudformation describe-stacks \
  --region "${GLOBAL_REGION}" \
  --stack-name fly-ae-bootstrap-global \
  --query 'Stacks[0].Outputs' \
  --output table
