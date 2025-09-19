resource "aws_ecr_repository" "care-activation" {
  image_tag_mutability = "MUTABLE"
  name                 = "care-activation"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "care-activation" {
  repository = aws_ecr_repository.care-activation.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Prune untagged images."
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Prune old release images."
        selection = {
          tagStatus      = "tagged"
          tagPrefixList  = ["v-care-activation-build-", "v-care-activation-commit-"]
          countType      = "imageCountMoreThan"
          countNumber    = 16
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 3
        description  = "Catch-all rule: keep last 16 images for any other tags."
        selection = {
          tagStatus   = "tagged"
          countType   = "imageCountMoreThan"
          countNumber = 16
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
