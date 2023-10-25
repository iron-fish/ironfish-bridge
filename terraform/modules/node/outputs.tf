data "aws_instance" "ironfish_instance" {
  instance_id = aws_elastic_beanstalk_environment.ironfish_node.instances[0]
}

output "public_address" {
  value = aws_elastic_beanstalk_environment.ironfish_node.cname
}

output "private_address" {
  value = data.aws_instance.ironfish_instance.private_dns
}

output "rpc_port" {
  value = var.rpc_port
}

output "security_group" {
  value = aws_security_group.ironfish_node_securitygroup
}
