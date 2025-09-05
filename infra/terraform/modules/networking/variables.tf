variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
}

variable "tags" {
  description = "A map of tags to apply to all resources"
  type        = map(string)
  default     = {}
}
variable "resource_name" {
  description = "Base name for the resources"
  type        = string
}
variable "environment" {
  description = "Deployment environment"
  type        = string
}
variable "subnets" {
  description = "A map of subnets to create with their CIDR blocks, availability zones, and other properties"
  type = map(object({
    cidr_block              = string
    availability_zone       = string
    map_public_ip_on_launch = bool
    tags                    = optional(map(string), {})
  }))
  default = {}
}

variable "enable_aws_vpc_endpoint" {
  type    = bool
  default = false
}

variable "aws_vpc_endpoint" {
  description = "Flexible map of VPC endpoints to create."
  type = map(object({
    # "Review to select the correct AWS Service that integrates with AWS PrivateLink https://docs.aws.amazon.com/vpc/latest/privatelink/aws-services-privatelink-support.html"
    service_name = string
    # "The type of VPC endpoint. Can be 'Gateway' or 'Interface'."
    vpc_endpoint_type = string
    tags              = optional(map(string))
  }))
}

variable "enable_dns_support" {
  type    = bool
  default = true
}

variable "enable_dns_hostnames" {
  type    = bool
  default = true
}
