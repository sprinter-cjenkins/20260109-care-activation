#!/usr/bin/env bash
# File: ssm-rds-auto-connect.sh
# Usage: ./ssm-rds-auto-connect.sh [LOCAL_PORT]

#set -euo pipefail

if [[ $USERNAME == "cjenkins" ]]; then
  export AWS_PROFILE=ca
else
  echo "Not Mr. Jenkins"
fi

LOCAL_PORT="${1:-3306}"
REMOTE_PORT=3306
EC2_TAG_NAME="care-activation-dev-ssm-ec2"
RDS_INSTANCE_ID="care-activation-dev-mysql-db"
SECRET_ID="dev/care-activation-mysql-credentials"

# --- Find EC2 instance by Name tag ---
EC2_INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=$EC2_TAG_NAME" "Name=instance-state-name,Values=running" \
  --query "Reservations[0].Instances[0].InstanceId" --output text)

if [[ -z "$EC2_INSTANCE_ID" || "$EC2_INSTANCE_ID" == "None" ]]; then
  echo "No running EC2 instance found with tag Name=$EC2_TAG_NAME"
  #exit 1
fi
echo "Found EC2 instance: $EC2_INSTANCE_ID"

# --- Find RDS endpoint ---
RDS_ENDPOINT=$(aws rds describe-db-instances \
  --filters "Name=db-instance-id,Values=$RDS_INSTANCE_ID" \
  --query "DBInstances[0].Endpoint.Address" --output text)

if [[ -z "$RDS_ENDPOINT" || "$RDS_ENDPOINT" == "None" ]]; then
  echo "No RDS instance found with ID $RDS_INSTANCE_ID"
  #exit 1
fi
echo "Found RDS endpoint: $RDS_ENDPOINT"

# --- Start SSM port forwarding in background ---
SESSION_PID=""
cleanup() {
  if [[ -n "$SESSION_PID" ]]; then
    echo "Stopping SSM session..."
    kill "$SESSION_PID"
  fi
}
trap cleanup EXIT

echo "Starting SSM port forwarding session..."
aws ssm start-session \
  --target "$EC2_INSTANCE_ID" \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters "host=${RDS_ENDPOINT},portNumber=${REMOTE_PORT},localPortNumber=${LOCAL_PORT}" &
SESSION_PID=$!

# --- Wait for local port to be open ---
echo "Waiting for localhost:$LOCAL_PORT to be ready..."
while ! nc -z 127.0.0.1 "$LOCAL_PORT"; do
  sleep 1
done


# --- Check if mysql CLI is installed ---
MYSQL_BIN=$(command -v mysql || true)

# --- Fetch credentials securely ---
CREDS=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ID" \
  --query SecretString --output text)

DB_USER=$(echo "$CREDS" | jq -r .db_username)
DB_PASS=$(echo "$CREDS" | jq -r .db_password)

# --- Connect using mysql locally OR via Docker ---
if [[ -n "$MYSQL_BIN" ]]; then
  echo "Connecting with local mysql client..."
  mysql -h 127.0.0.1 -P "$LOCAL_PORT" -u"$DB_USER" -p"$DB_USER"
else
  echo "mysql client not found, falling back to Docker..."
  docker run --rm -it \
    mysql:8 \
    mysql -h host.docker.internal -P "$LOCAL_PORT" \
    --user="$DB_USER" --password="$DB_PASS" "db_test"
fi
unset DB_USER DB_PASS
