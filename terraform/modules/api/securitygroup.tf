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

  ingress {
    from_port   = var.PORT
    to_port     = var.PORT
    protocol    = "tcp"
    security_groups = [var.ingress_security_group.id]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    security_groups = [var.ingress_security_group.id]
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
    from_port   = 5432  # Change if using a different DB or port
    to_port     = 5432
    protocol    = "tcp"
    security_groups = [aws_security_group.ironfish_api_securitygroup.id]  # Security group of EB instances
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
