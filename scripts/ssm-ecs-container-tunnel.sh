#!/bin/bash

export AWS_PROFILE=ca

# Configuration - update these values
CLUSTER_NAME="care-activation-dev"
CONTAINER_NAME="care-activation-dev"

# List running tasks
echo "Listing running tasks in cluster $CLUSTER_NAME..."
TASKS=$(aws ecs list-tasks --cluster "$CLUSTER_NAME" --query "taskArns[]" --output text)

if [ -z "$TASKS" ]; then
  echo "No running tasks found in cluster $CLUSTER_NAME."
  exit 1
fi

echo "Available tasks:"
echo "$TASKS"

# Pick the first task (change logic if you want to pick manually)
TASK_ID=$(echo $TASKS | awk '{print $1}')

echo "Using task: $TASK_ID"

# Execute into the container
echo "Starting ECS Exec session into container $CONTAINER_NAME..."
aws ecs execute-command \
  --cluster "$CLUSTER_NAME" \
  --task "$TASK_ID" \
  --container "$CONTAINER_NAME" \
  --interactive \
  --command "/bin/sh"
