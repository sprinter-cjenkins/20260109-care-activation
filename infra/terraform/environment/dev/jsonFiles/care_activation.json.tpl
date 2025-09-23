[
  {
    "name": "care-activation",
    "image": "${image_url}",
    "essential": true,
    "memory": 1024,
    "cpu": 512,
    "portMappings": [
      {
        "containerPort": ${container_port},
        "protocol": "tcp"
      }
    ],
    "environment": ${jsonencode(environment)}
  }
]
