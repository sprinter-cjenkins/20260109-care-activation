data "aws_iam_policy_document" "ecs_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_task_role" {
  name                 = "care-activation-${terraform.workspace}-ecs-task-role"
  description          = "This role grants permissions directly to the application code running inside your container to interact with other AWS services."
  path                 = "/"
  assume_role_policy   = data.aws_iam_policy_document.ecs_assume_role.json
  max_session_duration = 3600
  tags                 = {}
}

resource "aws_iam_role_policy" "ecs_task_policy" {
  name = "care-activation-${terraform.workspace}-ecs-task-policy"
  role = aws_iam_role.ecs_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject"]
        Resource = "arn:aws:s3:::my-app-bucket/*"
      }
    ]
  })
}

resource "aws_iam_role" "ecs_execution_role" {
  name                 = "care-activation-${terraform.workspace}-ecs-execution-role"
  description          = "This role grants permissions to the ECS agent (or Fargate agent) to perform actions on your behalf to manage the task's lifecycle."
  path                 = "/"
  assume_role_policy   = data.aws_iam_policy_document.ecs_assume_role.json
  max_session_duration = 3600
  tags                 = {}
}

resource "aws_iam_role_policy" "ecs_execution_policy" {
  name = "care-activation-${terraform.workspace}-ecs-execution-policy"
  role = aws_iam_role.ecs_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage"
        ]
        Resource = "*"
      },
      {
        Sid      = "GetSecrets"
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue", "ssm:GetParameters"]
        Resource = "*"
      },
      {
        Sid      = "CreateTaskLogs"
        Effect   = "Allow"
        Action   = ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/ecs/*"
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:UpdateInstanceInformation",
          "ssm:ListCommands",
          "ssm:SendCommand",
          "ssm:GetCommandInvocation",
          "ssmmessages:*",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_security_group" "care-activation-dev-alb-sg" {
  name        = "care-activation-${terraform.workspace}-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = module.networking.ids.vpc_id

  ingress {
    description = "Allow HTTP traffic"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow HTTPS traffic"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "care-activation-${terraform.workspace}-alb-sg"
    Environment = terraform.workspace
  }
}

resource "aws_security_group" "care-activation-dev-ecs-sg" {
  name        = "care-activation-${terraform.workspace}-ecs-sg"
  description = "Security group for ECS tasks/services"
  vpc_id      = module.networking.ids.vpc_id

  # Only allow inbound traffic from ALB security group
  ingress {
    description     = "Allow traffic from ALB"
    from_port       = 3000 # <--- container port
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.care-activation-dev-alb-sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "care-activation-${terraform.workspace}-ecs-sg"
    Environment = terraform.workspace
  }
}

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/care-activation-${terraform.workspace}"
  retention_in_days = 365
}

data "aws_ecr_image" "care_activation" {
  repository_name = "care-activation"
  image_tag       = "latest"
}

module "care-activation-dev" {
  source             = "../../modules/ecs"
  cluster_name       = "care-activation-${terraform.workspace}"
  enable_ecs_service = true

  ecs_services = {
    care_activation = {
      service_name             = "care-activation-dev"
      task_definition_key      = "care_activation-dev"
      launch_type              = "FARGATE"
      desired_count            = 3
      min_capacity             = 3
      max_capacity             = 3
      cpu_target_value         = 50
      use_capacity_provider    = false
      capacity_provider_config = []

      health_check_grace_period_seconds = 60
      wait_for_steady_state             = false
      enable_execute_command            = true
      enable_az_rebalancing             = false
      enable_ecs_managed_tags           = true
      propagate_tags                    = "SERVICE"

      enable_alb = true
      load_balancer_config = [
        {
          target_group_arn = aws_lb_target_group.ecs_target_group_https.arn
          container_name   = "care-activation-${terraform.workspace}" # must match container name in task definition
          container_port   = 3000
        }
      ]

      enable_alarms                     = false
      cloudwatch_alarm_names            = []
      enable_alarm_rollback             = true
      enable_deployment_circuit_breaker = true
      enable_circuit_breaker_rollback   = true
      deployment_controller_type        = "ECS"
      assign_public_ip                  = false
      subnet_ids = [
        module.networking.ids.private_subnet_ids[0],
        module.networking.ids.private_subnet_ids[1],
        module.networking.ids.private_subnet_ids[2]
      ]
      security_group_ids = [
        aws_security_group.care-activation-dev-ecs-sg.id,
        aws_security_group.care-activation-dev-subnet-app-rds-sg.id
      ]

      tags = {
        service = "care-activation-dev"
        env     = terraform.workspace
      }
    }
  }

  task_definitions = {
    care_activation-dev = {
      family                 = "care-activation-${terraform.workspace}"
      launch_type            = "FARGATE"
      cpu                    = 512
      memory                 = 1024
      task_role_arn          = aws_iam_role.ecs_execution_role.arn
      execution_role_arn     = aws_iam_role.ecs_execution_role.arn
      enable_fault_injection = false
      enable_execute_command = true

      container_definition_file = "${path.module}/templates/care_activation.json.tpl"
      container_definitions = jsonencode([
        {
          name      = "care-activation-${terraform.workspace}"
          image     = "${aws_ecr_repository.care_activation.repository_url}@${data.aws_ecr_image.care_activation.image_digest}"
          essential = true

          environment    = []
          mountPoints    = []
          systemControls = []
          volumesFrom    = []

          portMappings = [
            {
              containerPort = 3000
              hostPort      = 3000
              protocol      = "tcp"
            }
          ]

          secrets = [
            {
              name      = "DATABASE_URL"
              valueFrom = aws_secretsmanager_secret.care-activation-mysql-dev-db-string.arn
            },
            {
              name      = "BLAND_API_KEY"
              valueFrom = local.bland_ai_api_key_arn
            },
            {
              name      = "BLAND_AI_WEBHOOK_SECRET"
              valueFrom = local.bland_webhook_signature_key_arn
            },
            {
              name      = "BLAND_AI_WEBHOOK_URL"
              valueFrom = local.bland_webhook_url_arn
            },
            {
              name      = "BLAND_AI_FROM_NUMBER"
              valueFrom = local.bland_from_arn
            },
            {
              name      = "CITATION_SCHEMA_IDS"
              valueFrom = local.bland_citation_schema_ids_arn
            },
            {
              name      = "BLAND_AI_TWILIO_ENCRYPTED_KEY"
              valueFrom = local.bland_twilio_encrypted_key_arn
            },
            {
              name      = "CUSTOMER_API_KEYS_MAP"
              valueFrom = local.ca_api_keys_arn
            }
          ]

          logConfiguration = {
            logDriver = "awslogs"
            options = {
              awslogs-group         = "/ecs/care-activation-${terraform.workspace}"
              awslogs-region        = data.aws_region.current.name
              awslogs-stream-prefix = "ecs"
            }
          }
        }
      ])

      enable_efs             = false
      ephemeral_storage_size = 40
      network_mode           = "awsvpc"
      runtime_platform = {
        cpu_architecture        = "X86_64"
        operating_system_family = "LINUX"
      }

      tags = {
        service = "care-activation-${terraform.workspace}"
        env     = terraform.workspace
      }
    }
  }

  tags = {
    service = "care-activation-${terraform.workspace}"
    env     = terraform.workspace
  }
}

resource "aws_security_group" "vpc_endpoint_sg" {
  name        = "vpc-endpoints-sg"
  description = "Allow ECS tasks to access VPC endpoints"
  vpc_id      = module.networking.ids.vpc_id

  ingress {
    description     = "Allow HTTPS from ECS tasks"
    from_port       = 443
    to_port         = 443
    protocol        = "tcp"
    security_groups = [aws_security_group.care-activation-dev-ecs-sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "vpc-endpoints-sg"
  }
}

resource "aws_vpc_endpoint" "ecr_api" {
  vpc_id             = module.networking.ids.vpc_id
  service_name       = "com.amazonaws.${data.aws_region.current.name}.ecr.api"
  vpc_endpoint_type  = "Interface"
  subnet_ids         = module.networking.ids.private_subnet_ids
  security_group_ids = [aws_security_group.vpc_endpoint_sg.id]
}

resource "aws_vpc_endpoint" "ecr_docker" {
  vpc_id             = module.networking.ids.vpc_id
  service_name       = "com.amazonaws.${data.aws_region.current.name}.ecr.dkr"
  vpc_endpoint_type  = "Interface"
  subnet_ids         = module.networking.ids.private_subnet_ids
  security_group_ids = [aws_security_group.vpc_endpoint_sg.id]
}

resource "aws_vpc_endpoint" "secretsmanager" {
  vpc_id             = module.networking.ids.vpc_id
  service_name       = "com.amazonaws.${data.aws_region.current.name}.secretsmanager"
  vpc_endpoint_type  = "Interface"
  subnet_ids         = module.networking.ids.private_subnet_ids
  security_group_ids = [aws_security_group.vpc_endpoint_sg.id]
}

resource "aws_acm_certificate" "care_activation" {
  domain_name               = "careactivation.sprinterhealth.com"
  validation_method         = "DNS"
  subject_alternative_names = []

  tags = {
    Environment = terraform.workspace
    Project     = "care-activation"
  }
}

resource "aws_lb" "care-activation-dev" {
  name                             = "care-activation-dev"
  load_balancer_type               = "application"
  subnets                          = module.networking.ids.public_subnet_ids
  security_groups                  = [aws_security_group.care-activation-dev-alb-sg.id]
  idle_timeout                     = 60
  enable_http2                     = true
  enable_cross_zone_load_balancing = true
  internal                         = false
  ip_address_type                  = "ipv4"

  tags = {
    env  = terraform.workspace
    Name = "care-activation-dev"
  }
}

resource "aws_lb_listener" "care-activation-dev-http" {
  load_balancer_arn = aws_lb.care-activation-dev.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      protocol    = "HTTPS"
      port        = "443"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "care-activation-dev-https" {
  load_balancer_arn = aws_lb.care-activation-dev.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.care_activation.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ecs_target_group_https.arn
  }
}

resource "aws_lb_target_group" "ecs_target_group_https" {
  name        = "care-activation-tg-443"
  port        = 3000
  protocol    = "HTTP" # Matches container port
  target_type = "ip"
  vpc_id      = module.networking.ids.vpc_id

  health_check {
    enabled             = true
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP" # Must match container
    matcher             = "200-399"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 3
    unhealthy_threshold = 3
  }

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Environment = "dev"
    ManagedBy   = "Terraform"
    Project     = "care-activation-${terraform.workspace}"
  }
}

resource "aws_vpc_endpoint" "ssm" {
  vpc_id             = module.networking.ids.vpc_id
  service_name       = "com.amazonaws.${data.aws_region.current.name}.ssm"
  vpc_endpoint_type  = "Interface"
  subnet_ids         = module.networking.ids.private_subnet_ids
  security_group_ids = [aws_security_group.vpc_endpoint_sg.id]
}

resource "aws_vpc_endpoint" "ssmmessages" {
  vpc_id             = module.networking.ids.vpc_id
  service_name       = "com.amazonaws.${data.aws_region.current.name}.ssmmessages"
  vpc_endpoint_type  = "Interface"
  subnet_ids         = module.networking.ids.private_subnet_ids
  security_group_ids = [aws_security_group.vpc_endpoint_sg.id]
}

resource "aws_vpc_endpoint" "ec2messages" {
  vpc_id             = module.networking.ids.vpc_id
  service_name       = "com.amazonaws.${data.aws_region.current.name}.ec2messages"
  vpc_endpoint_type  = "Interface"
  subnet_ids         = module.networking.ids.private_subnet_ids
  security_group_ids = [aws_security_group.vpc_endpoint_sg.id]
}
