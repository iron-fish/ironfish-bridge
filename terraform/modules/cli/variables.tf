variable "environment_name" {
  default = "ironfish-bridge-cli"
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

variable "command" {
  description = "CLI command to run"
  type        = string
}
