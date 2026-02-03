# Outputs for use in GitHub Actions and manual access

output "github_actions_role_arn" {
  description = "ARN of the IAM role for GitHub Actions (add to GitHub Secrets as AWS_ROLE_ARN)"
  value       = aws_iam_role.github_actions.arn
}

output "ecr_repository_url" {
  description = "ECR repository URL for Docker images"
  value       = aws_ecr_repository.clawtrap.repository_url
}

output "ecr_repository_name" {
  description = "ECR repository name"
  value       = aws_ecr_repository.clawtrap.name
}

output "s3_bucket_name" {
  description = "S3 bucket name for logs"
  value       = aws_s3_bucket.logs.id
}

output "instance_id" {
  description = "EC2 instance ID (for SSM access)"
  value       = aws_instance.clawtrap.id
}

output "public_ip" {
  description = "Public IP address of the honeypot"
  value       = aws_eip.clawtrap.public_ip
}

output "honeypot_http_url" {
  description = "HTTP URL for the honeypot"
  value       = "https://${aws_eip.clawtrap.public_ip}:${var.http_port}"
}

output "honeypot_ws_url" {
  description = "WebSocket URL for MCP connections"
  value       = "wss://${aws_eip.clawtrap.public_ip}:${var.ws_port}"
}

output "ssm_connect_command" {
  description = "Command to connect to instance via SSM"
  value       = "aws ssm start-session --target ${aws_instance.clawtrap.id} --region ${var.aws_region}"
}

output "aws_region" {
  description = "AWS region"
  value       = var.aws_region
}
