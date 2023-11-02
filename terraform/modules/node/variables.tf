variable "aws_route53_zone" {
  description = "The hosted zone in route53"
  type = object({
    name_servers = list(string)
    zone_id      = string
  })
}

variable "aws_subnet_private" {
  description = "The public subnet of the VPC"
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

variable "bootstrap_node" {
  description = "Address of the network's bootstrap node. If empty, the node is started without a bootstrap node"
  type = object({
    override = bool
    value    = string
  })
  default = {
    override = false
    value    = ""
  }
}

variable "network_id" {
  description = "Network which the node should connect to"
  type        = number
  default     = -1
}

variable "environment_name" {
  description = "Name of the Elastic Beanstalk environment"
  type        = string
}

variable "app_image" {
  description = "Docker image to run on the node"
  type        = string
  default     = null
}

variable "command" {
  description = "Override to start the node with a command other than 'start'"
  type        = string
  default     = "start"
}

variable "listen_port" {
  description = "Port exposed by the docker image to redirect traffic to"
  type        = number
  default     = 9033
}

variable "mem_limit" {
  description = "The maximum amount of memory the node should be allowed to use. Sets mem_limit in docker_compose"
  type        = string
  default     = ""
}

variable "node_name" {
  description = "The name passed to the -n flag of the start command. Ignored if the command is not 'start'"
  type        = string
  default     = ""
}

variable "rpc_allowed_cidr_blocks" {
  description = "Address to connect to via RPC"
  type        = list(string)
  default     = []
}

variable "rpc_allowed_security_groups" {
  description = "Address to connect to via RPC"
  type        = list(string)
  default     = []
}

variable "rpc_port" {
  description = "Port exposed by the docker image to redirect traffic to"
  type        = number
  default     = 8020
}

variable "rpc_host" {
  description = "Address to connect to via RPC"
  type        = string
  default     = "0.0.0.0"
}

variable "rpc_auth_token" {
  description = "RPC Auth Token to connect to rpc"
  type        = string
  default     = ""
}

variable "instance_type" {
  description = "EC2 instance type to run the node on"
  type        = string
  default     = "t3.small"
}

variable "aws_efs" {
  description = "The AWS EFS to store files on"
  type = object({
    id = string
  })
}


# EC2_INSTANCE_CONNECT from us-east-1 and us-west-1 and eu-central-1
# From AWS IP Ranges: https://docs.aws.amazon.com/general/latest/gr/aws-ip-ranges.html
# Used to let AWS web based SSH sessions work
variable "instance_connect_cidrs" {
  description = "CIDR block to allow EC2 instance connect from"
  type        = list(string)
  default     = ["35.183.92.176/29"]
}


# Need to do this so external modules can explicitly pass null and have the
# default used here
locals {
  app_image = coalesce(var.app_image, "ghcr.io/iron-fish/ironfish:latest")
}
