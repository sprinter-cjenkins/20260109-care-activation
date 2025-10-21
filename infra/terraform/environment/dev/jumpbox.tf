# IAM Role for EC2 to allow SSM access
resource "aws_iam_role" "ssm_ec2_role" {
  name = "care-activation-${terraform.workspace}-ssm-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect    = "Allow",
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# Attach SSM Managed Policy
resource "aws_iam_role_policy_attachment" "ssm_managed" {
  role       = aws_iam_role.ssm_ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# EC2 instance profile
resource "aws_iam_instance_profile" "ssm_ec2_instance_profile" {
  name = "care-activation-${terraform.workspace}-ssm-instance-profile"
  role = aws_iam_role.ssm_ec2_role.name
}

# Security group for EC2 in private subnet
resource "aws_security_group" "ssm_ec2_sg" {
  name        = "care-activation-${terraform.workspace}-ssm-ec2-sg"
  description = "Private EC2 for SSM access to RDS"
  vpc_id      = module.networking.ids.vpc_id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"] # optional: allow internal SSH if needed
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "care-activation-${terraform.workspace}-ssm-ec2-sg"
    Environment = terraform.workspace
  }
}

# EC2 instance in private subnet
resource "aws_instance" "ssm_ec2" {
  ami                         = data.aws_ami.amazon_linux.id
  instance_type               = "t3.micro"
  subnet_id                   = module.networking.ids.private_subnet_ids[0]
  vpc_security_group_ids      = [aws_security_group.ssm_ec2_sg.id]
  iam_instance_profile        = aws_iam_instance_profile.ssm_ec2_instance_profile.name
  associate_public_ip_address = false
  key_name                    = "care-activation-${terraform.workspace}-ssm-key" # optional if using SSM only

  # Run install script at first boot
  user_data = <<-EOF
              #!/bin/bash
              yum update -y
              yum install -y mysql
              yum install -y git
              # Add any other packages you need here
              EOF
  tags = {
    Name        = "care-activation-${terraform.workspace}-ssm-ec2"
    Environment = terraform.workspace
  }
  lifecycle {
    ignore_changes = [
      user_data,
      ami
    ]
  }
}

# Data source for latest Amazon Linux 2 AMI
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}
