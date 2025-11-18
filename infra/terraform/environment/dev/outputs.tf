# Migration-related outputs for CI/CD
output "migration_task_definition" {
  value       = aws_ecs_task_definition.migration.family
  description = "Migration task definition family name"
}

output "migration_subnets" {
  value       = module.networking.ids.private_subnet_ids
  description = "Private subnet IDs for migration tasks"
}

output "migration_security_groups" {
  value = [
    aws_security_group.care-activation-dev-ecs-sg.id,
    aws_security_group.care-activation-dev-subnet-app-rds-sg.id
  ]
  description = "Security groups for migration tasks (ECS + RDS access)"
}