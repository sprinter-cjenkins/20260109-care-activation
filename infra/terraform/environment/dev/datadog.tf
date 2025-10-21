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

resource "aws_ecs_task_definition" "datadog_task" {
  family                   = "datadog-task"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.datadog_task_execution_role.arn
  task_role_arn            = aws_iam_role.datadog_task_role.arn

  container_definitions = jsonencode([
    {
      name  = "datadog-agent"
      image = "public.ecr.aws/datadog/agent:latest"
      environment = [
        { name = "DD_API_KEY", value = data.aws_secretsmanager_secret_version.datadog_api_key.secret_string },
        { name = "DD_SITE", value = "us3.datadoghq.com" },
        { name = "DD_APM_ENABLED", value = "false" },
        { name = "ECS_FARGATE", value = "true" }
      ]
    }
  ])
}

resource "aws_ecs_service" "datadog_service" {
  name            = "datadog-service"
  cluster         = module.care-activation-dev.cluster_arn
  task_definition = aws_ecs_task_definition.datadog_task.arn
  launch_type     = "FARGATE"

  network_configuration {
    assign_public_ip = true

    subnets = [
      module.networking.ids.public_subnet_ids[0],
      module.networking.ids.public_subnet_ids[1],
      module.networking.ids.public_subnet_ids[2]
    ]
    security_groups = ["sg-03c4747b070f202be"]
  }

  desired_count = 1
}
