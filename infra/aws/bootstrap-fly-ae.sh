#!/usr/bin/env bash
set -euo pipefail

EXPECTED_ACCOUNT_ID="808906610083"
APPLICATION_REGION="eu-central-1"
GLOBAL_REGION="us-east-1"
HOSTED_ZONE_ID="Z10483352SBZ9U6ULG9OH"
FRONTEND_DOMAIN="fly.ae"
RESOURCE_PREFIX="fly-ae-domain-prod"
ENVIRONMENT_NAME="domain-prod"
SECRET_PATH_PREFIX="fly-ae/domain-prod"
SECRET_DESCRIPTION_PREFIX="fly.ae domain production"
APPLICATION_STACK_NAME="fly-ae-domain-prod"
GLOBAL_BOOTSTRAP_STACK_NAME="fly-ae-domain-bootstrap-global"
REGIONAL_BOOTSTRAP_STACK_NAME="fly-ae-domain-bootstrap-regional"
BUDGET_EMAIL="simon.volman@gmail.com"
ARTIFACT_BUCKET="fly-ae-domain-sam-artifacts-${EXPECTED_ACCOUNT_ID}-${APPLICATION_REGION}"
FRONTEND_BUCKET="${RESOURCE_PREFIX}-frontend-${EXPECTED_ACCOUNT_ID}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

actual_account_id="$(aws sts get-caller-identity --query Account --output text)"
if [[ "${actual_account_id}" != "${EXPECTED_ACCOUNT_ID}" ]]; then
  echo "Refusing to continue: expected AWS account ${EXPECTED_ACCOUNT_ID}, got ${actual_account_id}." >&2
  exit 1
fi

aws cloudformation deploy \
  --region "${GLOBAL_REGION}" \
  --stack-name "${GLOBAL_BOOTSTRAP_STACK_NAME}" \
  --template-file "${SCRIPT_DIR}/bootstrap-global.yml" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    FrontendDomainName="${FRONTEND_DOMAIN}" \
    HostedZoneId="${HOSTED_ZONE_ID}" \
    BudgetEmail="${BUDGET_EMAIL}" \
    GitHubOidcProviderArn="arn:aws:iam::${EXPECTED_ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com" \
    ApplicationStackName="${APPLICATION_STACK_NAME}" \
    ResourcePrefix="${RESOURCE_PREFIX}" \
    EnvironmentName="${ENVIRONMENT_NAME}" \
    SecretPathPrefix="${SECRET_PATH_PREFIX}" \
    ArtifactBucketName="${ARTIFACT_BUCKET}" \
    FrontendBucketName="${FRONTEND_BUCKET}"

aws cloudformation deploy \
  --region "${APPLICATION_REGION}" \
  --stack-name "${REGIONAL_BOOTSTRAP_STACK_NAME}" \
  --template-file "${SCRIPT_DIR}/bootstrap-regional.yml" \
  --parameter-overrides \
    ArtifactBucketName="${ARTIFACT_BUCKET}" \
    EnvironmentName="${ENVIRONMENT_NAME}" \
    SecretPathPrefix="${SECRET_PATH_PREFIX}" \
    SecretDescriptionPrefix="${SECRET_DESCRIPTION_PREFIX}"

aws cloudformation describe-stacks \
  --region "${GLOBAL_REGION}" \
  --stack-name "${GLOBAL_BOOTSTRAP_STACK_NAME}" \
  --query 'Stacks[0].Outputs' \
  --output table
