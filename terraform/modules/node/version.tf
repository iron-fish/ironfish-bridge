data "archive_file" "deployment_bundle" {
  type        = "zip"
  output_path = "${path.module}/deployment_bundle_${var.environment_name}.zip"

  source {
    content = templatefile("${path.module}/deployment/docker-compose.yml.tpl", {
      app_image               = local.app_image
      command                 = var.command
      listen_port             = var.listen_port
      mem_limit               = var.mem_limit
      node_name               = var.node_name
      rpc_host                = var.rpc_host
      rpc_port                = var.rpc_port
      rpc_auth_token          = var.rpc_auth_token
      override_bootstrap_node = var.bootstrap_node.override
      bootstrap_node          = var.bootstrap_node.value
      network_id              = var.network_id
      datadir                 = var.environment_name
    })
    filename = "docker-compose.yml"
  }

  source {
    content = templatefile("${path.module}/deployment/.ebextensions/01-storage-efs-mountfilesystem.config.tpl", {
      file_system_id  = var.aws_efs.id
      mount_directory = "/efs"
    })
    filename = ".ebextensions/01-storage-efs-mountfilesystem.config"
  }
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

resource "aws_elastic_beanstalk_application_version" "ironfish_node_version" {
  name        = "${var.environment_name}-${data.archive_file.deployment_bundle.output_md5}"
  application = aws_elastic_beanstalk_application.ironfish_nodes.name
  description = "Application version created by Terraform"
  bucket      = aws_s3_bucket.deployment_bundle_bucket.id
  key         = aws_s3_bucket_object.deployment_bundle_bucket_object.id
}
