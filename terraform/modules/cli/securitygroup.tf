locals {
  ALL_PROTOCOLS = "-1"
}

resource "aws_security_group" "ironfish_securitygroup" {
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
