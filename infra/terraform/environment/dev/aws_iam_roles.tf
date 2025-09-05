# # Caller identity
# data "aws_caller_identity" "current" {}
#
# # IAM Role
# resource "aws_iam_role" "ca_terraform_role" {
#   name                 = "${var.resource_name}-${var.environment}-terraform-role"
#   path                 = "/"
#   max_session_duration = 3600
#
#   assume_role_policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [
#       {
#         Effect = "Allow"
#         Principal = {
#           Federated = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/token.actions.githubusercontent.com"
#         }
#         Action = "sts:AssumeRoleWithWebIdentity"
#         Condition = {
#           StringEquals = {
#             "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
#           }
#           StringLike = {
#             "token.actions.githubusercontent.com:sub" = "repo:Pulsetera/${var.resource_name}:*"
#           }
#           StringNotEquals = {
#             "token.actions.githubusercontent.com:sub" = "repo:Pulsetera/${var.resource_name}:ref:refs/heads/main"
#           }
#         }
#       }
#     ]
#   })
# }
#
# # Inline S3 policy
# resource "aws_iam_policy" "terraforms3backend_inline_policy" {
#   name = "terraforms3backend-${var.resource_name}-${var.environment}"
#
#   policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [
#       {
#         Sid    = "terraforms3bucketaccess"
#         Effect = "Allow"
#         Action = [
#           "s3:GetObject",
#           "s3:GetObjectVersion",
#           "s3:PutObject",
#           "s3:DeleteObject",
#           "s3:DeleteObjectVersion",
#           "s3:ListBucket",
#           "s3:GetBucketVersioning",
#           "s3:GetBucketObjectLockConfiguration"
#         ]
#         Resource = [
#           "arn:aws:s3:::${var.resource_name}-${var.environment}-terraform",
#           "arn:aws:s3:::${var.resource_name}-${var.environment}-terraform/*"
#         ]
#       }
#     ]
#   })
# }
#
# # Attach managed policy
# resource "aws_iam_role_policy_attachment" "readonly_access_attachment" {
#   role       = aws_iam_role.ca_terraform_role.name
#   policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
# }
#
# # Attach inline policy
# resource "aws_iam_role_policy_attachment" "terraforms3backend_inline_policy_attachment" {
#   role       = aws_iam_role.ca_terraform_role.name
#   policy_arn = aws_iam_policy.terraforms3backend_inline_policy.arn
# }
