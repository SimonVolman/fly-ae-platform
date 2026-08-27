# Deployment environments

## Independent targets

| Target | Domain | Stack | Trigger | Frontend |
| --- | --- | --- | --- | --- |
| `legacy-production` | `fly.turbulencesimtrading.com` | `fly-ae-v0-prod` | Manual `.github/workflows/deploy-v0-prod.yml` | Application |
| `fly-ae-maintenance` | `fly.ae` | `fly-ae-domain-prod` | Manual `.github/workflows/deploy-fly-ae.yml` | Maintenance |
| `fly-ae-application` | `fly.ae` | `fly-ae-domain-prod` | Manual `.github/workflows/deploy-fly-ae-app.yml` | Application |

`chatgpt.site` is not a deployment target.

The legacy and `fly.ae` targets are independent. They have separate
CloudFormation bootstrap and application stacks, ACM certificates, CloudFront
distributions, S3 buckets, DynamoDB tables, Lambda functions, IAM roles and
Secrets Manager paths. Deploying one target does not replace the DNS alias or
resources of the other target.

During the one-time split, the new `fly.ae` stack is first deployed with
`enable_custom_domain=false`. This provisions and verifies its default
CloudFront endpoint without competing for the `fly.ae` alias currently owned
by the legacy stack. After the legacy stack is moved back to its old domain,
the maintenance workflow is rerun with `enable_custom_domain=true` to complete
the Route53 cutover.

## Legacy deployment

The existing `.github/workflows/deploy-v0-prod.yml` configuration continues to
deploy the application to `fly.turbulencesimtrading.com`. It is manual-only so
an infrastructure-preparation commit cannot move the live alias prematurely.
Its existing stack, resource names and hosted zone remain unchanged.

## fly.ae maintenance release

The maintenance workflow deploys the backend as on-demand AWS Lambda behind API
Gateway, keeps documents in S3 and metadata in DynamoDB, then builds the
frontend with `NEXT_PUBLIC_MAINTENANCE_MODE=true`, publishes the static export
to S3 behind CloudFront, invalidates CloudFront, and checks `https://fly.ae`.

It is manual-only. Preparing or pushing the deployment configuration does not
change the running `fly.ae` site. Re-running it later is also the rollback path
from the application release to the maintenance page.

The `fly.ae` Route 53 hosted zone is `Z10483352SBZ9U6ULG9OH`.

## Required fly.ae AWS setup

The new target uses its own GitHub OIDC role:

```text
arn:aws:iam::808906610083:role/fly-ae-domain-prod-github-deploy
```

Run `infra/aws/bootstrap-fly-ae.sh` once from the prepared repository revision
to create the separate global and regional bootstrap stacks. The script uses
the local CloudFormation templates and is intentionally not run as part of
preparation. The ACM certificate is issued in `us-east-1`.

## Production application release

When the application is ready, manually run `Deploy fly.ae application on
Lambda` and enter `deploy-fly.ae` in the confirmation field. It reuses the
`fly-ae-domain-prod` stack and builds the frontend with
`NEXT_PUBLIC_MAINTENANCE_MODE=false`. Until that workflow is explicitly run,
the maintenance release remains active on `fly.ae`; the legacy domain is not
affected either way.

Both `fly.ae` workflows use the `fly-ae-domain-prod` concurrency group, so they
cannot publish maintenance and application releases at the same time. The
application workflow is intentionally manual-only; an automatic `main` trigger
can be added after the first production cutover is accepted.
