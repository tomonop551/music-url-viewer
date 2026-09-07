resource "aws_cloudwatch_log_group" "enrichment" {
  name              = "/aws/lambda/${var.name}-enrichment"
  retention_in_days = 14
}

data "archive_file" "enrichment" {
  type        = "zip"
  output_path = "${path.module}/.terraform/enrichment.zip"
  source_dir  = "${path.module}/../../agent"
  excludes    = ["__pycache__", "tests", "Dockerfile", "main.py", "recommender.py", "requirements.txt", ".dockerignore"]
}

resource "aws_lambda_function" "enrichment" {
  function_name                  = "${var.name}-enrichment"
  role                           = aws_iam_role.enrichment.arn
  filename                       = data.archive_file.enrichment.output_path
  source_code_hash               = data.archive_file.enrichment.output_base64sha256
  runtime                        = "python3.13"
  handler                        = "enrich.handler"
  architectures                  = ["arm64"]
  memory_size                    = 256
  timeout                        = 300
  reserved_concurrent_executions = 1
  environment {
    variables = {
      MUSIC_TABLE_NAME       = var.music_table_name
      FEATURES_TABLE_NAME    = aws_dynamodb_table.features.name
      MUSICBRAINZ_USER_AGENT = var.musicbrainz_user_agent
    }
  }
  depends_on = [aws_iam_role_policy.enrichment]
}

resource "aws_cloudwatch_event_rule" "enrichment" {
  name                = "${var.name}-enrichment"
  schedule_expression = "rate(15 minutes)"
}

resource "aws_cloudwatch_event_target" "enrichment" {
  rule = aws_cloudwatch_event_rule.enrichment.name
  arn  = aws_lambda_function.enrichment.arn
}

resource "aws_lambda_permission" "schedule" {
  statement_id  = "AllowScheduledRefresh"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.enrichment.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.enrichment.arn
}

resource "aws_cloudwatch_metric_alarm" "enrichment_errors" {
  alarm_name          = "${var.name}-enrichment-errors"
  namespace           = "AWS/Lambda"
  metric_name         = "Errors"
  statistic           = "Sum"
  period              = 900
  evaluation_periods  = 1
  threshold           = 0
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  dimensions          = { FunctionName = aws_lambda_function.enrichment.function_name }
}
