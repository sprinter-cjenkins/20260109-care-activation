# Datadog Task Role
resource "aws_iam_role" "datadog_task_role" {
  name = "datadog-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "datadog_task_role_policy" {
  name = "fargate-task-role-default-policy"
  role = aws_iam_role.datadog_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecs:ListClusters",
          "ecs:ListContainerInstances",
          "ecs:DescribeContainerInstances"
        ]
        Resource = "*"
      }
    ]
  })
}

# Datadog Task Execution Role
resource "aws_iam_role" "datadog_task_execution_role" {
  name = "datadog-task-execution-role"
  path = "/"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "datadog_secret_access" {
  name = "datadog-secret-access"
  role = aws_iam_role.datadog_task_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = data.aws_secretsmanager_secret.datadog_api_key.arn
      }
    ]
  })
}

data "aws_secretsmanager_secret" "datadog_api_key" {
  name = "DdApiKeySecret-CBGBg7keQWWm"
}

data "aws_secretsmanager_secret_version" "datadog_api_key" {
  secret_id = data.aws_secretsmanager_secret.datadog_api_key.id
}

resource "aws_security_group" "datadog_sg" {
  name        = "datadog-ecs-service-sg"
  description = "Allow outbound internet access for Datadog agent"
  vpc_id      = module.networking.ids.vpc_id

  egress {
    from_port   = 0
    to_port     = 65535
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    self        = false
  }

  tags = {
    name        = "datadog-ecs-service-sg"
    Environment = terraform.workspace
  }
}