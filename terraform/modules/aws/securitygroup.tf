locals {
  ALL_PROTOCOLS = "-1"
}

resource "aws_security_group" "ironfish_efs" {
  name   = "ironfish_securitygroup_efs"
  vpc_id = aws_vpc.ironfish.id

  ingress {
    protocol    = local.ALL_PROTOCOLS
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    protocol    = local.ALL_PROTOCOLS
    from_port   = 0
    to_port     = 0
    cidr_blocks = ["0.0.0.0/0"]
  }
}

