# WAF Web ACL for ALB with comprehensive protection
resource "aws_wafv2_web_acl" "care_activation_alb" {
  name  = "care-activation-${terraform.workspace}-alb-waf"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  # 1. AWS Managed Rules - Common Rule Set (protects against OWASP Top 10)
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 0

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # 2. AWS Managed Rules - Known Bad Inputs
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesKnownBadInputsMetric"
      sampled_requests_enabled   = true
    }
  }

  # 3. Geographic restrictions - Block high-risk countries
  rule {
    name     = "geo-block-high-risk"
    priority = 2

    action {
      block {
        custom_response {
          response_code = 403
        }
      }
    }

    statement {
      geo_match_statement {
        # Adjust this list based on your business needs
        # Common high-risk countries for abuse (not exhaustive)
        country_codes = ["CN", "RU", "KP", "IR"]
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "geo-block-metric"
      sampled_requests_enabled   = true
    }
  }

  # 4. Per-IP rate limit - Protect against single-source floods
  rule {
    name     = "rate-limit-per-ip"
    priority = 3

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
      metric_name                = "rate-limit-per-ip"
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