resource "aws_db_subnet_group" "main" {
  name       = "${var.environment_name}-subnet-group"
  subnet_ids = [for subnet in var.aws_subnet_private : subnet.id]
}
