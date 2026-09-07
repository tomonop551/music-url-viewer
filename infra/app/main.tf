terraform {
  required_version = ">= 1.10, < 2.0"
  backend "s3" {}
  required_providers {
    aws     = { source = "hashicorp/aws", version = ">= 6.37, < 7.0" }
    archive = { source = "hashicorp/archive", version = "~> 2.7" }
  }
}

provider "aws" {
  region = var.region
  default_tags { tags = { Project = var.name, ManagedBy = "Terraform" } }
}

data "aws_caller_identity" "current" {}
