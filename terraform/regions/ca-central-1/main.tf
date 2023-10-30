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


// the value below should correspond to instance connect for the region(s) you are deploying to
// https://docs.aws.amazon.com/vpc/latest/userguide/aws-ip-ranges.html
variable "ec2_instance_connect_cidr" {
  default = "35.183.92.176/29"
}

variable "api_token" {
  default = "test"
}

variable "bridge_address" {
  default = "4446bf78457d7b256f16b645fa0a3d4212c32b493de90ad920521f89808d022a"
}

variable "incoming_view_key" {
  default = "a72c04ddb2cbe87f1f4fe1eee6b7cac64a43316285de48f793c238bbb0793707"
}

variable "outgoing_view_key" {
  default = "42fe52470af73cde0c82236381d4d21aa9eaba6de14352f8aeb194b730a0d68c"
  
}

variable "rpc_auth_token" {
  default = "d3893f3acb07511796fae3c198e84883db8b3c8fdd819096cdfa90dcbe36055e"
}

variable "api_name" {
  default = "ironfish-bridge-api"
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
  aws_efs                           = module.aws.efs_ironfish
  aws_route53_zone                  = module.aws.route53_zone_ironfish
  aws_subnet_private                = module.aws.subnet_ironfish_private
  aws_vpc                           = module.aws.vpc_ironfish
  environment_name                  = "${var.bridge_name}-node"
  node_name                         = "${var.bridge_name}-node"
  instance_type                     = "t3.small"
  rpc_allowed_cidr_blocks           = ["0.0.0.0/0"]
  rpc_auth_token                    = var.rpc_auth_token
  network_id                        = 1
  instance_connect_cidrs            = [var.ec2_instance_connect_cidr]

}


module "relay" {
  source                            = "../../modules/cli"
  aws_route53_zone                  = module.aws.route53_zone_ironfish
  aws_subnet_private                = module.aws.subnet_ironfish_private
  aws_vpc                           = module.aws.vpc_ironfish
  environment_name                  = "${var.bridge_name}-relay"
  instance_type                     = "t3.small"
  instance_connect_cidrs            = [var.ec2_instance_connect_cidr]
  // hardcoding endpoint instead of ${module.api.endpoint_url} because of circular dependency
  // forcing install of linux nodejs binary, not installing automatically
  command                           = "npm i && npm i @ironfish/rust-nodejs-linux-x64-gnu && npm start -- relay --endpoint=http://${var.api_name}.${var.az}.elasticbeanstalk.com --token=${var.api_token} --incomingViewKey=${var.incoming_view_key} --outgoingViewKey=${var.outgoing_view_key} --address=${var.bridge_address} --rpc.auth=${var.rpc_auth_token}"
}

module "release" {
  source                            = "../../modules/cli"
  aws_route53_zone                  = module.aws.route53_zone_ironfish
  aws_subnet_private                = module.aws.subnet_ironfish_private
  aws_vpc                           = module.aws.vpc_ironfish
  environment_name                  = "${var.bridge_name}-release"
  instance_type                     = "t3.small"
  instance_connect_cidrs            = [var.ec2_instance_connect_cidr]
  // hardcoding endpoint instead of ${module.api.endpoint_url} because of circular dependency
  // forcing install of linux nodejs binary, not installing automatically
  command                           = "npm i && npm i @ironfish/rust-nodejs-linux-x64-gnu && npm start -- release --endpoint=http://${var.api_name}.${var.az}.elasticbeanstalk.com --token=${var.api_token} --rpc.auth=${var.rpc_auth_token}"
}


module "api" {
  source = "../../modules/api"

  # Application and region
  environment_name = var.api_name
  aws_region           = "ca-central-1"
  aws_route53_zone                  = module.aws.route53_zone_ironfish
  aws_subnet_private                = module.aws.subnet_ironfish_private
  aws_vpc                           = module.aws.vpc_ironfish
  ingress_security_groups           = [module.relay.security_group, module.release.security_group]
  instance_type                     = "t3.small"

  # API ENV Variables
  DB_NAME                                    = "ironfish_bridge"
  DB_USER                                    = "ironfish"
  DB_PASSWORD                                = "ironfish"
  GRAPHILE_CONCURRENCY                       = 10
  IRONFISH_BRIDGE_ADDRESS                    = var.bridge_address
  IRONFISH_BRIDGE_API_KEY                    = var.api_token
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
