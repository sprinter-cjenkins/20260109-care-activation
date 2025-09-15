output "cluster_id" {
  description = "The ECS cluster ID"
  value       = aws_ecs_cluster.this.id
}

output "cluster_arn" {
  description = "The ECS cluster ARN"
  value       = aws_ecs_cluster.this.arn
}

output "task_definition_arns" {
  description = "The ECS task definition ARNs"
  value       = { for k, td in aws_ecs_task_definition.this : k => td.arn }
}

output "task_role_arns" {
  description = "Map of ECS service keys to their task role ARNs"
  value = {
    for svc_key, def in aws_ecs_task_definition.this :
    svc_key => (
      var.create_iam_roles ? try(aws_iam_role.task_role[0].arn, null) : try(var.task_definitions[svc_key].task_role_arn, null)
    )
  }
  sensitive = true
}

output "execution_role_arns" {
  description = "Map of ECS service keys to their execution role ARNs"
  value = {
    for svc_key, def in aws_ecs_task_definition.this :
    svc_key => (
      var.create_iam_roles ? try(aws_iam_role.execution_role[0].arn, null) : try(var.task_definitions[svc_key].execution_role_arn, null)
    )
  }
  sensitive = true
}

output "ecs_service_names" {
  description = "Names of the ECS services"
  value       = var.enable_ecs_service ? { for k, s in aws_ecs_service.this : k => s.name } : {}
}

output "ecs_service_ids" {
  description = "IDs (ARNs) of the ECS services"
  value       = var.enable_ecs_service ? { for k, s in aws_ecs_service.this : k => s.id } : {}
}

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch Log Group for ECS task logs"
  value       = var.enable_logging && length(aws_cloudwatch_log_group.ecs_task) > 0 ? aws_cloudwatch_log_group.ecs_task[0].name : null
}

output "alb_target_group_arns" {
  description = "ARNs of ALB target groups for services that use ALB"
  value = {
    for svc_key, svc in var.ecs_services :
    svc_key => svc.alb_target_group_arn
    if svc.enable_alb
  }
}
