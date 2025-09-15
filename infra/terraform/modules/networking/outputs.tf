output "ids" {
  value = {
    vpc_id             = aws_vpc.main.id
    public_subnet_ids  = [for k, s in aws_subnet.subnet : s.id if can(regex("^public", k))]
    private_subnet_ids = [for k, s in aws_subnet.subnet : s.id if can(regex("^private", k))]
    private_rt_id      = { for k, rt in aws_route_table.private_rt : k => rt.id }
    public_rt_id       = { for k, rt in aws_route_table.public_rt : k => rt.id }
    vpc_endpoint_id    = try(aws_vpc_endpoint.vpc_endpoint[0].id, null) #"ID of the DynamoDB VPC Endpoint"
  }
}

output "arns" {
  value = {
    vpc_arn = aws_vpc.main.arn
  }
}
