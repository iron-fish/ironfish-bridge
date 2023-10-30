
data "archive_file" "deployment_bundle" {
  type        = "zip"
  source_dir  = "../../../api"
  output_path = "${path.module}/deployment_bundle_${var.environment_name}.zip"
  excludes    = ["node_modules"] 
}

resource "aws_s3_bucket" "deployment_bundle_bucket" {
  bucket = "eb-${var.environment_name}-deployment"
}

resource "aws_s3_bucket_object" "deployment_bundle_bucket_object" {
  key    = "deployment_bundle_${var.environment_name}.zip"
  bucket = aws_s3_bucket.deployment_bundle_bucket.id
  source = data.archive_file.deployment_bundle.output_path
  etag   = data.archive_file.deployment_bundle.output_md5
}

resource "aws_elastic_beanstalk_application_version" "ironfish_api_version" {
  name        = "${var.environment_name}-${data.archive_file.deployment_bundle.output_md5}"
  application = aws_elastic_beanstalk_application.api.name
  description = "Application version created by Terraform"
  bucket      = aws_s3_bucket.deployment_bundle_bucket.id
  key         = aws_s3_bucket_object.deployment_bundle_bucket_object.id
}