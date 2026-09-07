<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:mise-rules -->
# Development Tools Rule
When developing in this directory, you MUST ALWAYS use `mise` to run commands (e.g., `mise run <command>` or `mise exec -- <command>`). Do not use global package managers or system executables directly if they are managed by `mise`.
<!-- END:mise-rules -->

<!-- BEGIN:deployment-rules -->
# AWS Deployment Rules
For deployment preparation, execution, verification, or rollback, use the repository skill at `.agents/skills/deploy-ai-chat/SKILL.md`.

AWS access is SSO-only. Before any AWS CLI, Terraform, ECR, or Amplify operation, set the profile configured for the target environment and verify the session:

```bash
export AWS_PROFILE="<sso-profile-name>"
mise exec -- aws sts get-caller-identity --profile "$AWS_PROFILE" >/dev/null
```

If the check reports an expired or missing session, run `mise exec -- aws sso login --profile "$AWS_PROFILE"` and repeat the check. Stop if it still fails. Pass `--profile "$AWS_PROFILE"` to AWS CLI commands; Terraform inherits `AWS_PROFILE`.

Never commit credentials, SSO URLs, real profile or account names, account numbers, catalog data, Terraform state, plan files, or environment-specific variable files. Keep Terraform provider lock files and placeholder examples under version control. The Terraform app root keeps resources split into `dynamodb.tf`, `iam.tf`, `agentcore.tf`, and `lambda.tf`.
<!-- END:deployment-rules -->
