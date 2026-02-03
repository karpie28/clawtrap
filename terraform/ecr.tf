# ECR Repository for ClawTrap container images
resource "aws_ecr_repository" "clawtrap" {
  name                 = "${local.name_prefix}-honeypot"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name = "${local.name_prefix}-honeypot"
  }
}

# ECR Lifecycle Policy - Keep only the last 10 images
resource "aws_ecr_lifecycle_policy" "clawtrap" {
  repository = aws_ecr_repository.clawtrap.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus     = "any"
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
