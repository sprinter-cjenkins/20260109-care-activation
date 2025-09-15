resource "aws_db_subnet_group" "care-activation-dev-subnet-group" {
  name       = "care-activation-${terraform.workspace}-subnet-group"
  subnet_ids = module.networking.ids.private_subnet_ids
  tags = {
    Name        = "care-activation-${terraform.workspace}-subnet-group"
    Environment = "dev"
  }
}

resource "aws_security_group" "rds_sg" {
  name        = "care-activation-${terraform.workspace}-rds-sg"
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
    Name        = "care-activation-${terraform.workspace}-rds-sg"
    Environment = terraform.workspace
  }
}

