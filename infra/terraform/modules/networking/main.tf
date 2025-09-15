# Virtual Private Cloud (VPC)
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = var.enable_dns_support
  enable_dns_hostnames = var.enable_dns_hostnames

  tags = merge(var.tags, {
    Name = "${var.resource_name}-${var.environment}-vpc"
  })
}

# Subnet for Virtual Private Cloud (VPC)
resource "aws_subnet" "subnet" {
  for_each = var.subnets

  vpc_id                  = aws_vpc.main.id
  cidr_block              = each.value.cidr_block
  availability_zone       = each.value.availability_zone
  map_public_ip_on_launch = each.value.map_public_ip_on_launch

  tags = merge(
    var.tags,
    each.value.tags,
    {
      Name = "${var.resource_name}-${var.environment}-${each.key}"
    }
  )
}

# Internet Gateway (IGW) for Virtual Private Cloud (VPC)
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id

  tags = merge(var.tags, {
    Name = "${var.resource_name}-${var.environment}-internet-gateway"
  })
}

# Public Route Table
resource "aws_route_table" "public_rt" {
  for_each = {
    for subnet_key, subnet in var.subnets : subnet_key => subnet
    if startswith(subnet_key, "public")
  }

  vpc_id = aws_vpc.main.id

  tags = merge(var.tags, {
    Name = "${var.resource_name}-${var.environment}-${each.key}-rt"
  })
}

# Public Route in Each Public Route Table
resource "aws_route" "internet" {
  for_each = aws_route_table.public_rt

  route_table_id         = each.value.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.igw.id
}

# Public Route Table Associations (For Subnets with 'public' Role)
resource "aws_route_table_association" "public_rta" {
  for_each = {
    for subnet_key, subnet in aws_subnet.subnet :
    subnet_key => subnet
    if can(regex("public", subnet_key))
  }

  subnet_id      = each.value.id
  route_table_id = aws_route_table.public_rt[each.key].id
}

# Private Route Table
resource "aws_route_table" "private_rt" {
  for_each = {
    for subnet_key, subnet in var.subnets : subnet_key => subnet
    if startswith(subnet_key, "private")
  }

  vpc_id = aws_vpc.main.id

  tags = merge(var.tags, {
    Name = "${var.resource_name}-${var.environment}-${each.key}-rt"
  })
}

# Private Route Table Associations (For Subnets with 'private' Role)
resource "aws_route_table_association" "private_rta" {
  for_each = {
    for subnet_key, subnet in aws_subnet.subnet :
    subnet_key => subnet
    if can(regex("private", subnet_key))
  }

  subnet_id      = each.value.id
  route_table_id = aws_route_table.private_rt[each.key].id
}

# Elastic IP for the NAT Gateway
resource "aws_eip" "nat_eip" {
  for_each = {
    for subnet_key, subnet in var.subnets :
    subnet_key => subnet
    if startswith(subnet_key, "private")
  }

  domain = "vpc" # Specify domain as "vpc" for VPC-based EIP

  tags = merge(var.tags, {
    Name = "${var.resource_name}-${var.environment}-${each.key}-nat-eip"
  })
}

# NAT Gateway in the first available Public Subnet
resource "aws_nat_gateway" "nat" {
  for_each = {
    for subnet_key, subnet in var.subnets :
    subnet_key => subnet
    if startswith(subnet_key, "private")
  }

  allocation_id = aws_eip.nat_eip[each.key].id

  subnet_id = aws_subnet.subnet[
    # Find a public subnet in the same AZ
    [for pub_key, pub_subnet in var.subnets :
      pub_key if startswith(pub_key, "public") && pub_subnet.availability_zone == each.value.availability_zone
    ][0]
  ].id

  tags = merge(var.tags, {
    Name = "${var.resource_name}-${var.environment}-private-nat-gateway-${each.key}"
  })
}

# Update Route Table for Private Subnets to Route Traffic to the NAT Gateway
resource "aws_route" "nat_route" {
  for_each = aws_route_table.private_rt

  route_table_id         = each.value.id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.nat[each.key].id
}

# AWS PrivateLink Integration with AWS Compatible Services
resource "aws_vpc_endpoint" "vpc_endpoint" {
  for_each = var.enable_aws_vpc_endpoint ? var.aws_vpc_endpoint : {}

  vpc_id            = aws_vpc.main.id
  service_name      = each.value.service_name
  vpc_endpoint_type = each.value.vpc_endpoint_type

  route_table_ids = values({ for k, rt in aws_route_table.private_rt : k => rt.id })

  tags = merge(
    var.tags,
    each.value.tags,
    {
      Name = "${var.resource_name}-${var.environment}-${each.key}-endpoint"
    }
  )
}
