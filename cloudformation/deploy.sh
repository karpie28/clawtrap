#!/bin/bash
set -e

STACK_NAME="${STACK_NAME:-clawtrap-production}"
REGION="${AWS_REGION:-us-east-2}"
ENVIRONMENT="${ENVIRONMENT:-production}"
DESIRED_COUNT="${DESIRED_COUNT:-10}"
GITHUB_ORG="${GITHUB_ORG:-karpie28}"
GITHUB_REPO="${GITHUB_REPO:-clawtrap}"

echo "Deploying ClawTrap Fargate stack..."
echo "  Stack: $STACK_NAME"
echo "  Region: $REGION"
echo "  Environment: $ENVIRONMENT"
echo "  Container count: $DESIRED_COUNT"
echo "  GitHub: $GITHUB_ORG/$GITHUB_REPO"
echo ""

aws cloudformation deploy \
  --template-file "$(dirname "$0")/fargate.yaml" \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    Environment="$ENVIRONMENT" \
    DesiredCount="$DESIRED_COUNT" \
    GitHubOrg="$GITHUB_ORG" \
    GitHubRepo="$GITHUB_REPO" \
  --tags \
    Project=clawtrap \
    Environment="$ENVIRONMENT"

echo ""
echo "Stack deployed successfully!"
echo ""

# Get outputs
echo "=== Stack Outputs ==="
echo ""

ROLE_ARN=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`GitHubActionsRoleArn`].OutputValue' \
  --output text)

ECR_REPO=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`ECRRepository`].OutputValue' \
  --output text)

echo "GitHub Actions Role ARN (add to GitHub Secrets as AWS_ROLE_ARN):"
echo "  $ROLE_ARN"
echo ""
echo "ECR Repository:"
echo "  $ECR_REPO"
echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Add AWS_ROLE_ARN to GitHub Secrets:"
echo "   Go to: https://github.com/$GITHUB_ORG/$GITHUB_REPO/settings/secrets/actions"
echo "   Add: AWS_ROLE_ARN = $ROLE_ARN"
echo ""
echo "2. Push your Docker image:"
echo "   aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_REPO"
echo "   cd honeypot && docker buildx build --platform linux/arm64 -t $ECR_REPO:latest --push ."
echo ""
echo "3. Or just push to main branch to trigger GitHub Actions deployment"
echo ""
echo "To get public IPs after deployment:"
aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query 'Stacks[0].Outputs[?OutputKey==`GetPublicIPsCommand`].OutputValue' \
  --output text
