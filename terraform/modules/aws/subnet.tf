data "aws_availability_zones" "available" {
}

resource "aws_subnet" "ironfish_private" {
  count             = 2
  cidr_block        = cidrsubnet(aws_vpc.ironfish.cidr_block, 4, 2+count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  vpc_id            = aws_vpc.ironfish.id
  tags = {
    Name = "ironfish_private_${count.index}"
  }
}
