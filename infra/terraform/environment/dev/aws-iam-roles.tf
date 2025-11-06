# Fetch GitHub's OIDC certificate
data "tls_certificate" "github_oidc" {
  url = "https://token.actions.githubusercontent.com"
}

# Create OIDC Identity Provider
resource "aws_iam_openid_connect_provider" "github" {
  url             = data.tls_certificate.github_oidc.url
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github_oidc.certificates[0].sha1_fingerprint]
}

# IAM Role
resource "aws_iam_role" "ca_terraform_ro_role" {
  name                 = "${var.resource_name}-${terraform.workspace}-terraform-ro-role"
  path                 = "/"
  max_session_duration = 3600

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:Pulsetera/${var.resource_name}:*"
          }
          StringNotEquals = {
            "token.actions.githubusercontent.com:sub" = "repo:Pulsetera/${var.resource_name}:ref:refs/heads/main"
          }
        }
      }
    ]
  })
}
resource "aws_iam_role" "ca_terraform_rw_role" {
  name                 = "${var.resource_name}-${terraform.workspace}-terraform-rw-role"
  path                 = "/"
  max_session_duration = 3600

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:Pulsetera/${var.resource_name}:*"
          }
          StringNotEquals = {
            "token.actions.githubusercontent.com:sub" = "repo:Pulsetera/${var.resource_name}:ref:refs/heads/main"
          }
        }
      }
    ]
  })
}

# Inline S3 policy
resource "aws_iam_policy" "terraforms3backend_inline_policy" {
  name = "terraforms3backend-${var.resource_name}-${terraform.workspace}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "terraforms3bucketaccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:GetObjectVersion",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:DeleteObjectVersion",
          "s3:ListBucket",
          "s3:GetBucketVersioning",
          "s3:GetBucketObjectLockConfiguration",
          "secretsmanager:GetSecretValue"
        ]
        Resource = [
          "arn:aws:s3:::${var.resource_name}-${terraform.workspace}-terraform",
          "arn:aws:s3:::${var.resource_name}-${terraform.workspace}-terraform/*",
          aws_secretsmanager_secret.care-activation-mysql-dev.arn,
          data.aws_secretsmanager_secret.datadog_api_key.arn,
          data.aws_secretsmanager_secret.bland_ai_api_key.arn
        ]
      }
    ]
  })
}

# Attach managed policy
resource "aws_iam_role_policy_attachment" "readonly_access_attachment" {
  role       = aws_iam_role.ca_terraform_ro_role.name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}
resource "aws_iam_role_policy_attachment" "systemadmin_access_attachment" {
  role       = aws_iam_role.ca_terraform_rw_role.name
  policy_arn = "arn:aws:iam::aws:policy/job-function/SystemAdministrator"
}

# Attach inline policy
resource "aws_iam_role_policy_attachment" "terraforms3backend_inline_policy_attachment" {
  role       = aws_iam_role.ca_terraform_ro_role.name
  policy_arn = aws_iam_policy.terraforms3backend_inline_policy.arn
}
resource "aws_iam_role_policy_attachment" "ca_terraform_rw_role_inline_policy_attachment" {
  role       = aws_iam_role.ca_terraform_rw_role.name
  policy_arn = aws_iam_policy.terraforms3backend_inline_policy.arn
}