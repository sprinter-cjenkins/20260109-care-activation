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
resource "aws_iam_role" "rds_monitoring_role" {

  name = "rds-monitoring-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action = "sts:AssumeRole",
        Effect = "Allow",
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_policy_attachment" "rds_monitoring_attachment" {

  name       = "rds-monitoring-attachment"
  roles      = [aws_iam_role.rds_monitoring_role.name]
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

resource "aws_db_instance" "dev_mysql" {
  identifier                            = "care-activation-${terraform.workspace}-mysql-db"
  engine                                = "mysql"
  engine_version                        = "8.0"
  instance_class                        = "db.x2g.large"
  allocated_storage                     = 60
  username                              = local.db_username
  password                              = local.db_password
  db_subnet_group_name                  = aws_db_subnet_group.care-activation-dev-subnet-group.name
  skip_final_snapshot                   = true
  publicly_accessible                   = false
  multi_az                              = false
  storage_type                          = "gp3"
  backup_retention_period               = 7
  deletion_protection                   = false
  auto_minor_version_upgrade            = true
  delete_automated_backups              = true
  iam_database_authentication_enabled   = true
  network_type                          = "IPV4"
  parameter_group_name                  = aws_db_parameter_group.care-activation-dev-mysql-ssl.name
  database_insights_mode                = "advanced"
  performance_insights_retention_period = 465
  performance_insights_kms_key_id       = aws_kms_key.care-activation-mysql-dev-kms-key.arn
  performance_insights_enabled          = true
  monitoring_interval                   = 60
  monitoring_role_arn                   = aws_iam_role.rds_monitoring_role.arn
  storage_encrypted                     = true
  kms_key_id                            = aws_kms_key.care-activation-mysql-dev-kms-key.arn

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
