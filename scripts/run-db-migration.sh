#!/bin/bash
set -e

# Configuration
CLUSTER="${ECS_CLUSTER:-care-activation-dev}"
TASK_DEFINITION="${MIGRATION_TASK_DEF:-care-activation-dev-migration}"
REGION="${AWS_REGION:-us-east-1}"
MAX_WAIT_TIME=300  # 5 minutes
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"  # Optional: set in environment

# These should be extracted from Terraform or passed as env vars
SUBNETS="${MIGRATION_SUBNETS:-}"
SECURITY_GROUPS="${MIGRATION_SECURITY_GROUPS:-}"

# Function to send Slack alert
send_slack_alert() {
  local message="$1"
  if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -X POST "$SLACK_WEBHOOK_URL" \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"$message\"}" \
      --silent --show-error || echo "⚠️  Failed to send Slack alert"
  fi
}

# Validate required parameters
if [ -z "$SUBNETS" ] || [ -z "$SECURITY_GROUPS" ]; then
  echo "❌ Error: MIGRATION_SUBNETS and MIGRATION_SECURITY_GROUPS must be set"
  echo ""
  echo "Example:"
  echo "  export MIGRATION_SUBNETS='subnet-xxx,subnet-yyy,subnet-zzz'"
  echo "  export MIGRATION_SECURITY_GROUPS='sg-xxx,sg-yyy'"
  exit 1
fi

echo "🗄️  Running database migrations for $CLUSTER..."
echo "📍 Region: $REGION"
echo "📋 Task Definition: $TASK_DEFINITION"

# Run the migration task
echo "🚀 Starting migration task..."
TASK_ARN=$(aws ecs run-task \
  --cluster "$CLUSTER" \
  --task-definition "$TASK_DEFINITION" \
  --launch-type FARGATE \
  --region "$REGION" \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SECURITY_GROUPS],assignPublicIp=DISABLED}" \
  --query 'tasks[0].taskArn' \
  --output text 2>&1)

if [ -z "$TASK_ARN" ] || [[ "$TASK_ARN" == *"error"* ]]; then
  echo "❌ Failed to start migration task: $TASK_ARN"
  send_slack_alert "🚨 Failed to start database migration for $CLUSTER"
  exit 1
fi

echo "✓ Migration task started: $TASK_ARN"
echo "📊 CloudWatch Logs: https://console.aws.amazon.com/cloudwatch/home?region=$REGION#logsV2:log-groups/log-group//ecs/care-activation-dev-migrations"
echo ""

# Wait for task to complete
ELAPSED=0
echo "⏳ Waiting for migration to complete..."
while [ $ELAPSED -lt $MAX_WAIT_TIME ]; do
  TASK_STATUS=$(aws ecs describe-tasks \
    --cluster "$CLUSTER" \
    --tasks "$TASK_ARN" \
    --region "$REGION" \
    --query 'tasks[0].lastStatus' \
    --output text)
  
  if [ "$TASK_STATUS" == "STOPPED" ]; then
    # Check exit code
    EXIT_CODE=$(aws ecs describe-tasks \
      --cluster "$CLUSTER" \
      --tasks "$TASK_ARN" \
      --region "$REGION" \
      --query 'tasks[0].containers[0].exitCode' \
      --output text)
    
    STOP_REASON=$(aws ecs describe-tasks \
      --cluster "$CLUSTER" \
      --tasks "$TASK_ARN" \
      --region "$REGION" \
      --query 'tasks[0].stoppedReason' \
      --output text)
    
    echo ""
    if [ "$EXIT_CODE" == "0" ]; then
      echo "✅ Migrations completed successfully!"
      send_slack_alert "✅ Database migrations completed successfully for $CLUSTER"
      exit 0
    else
      echo "❌ Migration failed!"
      echo "   Exit Code: $EXIT_CODE"
      echo "   Reason: $STOP_REASON"
      echo ""
      echo "📝 Check logs for details:"
      echo "   https://console.aws.amazon.com/cloudwatch/home?region=$REGION#logsV2:log-groups/log-group//ecs/care-activation-dev-migrations"
      
      send_slack_alert "🚨 Database migration FAILED for $CLUSTER (exit code: $EXIT_CODE). Check CloudWatch logs."
      
      exit 1
    fi
  fi
  
  # Progress indicator
  if [ $((ELAPSED % 30)) -eq 0 ]; then
    echo "   Still running... ($ELAPSED/$MAX_WAIT_TIME seconds)"
  fi
  
  sleep 10
  ELAPSED=$((ELAPSED + 10))
done

echo ""
echo "⏱️  Migration timed out after $MAX_WAIT_TIME seconds"
send_slack_alert "⚠️ Database migration timed out for $CLUSTER after $MAX_WAIT_TIME seconds"
exit 1