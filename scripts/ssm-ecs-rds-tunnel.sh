#!/usr/bin/env bash
# File: ssm-ecs-rds-tunnel.sh
# Description: Unified ECS Exec or RDS SSM connection helper.
# Usage:
#   ./ssm-ecs-rds-tunnel.sh ecs
#   ./ssm-ecs-rds-tunnel.sh rds [LOCAL_PORT]
#
# Dependencies: awscli, jq, nc, and either mysql cli or docker 

set -euo pipefail

MODE="${1:-rds}"           # Default mode is rds
LOCAL_PORT="${2:-3306}"    # Used only for RDS mode
export AWS_PROFILE=ca

# -----------------------------------------------------
# --- ECS EXEC MODE ---
# -----------------------------------------------------
if [[ "$MODE" == "ecs" ]]; then
  CLUSTER_NAME="care-activation-dev"
  CONTAINER_NAME="care-activation-dev"

  echo "Listing running tasks in cluster $CLUSTER_NAME..."
  TASKS=($(aws ecs list-tasks --cluster "$CLUSTER_NAME" --query "taskArns[]" --output text))

  if [ ${#TASKS[@]} -eq 0 ]; then
    echo "No running tasks found in cluster $CLUSTER_NAME."
    exit 1
  fi

  echo "Available tasks:"
  for i in "${!TASKS[@]}"; do
    echo "$((i+1))) ${TASKS[$i]}"
  done

  # Prompt user for selection
  read -rp "Select a task number: " TASK_NUM
  TASK_ID="${TASKS[$((TASK_NUM-1))]}"
  echo "Using task: $TASK_ID"

  echo "Starting ECS Exec session into container $CONTAINER_NAME..."
  aws ecs execute-command \
    --cluster "$CLUSTER_NAME" \
    --task "$TASK_ID" \
    --container "$CONTAINER_NAME" \
    --interactive \
    --command "/bin/sh"

# -----------------------------------------------------
# --- RDS SSM MODE ---
# -----------------------------------------------------
elif [[ "$MODE" == "rds" ]]; then
  REMOTE_PORT=3306
  EC2_TAG_NAME="care-activation-dev-ssm-ec2"
  RDS_INSTANCE_ID="care-activation-dev-mysql-db"
  SECRET_ID="dev/care-activation-mysql-credentials"

  echo "Finding EC2 instance by tag: $EC2_TAG_NAME..."
  EC2_INSTANCE_ID=$(aws ec2 describe-instances \
    --filters "Name=tag:Name,Values=$EC2_TAG_NAME" "Name=instance-state-name,Values=running" \
    --query "Reservations[0].Instances[0].InstanceId" --output text)

  if [[ -z "$EC2_INSTANCE_ID" || "$EC2_INSTANCE_ID" == "None" ]]; then
    echo "No running EC2 instance found with tag Name=$EC2_TAG_NAME"
    exit 1
  fi
  echo "Found EC2 instance: $EC2_INSTANCE_ID"

  echo "Finding RDS endpoint for $RDS_INSTANCE_ID..."
  RDS_ENDPOINT=$(aws rds describe-db-instances \
    --filters "Name=db-instance-id,Values=$RDS_INSTANCE_ID" \
    --query "DBInstances[0].Endpoint.Address" --output text)

  if [[ -z "$RDS_ENDPOINT" || "$RDS_ENDPOINT" == "None" ]]; then
    echo "No RDS instance found with ID $RDS_INSTANCE_ID"
    exit 1
  fi
  echo "Found RDS endpoint: $RDS_ENDPOINT"

  echo "Starting SSM port forwarding session..."
  aws ssm start-session \
    --target "$EC2_INSTANCE_ID" \
    --document-name AWS-StartPortForwardingSessionToRemoteHost \
    --parameters "host=${RDS_ENDPOINT},portNumber=${REMOTE_PORT},localPortNumber=${LOCAL_PORT}" &
  SESSION_PID=$!

  trap "echo 'Stopping SSM session...'; kill $SESSION_PID" EXIT

  echo "Waiting for localhost:$LOCAL_PORT to be ready..."
  while ! nc -z 127.0.0.1 "$LOCAL_PORT"; do
    sleep 1
  done

  echo "Fetching database credentials from Secrets Manager..."
  CREDS=$(aws secretsmanager get-secret-value \
    --secret-id "$SECRET_ID" \
    --query SecretString --output text)
  DB_USER=$(echo "$CREDS" | jq -r .db_username)
  DB_PASS=$(echo "$CREDS" | jq -r .db_password)

  if command -v mysql >/dev/null 2>&1; then
    echo "Connecting using local mysql client..."
    mysql -h 127.0.0.1 -P "$LOCAL_PORT" -u"$DB_USER" -p"$DB_PASS"
  else
    echo "mysql client not found, using Docker fallback..."
    docker run --rm -it \
      mysql:8 \
      mysql -h host.docker.internal -P "$LOCAL_PORT" \
      --user="$DB_USER" --password="$DB_PASS" "db_test"
  fi
  unset DB_USER DB_PASS

else
  echo "Invalid mode. Use: ecs or rds"
  exit 1
fi
