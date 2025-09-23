# IAM Role
resource "aws_iam_role" "ca_ecr_rw_role" {
  name                 = "${var.resource_name}-${terraform.workspace}-ecr-rw-role"
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
          # StringNotEquals = {
          #   "token.actions.githubusercontent.com:sub" = "repo:Pulsetera/${var.resource_name}:ref:refs/heads/main"
          # }
        }
      }
    ]
  })
}

# IAM Policy
resource "aws_iam_policy" "github_actions_ecr_push" {
  name        = "${var.resource_name}-${terraform.workspace}-ecr-push-policy"
  description = "Allows GitHub Actions to push images to care-activation ECR repo"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ECRLogin"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      {
        Sid    = "ECRPushPullCareActivation"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:DescribeRepositories",
          "ecr:GetRepositoryPolicy"
        ]
        Resource = "arn:aws:ecr:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:repository/care-activation"
      },
      {
        Sid    = "OptionalListECR"
        Effect = "Allow"
        Action = [
          "ecr:ListImages",
          "ecr:DescribeImages"
        ]
        Resource = "arn:aws:ecr:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:repository/care-activation"
      }
    ]
  })
}

# Attach Policy
resource "aws_iam_role_policy_attachment" "github_actions_ecr_push_attachment" {
  role       = aws_iam_role.ca_ecr_rw_role.name
  policy_arn = aws_iam_policy.github_actions_ecr_push.arn
}

resource "aws_ecr_repository" "care_activation" {
  image_tag_mutability = "MUTABLE"
  name                 = "care-activation"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "care_activation" {
  repository = aws_ecr_repository.care_activation.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 16 release images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v-care-activation"]
          countType     = "imageCountMoreThan"
          countNumber   = 16
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Keep last 8 pre-release images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["pre-care-activation"]
          countType     = "imageCountMoreThan"
          countNumber   = 8
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 3
        description  = "Catch-all for commit builds"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 64
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

