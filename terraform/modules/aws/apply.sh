#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "Initializing providers"
terraform init

echo "Apply aws_route53_zone.ironfish"
terraform apply -compact-warnings -auto-approve -target aws_route53_zone.ironfish

echo "Apply aws_subnet.ironfish_private_az"
terraform apply -compact-warnings -auto-approve -target aws_subnet.ironfish_private_az

echo "Apply ALL"
terraform apply -compact-warnings -auto-approve
