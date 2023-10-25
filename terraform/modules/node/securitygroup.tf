locals {
  ALL_PROTOCOLS = "-1"
}

resource "aws_security_group" "ironfish_node_securitygroup" {
  name   = "eb_${var.environment_name}_securitygroup"
  vpc_id = var.aws_vpc.id

  ingress {
    protocol  = "tcp"
    from_port = 22
    to_port   = 22

    # EC2_INSTANCE_CONNECT from us-east-1 and us-west-1 and eu-central-1
    # From AWS IP Ranges: https://docs.aws.amazon.com/general/latest/gr/aws-ip-ranges.html
    # Used to let AWS web based SSH sessions work
    cidr_blocks = var.instance_connect_cidrs
  }

  dynamic "ingress" {
    for_each = var.command == "start" && var.rpc_port != 0 && length(var.rpc_allowed_cidr_blocks) != 0 ? [1] : []
    content {
      protocol    = "tcp"
      from_port   = var.rpc_port
      to_port     = var.rpc_port
      cidr_blocks = var.rpc_allowed_cidr_blocks
    }
  }

  dynamic "ingress" {
    for_each = var.command == "start" && var.rpc_port != 0 && length(var.rpc_allowed_security_groups) != 0 ? [1] : []
    content {
      protocol        = "tcp"
      from_port       = var.rpc_port
      to_port         = var.rpc_port
      security_groups = var.rpc_allowed_security_groups
    }
  }

  egress {
    protocol    = local.ALL_PROTOCOLS
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }
}
