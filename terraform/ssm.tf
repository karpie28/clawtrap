# SSM Parameter Store for application configuration
# These can be read by the EC2 instance at runtime

resource "aws_ssm_parameter" "ecr_repo" {
  name        = "/${var.project_name}/ecr-repository"
  description = "ECR repository URL for ClawTrap"
  type        = "String"
  value       = local.ecr_repository_url

  tags = {
    Name = "${local.name_prefix}-ecr-repo"
  }
}

resource "aws_ssm_parameter" "s3_bucket" {
  name        = "/${var.project_name}/s3-bucket"
  description = "S3 bucket for ClawTrap logs"
  type        = "String"
  value       = aws_s3_bucket.logs.id

  tags = {
    Name = "${local.name_prefix}-s3-bucket"
  }
}

resource "aws_ssm_parameter" "http_port" {
  name        = "/${var.project_name}/http-port"
  description = "HTTP port for ClawTrap"
  type        = "String"
  value       = tostring(var.http_port)

  tags = {
    Name = "${local.name_prefix}-http-port"
  }
}

resource "aws_ssm_parameter" "ws_port" {
  name        = "/${var.project_name}/ws-port"
  description = "WebSocket port for ClawTrap"
  type        = "String"
  value       = tostring(var.ws_port)

  tags = {
    Name = "${local.name_prefix}-ws-port"
  }
}

resource "aws_ssm_parameter" "aws_region" {
  name        = "/${var.project_name}/aws-region"
  description = "AWS region for ClawTrap"
  type        = "String"
  value       = var.aws_region

  tags = {
    Name = "${local.name_prefix}-aws-region"
  }
}
