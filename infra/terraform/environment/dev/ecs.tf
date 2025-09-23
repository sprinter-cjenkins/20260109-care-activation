
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
  name                 = "sh-ca-ecs-dev-task-role"
  description          = "This role grants permissions directly to the application code running inside your container to interact with other AWS services."
  path                 = "/"
  assume_role_policy   = data.aws_iam_policy_document.ecs_assume_role.json
  max_session_duration = "3600"

  tags = {}
}
resource "aws_iam_role_policy" "ecs_task_policy" {
  name = "sh-ca-ecs-dev-task-policy"
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
  name                 = "sh-ca-ecs-dev-execution-role"
  description          = "This role grants permissions to the ECS agent (or Fargate agent) to perform actions on your behalf to manage the task's lifecycle."
  path                 = "/"
  assume_role_policy   = data.aws_iam_policy_document.ecs_assume_role.json
  max_session_duration = "3600"

  tags = {}
}
resource "aws_iam_role_policy" "ecs_execution_policy" {
  name = "sh-ca-ecs-dev-execution-policy"
  role = aws_iam_role.ecs_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = [
          "secretsmanager:GetRandomPassword",
          "secretsmanager:ListSecrets",
          "secretsmanager:BatchGetSecretValue",
        ]
        Effect   = "Allow"
        Resource = "*"
        Sid      = "GetSecrets"
      },
      {
        "Action" : [
          "logs:CreateLogGroup",
          "logs:CreateLogStream"
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

module "care-activation-dev" {
  #depends_on         = [aws_lb_target_group.ecs_target_group_https]
  source             = "../../modules/ecs"
  cluster_name       = "care-activation-${terraform.workspace}"
  enable_ecs_service = true

  ecs_services = {
    care_activation = {
      service_name                      = "care-activation-dev"
      task_definition_key               = "care_activation-dev"
      desired_count                     = 1
      launch_type                       = "FARGATE"
      deployment_controller_type        = "ECS"
      subnet_ids                        = [module.networking.ids.private_subnet_ids[0], module.networking.ids.private_subnet_ids[1], module.networking.ids.private_subnet_ids[2]]
      security_group_ids                = [aws_security_group.care-activation-dev-ecs-sg.id]
      assign_public_ip                  = false
      enable_execute_command            = false
      enable_alarms                     = false
      cloudwatch_alarm_names            = []
      enable_deployment_circuit_breaker = true
      enable_circuit_breaker_rollback   = true
      max_capacity                      = 2
      min_capacity                      = 1
      cpu_target_value                  = 60
      capacity_provider_config          = []
      load_balancer_config              = []

      tags = {
        service = "care-activation-dev"
        env     = terraform.workspace
      }
    }
  }

  task_definitions = {
    care_activation-dev = {
      family                    = "care-activation-${terraform.workspace}"
      network_mode              = "awsvpc"
      launch_type               = "FARGATE"
      cpu                       = 512
      memory                    = 1024
      task_role_arn             = aws_iam_role.ecs_execution_role.arn
      execution_role_arn        = aws_iam_role.ecs_execution_role.arn
      enable_fault_injection    = false
      enable_efs                = false
      container_definition_file = "${path.module}/templates/care_activation.json.tpl"
      container_definitions = jsonencode([
        {
          name      = "care-activation"
          image     = aws_ecr_repository.care_activation.repository_url
          essential = true
          memory    = 1024
          cpu       = 512
          portMappings = [
            { containerPort = 3000, protocol = "tcp" }
          ]
          secrets = [
            {
              name      = "DATABASE_URL"
              valueFrom = aws_secretsmanager_secret.care-activation-mysql-dev-db-string.arn
            },
            {
              name      = "SHADOW_DATABASE_URL"
              valueFrom = aws_secretsmanager_secret.care-activation-mysql-dev-db-string.arn
            }
          ]
        }
      ])
      ephemeral_storage_size = 40
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

/*
resource "aws_lb_target_group" "ecs_target_group_http" {
  name                               = "care-activation-tg-9001"
  port                               = 8443
  protocol                           = "HTTPS"
  vpc_id                             = module.networking.ids.vpc_id
  target_type                        = "ip"
  deregistration_delay               = 300
  ip_address_type                    = "ipv4"
  load_balancing_algorithm_type      = "round_robin"
  load_balancing_anomaly_mitigation  = "off"
  load_balancing_cross_zone_enabled  = "use_load_balancer_configuration"
  protocol_version                   = "HTTP1"
  lambda_multi_value_headers_enabled = false
  proxy_protocol_v2                  = false

  health_check {
    enabled             = true
    healthy_threshold   = 3
    interval            = 30
    matcher             = "200-499"
    path                = "/"
    port                = "traffic-port"
    protocol            = "HTTPS"
    timeout             = 5
    unhealthy_threshold = 3
  }

  stickiness {
    cookie_duration = 86400
    cookie_name     = null
    enabled         = false
    type            = "lb_cookie"
  }

  target_group_health {
    dns_failover {
      minimum_healthy_targets_count      = "1"
      minimum_healthy_targets_percentage = "off"
    }
    unhealthy_state_routing {
      minimum_healthy_targets_count      = 1
      minimum_healthy_targets_percentage = "off"
    }
  }
  tags = {
    "Environment" = "dev"
    "ManagedBy"   = "Terraform"
    "Project"     = "care-activation"
  }
}
resource "aws_lb_target_group" "ecs_target_group_https" {
  name                               = "care-activation-tg-8443"
  port                               = 8443
  protocol                           = "HTTPS"
  vpc_id                             = module.networking.ids.vpc_id
  target_type                        = "ip"
  deregistration_delay               = 300
  ip_address_type                    = "ipv4"
  load_balancing_algorithm_type      = "round_robin"
  load_balancing_anomaly_mitigation  = "off"
  load_balancing_cross_zone_enabled  = "use_load_balancer_configuration"
  protocol_version                   = "HTTP1"
  lambda_multi_value_headers_enabled = false
  proxy_protocol_v2                  = false

  health_check {
    enabled             = true
    healthy_threshold   = 3
    interval            = 30
    matcher             = "200-499"
    path                = "/"
    port                = "traffic-port"
    protocol            = "HTTPS"
    timeout             = 5
    unhealthy_threshold = 3
  }

  stickiness {
    cookie_duration = 86400
    cookie_name     = null
    enabled         = false
    type            = "lb_cookie"
  }

  target_group_health {
    dns_failover {
      minimum_healthy_targets_count      = "1"
      minimum_healthy_targets_percentage = "off"
    }
    unhealthy_state_routing {
      minimum_healthy_targets_count      = 1
      minimum_healthy_targets_percentage = "off"
    }
  }
  tags = {
    "Environment" = "dev"
    "ManagedBy"   = "Terraform"
    "Project"     = "care-activation"
  }
}

resource "aws_lb" "care-activation-dev" {
  client_keep_alive          = "3600"
  xff_header_processing_mode = "append"

  connection_logs {
    enabled = false
    bucket  = ""
  }

  desync_mitigation_mode                      = "defensive"
  drop_invalid_header_fields                  = false
  enable_cross_zone_load_balancing            = true
  enable_deletion_protection                  = true
  enable_http2                                = true
  enable_tls_version_and_cipher_suite_headers = false
  enable_waf_fail_open                        = false
  enable_xff_client_port                      = false
  enable_zonal_shift                          = false
  idle_timeout                                = "60"
  internal                                    = false
  ip_address_type                             = "ipv4"
  load_balancer_type                          = "application"
  name                                        = "care-activation-dev"
  preserve_host_header                        = false
  security_groups                             = [ aws_security_group.care-activation-dev-alb-sg.id ]

  subnets = [ module.networking.ids.public_subnet_ids[0], module.networking.ids.private_subnet_ids[1], module.networking.ids.private_subnet_ids[2]]

  tags = {
    env = terraform.workspace
  }
}

resource "aws_lb_listener" "care-activation-dev-http" {
  default_action {
    order = "1"

    redirect {
      host        = "#{host}"
      path        = "/#{path}"
      port        = "443"
      protocol    = "HTTPS"
      query       = "#{query}"
      status_code = "HTTP_301"
    }

    type = "redirect"
  }

  load_balancer_arn = aws_lb.care-activation-dev.arn
  port              = "80"
  protocol          = "HTTP"

}
resource "aws_lb_listener" "care-activation-dev-https" {
  default_action {
    forward {
      stickiness {
        duration = "3600"
        enabled  = false
      }

      target_group {
        arn    = aws_lb_target_group.ecs_target_group_https.arn
        weight = "1"
      }
    }

    order            = "1"
    target_group_arn = aws_lb_target_group.ecs_target_group_https.arn
    type             = "forward"
  }

  certificate_arn   = "arn:aws:acm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:certificate/0f52da35-24e9-4226-9d60-2c4554ef093e"
  load_balancer_arn = aws_lb.care-activation-dev.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"

  mutual_authentication {
    advertise_trust_store_ca_names   = null
    ignore_client_certificate_expiry = false
    mode                             = "off"
    trust_store_arn                  = null
  }
}
*/
