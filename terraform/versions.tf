terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Recommended: Use S3 backend for team collaboration
  # backend "s3" {
  #   bucket         = "your-terraform-state-bucket"
  #   key            = "clawtrap/terraform.tfstate"
  #   region         = "us-east-2"
  #   encrypt        = true
  #   dynamodb_table = "terraform-locks"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "ClawTrap"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
