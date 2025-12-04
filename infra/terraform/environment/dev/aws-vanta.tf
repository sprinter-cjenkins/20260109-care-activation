provider "aws" {
  region = "us-west-2"
  alias  = "west"
}

provider "aws" {
  region = "us-west-2"
  alias  = "us_west_2"
}
resource "aws_iam_policy" "VantaAdditionalPermissions" {
  name        = "VantaAdditionalPermissions"
  description = "Custom Vanta Policy"
  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        "Effect" : "Deny",
        "Action" : [
          "datapipeline:EvaluateExpression",
          "datapipeline:QueryObjects",
          "rds:DownloadDBLogFilePortion"
        ],
        "Resource" : "*"
      }
    ]
  })
}

data "aws_iam_policy_document" "assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      identifiers = ["arn:aws:iam::956993596390:role/scanner"]
      type        = "AWS"
    }
    condition {
      test     = "StringEquals"
      values   = ["BAD69A41ACAD9BA"]
      variable = "sts:ExternalId"
    }
  }
}

resource "aws_iam_role" "vanta-auditor" {
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
  name               = "vanta-auditor"
}

resource "aws_iam_role_policy_attachment" "VantaSecurityAudit" {
  role       = aws_iam_role.vanta-auditor.name
  policy_arn = "arn:aws:iam::aws:policy/SecurityAudit"
}

resource "aws_iam_role_policy_attachment" "VantaAdditionalPermissions" {
  role       = aws_iam_role.vanta-auditor.name
  policy_arn = aws_iam_policy.VantaAdditionalPermissions.arn
}

output "vanta-auditor-arn" {
  description = "The arn from the Terraform created role that you need to input into the Vanta UI at the end of the AWS connection steps."
  value       = aws_iam_role.vanta-auditor.arn
}

resource "aws_iam_account_password_policy" "strict" {
  minimum_password_length        = 14
  require_lowercase_characters   = true
  require_uppercase_characters   = true
  require_numbers                = true
  require_symbols                = true
  allow_users_to_change_password = true
  password_reuse_prevention      = 24
  max_password_age               = 90
}

resource "aws_guardduty_detector" "us_west_2" {
  provider = aws.us_west_2

  enable = true

  datasources {
    s3_logs {
      enable = true
    }
    kubernetes {
      audit_logs {
        enable = true
      }
    }
    malware_protection {
      scan_ec2_instance_with_findings {
        ebs_volumes {
          enable = true
        }
      }
    }
  }
}

resource "aws_sns_topic" "guardduty_findings_west" {
  provider = aws.west
  name     = "guardduty-findings-notifications"
}

# Optional: Add SNS topic subscription for email notifications

resource "aws_sns_topic_subscription" "guardduty_findings_email_west" {
  provider  = aws.west
  topic_arn = aws_sns_topic.guardduty_findings_west.arn
  protocol  = "email"
  endpoint  = "ca-guardduty@sprinterhealth.com" # Replace with your email
}

resource "aws_iam_role" "eventbridge_sns_role" {
  name = "eventbridge-sns-publish-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy" "sns_publish_policy" {
  name        = "eventbridge-sns-publish-policy"
  description = "Allow EventBridge to publish to SNS topics"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sns:Publish"
        Effect = "Allow"
        Resource = [
          aws_sns_topic.guardduty_findings_west.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "sns_publish_attachment" {
  role       = aws_iam_role.eventbridge_sns_role.name
  policy_arn = aws_iam_policy.sns_publish_policy.arn
}

resource "aws_cloudwatch_event_rule" "guardduty_findings_west" {
  provider    = aws.west
  name        = "guardduty-findings-rule"
  description = "Capture GuardDuty findings and send notifications"

  event_pattern = jsonencode({
    source      = ["aws.guardduty"]
    detail-type = ["GuardDuty Finding"]
  })
}

resource "aws_cloudwatch_event_target" "guardduty_findings_target_west" {
  provider  = aws.west
  rule      = aws_cloudwatch_event_rule.guardduty_findings_west.name
  target_id = "SendToSNS"
  arn       = aws_sns_topic.guardduty_findings_west.arn
  role_arn  = aws_iam_role.eventbridge_sns_role.arn
}

resource "aws_cloudwatch_log_group" "vpc_flow_logs" {
  for_each = toset([
    "vpc-0bcf44af61b481cd3",
    "care-activation-dev-vpc"
  ])

  name              = "/aws/vpc/flowlogs/${each.key}"
  retention_in_days = 30 # Adjust retention period as needed
}

data "aws_vpc" "target_vpcs" {
  for_each = toset([
    "vpc-0bcf44af61b481cd3"
  ])

  id = each.key
}

data "aws_vpc" "named_vpc" {
  filter {
    name   = "tag:Name"
    values = ["care-activation-dev-vpc"]
  }
}

locals {
  all_vpcs = merge(
    data.aws_vpc.target_vpcs,
    { "care-activation-dev-vpc" = data.aws_vpc.named_vpc }
  )
}

resource "aws_flow_log" "vpc_flow_logs" {
  for_each = local.all_vpcs

  vpc_id          = each.value.id
  traffic_type    = "ALL" # Options: ACCEPT, REJECT, ALL
  iam_role_arn    = aws_iam_role.vpc_flow_logs_role.arn
  log_destination = aws_cloudwatch_log_group.vpc_flow_logs[each.key].arn

  log_format = "$${version} $${account-id} $${interface-id} $${srcaddr} $${dstaddr} $${srcport} $${dstport} $${protocol} $${packets} $${bytes} $${start} $${end} $${action} $${log-status}"

  tags = {
    Name = "flow-logs-${each.key}"
  }
}

resource "aws_sns_topic" "rds_cpu_alarm_topic" {
  name = "rds-cpu-alarm-topic"
}

resource "aws_sns_topic_subscription" "rds_cpu_alarm_email" {
  topic_arn = aws_sns_topic.rds_cpu_alarm_topic.arn
  protocol  = "email"
  endpoint  = "ca-guardduty@sprinterhealth.com" # Replace with your email address
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu_alarm" {
  alarm_name          = "care-activation-dev-mysql-db-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors RDS CPU utilization"
  alarm_actions       = [aws_sns_topic.rds_cpu_alarm_topic.arn]
  ok_actions          = [aws_sns_topic.rds_cpu_alarm_topic.arn]

  dimensions = {
    DBInstanceIdentifier = "care-activation-dev-mysql-db"
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_freeable_memory_alarm" {
  alarm_name          = "care-activation-dev-mysql-db-low-memory-alarm"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "FreeableMemory"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 1073741824 # 1 GB in bytes - adjust based on your instance size
  alarm_description   = "This alarm monitors RDS freeable memory"
  alarm_actions       = [aws_sns_topic.rds_alarms.arn]
  ok_actions          = [aws_sns_topic.rds_alarms.arn]

  dimensions = {
    DBInstanceIdentifier = "care-activation-dev-mysql-db"
  }
}

resource "aws_sns_topic" "rds_alarms" {
  name = "rds-alarms-topic"
}

resource "aws_sns_topic_subscription" "rds_alarms_email" {
  topic_arn = aws_sns_topic.rds_alarms.arn
  protocol  = "email"
  endpoint  = "ca-guardduty@sprinterhealth.com" # Replace with your email address
}

# Get the RDS instance details
data "aws_db_instance" "db" {
  db_instance_identifier = "care-activation-dev-mysql-db"
}

# DiskQueueDepth Alarm
resource "aws_cloudwatch_metric_alarm" "disk_queue_depth" {
  alarm_name          = "${data.aws_db_instance.db.db_instance_identifier}-disk-queue-depth"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DiskQueueDepth"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 10 # Adjust based on your requirements
  alarm_description   = "Alarm when disk queue depth exceeds threshold"
  alarm_actions       = [aws_sns_topic.rds_alarms.arn]
  ok_actions          = [aws_sns_topic.rds_alarms.arn]

  dimensions = {
    DBInstanceIdentifier = data.aws_db_instance.db.db_instance_identifier
  }
}

# ReadIOPS Alarm
resource "aws_cloudwatch_metric_alarm" "read_iops" {
  alarm_name          = "${data.aws_db_instance.db.db_instance_identifier}-read-iops"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ReadIOPS"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 500 # Adjust based on your requirements
  alarm_description   = "Alarm when read IOPS exceeds threshold"
  alarm_actions       = [aws_sns_topic.rds_alarms.arn]
  ok_actions          = [aws_sns_topic.rds_alarms.arn]

  dimensions = {
    DBInstanceIdentifier = data.aws_db_instance.db.db_instance_identifier
  }
}

# WriteIOPS Alarm
resource "aws_cloudwatch_metric_alarm" "write_iops" {
  alarm_name          = "${data.aws_db_instance.db.db_instance_identifier}-write-iops"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "WriteIOPS"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 500 # Adjust based on your requirements
  alarm_description   = "Alarm when write IOPS exceeds threshold"
  alarm_actions       = [aws_sns_topic.rds_alarms.arn]
  ok_actions          = [aws_sns_topic.rds_alarms.arn]

  dimensions = {
    DBInstanceIdentifier = data.aws_db_instance.db.db_instance_identifier
  }
}

resource "aws_sns_topic" "rds_storage_alerts" {
  name = "rds-storage-alerts"
}

resource "aws_sns_topic_subscription" "rds_storage_alerts_email" {
  topic_arn = aws_sns_topic.rds_storage_alerts.arn
  protocol  = "email"
  endpoint  = "ca-guardduty@sprinterhealth.com" # Replace with your email address
}

resource "aws_cloudwatch_metric_alarm" "rds_free_storage_space" {
  alarm_name          = "care-activation-dev-mysql-db-low-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "10000000000" # 10GB in bytes, adjust as needed
  alarm_description   = "This alarm monitors free storage space for RDS instance"
  alarm_actions       = [aws_sns_topic.rds_storage_alerts.arn]
  ok_actions          = [aws_sns_topic.rds_storage_alerts.arn]

  dimensions = {
    DBInstanceIdentifier = "care-activation-dev-mysql-db"
  }
}
