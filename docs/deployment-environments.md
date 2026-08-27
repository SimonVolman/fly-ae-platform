# Deployment environments

## Independent targets

| Environment | Domain | Stack | Trigger | Frontend |
| --- | --- | --- | --- | --- |
| `dev` | `dev.fly.ae` | `fly-ae-v0-prod` | Manual `.github/workflows/deploy-dev.yml` | Application |
| `prod` | `fly.ae` | `fly-ae-domain-prod` | Manual `.github/workflows/deploy-fly-ae.yml` | Maintenance |
| `prod` | `fly.ae` | `fly-ae-domain-prod` | Manual `.github/workflows/deploy-fly-ae-app.yml` | Application |

`chatgpt.site` is not a deployment target.

DEV and PROD are independent. They have separate CloudFormation application
stacks, ACM certificates, CloudFront distributions, S3 buckets, DynamoDB
tables, Lambda functions, IAM roles and Secrets Manager paths. Deploying one
environment does not replace the DNS alias or resources of the other.

The DEV stack keeps the physical stack and resource names created before the
environment split (`fly-ae-v0-prod`). They are retained to preserve DynamoDB,
S3 and Secrets Manager data; all user-facing deployment names use DEV.

## DEV deployment

The manual `.github/workflows/deploy-dev.yml` workflow deploys the application
to `dev.fly.ae`. It uses the `dev` GitHub environment and the `fly-ae-dev`
concurrency group.

Both `dev.fly.ae` and `fly.ae` are managed in Route 53 hosted zone
`Z10483352SBZ9U6ULG9OH`.

## PROD maintenance release

The PROD maintenance workflow deploys the backend as on-demand AWS Lambda
behind API Gateway, keeps documents in S3 and metadata in DynamoDB, then builds
the frontend with `NEXT_PUBLIC_MAINTENANCE_MODE=true`, publishes the static
export to S3 behind CloudFront, invalidates CloudFront, and checks
`https://fly.ae`.

It is manual-only. Re-running it is the rollback path from the application
release to the maintenance page.

## PROD AWS setup

PROD uses its own GitHub OIDC role:

```text
arn:aws:iam::808906610083:role/fly-ae-domain-prod-github-deploy
```

Run `infra/aws/bootstrap-fly-ae.sh` to update the separate global and regional
PROD bootstrap stacks. The ACM certificate is issued in `us-east-1`.

## PROD application release

When the application is ready, manually run `Deploy PROD application (fly.ae)
on Lambda` and enter `deploy-fly.ae` in the confirmation field. It reuses the
`fly-ae-domain-prod` stack and builds the frontend with
`NEXT_PUBLIC_MAINTENANCE_MODE=false`. Until that workflow is explicitly run,
the maintenance release remains active on `fly.ae`; DEV is not affected.

Both PROD workflows use the `fly-ae-domain-prod` concurrency group, so they
cannot publish maintenance and application releases at the same time.
