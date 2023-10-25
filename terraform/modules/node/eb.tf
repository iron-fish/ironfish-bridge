resource "aws_elastic_beanstalk_application" "ironfish_nodes" {
  name = "ironfish-nodes"
}

resource "aws_elastic_beanstalk_environment" "ironfish_node" {
  application         = aws_elastic_beanstalk_application.ironfish_nodes.name
  name                = var.environment_name
  cname_prefix        = var.environment_name
  solution_stack_name = "64bit Amazon Linux 2 v3.6.3 running Docker"

  tier                   = "WebServer"
  version_label          = aws_elastic_beanstalk_application_version.ironfish_node_version.name
  wait_for_ready_timeout = "20m"

  setting {
    namespace = "aws:elasticbeanstalk:environment"
    name      = "EnvironmentType"
    value     = "SingleInstance"
  }

  setting {
    namespace = "aws:elasticbeanstalk:environment"
    name      = "ServiceRole"
    value     = aws_iam_role.service.name
  }

  # The docs below claim this isn't used, but we'll turn it off anyway
  # https://docs.amazonaws.cn/en_us/elasticbeanstalk/latest/dg/command-options-specific.html
  setting {
    namespace = "aws:elasticbeanstalk:environment:proxy"
    name      = "ProxyServer"
    value     = "none"
  }

  setting {
    namespace = "aws:ec2:instances"
    name      = "InstanceTypes"
    value     = var.instance_type
  }

  setting {
    namespace = "aws:ec2:vpc"
    name      = "VPCId"
    value     = var.aws_vpc.id
  }

  setting {
    namespace = "aws:ec2:vpc"
    name      = "Subnets"
    value     = join(",", [for i in var.aws_subnet_private : i.id])
  }

  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "IamInstanceProfile"
    value     = aws_iam_instance_profile.ec2.name
  }

  setting {
    namespace = "aws:autoscaling:launchconfiguration"
    name      = "SecurityGroups"
    value     = aws_security_group.ironfish_node_securitygroup.id
  }
}
