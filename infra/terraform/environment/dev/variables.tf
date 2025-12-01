# variable "aws_region" {
#   description = "AWS region to deploy resources"
#   type        = string
#   default     = "us-west-2"
# }
#
# variable "aws_profile" {
#   description = "AWS CLI profile to use"
#   type        = string
#   default     = null
# }
#
# variable "environment" {
#   description = "Deployment environment"
#   type        = string
#   default     = "dev"
# }

variable "resource_name" {
  description = "Name of the resources"
  type        = string
  default     = "care-activation"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.10.0.0/16"
}
