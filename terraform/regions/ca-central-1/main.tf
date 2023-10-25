terraform {
  required_version = ">= 0.13"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "3.75.1"
    }
  }
}

variable "az" {
  default = "ca-central-1"
}

variable "bridge_name" {
  default = "ironfish-bridge-node"
}

provider "aws" {
  shared_credentials_file = "$HOME/.aws/credentials"
  profile                 = "default"
  region                  = var.az
}

module "aws" {
  source = "../../modules/aws"
  vpc_cidr = "10.8.0.0/16"
  az = var.az
}

module "node" {
  source                            = "../../modules/node"
  aws_route53_zone                  = module.aws.route53_zone_ironfish
  aws_subnet_private                = module.aws.subnet_ironfish_private
  aws_vpc                           = module.aws.vpc_ironfish
  aws_efs                           = module.aws.efs_ironfish
  environment_name                  = var.bridge_name
  node_name                         = var.bridge_name
  instance_type                     = "t3.small"
  rpc_allowed_cidr_blocks           = ["0.0.0.0/0"]
  network_id                        = 1
  // the value below should correspond to instance connect for the region(s) you are deploying to
  // https://docs.aws.amazon.com/vpc/latest/userguide/aws-ip-ranges.html
  instance_connect_cidrs            = ["35.183.92.176/29"]
}
