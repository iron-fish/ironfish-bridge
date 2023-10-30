
resource "aws_vpc" "ironfish" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "ironfish-bridge-vps"
  }
}

# Internet Gateway for the public subnet
resource "aws_internet_gateway" "ironfish" {
  vpc_id = aws_vpc.ironfish.id
}

# Route the public subnet traffic through the IGW
resource "aws_route" "internet_access" {
  route_table_id         = aws_vpc.ironfish.main_route_table_id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.ironfish.id
}
