module "networking" {
  source        = "../../modules/networking"
  resource_name = var.resource_name
  environment   = terraform.workspace
  vpc_cidr      = var.vpc_cidr

  subnets = {
    "public-subnet-1" = {
      cidr_block              = cidrsubnet(var.vpc_cidr, 8, 0)
      availability_zone       = data.aws_availability_zones.available.names[0]
      map_public_ip_on_launch = false
    }
    "public-subnet-2" = {
      cidr_block              = cidrsubnet(var.vpc_cidr, 8, 1)
      availability_zone       = data.aws_availability_zones.available.names[1]
      map_public_ip_on_launch = false
    }
    "public-subnet-3" = {
      cidr_block              = cidrsubnet(var.vpc_cidr, 8, 2)
      availability_zone       = data.aws_availability_zones.available.names[2]
      map_public_ip_on_launch = false
    }
    "private-subnet-1" = {
      cidr_block              = cidrsubnet(var.vpc_cidr, 8, 100)
      availability_zone       = data.aws_availability_zones.available.names[0]
      map_public_ip_on_launch = false
    }
    "private-subnet-2" = {
      cidr_block              = cidrsubnet(var.vpc_cidr, 8, 101)
      availability_zone       = data.aws_availability_zones.available.names[1]
      map_public_ip_on_launch = false
    }
    "private-subnet-3" = {
      cidr_block              = cidrsubnet(var.vpc_cidr, 8, 102)
      availability_zone       = data.aws_availability_zones.available.names[2]
      map_public_ip_on_launch = false
    }
  }

  enable_aws_vpc_endpoint = false # Set to true to deploy AWS VPC Endpoints; false skips deployment
  aws_vpc_endpoint        = {}
}

resource "aws_iam_role" "vpc_flow_logs_role" {
  name = "${var.resource_name}-${terraform.workspace}-flowlogs-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "vpc-flow-logs.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name        = "${var.resource_name}-${terraform.workspace}-flowlogs-role"
    Environment = terraform.workspace
  }
}

resource "aws_iam_role_policy" "vpc_flow_logs_policy" {
  name = "${var.resource_name}-${terraform.workspace}-flowlogs-policy"
  role = aws_iam_role.vpc_flow_logs_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogGroups",
          "logs:DescribeLogStreams"
        ]
        Resource = module.networking.arns.vpc_arn
      }
    ]
  })
}
