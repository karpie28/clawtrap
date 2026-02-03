# Security Group for ClawTrap
resource "aws_security_group" "clawtrap" {
  name        = "${local.name_prefix}-sg"
  description = "Security group for ClawTrap honeypot"

  # HTTP/HTTPS for honeypot
  ingress {
    description = "HTTP honeypot"
    from_port   = var.http_port
    to_port     = var.http_port
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # WebSocket for MCP connections
  ingress {
    description = "WebSocket MCP"
    from_port   = var.ws_port
    to_port     = var.ws_port
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # SSH access (conditional)
  dynamic "ingress" {
    for_each = var.enable_ssh ? [1] : []
    content {
      description = "SSH access"
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = [var.ssh_allowed_cidr]
    }
  }

  # Allow all outbound traffic
  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name_prefix}-sg"
  }
}

# EC2 Instance
resource "aws_instance" "clawtrap" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = var.instance_type
  iam_instance_profile   = aws_iam_instance_profile.ec2.name
  vpc_security_group_ids = [aws_security_group.clawtrap.id]
  key_name               = var.key_name

  # User data script for initial setup
  user_data = templatefile("${path.module}/../scripts/user-data.sh", {
    aws_region     = var.aws_region
    ecr_repo_url   = local.ecr_repository_url
    s3_bucket      = aws_s3_bucket.logs.id
    http_port      = var.http_port
    ws_port        = var.ws_port
    project_name   = var.project_name
  })

  # IMDSv2 only (security best practice)
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "enabled"
  }

  # Root volume
  root_block_device {
    volume_size           = 20
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true
  }

  # Enable detailed monitoring
  monitoring = true

  tags = {
    Name    = "${local.name_prefix}-honeypot"
    Project = var.project_name
  }

  # Ensure SSM agent is running before marking as created
  depends_on = [
    aws_iam_role_policy_attachment.ssm_managed
  ]
}

# Elastic IP for consistent addressing
resource "aws_eip" "clawtrap" {
  instance = aws_instance.clawtrap.id
  domain   = "vpc"

  tags = {
    Name = "${local.name_prefix}-eip"
  }
}
