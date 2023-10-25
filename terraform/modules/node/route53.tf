resource "aws_route53_record" "eb_bootstrap_route53_record" {
  count = var.dns_subdomain == "" ? 0 : 1

  zone_id = var.aws_route53_zone.zone_id
  name    = var.dns_subdomain
  type    = "CNAME"
  ttl     = "300"
  records = [aws_elastic_beanstalk_environment.ironfish_node.cname]
}
