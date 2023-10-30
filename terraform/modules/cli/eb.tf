resource "aws_elastic_beanstalk_application" "api" {
  name = var.environment_name
}

resource "aws_elastic_beanstalk_environment" "api" {
  name                = aws_elastic_beanstalk_application.api.name
  cname_prefix        = var.environment_name
  application         = aws_elastic_beanstalk_application.api.name
  version_label       = aws_elastic_beanstalk_application_version.ironfish_version.name
  solution_stack_name = "64bit Amazon Linux 2 v5.8.7 running Node.js 18"

  tier                   = "WebServer"
  wait_for_ready_timeout = "20m"

  setting {
    namespace = "aws:elasticbeanstalk:environment"
    name      = "EnvironmentType"
    value     = "SingleInstance"
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
    value     = aws_security_group.ironfish_securitygroup.id
  }

}

# AWS S3 bucket to store the application versions
resource "aws_s3_bucket" "eb_bucket" {
  bucket = "eb-${var.environment_name}-bucket"
}

