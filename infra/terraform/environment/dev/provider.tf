provider "aws" {
  region = "us-west-2"

  default_tags {
    tags = {
      Project     = "Care Activation"
      Environment = terraform.workspace
      Owner       = "SRE Team - sre@sprinterhealth.com"
      ManagedBy   = "Terraform"
      CostCenter  = "General"
    }
  }
}

