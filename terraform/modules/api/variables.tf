variable "environment_name" {
  default = "ironfish-bridge-api"
  type = string
}

variable "aws_region" {
    default = "ca-central-1"
    type = string 
}

variable "aws_route53_zone" {
  description = "The hosted zone in route53"
  type = object({
    name_servers = list(string)
    zone_id      = string
  })
}

variable "aws_subnet_private" {
  description = "The private subnet of the VPC"
  type        = list(object({ id = string }))
  default     = []
}

variable "aws_vpc" {
  description = "The AWS VPC to put the node in"
  type = object({
    id         = string
    cidr_block = string
  })
}

variable "ingress_security_group" {
    description = "Security group to allow ingress from"
    type = object({
        id = string
    })
}

variable "instance_type" {
  description = "EC2 instance type to run the node on"
  type        = string
  default     = "t3.small"
}


# EC2_INSTANCE_CONNECT from us-east-1 and us-west-1 and eu-central-1
# From AWS IP Ranges: https://docs.aws.amazon.com/general/latest/gr/aws-ip-ranges.html
# Used to let AWS web based SSH sessions work
variable "instance_connect_cidrs" {
  description = "CIDR block to allow EC2 instance connect from"
  type        = list(string)
  default     = ["35.183.92.176/29"]
}



// for environment variables in the api application

variable "DB_NAME" {
    default = "ironfish_bridge"
    type = string
}

variable "DB_USER" {
    default = "ironfish"
    type = string
}

variable "DB_PASSWORD" {
    default = "ironfish"
    type = string
}

variable "GRAPHILE_CONCURRENCY" {
  description = "Concurrency level for Graphile"
  type        = number
  default     = 10
}

variable "IRONFISH_BRIDGE_ADDRESS" {
  description = "IronFish bridge address"
  type        = string
  default     = "test"
}

variable "IRONFISH_BRIDGE_API_KEY" {
  description = "API key for the IronFish bridge"
  type        = string
  default     = "test"
}

variable "NODE_ENV" {
  description = "Node environment"
  type        = string
  default     = "development"
}

variable "REFRESH_WIRON_TRANSFERS_PERIOD_MINUTES" {
  description = "Refresh period for WIRON transfers in minutes"
  type        = number
  default     = 2
}

variable "REFRESH_TEST_USDC_TRANSFERS_PERIOD_MINUTES" {
  description = "Refresh period for test USDC transfers in minutes"
  type        = number
  default     = 2
}

variable "TEST_USDC_DEPLOYER_PRIVATE_KEY" {
  description = "Private key for test USDC deployer"
  type        = string
  default     = "test"
}

variable "TEST_USDC_DEPOSIT_ADDRESS" {
  description = "Deposit address for test USDC"
  type        = string
  default     = "test"
}

variable "TEST_USDC_FINALITY_HEIGHT_RANGE" {
  description = "Finality height range for test USDC"
  type        = number
  default     = 10
}

variable "TEST_USDC_QUERY_HEIGHT_RANGE" {
  description = "Query height range for test USDC"
  type        = number
  default     = 100
}

variable "WIRON_DEPLOYER_PRIVATE_KEY" {
  description = "Private key for WIRON deployer"
  type        = string
  default     = "test"
}

variable "WIRON_DEPOSIT_ADDRESS" {
  description = "Deposit address for WIRON"
  type        = string
  default     = "test"
}

variable "WIRON_FINALITY_HEIGHT_RANGE" {
  description = "Finality height range for WIRON"
  type        = number
  default     = 10
}

variable "WIRON_QUERY_HEIGHT_RANGE" {
  description = "Query height range for WIRON"
  type        = number
  default     = 100
}
