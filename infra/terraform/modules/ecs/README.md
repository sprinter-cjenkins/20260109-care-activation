# Terraform ECS Module

Terraform module to provision an ECS Cluster, Task Definition, and Service (Fargate or EC2), with optional CloudWatch alarms, EFS, and ALB integration.

---

## ⚙️ Requirements

| Name      | Version |
| --------- | ------- |
| terraform | >= 1.3.0 |
| aws       | >= 5.0   |

---

## 🧩 Modules

No external modules used.

---

## 🚀 Usage Example

```hcl
module "ecs" {## Usage
  source = "../modules/ecs"

  cluster_name        = "my-ecs-cluster"
  create_iam_roles    = true
  enable_logging      = true
  log_group_retention_days = 7
  
  ecs_services = {
    "app-service" = {
      service_name                      = "app-service"
      cluster_id                        = "arn:aws:ecs:region:account-id:cluster/my-ecs-cluster"
      cluster_name                      = "my-ecs-cluster"
      task_definition_arn               = "arn:aws:ecs:region:account-id:task-definition/app"
      desired_count                     = 2
      launch_type                       = "FARGATE"
      subnet_ids                        = ["subnet-abc", "subnet-def"]
      security_group_ids                = ["sg-xyz"]
      assign_public_ip                  = true
      enable_execute_command            = true
      enable_efs                        = false
      enable_az_rebalancing             = false
      enable_alb                        = false
      enable_deployment_circuit_breaker = true
      enable_circuit_breaker_rollback   = true
      enable_alarm_rollback             = false
      enable_alarms                     = false
      enable_cloudwatch_alarms          = false
      wait_for_steady_state             = true
      enable_ecs_managed_tags           = true
      propagate_tags                    = "SERVICE"
      platform_version                  = "1.4.0"
      deployment_controller_type        = "ECS"
      capacity_provider_config = [
        {
          base              = 1
          weight            = 100
          capacity_provider = "FARGATE"
        }
      ]
      tags = {
        Environment = "dev"
        Service     = "app"
      }
    }
  }
  
  task_definitions = {
    "app" = {
      family                   = "app"
      cpu                      = 512
      memory                   = 1024
      launch_type              = "FARGATE"
      network_mode             = "awsvpc"
      enable_fault_injection   = false
      container_definitions    = file("${path.module}/containers/app.json")
      task_role_arn            = null
      execution_role_arn       = null
      ephemeral_storage_size   = 21
      enable_efs               = false
      runtime_platform = {
        cpu_architecture        = "X86_64"
        operating_system_family = "LINUX"
      }
      tags = {}
    }
  }
}
```

<!-- BEGIN_TF_DOCS -->


## Resources

| Name | Type |
|------|------|
| [aws_availability_zones.available](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/availability_zones) | data source |
| [aws_caller_identity.current](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/caller_identity) | data source |
| [aws_region.current](https://registry.terraform.io/providers/hashicorp/aws/latest/docs/data-sources/region) | data source |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| <a name="input_capacity_provider_strategy"></a> [capacity\_provider\_strategy](#input\_capacity\_provider\_strategy) | n/a | ```list(object({ capacity_provider = string base = number weight = number }))``` | ```[ { "base": 0, "capacity_provider": "FARGATE", "weight": 1 } ]``` | no |
| <a name="input_cloudwatch_alarm_action_arns"></a> [cloudwatch\_alarm\_action\_arns](#input\_cloudwatch\_alarm\_action\_arns) | List of SNS topic ARNs or other actions for CloudWatch alarms | `list(string)` | `[]` | no |
| <a name="input_cluster_name"></a> [cluster\_name](#input\_cluster\_name) | ECS cluster name | `string` | n/a | yes |
| <a name="input_cpu_alarm_threshold"></a> [cpu\_alarm\_threshold](#input\_cpu\_alarm\_threshold) | CPU utilization percentage threshold to trigger alarm | `number` | `80` | no |
| <a name="input_create_iam_roles"></a> [create\_iam\_roles](#input\_create\_iam\_roles) | Whether to create ECS Task and Execution IAM roles | `bool` | `false` | no |
| <a name="input_ecs_services"></a> [ecs\_services](#input\_ecs\_services) | n/a | ```map(object({ #cluster_id = string #cluster_name = string #task_definition_arn = string task_definition_key = optional(string) task_definition_revision = optional(string) service_name = string desired_count = optional(number, 1) use_capacity_provider = optional(bool, true) launch_type = optional(string, "FARGATE") #EC2, FARGATE, and EXTERNAL enable_az_rebalancing = optional(bool, true) enable_execute_command = optional(bool, false) enable_alb = optional(bool, false) alb_target_group_arn = optional(string) enable_alarms = optional(bool, false) cloudwatch_alarm_names = list(string) enable_alarm_rollback = optional(bool, false) enable_deployment_circuit_breaker = optional(bool, false) enable_circuit_breaker_rollback = optional(bool, false) deployment_controller_type = string # "ECS", "CODE_DEPLOY", "EXTERNAL" subnet_ids = list(string) security_group_ids = list(string) assign_public_ip = optional(bool, false) propagate_tags = optional(string) #SERVICE and TASK_DEFINITION wait_for_steady_state = optional(bool, false) load_balancer_config = list(object({ target_group_arn = string container_name = string container_port = optional(number, 80) })) capacity_provider_config = list(object({ base = optional(number, 0) weight = optional(number, 1) capacity_provider = optional(string, "FARGATE") })) tags = optional(map(string), {}) max_capacity = optional(number, 1) min_capacity = optional(number, 1) cpu_target_value = optional(number, 60) health_check_grace_period_seconds = optional(number, 0) enable_ecs_managed_tags = optional(bool, true) }))``` | n/a | yes |
| <a name="input_enable_autoscaling"></a> [enable\_autoscaling](#input\_enable\_autoscaling) | Whether to enable autoscaling for ECS services | `bool` | `false` | no |
| <a name="input_enable_cloudwatch_alarm_actions"></a> [enable\_cloudwatch\_alarm\_actions](#input\_enable\_cloudwatch\_alarm\_actions) | Enable CloudWatch alarm actions | `bool` | `false` | no |
| <a name="input_enable_cloudwatch_alarms"></a> [enable\_cloudwatch\_alarms](#input\_enable\_cloudwatch\_alarms) | Enable CloudWatch alarms for CPU and memory | `bool` | `false` | no |
| <a name="input_enable_ecs_service"></a> [enable\_ecs\_service](#input\_enable\_ecs\_service) | Controls whether to create the ECS service. | `bool` | `true` | no |
| <a name="input_enable_logging"></a> [enable\_logging](#input\_enable\_logging) | Enable CloudWatch Log Group for ECS tasks | `bool` | `false` | no |
| <a name="input_log_group_retention_days"></a> [log\_group\_retention\_days](#input\_log\_group\_retention\_days) | Retention period in days for CloudWatch Log Group | `number` | `30` | no |
| <a name="input_memory_alarm_threshold"></a> [memory\_alarm\_threshold](#input\_memory\_alarm\_threshold) | Memory utilization percentage threshold to trigger alarm | `number` | `80` | no |
| <a name="input_tags"></a> [tags](#input\_tags) | Tags to apply to all resources | `map(string)` | `{}` | no |
| <a name="input_task_definitions"></a> [task\_definitions](#input\_task\_definitions) | Map of ECS task definitions configurations | ```map(object({ family = string network_mode = optional(string, "awsvpc")  #"bridge", "host", "awsvpc", "none" launch_type = optional(string, "FARGATE") #"EC2", "FARGATE" cpu = number memory = number task_role_arn = string execution_role_arn = string enable_fault_injection = optional(bool, false) container_definitions = optional(string) container_definition_file = optional(string) container_template_vars = optional(map(any), {}) ephemeral_storage_size = number enable_efs = optional(bool, false) efs_file_system_id = optional(string) efs_access_point_id = optional(string) tags = map(string) runtime_platform = optional(object({ cpu_architecture = string                    # X86_64 or ARM64 operating_system_family = optional(string, "LINUX") # LINUX, WINDOWS_SERVER_2019_CORE, etc. })) }))``` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| <a name="output_alb_target_group_arns"></a> [alb\_target\_group\_arns](#output\_alb\_target\_group\_arns) | ARNs of ALB target groups for services that use ALB |
| <a name="output_cloudwatch_log_group_name"></a> [cloudwatch\_log\_group\_name](#output\_cloudwatch\_log\_group\_name) | Name of the CloudWatch Log Group for ECS task logs |
| <a name="output_cluster_arn"></a> [cluster\_arn](#output\_cluster\_arn) | The ECS cluster ARN |
| <a name="output_cluster_id"></a> [cluster\_id](#output\_cluster\_id) | The ECS cluster ID |
| <a name="output_ecs_service_ids"></a> [ecs\_service\_ids](#output\_ecs\_service\_ids) | IDs (ARNs) of the ECS services |
| <a name="output_ecs_service_names"></a> [ecs\_service\_names](#output\_ecs\_service\_names) | Names of the ECS services |
| <a name="output_execution_role_arns"></a> [execution\_role\_arns](#output\_execution\_role\_arns) | Map of ECS service keys to their execution role ARNs |
| <a name="output_task_definition_arns"></a> [task\_definition\_arns](#output\_task\_definition\_arns) | The ECS task definition ARNs |
| <a name="output_task_role_arns"></a> [task\_role\_arns](#output\_task\_role\_arns) | Map of ECS service keys to their task role ARNs |
<!-- END_TF_DOCS -->

---
## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## 📞 Support

If you encounter any issues or have questions, please open an issue on the GitHub repository or contact the maintainers.

---

## ⚖️ Disclaimer

This module is provided "as-is" without any warranties. Use it at your own risk.

---
