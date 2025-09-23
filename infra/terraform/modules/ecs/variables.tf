variable "cluster_name" {
  description = "ECS cluster name"
  type        = string
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}

variable "enable_logging" {
  description = "Enable CloudWatch Log Group for ECS tasks"
  type        = bool
  default     = false
}

variable "log_group_retention_days" {
  description = "Retention period in days for CloudWatch Log Group"
  type        = number
  default     = 30
}

variable "create_iam_roles" {
  description = "Whether to create ECS Task and Execution IAM roles"
  type        = bool
  default     = false
}

variable "enable_cloudwatch_alarms" {
  description = "Enable CloudWatch alarms for CPU and memory"
  type        = bool
  default     = false
}

variable "cpu_alarm_threshold" {
  description = "CPU utilization percentage threshold to trigger alarm"
  type        = number
  default     = 80
}

variable "memory_alarm_threshold" {
  description = "Memory utilization percentage threshold to trigger alarm"
  type        = number
  default     = 80
}

variable "enable_ecs_service" {
  description = "Controls whether to create the ECS service."
  type        = bool
  default     = true
}

variable "task_definitions" {
  description = "Map of ECS task definitions configurations"
  type = map(object({
    family                    = string
    network_mode              = optional(string, "awsvpc")  #"bridge", "host", "awsvpc", "none"
    launch_type               = optional(string, "FARGATE") #"EC2", "FARGATE"
    cpu                       = number
    memory                    = number
    task_role_arn             = string
    execution_role_arn        = string
    enable_fault_injection    = optional(bool, false)
    container_definitions     = optional(string)
    container_definition_file = optional(string)
    container_template_vars   = optional(map(any), {})
    ephemeral_storage_size    = number
    enable_efs                = optional(bool, false)
    efs_file_system_id        = optional(string)
    efs_access_point_id       = optional(string)
    tags                      = map(string)
    runtime_platform = optional(object({
      cpu_architecture        = string                    # X86_64 or ARM64
      operating_system_family = optional(string, "LINUX") # LINUX, WINDOWS_SERVER_2019_CORE, etc.
    }))
  }))
  default = {}
}

variable "enable_autoscaling" {
  description = "Whether to enable autoscaling for ECS services"
  type        = bool
  default     = false
}

variable "ecs_services" {
  type = map(object({
    #cluster_id                        = string
    #cluster_name                      = string
    #task_definition_arn               = string
    task_definition_key               = optional(string)
    task_definition_revision          = optional(string)
    service_name                      = string
    desired_count                     = optional(number, 1)
    use_capacity_provider             = optional(bool, false)
    launch_type                       = optional(string, "FARGATE") #EC2, FARGATE, and EXTERNAL
    enable_az_rebalancing             = optional(bool, true)
    enable_execute_command            = optional(bool, false)
    enable_alb                        = optional(bool, false)
    alb_target_group_arn              = optional(string)
    enable_alarms                     = optional(bool, false)
    cloudwatch_alarm_names            = list(string)
    enable_alarm_rollback             = optional(bool, false)
    enable_deployment_circuit_breaker = optional(bool, false)
    enable_circuit_breaker_rollback   = optional(bool, false)
    deployment_controller_type        = string # "ECS", "CODE_DEPLOY", "EXTERNAL"
    subnet_ids                        = list(string)
    security_group_ids                = list(string)
    assign_public_ip                  = optional(bool, false)
    propagate_tags                    = optional(string) #SERVICE and TASK_DEFINITION
    wait_for_steady_state             = optional(bool, false)
    load_balancer_config = list(object({
      target_group_arn = string
      container_name   = string
      container_port   = optional(number, 80)
    }))
    capacity_provider_config = list(object({
      base              = optional(number, 0)
      weight            = optional(number, 1)
      capacity_provider = optional(string, "FARGATE")
    }))
    tags                              = optional(map(string), {})
    max_capacity                      = optional(number, 1)
    min_capacity                      = optional(number, 1)
    cpu_target_value                  = optional(number, 60)
    health_check_grace_period_seconds = optional(number, 0)
    enable_ecs_managed_tags           = optional(bool, true)
  }))
}

variable "enable_cloudwatch_alarm_actions" {
  type        = bool
  default     = false
  description = "Enable CloudWatch alarm actions"
}

variable "cloudwatch_alarm_action_arns" {
  type        = list(string)
  default     = []
  description = "List of SNS topic ARNs or other actions for CloudWatch alarms"
}
