resource "aws_ecs_cluster" "this" {
  name = var.cluster_name
  tags = var.tags
}

resource "aws_cloudwatch_log_group" "ecs_task" {
  count             = var.enable_logging ? 1 : 0
  name              = "/ecs/${var.cluster_name}"
  retention_in_days = var.log_group_retention_days
  tags              = var.tags
}

resource "aws_iam_role" "task_role" {
  count = var.create_iam_roles ? 1 : 0

  name = "${var.cluster_name}-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = var.tags
}

resource "aws_iam_role" "execution_role" {
  count = var.create_iam_roles ? 1 : 0

  name = "${var.cluster_name}-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
  tags = var.tags
}

resource "aws_ecs_task_definition" "this" {
  for_each = var.task_definitions

  family                   = each.value.family
  network_mode             = each.value.network_mode
  requires_compatibilities = [upper(each.value.launch_type)]
  cpu                      = tostring(each.value.cpu)
  memory                   = tostring(each.value.memory)

  task_role_arn          = var.create_iam_roles ? try(aws_iam_role.task_role[0].arn, null) : try(each.value.task_role_arn, null)
  execution_role_arn     = var.create_iam_roles ? try(aws_iam_role.execution_role[0].arn, null) : try(each.value.execution_role_arn, null)
  enable_fault_injection = each.value.enable_fault_injection

  container_definitions = each.value.container_definitions != null ? each.value.container_definitions : templatefile(each.value.container_definition_file, each.value.container_template_vars)

  dynamic "ephemeral_storage" {
    for_each = each.value.ephemeral_storage_size != null ? [1] : []
    content {
      size_in_gib = each.value.ephemeral_storage_size
    }
  }

  dynamic "runtime_platform" {
    for_each = each.value.runtime_platform != null ? [1] : []

    content {
      cpu_architecture        = each.value.runtime_platform.cpu_architecture        # e.g., "X86_64" or "ARM64"
      operating_system_family = each.value.runtime_platform.operating_system_family # e.g., "LINUX"
    }
  }

  dynamic "volume" {
    for_each = each.value.enable_efs ? [1] : []
    content {
      name = "efs-volume"

      efs_volume_configuration {
        file_system_id     = each.value.efs_file_system_id
        transit_encryption = "ENABLED"
        authorization_config {
          access_point_id = each.value.efs_access_point_id
          iam             = "ENABLED"
        }
      }
    }
  }
  tags = each.value.tags
}

resource "aws_ecs_service" "this" {
  for_each = var.enable_ecs_service ? var.ecs_services : {}

  name    = each.value.service_name
  cluster = aws_ecs_cluster.this.arn
  task_definition = (
    each.value.task_definition_key != null ?
    (
      each.value.task_definition_revision != null ?
      "${aws_ecs_task_definition.this[each.value.task_definition_key].family}:${each.value.task_definition_revision}" :
      "${aws_ecs_task_definition.this[each.value.task_definition_key].family}:${aws_ecs_task_definition.this[each.value.task_definition_key].revision}"
    ) :
    (
      each.value.task_definition_revision != null ?
      "${aws_ecs_task_definition.this[each.key].family}:${each.value.task_definition_revision}" :
      "${aws_ecs_task_definition.this[each.key].family}:${aws_ecs_task_definition.this[each.key].revision}"
    )
  )
  desired_count = each.value.desired_count

  launch_type = each.value.use_capacity_provider ? null : upper(each.value.launch_type)

  availability_zone_rebalancing = each.value.use_capacity_provider && each.value.enable_az_rebalancing ? "ENABLED" : null

  enable_execute_command            = each.value.enable_execute_command
  enable_ecs_managed_tags           = each.value.enable_ecs_managed_tags
  health_check_grace_period_seconds = each.value.health_check_grace_period_seconds

  propagate_tags        = try(each.value.propagate_tags, null)
  wait_for_steady_state = try(each.value.wait_for_steady_state, false)

  dynamic "capacity_provider_strategy" {
    for_each = each.value.use_capacity_provider ? {
      for idx, strategy in each.value.capacity_provider_config : idx => strategy
    } : {}

    content {
      base              = capacity_provider_strategy.value.base
      weight            = capacity_provider_strategy.value.weight
      capacity_provider = capacity_provider_strategy.value.capacity_provider
    }
  }

  dynamic "alarms" {
    for_each = each.value.enable_alarms && length(each.value.cloudwatch_alarm_names) > 0 ? [1] : []

    content {
      enable      = true
      rollback    = each.value.enable_alarm_rollback
      alarm_names = each.value.cloudwatch_alarm_names
    }
  }

  deployment_circuit_breaker {
    enable   = each.value.enable_deployment_circuit_breaker
    rollback = each.value.enable_circuit_breaker_rollback
  }

  deployment_controller {
    type = each.value.deployment_controller_type
  }

  network_configuration {
    subnets          = each.value.subnet_ids
    security_groups  = each.value.security_group_ids
    assign_public_ip = each.value.assign_public_ip
  }

  dynamic "load_balancer" {
    for_each = each.value.enable_alb && length(each.value.load_balancer_config) > 0 ? {
      for idx, cfg in each.value.load_balancer_config : idx => cfg
    } : {}

    content {
      target_group_arn = load_balancer.value.target_group_arn
      container_name   = load_balancer.value.container_name
      container_port   = load_balancer.value.container_port
    }
  }

  depends_on = [aws_ecs_task_definition.this]

  tags = each.value.tags
}

resource "aws_appautoscaling_target" "ecs" {
  for_each = var.enable_autoscaling ? var.ecs_services : {}

  max_capacity       = each.value.max_capacity
  min_capacity       = each.value.min_capacity
  resource_id        = "service/${aws_ecs_cluster.this.name}/${each.value.service_name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "cpu_target_tracking" {
  for_each = var.enable_autoscaling ? var.ecs_services : {}

  name               = "${aws_ecs_cluster.this.name}-${each.value.service_name}-cpu-target-tracking"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs[each.key].resource_id
  scalable_dimension = aws_appautoscaling_target.ecs[each.key].scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs[each.key].service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = each.value.cpu_target_value
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    scale_in_cooldown  = 60
    scale_out_cooldown = 60
  }
}

resource "aws_cloudwatch_metric_alarm" "cpu_alarm" {
  for_each = var.enable_cloudwatch_alarms ? var.ecs_services : {}

  alarm_name          = "${aws_ecs_cluster.this.name}-${each.value.service_name}-cpu-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = var.cpu_alarm_threshold

  dimensions = {
    ClusterName = aws_ecs_cluster.this.name
    ServiceName = each.value.service_name
  }

  alarm_description = "Alarm if ECS CPU utilization exceeds threshold"
  actions_enabled   = true
}

resource "aws_cloudwatch_metric_alarm" "memory_alarm" {
  for_each = var.enable_cloudwatch_alarms ? var.ecs_services : {}

  alarm_name          = "${aws_ecs_cluster.this.name}-${each.value.service_name}-memory-alarm"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = var.memory_alarm_threshold

  dimensions = {
    ClusterName = aws_ecs_cluster.this.name
    ServiceName = each.value.service_name
  }

  alarm_description = "Alarm if ECS memory utilization exceeds threshold"
  actions_enabled   = true

  alarm_actions = var.enable_cloudwatch_alarm_actions ? var.cloudwatch_alarm_action_arns : []
  ok_actions    = var.enable_cloudwatch_alarm_actions ? var.cloudwatch_alarm_action_arns : []
}
