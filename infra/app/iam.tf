resource "aws_iam_role" "agent" {
  name = "${var.name}-agent"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{
    Effect    = "Allow", Principal = { Service = "bedrock-agentcore.amazonaws.com" }, Action = "sts:AssumeRole",
    Condition = { StringEquals = { "aws:SourceAccount" = data.aws_caller_identity.current.account_id }, ArnLike = { "aws:SourceArn" = "arn:aws:bedrock-agentcore:${var.region}:${data.aws_caller_identity.current.account_id}:*" } }
  }] })
}

resource "aws_iam_role_policy" "agent" {
  role = aws_iam_role.agent.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = "*" },
    { Effect = "Allow", Action = ["ecr:BatchGetImage", "ecr:GetDownloadUrlForLayer"], Resource = data.aws_ecr_repository.agent.arn },
    { Effect = "Allow", Action = ["dynamodb:Scan"], Resource = [data.aws_dynamodb_table.music.arn, aws_dynamodb_table.features.arn] },
    { Effect = "Allow", Action = ["bedrock:InvokeModel"], Resource = var.bedrock_model_arns },
    { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams", "logs:CreateLogGroup"], Resource = "arn:aws:logs:${var.region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/bedrock-agentcore/runtimes/*" },
    { Effect = "Allow", Action = ["logs:DescribeLogGroups"], Resource = "*" }
  ] })
}

resource "aws_iam_role_policy" "web" {
  name = "${var.name}-chat"
  role = var.amplify_compute_role_name
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["bedrock-agentcore:InvokeAgentRuntime"], Resource = [aws_bedrockagentcore_agent_runtime.chat.agent_runtime_arn, "${aws_bedrockagentcore_agent_runtime.chat.agent_runtime_arn}/runtime-endpoint/*"] },
    { Effect = "Allow", Action = ["dynamodb:GetItem", "dynamodb:UpdateItem"], Resource = aws_dynamodb_table.chat.arn },
    { Effect = "Allow", Action = ["dynamodb:BatchGetItem"], Resource = data.aws_dynamodb_table.music.arn }
  ] })
}

resource "aws_iam_role" "enrichment" {
  name               = "${var.name}-enrichment"
  assume_role_policy = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }] })
}

resource "aws_iam_role_policy" "enrichment" {
  role = aws_iam_role.enrichment.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["dynamodb:Scan"], Resource = [data.aws_dynamodb_table.music.arn, aws_dynamodb_table.features.arn] },
    { Effect = "Allow", Action = ["dynamodb:PutItem"], Resource = aws_dynamodb_table.features.arn },
    { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "${aws_cloudwatch_log_group.enrichment.arn}:*" }
  ] })
}
