terraform {
  backend "s3" {
    bucket       = "care-activation-dev-terraform"
    key          = "dev/terraform.tfstate"
    region       = "us-west-2"
    encrypt      = true
    use_lockfile = true
  }

  required_version = "~> 1.11.4"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.97"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.7.2"
    }
    tls = {
      source = "hashicorp/tls"
      version = "4.1.0"
    }
  }
}
