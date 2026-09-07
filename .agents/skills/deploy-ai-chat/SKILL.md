---
name: deploy-ai-chat
description: Deploy, update, verify, or roll back this repository's music companion on AWS using Terraform, an ARM64 AgentCore image, and Amplify SSR. Use for deployment preparation or execution, not ordinary chat UI edits.
---

# Deploy the music companion

## Scope and execution

Work from the repository root. Run commands through `mise`; all repository paths below are relative to that root. Read `AGENTS.md`, `infra/app/variables.tf`, the relevant Terraform resource files, and `scripts/write-runtime-env.mjs` before preparing a deployment. Use [the architecture notes](../../../docs/ai-chat.md) when validating runtime behavior or metadata coverage.

Determine whether the requested operation is preparation, a first deployment, an update, verification, or rollback. Reuse the target environment and authorization already established in the conversation. Loading this skill alone does not authorize a deployment. Complete local checks, resolve inputs, and prepare a concrete plan before requesting any additional authorization that is actually needed. Do not ask again for an action already authorized within that scope.

Resolve the AWS account/profile and region, Terraform backend and resource prefix, existing catalog table, SSR compute role, available model/profile and invocation ARNs, MusicBrainz contact User-Agent, and Amplify app/branch/origin from the current environment or user-provided configuration. Ask only for missing values needed for the selected operation. Do not copy actual credentials, catalog data, environment-specific identifiers, or Terraform state into tracked examples or this skill.

AWS authentication is SSO-only. Before any AWS, Terraform, ECR, or Amplify operation, use the profile configured for the target environment and check that its SSO session is valid:

```sh
export AWS_PROFILE="<sso-profile-name>"
mise exec -- aws sts get-caller-identity --profile "$AWS_PROFILE" >/dev/null
```

The check must succeed before continuing. If it fails because the SSO session is missing or expired, run `mise exec -- aws sso login --profile "$AWS_PROFILE"`, then repeat the identity check. Stop if the check still fails. Do not record, print, or add a real profile name, account name, account number, access key, or SSO start URL to the repository. Pass `--profile "$AWS_PROFILE"` to every AWS CLI command; Terraform inherits the same selection through `AWS_PROFILE`. Treat the returned identity only as a verification result and do not include its account-specific values in reports or committed files.

For a first deployment, follow the bootstrap, image, infrastructure, and frontend sequence below. For an update, inspect the existing outputs and state, skip bootstrap creation, and run only the affected stages. For preparation-only requests, stop after local validation and the requested plan; do not push images, apply changes, or start an Amplify deployment. For rollback, use the final section.

Before applying, inspect the saved plan for target account/region, resource changes, and any replacement or deletion. The existing music table is a data source and must not be recreated. Apply the reviewed saved plan; regenerate and review it if configuration or target inputs change. On a failed mutation, inspect the actual resource/job status before retrying. Stop for missing permissions, an unexpected replacement/deletion, or an unresolved service error instead of repeatedly applying or weakening permissions.

Run the relevant local checks before deployment: frontend type/lint/build checks for frontend changes, the agent tests and ARM64 image build for agent changes, and `terraform fmt -check`, `init`, and `validate` for Terraform changes. Keep provider lock files committed. Use mocked tests for preparation when live AWS calls are outside the request.

Use the validated AWS SSO profile for all AWS access. Keep account-specific configuration, state, plans, actual catalog data, and environment files out of version control. All example values below are placeholders. No deployment is performed by a Next.js build.

## Terraform layout

```text
infra/
  bootstrap/
    main.tf        # Provider and Terraform requirements
    s3.tf          # Private remote state storage
    ecr.tf         # Agent image repository
    variables.tf
    outputs.tf
  app/
    main.tf        # Provider, backend, and shared account lookup
    dynamodb.tf    # Catalog lookup, features, and chat state
    iam.tf         # Runtime, worker, and frontend permissions
    agentcore.tf   # AgentCore runtime, image lookup, and runtime logs
    lambda.tf      # Metadata worker, schedule, logs, and error alarm
    variables.tf
    outputs.tf
```

Files in each directory form one Terraform root module. Resource addresses remain independent of filenames.

## 1. Bootstrap

Prerequisites: mise, Terraform 1.10+, AWS CLI, an SSO profile with the required permissions, Docker with ARM64 support, access to an existing music table, and a Bedrock Converse model supporting tools and `toolChoice.any` in the chosen region. The default region is Tokyo. Select the model/profile ID and its exact invocation ARNs before planning; cross-region profiles also need their destination model ARNs. Complete the SSO identity check in the scope section first.

Create `infra/bootstrap/terraform.tfvars` with a unique `state_bucket_name` and optional `region`/`name`. Then:

```sh
mise exec -- terraform -chdir=infra/bootstrap init
mise exec -- terraform -chdir=infra/bootstrap plan -out=bootstrap.tfplan
mise exec -- terraform -chdir=infra/bootstrap apply bootstrap.tfplan
```

Bootstrap initially uses local state. Keep it private and backed up. After the bucket exists, add an S3 backend block to the bootstrap configuration and migrate with `mise exec -- terraform -chdir=infra/bootstrap init -migrate-state`, using a distinct key such as `music-companion/bootstrap.tfstate`. Never use the app's state key for bootstrap. The state bucket has versioning, encryption, public access blocking, TLS-only access, and destruction protection. Grant state access only to infrastructure operators and the deployment role.

## 2. Publish the agent image

Read the repository URL from `mise exec -- terraform -chdir=infra/bootstrap output -raw repository_url`. Substitute your own registry, region, and unique release tag:

```sh
mise exec -- aws ecr get-login-password --profile "$AWS_PROFILE" --region ap-northeast-1 | mise exec -- docker login --username AWS --password-stdin REGISTRY_HOST
mise exec -- docker build --platform linux/arm64 -t REPOSITORY_URL:RELEASE_TAG agent
mise exec -- docker push REPOSITORY_URL:RELEASE_TAG
mise exec -- aws ecr describe-images --profile "$AWS_PROFILE" --repository-name REPOSITORY_NAME --image-ids imageTag=RELEASE_TAG --query 'imageDetails[0].imageDigest' --output text
```

The immutable release tag must be new for each build. Use the returned digest in app Terraform. Terraform owns infrastructure; the image build/push is a separate artifact step. The container runs without local credential files or embedded keys.

## 3. Configure and plan the app infrastructure

Copy `infra/app/terraform.tfvars.example` to `infra/app/terraform.tfvars` and replace every placeholder. Use the existing Amplify **SSR compute role name**, not its build service role. Terraform attaches a narrowly scoped policy to this role and leaves its other policies in place. If there is no SSR compute role, provision and assign one before this step.

Copy `infra/app/backend.hcl.example` to a private local backend file, preferably outside the repository. Set the state bucket, region, and app-specific key. Do not put credentials in backend configuration.

```sh
mise exec -- terraform -chdir=infra/app init -backend-config=/absolute/path/to/backend.hcl
mise exec -- terraform -chdir=infra/app plan -out=app.tfplan
mise exec -- terraform -chdir=infra/app apply app.tfplan
```

The MusicBrainz User-Agent must identify the application/version and a working contact URL. The example contact URL must be replaced. Each environment should have its own resource prefix, session table, image selection, and Terraform state key.

The Lambda schedule begins after apply. Initial metadata population normally takes several runs. The CloudWatch error alarm is created without an external notification destination; connect your notification topic if notifications are required. Inspect worker counters and feature-table matched/unknown counts before assessing mood recommendations.

## 4. Configure Amplify SSR

Configure these application environment values:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_AWS_REGION` | AWS region |
| `MUSIC_TABLE_NAME` | Existing catalog table name |
| `AGENTCORE_RUNTIME_ARN` | Terraform `agentcore_runtime_arn` output |
| `CHAT_TABLE_NAME` | Terraform `chat_table_name` output |
| `APP_ORIGIN` | Exact browser origin, such as `https://music.example.com`, without a trailing slash |
| `CHAT_DAILY_LIMIT` | Positive integer; default 200 requests per UTC day |

Amplify build variables must be made available to SSR. In the existing build commands, run `mise exec -- node scripts/write-runtime-env.mjs` immediately before `mise exec -- pnpm build`. This creates the ignored `.env.production` file from an explicit allowlist. It does not export AWS access keys or the rest of the build environment. Retain the existing mise installation and dependency-install steps.

Verify that the deployed branch uses the compute role specified in Terraform. Redeploy the frontend after changing the runtime ARN or table configuration. Missing chat configuration produces a friendly unavailable response while the music list continues to work.

If local verification is requested, copy `.env.example` to `.env.local`, fill in the outputs, and set `APP_ORIGIN=http://localhost:3000`. Preserve any existing local configuration. Local requests use the configured AWS resources and model; isolated UI tests use mocks.

## 5. Verify and roll back

Verify the runtime becomes ready, the scheduled worker succeeds, and the frontend can read the current catalog. Send a mood request, ask for alternatives, request high addictiveness, and reset the conversation. Check the daily cap and error recovery with a non-production environment. A real deployment test is required to verify model access, AgentCore credential metadata compatibility, Amplify timeouts, and metadata coverage.

To roll back the agent, restore the previous immutable image digest and apply the reviewed plan. Roll back the frontend through its existing deployment workflow. Do not destroy or replace the source music table. Deleting the new session table removes chat history; deleting the features table requires metadata to be rebuilt.

## Completion report

Report the actual target environment, applied plan summary, deployed image digest, Amplify deployment status, and verification results relevant to the operation. Keep identifiers out of tracked documentation. Clearly separate completed local checks from live AWS verification. If deployment was only prepared or a service check failed, state what remains; do not describe the feature as deployed or validated from a successful build alone.
