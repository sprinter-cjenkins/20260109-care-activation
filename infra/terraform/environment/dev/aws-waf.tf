# WAF Web ACL for ALB rate limiting (testing limits)
resource "aws_wafv2_web_acl" "care_activation_alb" {
  name  = "care-activation-${terraform.workspace}-alb-waf"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  # Global rate limit for all endpoints
  rule {
    name     = "rate-limit-global"
    priority = 1

    action {
      block {
        custom_response {
          response_code = 429
        }
      }
    }

    statement {
      rate_based_statement {
        limit              = 250  # 250 requests per 5 minutes per IP
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "rate-limit-global"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "care-activation-alb-waf"
    sampled_requests_enabled   = true
  }

  tags = {
    Environment = terraform.workspace
    Project     = "care-activation"
  }
}

# Associate WAF with ALB
resource "aws_wafv2_web_acl_association" "care_activation_alb" {
  resource_arn = aws_lb.care-activation-dev.arn
  web_acl_arn  = aws_wafv2_web_acl.care_activation_alb.arn
}

# Output WAF details
output "waf_web_acl_id" {
  value       = aws_wafv2_web_acl.care_activation_alb.id
  description = "WAF Web ACL ID"
}

output "waf_metrics" {
  value = {
    global_metric  = "rate-limit-global"
  }
  description = "CloudWatch metric names for WAF rules"
}