resource "aws_efs_file_system" "ironfish" {
  creation_token                  = "ironfish"
  throughput_mode                 = "provisioned"
  provisioned_throughput_in_mibps = 80
}

resource "aws_efs_mount_target" "ironfish_private" {
  for_each = { for subnet in aws_subnet.ironfish_private : subnet.id => subnet }

  file_system_id  = aws_efs_file_system.ironfish.id
  security_groups = [aws_security_group.ironfish_efs.id]
  subnet_id       = each.value.id
}