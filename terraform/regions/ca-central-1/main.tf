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
  default = "ironfish-bridge"
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
  environment_name                  = "${var.bridge_name}-node"
  node_name                         = "${var.bridge_name}-node"
  instance_type                     = "t3.small"
  rpc_allowed_cidr_blocks           = ["0.0.0.0/0"]
  network_id                        = 1
  // the value below should correspond to instance connect for the region(s) you are deploying to
  // https://docs.aws.amazon.com/vpc/latest/userguide/aws-ip-ranges.html
  instance_connect_cidrs            = ["35.183.92.176/29"]
}

module "api" {
  source = "../../modules/api"

  # Application and region
  environment_name = "${var.bridge_name}-api"
  aws_region           = "ca-central-1"
  aws_route53_zone                  = module.aws.route53_zone_ironfish
  aws_subnet_private                = module.aws.subnet_ironfish_private
  aws_vpc                           = module.aws.vpc_ironfish
  ingress_security_group            = module.node.security_group
  instance_type                     = "t3.small"

  # API ENV Variables
  DB_NAME                                    = "ironfish_bridge"
  DB_USER                                    = "ironfish"
  DB_PASSWORD                                = "ironfish"
  GRAPHILE_CONCURRENCY                       = 10
  IRONFISH_BRIDGE_ADDRESS                    = "test"
  IRONFISH_BRIDGE_API_KEY                    = "test"
  NODE_ENV                                   = "development"
  REFRESH_WIRON_TRANSFERS_PERIOD_MINUTES     = 2
  REFRESH_TEST_USDC_TRANSFERS_PERIOD_MINUTES = 2
  TEST_USDC_DEPLOYER_PRIVATE_KEY             = "test"
  TEST_USDC_DEPOSIT_ADDRESS                  = "test"
  TEST_USDC_FINALITY_HEIGHT_RANGE            = 10
  TEST_USDC_QUERY_HEIGHT_RANGE               = 100
  WIRON_DEPLOYER_PRIVATE_KEY                 = "test"
  WIRON_DEPOSIT_ADDRESS                      = "test"
  WIRON_FINALITY_HEIGHT_RANGE                = 10
  WIRON_QUERY_HEIGHT_RANGE                   = 100
}
