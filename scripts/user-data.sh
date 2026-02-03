#!/bin/bash
set -euo pipefail

# ClawTrap EC2 Bootstrap Script
# This script is run on first boot via EC2 user data

# Variables injected by Terraform
AWS_REGION="${aws_region}"
ECR_REPO_URL="${ecr_repo_url}"
S3_BUCKET="${s3_bucket}"
HTTP_PORT="${http_port}"
WS_PORT="${ws_port}"
PROJECT_NAME="${project_name}"

# Logging
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
echo "Starting ClawTrap bootstrap at $(date)"

# Update system
echo "Updating system packages..."
dnf update -y

# Install Docker
echo "Installing Docker..."
dnf install -y docker

# Start and enable Docker
systemctl start docker
systemctl enable docker

# Add ec2-user to docker group
usermod -aG docker ec2-user

# Install AWS CLI v2 (should already be present on AL2023)
if ! command -v aws &> /dev/null; then
    echo "Installing AWS CLI..."
    dnf install -y awscli
fi

# Create application directory
mkdir -p /opt/clawtrap
chown ec2-user:ec2-user /opt/clawtrap

# Create logs directory
mkdir -p /opt/clawtrap/logs
chown ec2-user:ec2-user /opt/clawtrap/logs

# Create environment file
cat > /opt/clawtrap/.env << EOF
NODE_ENV=production
CLAWTRAP_HTTP_PORT=$HTTP_PORT
CLAWTRAP_WS_PORT=$WS_PORT
CLAWTRAP_LOG_BACKEND=s3
CLAWTRAP_S3_BUCKET=$S3_BUCKET
AWS_REGION=$AWS_REGION
EOF

chown ec2-user:ec2-user /opt/clawtrap/.env

# Create ECR login script
cat > /opt/clawtrap/ecr-login.sh << 'EOFLOGIN'
#!/bin/bash
set -euo pipefail
AWS_REGION="${1:-us-east-2}"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com"
EOFLOGIN

chmod +x /opt/clawtrap/ecr-login.sh
chown ec2-user:ec2-user /opt/clawtrap/ecr-login.sh

# Create deployment script
cat > /opt/clawtrap/deploy.sh << EOFDEPLOY
#!/bin/bash
set -euo pipefail

ECR_REPO_URL="$ECR_REPO_URL"
CONTAINER_NAME="clawtrap"

echo "Logging into ECR..."
/opt/clawtrap/ecr-login.sh "$AWS_REGION"

echo "Pulling latest image..."
docker pull "\$ECR_REPO_URL:latest"

echo "Stopping existing container (if any)..."
docker stop "\$CONTAINER_NAME" 2>/dev/null || true
docker rm "\$CONTAINER_NAME" 2>/dev/null || true

echo "Starting new container..."
docker run -d \\
    --name "\$CONTAINER_NAME" \\
    --restart unless-stopped \\
    --env-file /opt/clawtrap/.env \\
    -p $HTTP_PORT:$HTTP_PORT \\
    -p $WS_PORT:$WS_PORT \\
    -v /opt/clawtrap/logs:/app/logs \\
    "\$ECR_REPO_URL:latest"

echo "Container started successfully"
docker ps | grep "\$CONTAINER_NAME"
EOFDEPLOY

chmod +x /opt/clawtrap/deploy.sh
chown ec2-user:ec2-user /opt/clawtrap/deploy.sh

# Create systemd service
cat > /etc/systemd/system/clawtrap.service << EOFSERVICE
[Unit]
Description=ClawTrap Honeypot Container
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/opt/clawtrap/deploy.sh
ExecStop=/usr/bin/docker stop clawtrap
User=root
Group=root

[Install]
WantedBy=multi-user.target
EOFSERVICE

# Reload systemd
systemctl daemon-reload

# Enable service (but don't start - no image yet)
systemctl enable clawtrap.service

# Create health check script
cat > /opt/clawtrap/health-check.sh << 'EOFHEALTH'
#!/bin/bash
if docker ps | grep -q clawtrap; then
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${CLAWTRAP_HTTP_PORT:-443}/health 2>/dev/null || echo "000")
    if [ "$HTTP_STATUS" = "200" ]; then
        echo "healthy"
        exit 0
    fi
fi
echo "unhealthy"
exit 1
EOFHEALTH

chmod +x /opt/clawtrap/health-check.sh
chown ec2-user:ec2-user /opt/clawtrap/health-check.sh

echo "ClawTrap bootstrap completed at $(date)"
echo "Run 'sudo systemctl start clawtrap' after pushing an image to ECR"
