data "aws_ecr_repository" "agent" { name = var.ecr_repository_name }

resource "aws_bedrockagentcore_agent_runtime" "chat" {
  agent_runtime_name = replace(var.name, "-", "_")
  role_arn           = aws_iam_role.agent.arn
  agent_runtime_artifact {
    container_configuration {
      container_uri = "${data.aws_ecr_repository.agent.repository_url}@${var.agent_image_digest}"
    }
  }
  network_configuration { network_mode = "PUBLIC" }
  protocol_configuration { server_protocol = "HTTP" }
  lifecycle_configuration = [{
    idle_runtime_session_timeout = 60
    max_lifetime                 = 3600
  }]
  environment_variables = {
    MUSIC_TABLE_NAME    = var.music_table_name
    FEATURES_TABLE_NAME = aws_dynamodb_table.features.name
    BEDROCK_MODEL_ID    = var.bedrock_model_id
    AWS_REGION          = var.region
  }
  depends_on = [aws_iam_role_policy.agent]
}

resource "aws_cloudwatch_log_group" "agent" {
  name              = "/aws/bedrock-agentcore/runtimes/${aws_bedrockagentcore_agent_runtime.chat.agent_runtime_id}-DEFAULT"
  retention_in_days = 14
}
