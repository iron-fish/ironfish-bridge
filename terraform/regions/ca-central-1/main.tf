terraform {
  required_version = ">= 0.13"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "3.75.1"
    }
  }
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
  bootstrap_node                    = var.bootstrap_node
  network_id                        = var.network_id
  environment_name                  = var.node_name
  node_name                         = var.node_name
  instance_type                     = var.node_instance_type
  rpc_allowed_cidr_blocks           = var.rpc_allowed_cidr_blocks
  rpc_auth_token                    = var.rpc_auth_token
  instance_connect_cidrs            = [var.ec2_instance_connect_cidr]
  command                           = var.node_command
}


module "relay" {
  source                            = "../../modules/cli"
  aws_route53_zone                  = module.aws.route53_zone_ironfish
  aws_subnet_private                = module.aws.subnet_ironfish_private
  aws_vpc                           = module.aws.vpc_ironfish
  environment_name                  = var.relay_name
  instance_type                     = var.relay_instance_type
  instance_connect_cidrs            = [var.ec2_instance_connect_cidr]
  // hardcoding endpoint instead of ${module.api.endpoint_url} because of circular dependency
  // forcing install of linux nodejs binary, not installing automatically
  command                           = "npm i && npm i @ironfish/rust-nodejs-linux-x64-gnu && npm start -- relay --endpoint=http://${var.api_name}.${var.az}.elasticbeanstalk.com --token=${var.api_token} --incomingViewKey=${var.incoming_view_key} --outgoingViewKey=${var.outgoing_view_key} --address=${var.bridge_address} --rpc.tcp --rpc.auth=${var.rpc_auth_token} --rpc.tcp.host=${var.node_name}.${var.az}.elasticbeanstalk.com"
}

module "api" {
  source                            = "../../modules/api"

  # Application and region
  environment_name                  = var.api_name
  aws_region                        = var.az
  aws_route53_zone                  = module.aws.route53_zone_ironfish
  aws_subnet_private                = module.aws.subnet_ironfish_private
  aws_vpc                           = module.aws.vpc_ironfish
  ingress_security_groups           = [module.relay.security_group]
  instance_type                     = var.api_instance_type

  # API ENV Variables
  DB_NAME                                    = var.DB_NAME
  DB_USER                                    = var.DB_USER
  DB_PASSWORD                                = var.DB_PASSWORD
  GRAPHILE_CONCURRENCY                       = var.GRAPHILE_CONCURRENCY
  IRONFISH_BRIDGE_ADDRESS                    = var.IRONFISH_BRIDGE_ADDRESS
  IRONFISH_BRIDGE_API_KEY                    = var.IRONFISH_BRIDGE_API_KEY
  NODE_ENV                                   = var.NODE_ENV
  REFRESH_WIRON_TRANSFERS_PERIOD_MINUTES     = var.REFRESH_WIRON_TRANSFERS_PERIOD_MINUTES
  REFRESH_TEST_USDC_TRANSFERS_PERIOD_MINUTES = var.REFRESH_TEST_USDC_TRANSFERS_PERIOD_MINUTES
  TEST_USDC_DEPLOYER_PRIVATE_KEY             = var.TEST_USDC_DEPLOYER_PRIVATE_KEY
  TEST_USDC_DEPOSIT_ADDRESS                  = var.TEST_USDC_DEPOSIT_ADDRESS
  TEST_USDC_FINALITY_HEIGHT_RANGE            = var.TEST_USDC_FINALITY_HEIGHT_RANGE
  TEST_USDC_QUERY_HEIGHT_RANGE               = var.TEST_USDC_QUERY_HEIGHT_RANGE
  WIRON_DEPLOYER_PRIVATE_KEY                 = var.WIRON_DEPLOYER_PRIVATE_KEY
  WIRON_DEPOSIT_ADDRESS                      = var.WIRON_DEPOSIT_ADDRESS
  WIRON_FINALITY_HEIGHT_RANGE                = var.WIRON_FINALITY_HEIGHT_RANGE
  WIRON_QUERY_HEIGHT_RANGE                   = var.WIRON_QUERY_HEIGHT_RANGE
}
