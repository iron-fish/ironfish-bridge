#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "Planning: AWS"
terraform apply -compact-warnings -auto-approve -target module.aws.aws_route53_zone.ironfish
terraform apply -compact-warnings -auto-approve -target module.aws.aws_subnet.ironfish_private_az
terraform apply -compact-warnings -auto-approve -target module.aws

echo "Planning: All"
terraform apply -compact-warnings -auto-approve
