
variable "az" {
  default = "ca-central-1"
}
// the value below should correspond to instance connect for the region(s) you are deploying to
// https://docs.aws.amazon.com/vpc/latest/userguide/aws-ip-ranges.html
variable "ec2_instance_connect_cidr" {
  default = "35.183.92.176/29"
}

variable "api_instance_type" {
  default = "t3.small"
}

variable "relay_instance_type" {
  default = "t3.small"
}

variable "node_instance_type" {
  default = "t3.small"
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

variable "rpc_allowed_cidr_blocks" {
  default = ["0.0.0.0/0"]
}

// naming of elastic beanstalk applications

variable "api_name" {
  default = "ironfish-bridge-api"
}

variable "node_name" {
  default = "ironfish-bridge-node"
}

variable "relay_name" {
  default = "ironfish-bridge-relay"
}

variable "node_command" {
  default = "start"
}

variable "bootstrap_node" {
  default = {
    override = false
    value = ""
  }
}

variable "network_id" {
  default = 1
}

# API ENV variables

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
