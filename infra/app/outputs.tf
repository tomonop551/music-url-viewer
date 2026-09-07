output "agentcore_runtime_arn" { value = aws_bedrockagentcore_agent_runtime.chat.agent_runtime_arn }
output "chat_table_name" { value = aws_dynamodb_table.chat.name }
output "features_table_name" { value = aws_dynamodb_table.features.name }
output "enrichment_function_name" { value = aws_lambda_function.enrichment.function_name }
