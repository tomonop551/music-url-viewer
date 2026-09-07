output "repository_url" { value = aws_ecr_repository.agent.repository_url }

output "repository_name" { value = aws_ecr_repository.agent.name }

output "state_bucket" { value = aws_s3_bucket.state.id }
