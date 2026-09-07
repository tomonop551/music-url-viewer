data "aws_dynamodb_table" "music" { name = var.music_table_name }

resource "aws_dynamodb_table" "features" {
  name         = "${var.name}-features"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "message_id"
  attribute {
    name = "message_id"
    type = "S"
  }
  server_side_encryption { enabled = true }
}

resource "aws_dynamodb_table" "chat" {
  name         = "${var.name}-chat"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"
  attribute {
    name = "id"
    type = "S"
  }
  ttl {
    attribute_name = "expires_at"
    enabled        = true
  }
  server_side_encryption { enabled = true }
}
