variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-2"
}

variable "environment" {
  description = "Environment name (e.g., production, staging)"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "clawtrap"
}

# GitHub OIDC Configuration
variable "github_org" {
  description = "GitHub organization or username"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
}

# EC2 Configuration
variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}

variable "ssh_allowed_cidr" {
  description = "CIDR block allowed for SSH access (your IP). Use 0.0.0.0/0 with caution or rely on SSM only."
  type        = string
  default     = "0.0.0.0/32" # Default blocks all SSH - use SSM instead
}

variable "enable_ssh" {
  description = "Enable SSH access (port 22). Set to false to use SSM only."
  type        = bool
  default     = false
}

# Application Configuration
variable "http_port" {
  description = "HTTP port for the honeypot"
  type        = number
  default     = 443
}

variable "ws_port" {
  description = "WebSocket port for the honeypot"
  type        = number
  default     = 18789
}

# S3 Log Configuration
variable "log_retention_days" {
  description = "Number of days to retain logs in S3"
  type        = number
  default     = 90
}

# Optional: Key pair for SSH access
variable "key_name" {
  description = "EC2 key pair name for SSH access (optional if using SSM only)"
  type        = string
  default     = null
}
