
resource "aws_elastic_beanstalk_application" "api" {
  name = var.environment_name
}

resource "aws_elastic_beanstalk_environment" "api" {
  name                = aws_elastic_beanstalk_application.api.name
  cname_prefix        = var.environment_name
  application         = aws_elastic_beanstalk_application.api.name
  version_label       = aws_elastic_beanstalk_application_version.ironfish_api_version.name
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
    value     = aws_security_group.ironfish_api_securitygroup.id
  }

  # Example for DATABASE_URL, replace with actual values or Terraform variables

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "PORT"
    value     = 8080
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "DATABASE_CONNECTION_POOL_URL"
    value     = "postgres://${var.DB_USER}:${var.DB_PASSWORD}@${aws_db_instance.db.endpoint}/${var.DB_NAME}"
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "DATABASE_URL"
    value     = "postgres://${var.DB_USER}:${var.DB_PASSWORD}@${aws_db_instance.db.endpoint}/${var.DB_NAME}"
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "GRAPHILE_CONCURRENCY"
    value     = var.GRAPHILE_CONCURRENCY
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "IRONFISH_BRIDGE_ADDRESS"
    value     = var.IRONFISH_BRIDGE_ADDRESS
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "IRONFISH_BRIDGE_API_KEY"
    value     = var.IRONFISH_BRIDGE_API_KEY
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "NODE_ENV"
    value     = var.NODE_ENV
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "REFRESH_WIRON_TRANSFERS_PERIOD_MINUTES"
    value     = var.REFRESH_WIRON_TRANSFERS_PERIOD_MINUTES
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "REFRESH_TEST_USDC_TRANSFERS_PERIOD_MINUTES"
    value     = var.REFRESH_TEST_USDC_TRANSFERS_PERIOD_MINUTES
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "TEST_USDC_DEPLOYER_PRIVATE_KEY"
    value     = var.TEST_USDC_DEPLOYER_PRIVATE_KEY
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "TEST_USDC_DEPOSIT_ADDRESS"
    value     = var.TEST_USDC_DEPOSIT_ADDRESS
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "TEST_USDC_FINALITY_HEIGHT_RANGE"
    value     = var.TEST_USDC_FINALITY_HEIGHT_RANGE
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "TEST_USDC_QUERY_HEIGHT_RANGE"
    value     = var.TEST_USDC_QUERY_HEIGHT_RANGE
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "WIRON_DEPLOYER_PRIVATE_KEY"
    value     = var.WIRON_DEPLOYER_PRIVATE_KEY
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "WIRON_DEPOSIT_ADDRESS"
    value     = var.WIRON_DEPOSIT_ADDRESS
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "WIRON_FINALITY_HEIGHT_RANGE"
    value     = var.WIRON_FINALITY_HEIGHT_RANGE
  }

  setting {
    namespace = "aws:elasticbeanstalk:application:environment"
    name      = "WIRON_QUERY_HEIGHT_RANGE"
    value     = var.WIRON_QUERY_HEIGHT_RANGE
  }

}

# AWS S3 bucket to store the application versions
resource "aws_s3_bucket" "eb_bucket" {
  bucket = "eb-${var.environment_name}-bucket"
}

