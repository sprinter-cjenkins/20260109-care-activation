resource "aws_db_subnet_group" "care-activation-dev-subnet-group" {
  name       = "care-activation-${terraform.workspace}-subnet-group"
  subnet_ids = module.networking.ids.private_subnet_ids
  tags = {
    Name        = "care-activation-${terraform.workspace}-subnet-group"
    Environment = terraform.workspace
  }
}

resource "aws_security_group" "care-activation-dev-subnet-app-rds-sg" {
  name        = "care-activation-${terraform.workspace}-app-rds-sg"
  description = "Security group for development RDS MySQL"
  vpc_id      = module.networking.ids.vpc_id

  ingress {
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.care-activation-dev-ecs-sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "care-activation-${terraform.workspace}-app-rds-sg"
    Environment = terraform.workspace
  }
}

resource "aws_security_group" "care-activation-dev-subnet-engineer-rds-sg" {
  name        = "care-activation-${terraform.workspace}-engineer-rds-sg"
  description = "Security group for development engineer RDS MySQL"
  vpc_id      = module.networking.ids.vpc_id

  ingress {
    from_port   = 3306
    to_port     = 3306
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/32"]
    description = "Ingress Temporary access from my workstation"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "care-activation-${terraform.workspace}-engineer-rds-sg"
    Environment = terraform.workspace
  }

  lifecycle {
    ignore_changes = [
      ingress,
      egress
    ]
  }
}

resource "aws_secretsmanager_secret" "care-activation-mysql-dev" {
  name        = "${terraform.workspace}/care-activation-mysql-credentials"
  description = "MySQL credentials for development database"
}

data "aws_secretsmanager_secret_version" "dev_db" {
  depends_on = [aws_secretsmanager_secret.care-activation-mysql-dev]
  secret_id  = aws_secretsmanager_secret.care-activation-mysql-dev.id
}

locals {
  db_username = jsondecode(data.aws_secretsmanager_secret_version.dev_db.secret_string).db_username
  db_password = jsondecode(data.aws_secretsmanager_secret_version.dev_db.secret_string).db_password
}

resource "aws_secretsmanager_secret" "care-activation-mysql-dev-db-string" {
  name        = "${terraform.workspace}/care-activation-mysql-connection-string"
  description = "MySQL connectionString for development database"
}

resource "aws_secretsmanager_secret_version" "care-activation-mysql-dev-version" {
  secret_id     = aws_secretsmanager_secret.care-activation-mysql-dev-db-string.id
  secret_string = "mysql://${local.db_username}:${local.db_password}@${aws_db_instance.dev_mysql.endpoint}"
}

resource "aws_kms_key" "care-activation-mysql-dev-kms-key" {
  description             = "Care Activation MySQL ${terraform.workspace} KMS key for RDS encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid    = "Allow administration of the key"
        Effect = "Allow"
        Principal = {
          AWS = [
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:user/cjenkins-ca",
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:user/jpaad-ca",
            "arn:aws:iam::${data.aws_caller_identity.current.account_id}:user/skumar-ca"
          ]
        }
        Action = [
          "kms:*"
        ]
        Resource = "*"
      },
      {
        Sid    = "Allow RDS usage of the key"
        Effect = "Allow"
        Principal = {
          Service = "rds.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_kms_alias" "care-activation-mysql-dev-kms-alias" {
  name          = "alias/rds-${terraform.workspace}-key"
  target_key_id = aws_kms_key.care-activation-mysql-dev-kms-key.id
}

resource "aws_db_parameter_group" "care-activation-dev-mysql-ssl" {
  name        = "care-activation-${terraform.workspace}-mysql8-ssl"
  family      = "mysql8.0"
  description = "MySQL 8.0 parameter group enforcing SSL connections"

  parameter {
    name  = "require_secure_transport"
    value = "0"
  }

  tags = {
    Environment = terraform.workspace
    Project     = "care-activation"
  }
}

resource "aws_db_instance" "dev_mysql" {
  identifier                          = "care-activation-${terraform.workspace}-mysql-db"
  engine                              = "mysql"
  engine_version                      = "8.0"
  instance_class                      = "db.t3.micro"
  allocated_storage                   = 20
  username                            = local.db_username
  password                            = local.db_password
  db_subnet_group_name                = aws_db_subnet_group.care-activation-dev-subnet-group.name
  skip_final_snapshot                 = true
  publicly_accessible                 = true
  multi_az                            = false
  storage_type                        = "gp3"
  backup_retention_period             = 7
  deletion_protection                 = false
  auto_minor_version_upgrade          = true
  delete_automated_backups            = true
  iam_database_authentication_enabled = true
  network_type                        = "IPV4"
  parameter_group_name                = aws_db_parameter_group.care-activation-dev-mysql-ssl.name
  #performance_insights_retention_period = 7
  #performance_insights_kms_key_id       = aws_kms_key.care-activation-mysql-dev-kms-key.arn
  #performance_insights_enabled          = true
  storage_encrypted = true
  kms_key_id        = aws_kms_key.care-activation-mysql-dev-kms-key.arn

  vpc_security_group_ids = [
    aws_security_group.care-activation-dev-subnet-app-rds-sg.id,
    aws_security_group.care-activation-dev-subnet-engineer-rds-sg.id
  ]

  tags = {
    Name        = "care-activation-${terraform.workspace}-mysql-db"
    Environment = terraform.workspace
  }
}

resource "aws_vpc_endpoint" "rds_vpc_endpoint" {
  vpc_id             = module.networking.ids.vpc_id
  service_name       = "com.amazonaws.${data.aws_region.current.name}.rds"
  vpc_endpoint_type  = "Interface"
  subnet_ids         = module.networking.ids.private_subnet_ids
  security_group_ids = [aws_security_group.rds_vpc_endpoint_sg.id]

  private_dns_enabled = true
  tags = {
    Name = "care-activation-${terraform.workspace}-rds-vpc-endpoint"
  }
}

resource "aws_security_group" "rds_vpc_endpoint_sg" {
  name        = "care-activation-${terraform.workspace}-rds-vpce-sg"
  description = "SG for ${terraform.workspace} RDS VPC Endpoint"
  vpc_id      = module.networking.ids.vpc_id

  # Ingress: allow ECS tasks to talk to RDS
  ingress {
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.care-activation-dev-ecs-sg.id]
    description     = "Allow ECS tasks access to RDS"
  }

  # Egress: allow traffic from ECS SG to RDS VPC endpoint
  egress {
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.care-activation-dev-ecs-sg.id]
    description     = "Allow outbound to ECS tasks"
  }

  # Optional: full egress for other traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name        = "care-activation-${terraform.workspace}-rds-vpce-sg"
    Environment = terraform.workspace
  }
}
