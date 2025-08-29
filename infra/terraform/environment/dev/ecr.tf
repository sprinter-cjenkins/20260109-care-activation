resource "aws_ecr_repository" "tbd" {
  image_tag_mutability = "MUTABLE"
  name                 = "tbd"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecr_lifecycle_policy" "tbd" {
  repository = aws_ecr_repository.tbd.name

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
        description  = "Prune old candidate images."
        selection = {
          tagStatus      = "tagged"
          tagPrefixList  = ["rc-tbd-build-", "rc-tbd-commit-"]
          countType      = "imageCountMoreThan"
          countNumber    = 16
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 3
        description  = "Prune old release images."
        selection = {
          tagStatus      = "tagged"
          tagPrefixList  = ["v-tbd-build-", "v-tbd-commit-"]
          countType      = "imageCountMoreThan"
          countNumber    = 16
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 4
        description  = "Catch-all rule: keep last 30 images for any other tags."
        selection = {
          tagStatus   = "tagged"
          countType   = "imageCountMoreThan"
          countNumber = 30
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
