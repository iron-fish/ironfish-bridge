output "vpc_ironfish" {
  value = aws_vpc.ironfish
}

output "subnet_ironfish_private" {
  value = aws_subnet.ironfish_private
}

output "route53_zone_ironfish" {
  value = aws_route53_zone.ironfish
}
