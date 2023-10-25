#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "Applying: AWS"
terraform apply -compact-warnings -auto-approve -target module.aws.aws_route53_zone.ironfish
terraform apply -compact-warnings -auto-approve -target module.aws.aws_subnet.ironfish_private_az
terraform apply -compact-warnings -auto-approve -target module.aws

echo "Applying: All"
terraform apply -compact-warnings -auto-approve
