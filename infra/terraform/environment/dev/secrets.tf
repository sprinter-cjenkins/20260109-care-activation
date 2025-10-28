# MySQL Credentials Secret
resource "aws_secretsmanager_secret" "care-activation-mysql-dev" {
  name        = "${terraform.workspace}/care-activation-mysql-credentials"
  description = "MySQL credentials for development database"
}

data "aws_secretsmanager_secret_version" "dev_db" {
  depends_on = [aws_secretsmanager_secret.care-activation-mysql-dev]
  secret_id  = aws_secretsmanager_secret.care-activation-mysql-dev.id
}

locals {
  db_username = jsondecode(data.aws_secretsmanager_secret_version.dev_db.secret_string).db_username
  db_password = jsondecode(data.aws_secretsmanager_secret_version.dev_db.secret_string).db_password
}

# MySQL connection secret
resource "aws_secretsmanager_secret" "care-activation-mysql-dev-db-string" {
  name        = "${terraform.workspace}/care-activation-mysql-connection-string"
  description = "MySQL connectionString for development database"
}

resource "aws_secretsmanager_secret_version" "care-activation-mysql-dev-version" {
  secret_id     = aws_secretsmanager_secret.care-activation-mysql-dev-db-string.id
  secret_string = "mysql://${local.db_username}:${local.db_password}@${aws_db_instance.dev_mysql.endpoint}"
}

# KMS Key
resource "aws_kms_key" "care-activation-mysql-dev-kms-key" {
  description             = "Care Activation MySQL ${terraform.workspace} KMS key for RDS encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid    = "Allow administration of the key"
        Effect = "Allow"
        Principal = {
          AWS = [
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:user/cjenkins-ca",
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:user/jpaad-ca",
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:user/skumar-ca"
          ]
        }
        Action = [
          "kms:*"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow RDS usage of the key"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_kms_alias" "care-activation-mysql-dev-kms-alias" {
  name          = "alias/rds-${terraform.workspace}-key"
  target_key_id = aws_kms_key.care-activation-mysql-dev-kms-key.id
}

# Bland AI
data "aws_secretsmanager_secret" "bland_ai_api_key" {
  name = "prod/bland-api-key"
}

locals {  
  # ECS secret references (ARN format for valueFrom)
  bland_ai_api_key_arn              = "${data.aws_secretsmanager_secret.bland_ai_api_key.arn}:API_KEY::"
  bland_webhook_signature_key_arn   = "${data.aws_secretsmanager_secret.bland_ai_api_key.arn}:WEBHOOK_SIGNATURE_KEY::"
  bland_webhook_url_arn             = "${data.aws_secretsmanager_secret.bland_ai_api_key.arn}:WEBHOOK_URL::"
  bland_from_arn                    = "${data.aws_secretsmanager_secret.bland_ai_api_key.arn}:FROM::"
  bland_citation_schema_ids_arn     = "${data.aws_secretsmanager_secret.bland_ai_api_key.arn}:CITATION_SCHEMA_IDS::"
}

