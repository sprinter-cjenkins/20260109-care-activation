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
  max_session_duration = "3600"

  tags = {}
}

resource "aws_iam_role_policy" "ecs_task_policy" {
  name = "care-activation-${terraform.workspace}-ecs-task-policy"
  role = aws_iam_role.ecs_task_role.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "s3:GetObject",
          "s3:PutObject"
        ],
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
  max_session_duration = "3600"

  tags = {}
}

resource "aws_iam_role_policy" "ecs_execution_policy" {
  name = "care-activation-${terraform.workspace}-ecs-execution-policy"
  role = aws_iam_role.ecs_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17",
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
        Action = [
          "secretsmanager:GetSecretValue",
          "ssm:GetParameters",
        ]
        Effect   = "Allow"
        Resource = "*"
        Sid      = "GetSecrets"
      },
      {
        "Action" : [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        "Effect" : "Allow",
        "Resource" : "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/ecs/*",
        "Sid" : "CreateTaskLogs"
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
    from_port       = 443
    to_port         = 443
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
  retention_in_days = 7
}

module "care-activation-dev" {
  #depends_on         = [aws_lb_target_group.ecs_target_group_https]
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
      max_capacity             = 6
      cpu_target_value         = 50
      use_capacity_provider    = false
      capacity_provider_config = []

      health_check_grace_period_seconds = 60
      wait_for_steady_state             = false
      enable_execute_command            = false
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
      enable_deployment_circuit_breaker = false
      enable_circuit_breaker_rollback   = false
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
      task_role_arn          = aws_iam_role.ecs_execution_role.arn #ARN of IAM role that allows your Amazon ECS container task to make calls to other AWS services
      execution_role_arn     = aws_iam_role.ecs_execution_role.arn #ARN of the task execution role that the Amazon ECS container agent and the Docker daemon can assume
      enable_fault_injection = false

      container_definition_file = "${path.module}/templates/care_activation.json.tpl"
      container_definitions = jsonencode([
        {
          name      = "care-activation-${terraform.workspace}"
          image     = "${aws_ecr_repository.care_activation.repository_url}:latest"
          essential = true

          portMappings = [
            {
              containerPort = 3000
              protocol      = "tcp"
            }
          ]

          secrets = [
            {
              name      = "DATABASE_URL"
              valueFrom = aws_secretsmanager_secret.care-activation-mysql-dev-db-string.arn
            }
          ]

          # Send logs to CloudWatch
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
    security_groups = [aws_security_group.care-activation-dev-ecs-sg.id] # ECS task SG
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

# Example for an ECR API VPC endpoint
resource "aws_vpc_endpoint" "ecr_api" {
  vpc_id             = module.networking.ids.vpc_id
  service_name       = "com.amazonaws.${data.aws_region.current.name}.ecr.api"
  vpc_endpoint_type  = "Interface"
  subnet_ids         = module.networking.ids.private_subnet_ids
  security_group_ids = [aws_security_group.vpc_endpoint_sg.id]
}

# ECR Docker endpoint
resource "aws_vpc_endpoint" "ecr_docker" {
  vpc_id             = module.networking.ids.vpc_id
  service_name       = "com.amazonaws.${data.aws_region.current.name}.ecr.dkr"
  vpc_endpoint_type  = "Interface"
  subnet_ids         = module.networking.ids.private_subnet_ids
  security_group_ids = [aws_security_group.vpc_endpoint_sg.id]
}

# Secrets Manager endpoint
resource "aws_vpc_endpoint" "secretsmanager" {
  vpc_id             = module.networking.ids.vpc_id
  service_name       = "com.amazonaws.${data.aws_region.current.name}.secretsmanager"
  vpc_endpoint_type  = "Interface"
  subnet_ids         = module.networking.ids.private_subnet_ids
  security_group_ids = [aws_security_group.vpc_endpoint_sg.id]
}

resource "aws_acm_certificate" "care_activation" {
  domain_name       = "careactivation.sprinterhealth.com" # replace with your domain
  validation_method = "DNS"

  subject_alternative_names = []

  tags = {
    Environment = terraform.workspace
    Project     = "care-activation"
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
    type = "forward"

    forward {
      target_group {
        arn    = aws_lb_target_group.ecs_target_group_https.arn
        weight = 1
      }
    }
  }
}
resource "aws_lb_target_group" "ecs_target_group_https" {
  name        = "care-activation-tg-443"
  port        = 3000
  protocol    = "HTTPS"
  target_type = "ip"
  vpc_id      = module.networking.ids.vpc_id

  health_check {
    enabled             = true
    path                = "/"
    port                = "traffic-port"
    protocol            = "HTTPS"
    matcher             = "200-499"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 3
    unhealthy_threshold = 3
  }

  tags = {
    Environment = "dev"
    ManagedBy   = "Terraform"
    Project     = "care-activation-${terraform.workspace}"
  }
}

resource "aws_lb" "care-activation-dev" {
  name                             = "care-activation-dev"
  load_balancer_type               = "application"
  subnets                          = [module.networking.ids.public_subnet_ids[0], module.networking.ids.public_subnet_ids[1], module.networking.ids.public_subnet_ids[2]]
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
