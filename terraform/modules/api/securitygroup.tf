locals {
  ALL_PROTOCOLS = "-1"
}

resource "aws_security_group" "ironfish_api_securitygroup" {
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

  egress {
    protocol    = local.ALL_PROTOCOLS
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ironfish_api_lb_securitygroup" {
  name   = "eb_${var.environment_name}_lb_securitygroup"
  vpc_id = var.aws_vpc.id

  ingress {
    protocol    = "tcp"
    from_port   = 80
    to_port     = 80
    security_groups = [for security_group in var.ingress_security_groups : security_group.id]
  }

  ingress {
    protocol    = "tcp"
    from_port   = 443
    to_port     = 443
    security_groups =  [for security_group in var.ingress_security_groups : security_group.id]
  }

  egress {
    protocol    = local.ALL_PROTOCOLS
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "rds_sg" {
  name        = "rds-sg"
  description = "Security group for RDS instance"
  vpc_id      = var.aws_vpc.id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    security_groups = [aws_security_group.ironfish_api_securitygroup.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = local.ALL_PROTOCOLS
    cidr_blocks = ["0.0.0.0/0"]
  }
}
